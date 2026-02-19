# Ingestion System

The ingestion pipeline populates and maintains the ShortStamp product catalog. It pulls product data from Open Beauty Facts (public API), scrapes retailer sites (Amazon, Sephora, Ulta) for product/link discovery, enriches pricing from the Walmart Affiliate Marketing API, and recalculates StampScores on a schedule.

## Architecture

```
APScheduler (UTC)
├── Open Beauty Facts   daily @ 02:00      catalog seeding
├── Retailer Scraping   every 12 hours      amazon/sephora/ulta product + link discovery
├── Walmart Prices      every 6 hours       price enrichment
└── Score Recalculation every 6 hours       StampScore refresh
```

Every job is wrapped by `run_job()` in `app/ingestion/__init__.py`, which provides:
- **DB-based locking** via the `ingestion_locks` table (no duplicate runs)
- **IngestionRun tracking** with status, duration, stats, and error stacks
- **Partial failure tolerance** — one search term failing won't abort the run

## Quick Start

```bash
cd backend
cp .env.example .env         # edit DATABASE_URL and keys
pip install -e .
alembic upgrade head          # apply migrations
python -m app.seed            # optional: seed sample data
```

### Run individual jobs manually

```bash
python -m app.ingestion.open_beauty_facts   # seed from Open Beauty Facts
python -m app.ingestion.retailer_scrape     # scrape Amazon/Sephora/Ulta product links
python -m app.ingestion.walmart_affiliate   # enrich prices from Walmart
python -m app.ingestion.score_calculator    # recalculate StampScores
```

### Enable the scheduler

Set in `.env`:
```
ENABLE_SCHEDULER=true
```

Then start the API server normally:
```bash
uvicorn app.main:app --reload
```

The scheduler starts in the server process. For multi-worker deployments
(gunicorn, etc.), also set `SINGLE_SCHEDULER_PROCESS=true` on exactly one
worker to prevent duplicate schedulers. The DB job locks provide a safety
net regardless.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | sqlite (dev only) | PostgreSQL async URL |
| `WALMART_API_KEY` | For pricing | `""` | Walmart Affiliate Marketing API key |
| `ENABLE_SCHEDULER` | No | `false` | Start APScheduler on server boot |
| `ENABLE_RETAILER_SCRAPER` | No | `false` | Enable retailer website scraping job |
| `RETAILER_SCRAPE_MAX_PAGES_PER_TERM` | No | `1` | Pages fetched per term per retailer |
| `RETAILER_SCRAPE_TERMS` | No | `""` | Optional comma-separated term override |
| `RETAILER_SCRAPE_DETAIL_ENRICH_PER_RETAILER` | No | `25` | Product detail pages fetched per retailer to enrich brand/image/price |
| `MAX_PAGES_PER_TERM` | No | `5` | OBF pages to fetch per search term |
| `PAGE_SIZE` | No | `50` | OBF results per page (max 100) |

## Getting API Keys

### Walmart Affiliate Marketing API

1. Apply at https://developer.walmart.com
2. Register for the **Affiliate Marketing API** program
3. Once approved, find your API key in the developer dashboard
4. Set `WALMART_API_KEY=your-key-here` in `.env`

If `WALMART_API_KEY` is empty, the Walmart job logs a FAILED run with
"not configured" — it never silently skips.

### Open Beauty Facts

No API key needed. The Open Beauty Facts API is public and free under
CC-BY-SA license. We set a `User-Agent` header per their usage policy.

## How Each Job Works

### Open Beauty Facts (`open_beauty_facts.py`)

1. Searches 16 cosmetics terms (foundation, concealer, primer, powder, blush, bronzer, highlighter, eyeshadow, eyeliner, mascara, lipstick, lip gloss, lip liner, setting spray, brow pencil, brow gel)
2. Paginates up to `MAX_PAGES_PER_TERM` pages x `PAGE_SIZE` results
3. For each product:
   - Upserts brand by case-insensitive name match
   - Upserts product by barcode (preferred) or (brand_id + normalized name)
   - Updates `last_seen_at` on every encounter
4. Partial failure: if one term errors, remaining terms still run
5. Stats recorded: created, updated, skipped, errors, api_calls

### Retailer Scraping (`retailer_scrape.py`)

1. Runs search pages for each configured term on:
   - `amazon.com`
   - `sephora.com`
   - `ulta.com`
2. Parses JSON-LD `Product` records when available
3. Falls back to product-link extraction by retailer URL pattern
4. Upserts:
   - `Brand`
   - `Product` (source: `<retailer>_scrape`, source_id: retailer external id)
   - `ProductPrice` (`source` = retailer slug, stores product link + price when available)
5. Stats recorded: products_created, products_updated, prices_written, candidates_seen, pages_fetched, api_errors

### Walmart Price Enrichment (`walmart_affiliate.py`)

Two matching stages:

1. **Barcode lookup** — for products with a UPC, calls Walmart Product Lookup
2. **Keyword search fallback** — if barcode misses, searches "brand + name" and scores candidates using brand match, name token overlap, and barcode confirmation

Scoring heuristic (0-100):
- +50 for exact barcode match
- +25 for brand substring match
- +25 for name token overlap

Threshold: candidates scoring < 35 are rejected.

Rate limiting: exponential backoff + jitter on 429 and 5xx responses.

### Score Recalculation (`score_calculator.py`)

Computes StampScore (0-100) from four weighted components:

| Component | Weight | Source |
|---|---|---|
| Review score | 30% | Avg rating with confidence ramp (0-50 reviews) |
| Popularity | 25% | Placeholder (50) until trend data matures |
| Ingredient | 20% | Placeholder (70) until OBF ingredients parsed |
| Value | 25% | Derived from Walmart price if available, else 60 |

Changes are logged to `stamp_score_history` with old/new scores,
component values, weights, and `score_version = "v0"`.

## Database Tables

### `ingestion_runs`
Tracks every job execution with UUID id, job_name, source, status
(STARTED/SUCCESS/FAILED/SKIPPED), stats (jsonb), error stacks, duration,
and parameters.

### `stamp_score_history`
Audit trail of score changes with UUID id, product_id, old/new scores,
score_version, components (jsonb), and weights (jsonb).

### `ingestion_locks`
Simple lock table (job_name PK, locked_at, locked_by). Stale locks
older than 2 hours are automatically cleaned up.

### `product_prices` (modified)
Added `source`, `currency`, `availability` columns. Unique constraint on
`(product_id, source)` prevents duplicate price rows per retailer.

### `products` (modified)
Added `source`, `source_id`, `walmart_item_id`, `last_seen_at`.
`upc` column now has a unique constraint.

## File Reference

```
app/ingestion/
├── __init__.py              # Job runner, DB locking, run recording
├── scheduler.py             # APScheduler job registration
├── open_beauty_facts.py     # OBF catalog ingestion
├── retailer_scrape.py       # Retailer site scraping (Amazon/Sephora/Ulta)
├── walmart_affiliate.py     # Walmart price enrichment
└── score_calculator.py      # StampScore recalculation

app/services/
├── obf_client.py            # Open Beauty Facts HTTP client
├── walmart_client.py        # Walmart API client with retry/backoff
└── stamp_score.py           # Score calculation engine

app/models/
├── ingestion.py             # IngestionRun, StampScoreHistory, IngestionLock
├── product.py               # Product, Brand, ProductPrice (modified)
└── price.py                 # Re-exports from product.py
```
