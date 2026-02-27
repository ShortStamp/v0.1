#!/usr/bin/env python3
"""One-time migration: SQLite → PostgreSQL.

Usage:
    python scripts/migrate_sqlite_to_postgres.py \\
        --sqlite backend/shortstamp.db \\
        --pg postgresql://shortstamp:shortstampdev@localhost/shortstamp

Features:
- Respects FK dependency order across all tables
- Batched INSERTs (500 rows at a time) for memory efficiency
- ON CONFLICT DO NOTHING — idempotent, safe to re-run
- Handles NULL values and JSON columns transparently
- Prints progress per table
"""

import argparse
import json
import sqlite3
import sys
from typing import Any

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("psycopg2 required: pip install psycopg2-binary")
    sys.exit(1)


# Tables in FK-safe insertion order
TABLES_IN_ORDER = [
    "brands",
    "categories",
    "category_filters",
    "products",
    "product_filter_values",
    "product_prices",
    "product_variants",
    "product_reviews",
    "users",
    "beauty_profiles",
    "builds",
    "build_slots",
    "refresh_tokens",
    "ingestion_runs",
    "ingestion_locks",
    "trends",
    "trend_products",
    # Retailer table (may not exist in all schema versions)
    "retailers",
    "price_history",
]

BATCH_SIZE = 500


def _sqlite_tables(sqlite_conn: sqlite3.Connection) -> set[str]:
    cur = sqlite_conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    )
    return {row[0] for row in cur.fetchall()}


def _sqlite_columns(sqlite_conn: sqlite3.Connection, table: str) -> list[str]:
    cur = sqlite_conn.execute(f"PRAGMA table_info({table})")
    return [row[1] for row in cur.fetchall()]


def _coerce_value(value: Any) -> Any:
    """Coerce SQLite values for PostgreSQL compatibility."""
    if isinstance(value, bytes):
        # Try JSON decode, otherwise keep as-is
        try:
            return json.loads(value.decode())
        except (json.JSONDecodeError, UnicodeDecodeError):
            return value
    if isinstance(value, str):
        # Detect JSON strings stored as text
        stripped = value.strip()
        if stripped.startswith(("{", "[")) and stripped.endswith(("}", "]")):
            try:
                return json.loads(stripped)
            except json.JSONDecodeError:
                pass
    return value


def migrate_table(
    sqlite_conn: sqlite3.Connection,
    pg_conn,
    table: str,
    existing_tables: set[str],
) -> int:
    """Migrate a single table. Returns row count migrated."""
    if table not in existing_tables:
        print(f"  [{table}] — not in SQLite, skipping")
        return 0

    columns = _sqlite_columns(sqlite_conn, table)
    if not columns:
        print(f"  [{table}] — no columns, skipping")
        return 0

    cur_sqlite = sqlite_conn.execute(f"SELECT COUNT(*) FROM {table}")
    total = cur_sqlite.fetchone()[0]
    print(f"  [{table}] — {total} rows to migrate")

    if total == 0:
        return 0

    col_list = ", ".join(f'"{c}"' for c in columns)
    placeholders = ", ".join(["%s"] * len(columns))
    conflict_clause = "ON CONFLICT DO NOTHING"
    insert_sql = (
        f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders}) {conflict_clause}'
    )

    sqlite_conn.row_factory = sqlite3.Row
    cur_read = sqlite_conn.execute(f"SELECT * FROM {table}")

    migrated = 0
    batch: list[tuple] = []

    with pg_conn.cursor() as pg_cur:
        while True:
            rows = cur_read.fetchmany(BATCH_SIZE)
            if not rows:
                break

            for row in rows:
                values = tuple(_coerce_value(row[col]) for col in columns)
                batch.append(values)

            if batch:
                try:
                    psycopg2.extras.execute_batch(pg_cur, insert_sql, batch, page_size=BATCH_SIZE)
                    migrated += len(batch)
                except Exception as exc:
                    pg_conn.rollback()
                    print(f"    ERROR in batch: {exc}")
                    # Fallback: row-by-row
                    for values in batch:
                        try:
                            pg_cur.execute(insert_sql, values)
                            migrated += 1
                        except Exception as row_exc:
                            pg_conn.rollback()
                            print(f"    Skipping row: {row_exc}")
                            pg_conn.autocommit = False
                batch.clear()

        pg_conn.commit()

    print(f"  [{table}] — migrated {migrated}/{total}")
    return migrated


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate SQLite → PostgreSQL")
    parser.add_argument("--sqlite", required=True, help="Path to SQLite DB file")
    parser.add_argument("--pg", required=True, help="PostgreSQL DSN")
    parser.add_argument(
        "--tables",
        nargs="*",
        help="Specific tables to migrate (default: all in dependency order)",
    )
    args = parser.parse_args()

    print(f"Source: {args.sqlite}")
    print(f"Target: {args.pg}")
    print()

    sqlite_conn = sqlite3.connect(args.sqlite)
    sqlite_conn.row_factory = None  # reset, we set it per table

    pg_conn = psycopg2.connect(args.pg)
    pg_conn.autocommit = False

    existing_sqlite_tables = _sqlite_tables(sqlite_conn)
    print(f"Found {len(existing_sqlite_tables)} tables in SQLite: {sorted(existing_sqlite_tables)}")
    print()

    tables_to_migrate = args.tables if args.tables else TABLES_IN_ORDER
    # Also migrate any tables not in our explicit list
    remaining = existing_sqlite_tables - set(TABLES_IN_ORDER)
    if remaining and not args.tables:
        tables_to_migrate = list(tables_to_migrate) + sorted(remaining)

    total_rows = 0
    for table in tables_to_migrate:
        count = migrate_table(sqlite_conn, pg_conn, table, existing_sqlite_tables)
        total_rows += count

    sqlite_conn.close()
    pg_conn.close()

    print()
    print(f"Migration complete. Total rows migrated: {total_rows}")


if __name__ == "__main__":
    main()
