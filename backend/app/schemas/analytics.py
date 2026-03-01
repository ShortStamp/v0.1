from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel, Field


class EventIngest(BaseModel):
    anonymous_id: str = Field(..., max_length=36)
    session_id: str = Field(..., max_length=36)
    event_name: str = Field(..., max_length=100)
    properties: dict[str, Any] = Field(default_factory=dict)


class DailyCount(BaseModel):
    day: date
    count: int


class LabelCount(BaseModel):
    label: str
    count: int


class QuizDistribution(BaseModel):
    skin_tone: list[LabelCount]
    finish: list[LabelCount]
    coverage: list[LabelCount]


class AnalyticsSummary(BaseModel):
    quiz_completions: int
    unique_sessions: int
    affiliate_clicks: int
    active_users_30d: int


class CohortRow(BaseModel):
    cohort_week: str
    w0: int | None
    w1: int | None
    w2: int | None
    w4: int | None
