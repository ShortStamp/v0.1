# ShortStamp — Sidecar Agentic AI: Design Document

**Author:** Senior Full-Stack Engineer / AI Architect
**Date:** 2026-02-20
**Status:** Draft v1.0
**Scope:** Multi-agent compatibility analysis and trend-based recommendation system

---

## 1. Executive Summary

This document describes the architecture for a "Sidecar" Agentic AI system that augments the existing ShortStamp Makeup build flow with:

1. **Real-time ingredient conflict detection** (Chemist Agent)
2. **Aesthetic harmony scoring** based on the user's quiz/beauty profile (Artist Agent)
3. **Viral trend mapping** from social media onto the product catalog (Trend Agent)
4. **Server-Sent Events (SSE)** delivery of compatibility results as users build their set
5. **RAG (Retrieval-Augmented Generation)** over INCI ingredient lists and trend descriptions via pgvector

The system is designed as a non-blocking "sidecar": the existing product and build APIs are unchanged. The compatibility layer adds a soft-constraint overlay that the frontend can show, hide, or filter.

---

## 2. Pre-Implementation Audit Notes

> Based on analysis of the actual codebase (not the prompt's file assumptions).

| Assumption in prompt | Actual state |
|---|---|
| `/backend/api/sets.py` exists | Does **not** exist. Build management is in `/backend/app/api/builds.py` |
| pgvector installed | **Not installed**. Backend uses SQLite locally; asyncpg is a dep but not connected |
| LangGraph installed | **Not installed**. Must be added to `pyproject.toml` |
| LLM SDK present | **Not installed**. Must choose: Anthropic or OpenAI SDK |
| INCI data on products | Product model has `specs: list[str] | None (JSON)` and `description`. INCI fields must be **added** |

These gaps are addressed explicitly in the migration section (§8).

---

## 3. New File Structure

```
backend/app/
├── agents/
│   ├── __init__.py
│   ├── base_agent.py          # Abstract base, shared LLM client, retry logic
│   ├── orchestrator.py        # LangGraph state machine coordinating all three agents
│   ├── chemist_agent.py       # INCI formulation conflict analysis
│   ├── artist_agent.py        # Aesthetic harmony (skin tone/type) scoring
│   └── trend_agent.py         # Trend-catalog mapping + periodic ingestion
│
├── services/
│   ├── vector_store.py        # NEW: pgvector embedding + query helpers
│   ├── compatibility_service.py  # NEW: orchestrates agent run per build slot change
│   ├── sse_manager.py         # NEW: per-user SSE connection registry
│   ├── build_service.py       # EXISTING (unchanged)
│   ├── product_service.py     # EXISTING (unchanged)
│   ├── trend_service.py       # EXISTING — extended to feed Trend Agent
│   ├── auth_service.py        # EXISTING (unchanged)
│   ├── stamp_score.py         # EXISTING (unchanged)
│   ├── walmart_client.py      # EXISTING (unchanged)
│   └── obf_client.py          # EXISTING — extended to ingest INCI data
│
├── schemas/
│   ├── compatibility.py       # NEW: all agent I/O Pydantic models
│   ├── product.py             # EXISTING — add CompatibilityOverlay to ProductListItem
│   ├── build.py               # EXISTING — add compatibility_map to BuildSchema
│   └── [others unchanged]
│
├── models/
│   ├── product.py             # EXISTING — add inci_ingredients column + embedding FK
│   ├── compatibility.py       # NEW: CompatibilityResult DB model (cached results)
│   └── [others unchanged]
│
├── api/
│   ├── compatibility.py       # NEW: SSE stream + manual trigger endpoints
│   ├── builds.py              # EXISTING — patch set_slot to enqueue compatibility job
│   ├── products.py            # EXISTING — optionally annotate products with compat
│   └── [others unchanged]
│
└── alembic/versions/
    └── [new migration]        # Add inci_ingredients, vector embeddings, compat cache
```

**New top-level directories:**
```
backend/
├── app/                       # (existing)
└── scripts/
    └── backfill_inci.py       # One-time script to fetch INCI via OBF for existing products
```

---

## 4. Pydantic Models — Agent Communication Layer

All models live in `backend/app/schemas/compatibility.py`.

```python
# backend/app/schemas/compatibility.py
from __future__ import annotations

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Core output type — returned to the frontend
# ---------------------------------------------------------------------------

class CompatibilityResponse(BaseModel):
    """
    The canonical compatibility verdict for a single product within a build.
    Returned by any agent and aggregated by the Orchestrator.
    """
    is_compatible: bool
    reason: str = Field(
        ...,
        description="Human-readable explanation shown to the user",
        max_length=300,
    )
    severity: Literal["warning", "error"] = Field(
        ...,
        description=(
            "'error' = strong formulation conflict (e.g. silicone over water-based moisturiser). "
            "'warning' = soft mismatch (e.g. dewy finish over oily skin)."
        ),
    )
    source_agent: Literal["chemist", "artist", "trend", "orchestrator"]
    conflicting_product_ids: list[str] = Field(
        default_factory=list,
        description="Other product IDs in the build that caused this conflict",
    )


# ---------------------------------------------------------------------------
# Orchestrator — top-level I/O
# ---------------------------------------------------------------------------

class OrchestratorInput(BaseModel):
    """Passed to the LangGraph entry node."""
    build_id: str
    user_id: str
    # Full list of product IDs currently in the build (including the new one)
    product_ids: list[str]
    # The product that was just added (triggers re-evaluation of this product only)
    trigger_product_id: str | None = None


class OrchestratorOutput(BaseModel):
    """Emitted by the LangGraph terminal node."""
    build_id: str
    # Keyed by product_id. Only products with issues are included.
    compatibility_map: dict[str, CompatibilityResponse]
    evaluated_at: datetime
    overall_compatibility_score: float = Field(
        ge=0.0, le=1.0,
        description="1.0 = fully compatible, 0.0 = severe conflicts",
    )


# ---------------------------------------------------------------------------
# LangGraph shared state (passed between nodes)
# ---------------------------------------------------------------------------

class AgentState(BaseModel):
    """
    The shared mutable state object flowing through the LangGraph pipeline.
    Each agent node reads what it needs and writes its results back.
    """
    # Input
    build_id: str
    user_id: str
    product_ids: list[str]
    trigger_product_id: str | None

    # Populated by the data-fetch node before agents run
    products: list[ProductSnapshot] = Field(default_factory=list)
    beauty_profile: BeautyProfileSnapshot | None = None
    active_trends: list[TrendSnapshot] = Field(default_factory=list)

    # Agent outputs (written by each agent node, read by orchestrator aggregator)
    chemist_results: dict[str, CompatibilityResponse] = Field(default_factory=dict)
    artist_results: dict[str, CompatibilityResponse] = Field(default_factory=dict)
    trend_results: dict[str, CompatibilityResponse] = Field(default_factory=dict)

    # Error tracking
    errors: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Data snapshots — lightweight read models passed into agents
# (agents must not hit the DB directly; data-fetch node provides these)
# ---------------------------------------------------------------------------

class ProductSnapshot(BaseModel):
    """Minimal product data needed by all three agents."""
    id: str
    name: str
    brand: str
    category: str
    inci_ingredients: list[str] = Field(
        default_factory=list,
        description="INCI ingredient list from Open Beauty Facts",
    )
    specs: list[str] = Field(default_factory=list)
    filters: dict[str, str | bool | float]  # finish, coverage, skin_type, etc.


class BeautyProfileSnapshot(BaseModel):
    """User's quiz-derived profile, passed to Artist Agent."""
    skin_tone: str | None
    undertone: str | None
    skin_type: str | None       # oily | dry | combination | normal
    coverage: str | None        # light | medium | full
    finish: str | None          # matte | dewy | natural | satin
    budget: str | None


class TrendSnapshot(BaseModel):
    """A current trend with catalog-mapped products, passed to Trend Agent."""
    id: str
    name: str
    description: str
    direction: Literal["rising", "stable", "declining"]
    associated_product_ids: list[str]


# ---------------------------------------------------------------------------
# Chemist Agent I/O
# ---------------------------------------------------------------------------

class ChemistInput(BaseModel):
    """
    Subset of AgentState passed to the Chemist Agent tool call.
    The agent receives only what it needs for ingredient analysis.
    """
    products: list[ProductSnapshot]
    known_conflict_pairs: list[tuple[str, str]] = Field(
        default_factory=list,
        description="Pre-loaded rule pairs from the vector store (e.g. 'retinol','aha')",
    )


class ChemistOutput(BaseModel):
    """Per-product conflict verdicts from the Chemist Agent."""
    results: dict[str, CompatibilityResponse]
    rag_queries_used: list[str] = Field(
        default_factory=list,
        description="Vector store queries fired during analysis (for observability)",
    )


# ---------------------------------------------------------------------------
# Artist Agent I/O
# ---------------------------------------------------------------------------

class ArtistInput(BaseModel):
    products: list[ProductSnapshot]
    beauty_profile: BeautyProfileSnapshot


class ArtistOutput(BaseModel):
    results: dict[str, CompatibilityResponse]


# ---------------------------------------------------------------------------
# Trend Agent I/O
# ---------------------------------------------------------------------------

class TrendInput(BaseModel):
    products: list[ProductSnapshot]
    active_trends: list[TrendSnapshot]
    trend_window_days: int = 30


class TrendOutput(BaseModel):
    results: dict[str, CompatibilityResponse]
    # Products the Trend Agent positively recommends (no conflict, trending)
    trending_product_ids: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# SSE event payloads (sent over the wire to the frontend)
# ---------------------------------------------------------------------------

class CompatibilitySSEEvent(BaseModel):
    """Streamed to the client via SSE as agent results arrive."""
    event: Literal["partial", "complete", "error"]
    build_id: str
    # For 'partial': a single product's result
    product_id: str | None = None
    compatibility: CompatibilityResponse | None = None
    # For 'complete': the full orchestrator output
    summary: OrchestratorOutput | None = None
    error_message: str | None = None


# ---------------------------------------------------------------------------
# DB-cached result (stored in compatibility_results table)
# ---------------------------------------------------------------------------

class CompatibilityResultSchema(BaseModel):
    id: int
    build_id: str
    product_id: str
    is_compatible: bool
    reason: str
    severity: Literal["warning", "error"]
    source_agent: str
    conflicting_product_ids: list[str]
    evaluated_at: datetime
    build_fingerprint: str = Field(
        ...,
        description="SHA-256 hash of sorted product_ids; used to detect stale cache",
    )
```

---

## 5. LangGraph Orchestrator Design

The orchestrator is implemented as a `StateGraph` (LangGraph). Agents run in **parallel** where possible; the aggregator node merges results.

```
                     ┌─────────────────────────────────────────┐
                     │          fetch_data_node                │
                     │  (load products, beauty_profile, trends) │
                     └─────────────────────────────────────────┘
                                        │
                          ┌─────────────┼─────────────┐
                          ▼             ▼             ▼
               ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
               │ chemist_node │ │  artist_node │ │  trend_node  │
               │ (INCI check) │ │ (skin match) │ │(viral looks) │
               └──────────────┘ └──────────────┘ └──────────────┘
                          │             │             │
                          └─────────────┼─────────────┘
                                        ▼
                     ┌─────────────────────────────────────────┐
                     │          aggregate_node                  │
                     │  Merge results, compute overall score,  │
                     │  persist to DB, emit SSE 'complete'      │
                     └─────────────────────────────────────────┘
```

### Node responsibilities

| Node | Input | Output | LLM call? |
|---|---|---|---|
| `fetch_data_node` | `OrchestratorInput` | `AgentState` (populated) | No — DB queries only |
| `chemist_node` | `AgentState.products` + RAG | `AgentState.chemist_results` | **Yes** — ingredient conflict analysis |
| `artist_node` | `AgentState.products` + `beauty_profile` | `AgentState.artist_results` | **Yes** — finish/skin-type mismatch |
| `trend_node` | `AgentState.products` + `active_trends` | `AgentState.trend_results` | Optional — rule-based first, LLM fallback |
| `aggregate_node` | Full `AgentState` | `OrchestratorOutput` + SSE emit | No |

### Agent prompting strategy

Each agent uses a **structured output** call (tool-use / JSON mode):

- **Chemist Agent**: System prompt includes INCI chemistry rules (water-based vs silicone-based, pH-sensitive actives, oxidising agents). RAG context is injected per call from the vector store.
- **Artist Agent**: System prompt includes skin tone / finish compatibility matrix. Beauty profile is injected as user context.
- **Trend Agent**: Primarily rule-based (is this product in an active trending look?). LLM only used for fuzzy matching when product is not in `associated_product_ids`.

---

## 6. Vector Store / RAG Pipeline

### Why RAG here?

- Ingredient conflict knowledge is too large to fit in every prompt context.
- Trend descriptions are unstructured text; semantic search outperforms keyword matching.
- The RAG layer allows the knowledge base to be updated without redeploying the model.

### Technology choice

| Option | Pros | Cons | Recommended for |
|---|---|---|---|
| **pgvector** (PostgreSQL extension) | Single DB, no extra infra, SQL joins with product data | Requires Postgres migration from SQLite | **Production** |
| **Chroma** (local) | Zero setup, pure Python, good for dev | Separate process, not production-grade | **Development** |
| **Pinecone / Weaviate** | Managed, scalable | External dependency, cost | Large scale |

**Recommendation:** Use Chroma for local dev; pgvector for staging/production. The `vector_store.py` service abstracts the backend behind a protocol so swapping is trivial.

### Collections / indexes

| Collection | Content | Embedding model | Updated |
|---|---|---|---|
| `inci_ingredients` | Full INCI ingredient list per product | `text-embedding-3-small` | On product ingest |
| `ingredient_conflicts` | Known conflict rule descriptions (e.g. "AHA + retinol at night causes irritation") | same | Manually curated |
| `trend_descriptions` | Trend name + description from `trend_service` | same | Periodic scheduler |

### `vector_store.py` interface

```python
class VectorStore(Protocol):
    async def upsert_product_ingredients(
        self, product_id: str, ingredients: list[str]
    ) -> None: ...

    async def search_ingredient_conflicts(
        self, query_ingredients: list[str], top_k: int = 5
    ) -> list[ConflictHint]: ...

    async def search_trends(
        self, query: str, top_k: int = 3
    ) -> list[TrendHint]: ...


class ConflictHint(BaseModel):
    conflict_description: str
    ingredients_involved: list[str]
    severity: Literal["warning", "error"]
    score: float  # cosine similarity


class TrendHint(BaseModel):
    trend_id: str
    trend_name: str
    score: float
```

---

## 7. API Endpoints — New

### `GET /api/v1/compatibility/stream/{build_id}`

Server-Sent Events endpoint. The client opens this once per build session and receives:

```
event: partial
data: {"event":"partial","build_id":"...","product_id":"abc","compatibility":{...}}

event: complete
data: {"event":"complete","build_id":"...","summary":{...}}
```

**Implementation:** `asyncio.Queue` per connected user stored in `sse_manager.py`. When `set_slot` is called, it enqueues an `OrchestratorInput` task; the compatibility service processes it and pushes `CompatibilitySSEEvent` objects into the queue.

### `POST /api/v1/compatibility/analyze`

Manual (non-streaming) trigger. Returns `OrchestratorOutput` synchronously. Useful for initial page load or when the SSE connection is unavailable.

**Request body:** `OrchestratorInput`
**Response:** `OrchestratorOutput`

### Modified: `PUT /api/v1/builds/{build_id}/slots/{category_key}`

No change to request/response schema (backward compatible). After the slot is saved, the endpoint:
1. Enqueues a background `OrchestratorInput` task (non-blocking).
2. Returns the existing `BuildSlotSchema` response immediately.

The compatibility result arrives via SSE — the slot update response does **not** wait for agents.

---

## 8. Database Changes

### New column: `products.inci_ingredients`

```python
# In backend/app/models/product.py
inci_ingredients: Mapped[list[str] | None] = mapped_column(
    JSON, nullable=True, comment="INCI ingredient list from Open Beauty Facts"
)
```

### New table: `compatibility_results`

```python
# backend/app/models/compatibility.py
class CompatibilityResult(Base, TimestampMixin):
    __tablename__ = "compatibility_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    build_id: Mapped[str] = mapped_column(ForeignKey("builds.id"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    is_compatible: Mapped[bool]
    reason: Mapped[str]
    severity: Mapped[str]  # 'warning' | 'error'
    source_agent: Mapped[str]
    conflicting_product_ids: Mapped[list[str]] = mapped_column(JSON)
    evaluated_at: Mapped[datetime]
    build_fingerprint: Mapped[str] = mapped_column(
        index=True,
        comment="SHA-256 of sorted product_ids; cache invalidation key"
    )

    build: Mapped["Build"] = relationship(back_populates="compatibility_results")
    product: Mapped["Product"] = relationship()
```

### Alembic migration

One new migration file handles both changes:
```
backend/alembic/versions/[hash]_add_inci_and_compat_cache.py
```

---

## 9. Frontend Changes — ProductPicker & Build UI

> All styling follows CLAUDE.md: black/white high-contrast, sharp edges, uppercase labels.

### 9.1 New types (`frontend/src/types/index.ts`)

```typescript
export interface CompatibilityInfo {
  isCompatible: boolean;
  reason: string;
  severity: 'warning' | 'error';
  conflictingProductIds: string[];
}

export interface CompatibilityMap {
  [productId: string]: CompatibilityInfo;
}

export interface BuildCompatibilitySummary {
  buildId: string;
  compatibilityMap: CompatibilityMap;
  overallScore: number;  // 0.0–1.0
  evaluatedAt: string;
}
```

### 9.2 New hook: `useCompatibilityStream`

```typescript
// frontend/src/lib/useCompatibilityStream.ts
export function useCompatibilityStream(buildId: string | null) {
  const [compatibilityMap, setCompatibilityMap] = useState<CompatibilityMap>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (!buildId) return;
    const sse = new EventSource(`/api/v1/compatibility/stream/${buildId}`);

    sse.addEventListener('partial', (e) => {
      const data = JSON.parse(e.data);
      setCompatibilityMap(prev => ({
        ...prev,
        [data.product_id]: data.compatibility,
      }));
      setIsAnalyzing(true);
    });

    sse.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      setCompatibilityMap(data.summary.compatibility_map);
      setIsAnalyzing(false);
    });

    return () => sse.close();
  }, [buildId]);

  return { compatibilityMap, isAnalyzing };
}
```

### 9.3 ProductPicker changes

**New prop:**
```typescript
interface ProductPickerProps {
  categoryKey: CategoryKey;
  onSelect: (product: Product) => void;
  onClose: () => void;
  compatibilityMap?: CompatibilityMap;  // NEW
}
```

**Compatibility toggle** (added above the product grid):
```
[SHOW ALL]  [COMPATIBLE ONLY]
```
- Default: `SHOW ALL` — all products visible, incompatible ones show a badge.
- `COMPATIBLE ONLY`: hides products with `severity: 'error'`; warnings still shown.
- A badge on each incompatible product card: `! WARNING` or `✕ CONFLICT` (uppercase, black, sharp).

**Product card conflict badge:**
```
┌─────────────────────────────┐
│  [Product image]            │
│  PRODUCT NAME               │
│  Brand · $24.99             │
│                             │
│  ✕ CONFLICTS WITH PRIMER    │  ← red/black badge, tooltip with reason
└─────────────────────────────┘
```

**Analyzing state indicator** (shown while `isAnalyzing === true`):
```
ANALYZING COMPATIBILITY...   ← small uppercase label in header bar
```

### 9.4 Build page slot changes

Each filled slot badge gains a small incompatibility dot:
```
[Foundation ●]   ← ● is a small warning dot if slot product has a conflict
```

Clicking the dot opens a tooltip/modal with the full `CompatibilityResponse.reason`.

---

## 10. New Python Dependencies

Add to `backend/pyproject.toml`:

```toml
[project.dependencies]
# Existing deps retained...

# Agentic AI
langgraph = ">=0.2.0"
langchain-core = ">=0.3.0"
langchain-anthropic = ">=0.3.0"   # or langchain-openai, depending on LLM choice

# Vector store (dev: Chroma, prod: pgvector)
chromadb = ">=0.5.0"              # dev only
pgvector = ">=0.3.0"              # prod only (requires Postgres)
sqlalchemy-pgvector = ">=0.1.0"   # SQLAlchemy integration

# Embeddings
anthropic = ">=0.40.0"            # if using Claude for agents
openai = ">=1.50.0"               # if using text-embedding-3-small for embeddings
```

---

## 11. Real-time Strategy: SSE vs Polling

**Decision: Server-Sent Events (SSE)**

| Criterion | SSE | WebSocket | Long Polling |
|---|---|---|---|
| Server complexity | Low | High (stateful) | Medium |
| Client API | `EventSource` (native browser) | `ws://` | `fetch` loop |
| Direction | Server → Client only | Bidirectional | Server → Client only |
| HTTP/2 multiplexing | Yes | No | No |
| Reconnect | Automatic | Manual | Manual |
| Fit for this use case | ✅ Perfect | Overkill | Acceptable fallback |

Agent analysis is strictly server-to-client (the server computes, the client displays). SSE is the simplest correct tool.

**Fallback:** If the client cannot open an SSE connection (e.g. certain proxies strip `text/event-stream`), the frontend falls back to a single `POST /api/v1/compatibility/analyze` call on each slot change (3-5 second wait, no partial results).

---

## 12. Migration Path (SQLite → PostgreSQL)

For pgvector the DB must be PostgreSQL. Recommended steps:

1. Set `DATABASE_URL=postgresql+asyncpg://...` in `.env` for staging/production.
2. Run `alembic upgrade head` to apply all migrations against Postgres.
3. Run `scripts/backfill_inci.py` to fetch INCI for existing products via OBF.
4. Enable `CREATE EXTENSION IF NOT EXISTS vector` in Postgres.
5. Swap `chromadb` for the pgvector implementation in `vector_store.py` via env flag `VECTOR_BACKEND=pgvector`.

SQLite remains supported for local development with Chroma.

---

## 13. Observability

- Each `OrchestratorOutput` includes `evaluated_at` and per-agent result attribution (`source_agent` field).
- Agent LLM calls log `rag_queries_used` for debugging retrieval quality.
- `compatibility_results` table acts as an audit log — results are queryable by `build_fingerprint` to understand caching behaviour.
- Recommended: add Prometheus counters for agent latency, conflict rate per category, cache hit rate.

---

## 14. Implementation Order

| Phase | Work | Risk |
|---|---|---|
| **P0 — Foundation** | Add `inci_ingredients` column, write Alembic migration, backfill OBF data, define all Pydantic schemas | Low |
| **P1 — Vector Store** | Implement `vector_store.py` with Chroma backend, seed `ingredient_conflicts` collection | Low |
| **P2 — Chemist Agent** | Implement `chemist_agent.py` + LangGraph graph, wire into `/api/v1/compatibility/analyze` | Medium |
| **P3 — SSE** | Implement `sse_manager.py`, `GET /compatibility/stream/{build_id}`, patch `builds.py` to enqueue | Medium |
| **P4 — Artist + Trend Agents** | Implement remaining agents, wire into graph in parallel | Medium |
| **P5 — Frontend** | `useCompatibilityStream` hook, ProductPicker compatibility toggle + badges | Low |
| **P6 — Prod DB** | Migrate to Postgres + pgvector, swap vector backend | High (infra) |

---

## 15. Open Questions

1. **LLM provider**: Anthropic (`claude-haiku-4-5` for speed) or OpenAI (`gpt-4o-mini`)? Haiku is faster/cheaper; GPT-4o-mini has better function-calling reliability for structured output. Recommend Haiku given the existing Anthropic relationship.
2. **INCI data coverage**: Open Beauty Facts covers ~30% of mainstream products. Gap-filling strategy needed (manual curation or fallback to `specs` field parsing).
3. **Trend data source**: Current `trend_service.py` has a skeleton; it needs a real social data feed (TikTok API, Pinterest Trends, or a third-party scraper) to power the Trend Agent meaningfully.
4. **Auth on SSE endpoint**: The SSE stream must be authenticated. Passing the JWT as a query param (`?token=...`) is acceptable for EventSource (which cannot set headers); token must be short-lived.
5. **Caching TTL**: Build fingerprint cache — how long before we re-run agents on the same product set? Suggested: 1 hour for Artist/Trend (slow-changing), 24 hours for Chemist (ingredient data changes rarely).
