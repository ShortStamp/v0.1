from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth_middleware import get_optional_user, require_admin
from app.models.analytics import AnalyticsEvent
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsSummary,
    CohortRow,
    DailyCount,
    LabelCount,
    QuizDistribution,
)

logger = logging.getLogger(__name__)

ALLOWED_EVENTS = frozenset(
    {
        "app_opened",
        "quiz_started",
        "quiz_completed",
        "product_added_to_build",
        "affiliate_link_clicked",
        "account_created",
        "user_login",
    }
)

# ---------------------------------------------------------------------------
# Ingest router (public — no auth required)
# ---------------------------------------------------------------------------
ingest_router = APIRouter(prefix="/analytics", tags=["analytics"])


@ingest_router.post("/event", status_code=status.HTTP_202_ACCEPTED)
async def ingest_event(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> dict[str, bool]:
    anonymous_id = str(body.get("anonymous_id", ""))[:36]
    session_id = str(body.get("session_id", ""))[:36]
    event_name = str(body.get("event_name", ""))[:100]
    properties = body.get("properties") or {}

    if event_name not in ALLOWED_EVENTS:
        raise HTTPException(status_code=422, detail=f"Unknown event: {event_name}")

    if not isinstance(properties, dict):
        properties = {}

    try:
        event = AnalyticsEvent(
            anonymous_id=anonymous_id,
            session_id=session_id,
            event_name=event_name,
            properties=properties,
            user_id=str(current_user.id) if current_user else None,
        )
        db.add(event)
        await db.commit()
    except Exception:
        logger.exception("Failed to persist analytics event")
        await db.rollback()

    return {"ok": True}


# ---------------------------------------------------------------------------
# Admin analytics router (require_admin)
# ---------------------------------------------------------------------------
admin_analytics_router = APIRouter(prefix="/admin/analytics", tags=["admin-analytics"])


@admin_analytics_router.get("/summary")
async def analytics_summary(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> AnalyticsSummary:
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    quiz_q = select(func.count()).where(AnalyticsEvent.event_name == "quiz_completed")
    quiz_result = await db.execute(quiz_q)
    quiz_completions = quiz_result.scalar_one() or 0

    sessions_q = select(func.count(AnalyticsEvent.session_id.distinct())).where(
        AnalyticsEvent.occurred_at >= thirty_days_ago
    )
    sessions_result = await db.execute(sessions_q)
    unique_sessions = sessions_result.scalar_one() or 0

    clicks_q = select(func.count()).where(
        AnalyticsEvent.event_name == "affiliate_link_clicked"
    )
    clicks_result = await db.execute(clicks_q)
    affiliate_clicks = clicks_result.scalar_one() or 0

    users_q = select(func.count(AnalyticsEvent.user_id.distinct())).where(
        AnalyticsEvent.occurred_at >= thirty_days_ago,
        AnalyticsEvent.user_id.isnot(None),
    )
    users_result = await db.execute(users_q)
    active_users_30d = users_result.scalar_one() or 0

    return AnalyticsSummary(
        quiz_completions=quiz_completions,
        unique_sessions=unique_sessions,
        affiliate_clicks=affiliate_clicks,
        active_users_30d=active_users_30d,
    )


@admin_analytics_router.get("/quiz-trend")
async def quiz_trend(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[DailyCount]:
    since = datetime.now(timezone.utc) - timedelta(days=days)

    q = (
        select(
            func.date(AnalyticsEvent.occurred_at).label("day"),
            func.count().label("cnt"),
        )
        .where(
            AnalyticsEvent.event_name == "quiz_completed",
            AnalyticsEvent.occurred_at >= since,
        )
        .group_by(func.date(AnalyticsEvent.occurred_at))
        .order_by(func.date(AnalyticsEvent.occurred_at))
    )
    result = await db.execute(q)
    rows = result.fetchall()

    by_date: dict[date, int] = {row.day: row.cnt for row in rows}
    output: list[DailyCount] = []
    for i in range(days):
        d = (datetime.now(timezone.utc) - timedelta(days=days - 1 - i)).date()
        output.append(DailyCount(day=d, count=by_date.get(d, 0)))
    return output


@admin_analytics_router.get("/quiz-distribution")
async def quiz_distribution(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> QuizDistribution:
    q = select(
        AnalyticsEvent.properties["skin_tone"].astext.label("skin_tone"),
        AnalyticsEvent.properties["finish"].astext.label("finish"),
        AnalyticsEvent.properties["coverage"].astext.label("coverage"),
    ).where(AnalyticsEvent.event_name == "quiz_completed")

    result = await db.execute(q)
    rows = result.fetchall()

    skin_tone_counts: dict[str, int] = {}
    finish_counts: dict[str, int] = {}
    coverage_counts: dict[str, int] = {}

    for row in rows:
        if row.skin_tone:
            skin_tone_counts[row.skin_tone] = skin_tone_counts.get(row.skin_tone, 0) + 1
        if row.finish:
            finish_counts[row.finish] = finish_counts.get(row.finish, 0) + 1
        if row.coverage:
            coverage_counts[row.coverage] = coverage_counts.get(row.coverage, 0) + 1

    def to_sorted(d: dict[str, int]) -> list[LabelCount]:
        return [
            LabelCount(label=k, count=v) for k, v in sorted(d.items(), key=lambda x: -x[1])
        ]

    return QuizDistribution(
        skin_tone=to_sorted(skin_tone_counts),
        finish=to_sorted(finish_counts),
        coverage=to_sorted(coverage_counts),
    )


@admin_analytics_router.get("/top-products-added")
async def top_products_added(
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[dict[str, Any]]:
    q = (
        select(
            AnalyticsEvent.properties["product_name"].astext.label("product_name"),
            AnalyticsEvent.properties["product_brand"].astext.label("product_brand"),
            func.count().label("count"),
        )
        .where(AnalyticsEvent.event_name == "product_added_to_build")
        .group_by(
            AnalyticsEvent.properties["product_name"].astext,
            AnalyticsEvent.properties["product_brand"].astext,
        )
        .order_by(func.count().desc())
        .limit(limit)
    )
    result = await db.execute(q)
    return [
        {
            "product_name": r.product_name,
            "product_brand": r.product_brand,
            "count": r.count,
        }
        for r in result.fetchall()
    ]


@admin_analytics_router.get("/top-affiliate-clicks")
async def top_affiliate_clicks(
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[dict[str, Any]]:
    q = (
        select(
            AnalyticsEvent.properties["product_id"].astext.label("product_id"),
            AnalyticsEvent.properties["retailer"].astext.label("retailer"),
            func.count().label("count"),
        )
        .where(AnalyticsEvent.event_name == "affiliate_link_clicked")
        .group_by(
            AnalyticsEvent.properties["product_id"].astext,
            AnalyticsEvent.properties["retailer"].astext,
        )
        .order_by(func.count().desc())
        .limit(limit)
    )
    result = await db.execute(q)
    return [
        {"product_id": r.product_id, "retailer": r.retailer, "count": r.count}
        for r in result.fetchall()
    ]


@admin_analytics_router.get("/category-heatmap")
async def category_heatmap(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[dict[str, Any]]:
    q = (
        select(
            AnalyticsEvent.properties["category"].astext.label("category"),
            func.count().label("count"),
        )
        .where(AnalyticsEvent.event_name == "product_added_to_build")
        .group_by(AnalyticsEvent.properties["category"].astext)
        .order_by(func.count().desc())
    )
    result = await db.execute(q)
    return [{"category": r.category, "count": r.count} for r in result.fetchall()]


@admin_analytics_router.get("/cohort")
async def cohort_retention(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[CohortRow]:
    sql = text(
        """
        WITH first_open AS (
            SELECT anonymous_id,
                   DATE_TRUNC('week', MIN(occurred_at)) AS cohort_week
            FROM analytics_events
            WHERE event_name = 'app_opened'
            GROUP BY anonymous_id
        ),
        weekly_activity AS (
            SELECT DISTINCT anonymous_id,
                   DATE_TRUNC('week', occurred_at) AS active_week
            FROM analytics_events
        ),
        cohort_size AS (
            SELECT cohort_week, COUNT(DISTINCT anonymous_id) AS total
            FROM first_open
            GROUP BY cohort_week
        ),
        retention AS (
            SELECT f.cohort_week,
                   EXTRACT(EPOCH FROM (w.active_week - f.cohort_week)) / 604800 AS week_offset,
                   COUNT(DISTINCT f.anonymous_id) AS retained
            FROM first_open f
            JOIN weekly_activity w ON f.anonymous_id = w.anonymous_id
            GROUP BY f.cohort_week, week_offset
        )
        SELECT
            r.cohort_week,
            r.week_offset,
            r.retained,
            cs.total
        FROM retention r
        JOIN cohort_size cs ON cs.cohort_week = r.cohort_week
        ORDER BY r.cohort_week DESC, r.week_offset
        LIMIT 200
        """
    )
    result = await db.execute(sql)
    rows = result.fetchall()

    cohort_map: dict[str, dict[int, int]] = {}
    cohort_total: dict[str, int] = {}
    for row in rows:
        cw = (
            row.cohort_week.date().isoformat()
            if hasattr(row.cohort_week, "date")
            else str(row.cohort_week)[:10]
        )
        offset = int(row.week_offset)
        cohort_map.setdefault(cw, {})[offset] = row.retained
        cohort_total[cw] = row.total

    output: list[CohortRow] = []
    for cw in list(sorted(cohort_map.keys(), reverse=True))[:8]:
        total = cohort_total.get(cw, 0) or 1
        data = cohort_map[cw]

        def pct(offset: int) -> int | None:
            if offset not in data:
                return None
            return round(data[offset] / total * 100)

        output.append(
            CohortRow(
                cohort_week=cw,
                w0=pct(0),
                w1=pct(1),
                w2=pct(2),
                w4=pct(4),
            )
        )

    return list(reversed(output))
