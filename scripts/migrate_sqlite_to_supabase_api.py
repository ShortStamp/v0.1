#!/usr/bin/env python3
"""Migrate SQLite → Supabase via Management API (no direct PostgreSQL connection needed).

Usage:
    python scripts/migrate_sqlite_to_supabase_api.py \
        --sqlite backend/shortstamp.db \
        --project-ref yftqefexrxlmugynduhz \
        --token sbp_...

Uses POST /v1/projects/{ref}/database/query for each batch.
Safe to re-run (ON CONFLICT DO NOTHING).
"""

import argparse
import json
import sqlite3
import sys
import time

try:
    import httpx
    def _http_post(url, token, payload):
        r = httpx.post(url, json=payload, headers={"Authorization": f"Bearer {token}"}, timeout=30)
        if r.is_error:
            raise RuntimeError(f"HTTP {r.status_code}: {r.text}")
        return r.json()
except ImportError:
    import urllib.request, urllib.error, ssl
    _ssl_ctx = ssl.create_default_context()
    try:
        import certifi
        _ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        _ssl_ctx.check_hostname = False
        _ssl_ctx.verify_mode = ssl.CERT_NONE

    def _http_post(url, token, payload):
        data = json.dumps(payload).encode()
        req = urllib.request.Request(url, data=data,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30, context=_ssl_ctx) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"HTTP {e.code}: {e.read().decode(errors='replace')}") from e

TABLES_IN_ORDER = [
    "brands",
    "category_groups",
    "retailers",
    "trends",
    "users",
    "categories",
    "beauty_profiles",
    "builds",
    "refresh_tokens",
    "category_filters",
    "products",
    "product_prices",
    "product_filter_values",
    "product_reviews",
    "product_variants",
    "build_slots",
    "ingestion_locks",
    "ingestion_runs",
    "stamp_score_history",
    "chemist_known_ingredients",
    "compatibility_results",
    "trend_articles",
    "trend_videos",
    "trend_products",
    "price_history",
]

SKIP_TABLES = {"alembic_version", "sqlite_sequence"}

# Rows per API request — smaller for wide tables, larger for narrow ones
BATCH_SIZES = {
    "products": 50,
    "product_prices": 100,
    "compatibility_results": 100,
    "ingestion_runs": 100,
    "stamp_score_history": 100,
    "default": 200,
}


import re as _re

def _sqlite_col_meta(sqlite_conn: sqlite3.Connection, table: str) -> dict:
    """Return {col_name: {"is_bool": bool, "max_len": int|None}} for each column."""
    rows = sqlite_conn.execute(f"PRAGMA table_info({table})").fetchall()
    meta = {}
    for row in rows:
        name, decl = row[1], (row[2] or "").lower()
        is_bool = "bool" in decl
        max_len = None
        m = _re.search(r"varchar\s*\(\s*(\d+)\s*\)", decl)
        if m:
            max_len = int(m.group(1))
        meta[name] = {"is_bool": is_bool, "max_len": max_len}
    return meta


def _sqlite_bool_cols(sqlite_conn: sqlite3.Connection, table: str) -> set:
    """Return set of column names whose declared type is BOOLEAN."""
    rows = sqlite_conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {row[1] for row in rows if "bool" in (row[2] or "").lower()}


def _coerce(value):
    """Convert SQLite value to a PostgreSQL-safe Python value."""
    if isinstance(value, bytes):
        try:
            return json.loads(value.decode())
        except Exception:
            return value.decode(errors="replace")
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.startswith(("{", "[")) and stripped.endswith(("}", "]")):
            try:
                return json.loads(stripped)
            except json.JSONDecodeError:
                pass
    return value


def _pg_literal(value, is_bool: bool = False, max_len: int | None = None) -> str:
    """Render a Python value as a PostgreSQL literal string."""
    if value is None:
        return "NULL"
    if is_bool:
        return "TRUE" if value else "FALSE"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return str(value)
    if isinstance(value, (dict, list)):
        escaped = json.dumps(value).replace("'", "''")
        return f"'{escaped}'"
    # string — truncate if column has a max length
    s = str(value)
    if max_len and len(s) > max_len:
        s = s[:max_len]
    escaped = s.replace("'", "''")
    return f"'{escaped}'"


def _run_query(api_url: str, token: str, sql: str, retries: int = 5) -> list:
    delay = 2.0
    for attempt in range(retries):
        try:
            return _http_post(api_url, token, {"query": sql})
        except RuntimeError as e:
            msg = str(e)
            if "429" in msg and attempt < retries - 1:
                print(f"\n    rate-limited, waiting {delay:.0f}s...", end="", flush=True)
                time.sleep(delay)
                delay = min(delay * 2, 30)
            else:
                raise


def migrate_table(api_url: str, token: str, sqlite_conn: sqlite3.Connection,
                  table: str, existing: set) -> int:
    if table not in existing:
        print(f"  [{table}] not in SQLite — skip")
        return 0

    cols_info = sqlite_conn.execute(f"PRAGMA table_info({table})").fetchall()
    if not cols_info:
        print(f"  [{table}] no columns — skip")
        return 0
    columns = [row[1] for row in cols_info]
    col_meta = _sqlite_col_meta(sqlite_conn, table)
    bool_cols = {c for c, m in col_meta.items() if m["is_bool"]}

    total = sqlite_conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    if total == 0:
        print(f"  [{table}] 0 rows — skip")
        return 0

    batch_size = BATCH_SIZES.get(table, BATCH_SIZES["default"])
    print(f"  [{table}] {total} rows (batch={batch_size}) ...", end="", flush=True)

    sqlite_conn.row_factory = sqlite3.Row
    cursor = sqlite_conn.execute(f"SELECT * FROM {table}")
    col_list = ", ".join(f'"{c}"' for c in columns)

    migrated = 0
    batch = []

    def flush(batch):
        nonlocal migrated
        if not batch:
            return
        values_sql = ",\n  ".join(
            "(" + ", ".join(
                _pg_literal(_coerce(row[c]), c in bool_cols, col_meta[c]["max_len"])
                for c in columns
            ) + ")"
            for row in batch
        )
        sql = f'INSERT INTO "{table}" ({col_list}) VALUES\n  {values_sql}\nON CONFLICT DO NOTHING'
        try:
            _run_query(api_url, token, sql)
            migrated += len(batch)
        except RuntimeError as e:
            print(f"\n    batch error: {e} — trying row-by-row")
            for row in batch:
                single_vals = "(" + ", ".join(
                    _pg_literal(_coerce(row[c]), c in bool_cols, col_meta[c]["max_len"])
                    for c in columns
                ) + ")"
                single_sql = f'INSERT INTO "{table}" ({col_list}) VALUES {single_vals} ON CONFLICT DO NOTHING'
                try:
                    _run_query(api_url, token, single_sql)
                    migrated += 1
                except RuntimeError as row_e:
                    print(f"\n    row skip: {row_e}")

    while True:
        rows = cursor.fetchmany(batch_size)
        if not rows:
            break
        batch.extend(rows)
        if len(batch) >= batch_size:
            flush(batch)
            batch.clear()
            print(".", end="", flush=True)
            time.sleep(0.3)

    flush(batch)
    print(f" {migrated}/{total}")
    return migrated


def main():
    parser = argparse.ArgumentParser(description="Migrate SQLite → Supabase via Management API")
    parser.add_argument("--sqlite", required=True)
    parser.add_argument("--project-ref", required=True)
    parser.add_argument("--token", required=True)
    parser.add_argument("--tables", nargs="*")
    args = parser.parse_args()

    api_url = f"https://api.supabase.com/v1/projects/{args.project_ref}/database/query"
    print(f"Source : {args.sqlite}")
    print(f"Target : {api_url}")
    print()

    sqlite_conn = sqlite3.connect(args.sqlite)
    sqlite_conn.row_factory = None

    existing = {
        r[0] for r in sqlite_conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
    }
    existing -= SKIP_TABLES
    print(f"SQLite tables: {sorted(existing)}\n")

    tables = args.tables if args.tables else TABLES_IN_ORDER
    # append any unlisted tables at the end
    remaining = existing - set(TABLES_IN_ORDER)
    if remaining and not args.tables:
        tables = list(tables) + sorted(remaining)

    total = 0
    for table in tables:
        total += migrate_table(api_url, args.token, sqlite_conn, table, existing)

    sqlite_conn.close()
    print(f"\nDone. Total rows migrated: {total}")


if __name__ == "__main__":
    main()
