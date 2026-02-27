"""Scheduled job: extract filter values for products that have none."""

from ingestion.enrichers.filters import backfill_missing_filters
from ingestion.pipeline.runner import run_job


async def run_filter_extraction() -> None:
    await run_job(
        job_name="filter_extract",
        source="filter_enricher",
        job_fn=backfill_missing_filters,
    )
