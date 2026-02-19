# ShortStamp — Build Plan

## Priority 1 — Wire Backend to Frontend
Connect the Next.js frontend to the FastAPI backend so API calls actually work.

- [ ] Add `NEXT_PUBLIC_API_URL` to `frontend/.env.local`
- [ ] Update `frontend/src/lib/api.ts` to use `process.env.NEXT_PUBLIC_API_URL` instead of hardcoded `/api/v1`
- [ ] Add Next.js rewrites in `next.config.ts` to proxy `/api/v1/*` → backend in dev
- [ ] Confirm CORS settings in `backend/app/config.py` allow the frontend origin
- [ ] Test one API call end-to-end (e.g. `GET /api/v1/products`)

---

## Priority 2 — Seed / Ingest Real Product Data
Get real products into the database so the site has content.

- [ ] Verify backend `.env` has required vars (DB URL, Walmart API key, etc.)
- [ ] Run Alembic migrations: `alembic upgrade head`
- [ ] Run the seed script: `python -m app.seed`
- [ ] Trigger or schedule one ingestion pass (Open Beauty Facts + Walmart)
- [ ] Confirm products are returned by `GET /api/v1/products`
- [ ] Add at least one trend with associated products via seed or admin endpoint

---

## Priority 3 — Unify the Build Flow
There are currently two conflicting build flows. Pick one and make it consistent.

**Decision:** Use the full 18-category grouped flow (`/build/[group]`) as the primary experience, replacing the flat 7-slot `/build/page.tsx`.

- [ ] Redesign `/build/page.tsx` to show the 5 face area groups (Base, Eyes, Brows, Cheeks, Lips) as a selection grid — not a flat slot list
- [ ] Each group tile shows fill count (e.g. "2 / 4 selected") per Goal-Gradient Effect
- [ ] Clicking a group navigates to `/build/[group]` (already built)
- [ ] `/build/[group]/page.tsx` shows category slots within that group, each linking to `/build/category/[slug]`
- [ ] `/build/category/[slug]` shows filtered products for that category (calls API)
- [ ] Toolbox summary bar (`Toolbox.tsx`) persists across all build sub-pages
- [ ] Remove the old 7-slot hardcoded category list from `/build/page.tsx`

---

## Priority 4 — Replace Static Trend Data with Live API
The homepage and trends page use hardcoded `sampleTrends`. Wire them to the backend.

- [ ] `GET /api/v1/trends` endpoint returns paginated trends with stampScore
- [ ] Update `frontend/src/app/trends/page.tsx` to fetch from API (with loading + error state)
- [ ] Update `frontend/src/app/page.tsx` homepage to fetch top 3–6 trends from API
- [ ] Replace all `sampleTrends` imports with API calls (`api.getTrends()`)
- [ ] Add `api.getTrends()` method to `frontend/src/lib/api.ts` if missing

---

## Priority 5 — Build `/trends/[id]` Detail Page
The route exists but the page content is unknown / likely a stub.

- [ ] Check current state of `frontend/src/app/trends/[id]/page.tsx`
- [ ] Fetch trend by ID from API: name, description, stampScore, direction
- [ ] Show associated products in a grid (ShortStamp badge + price + buy link)
- [ ] Show articles list (title → external link) if present
- [ ] Show videos list (YouTube embeds or links) if present
- [ ] Add ShortStamp score breakdown section explaining the trend score
- [ ] Back link → `/trends`

---

## Priority 6 — Fix Design Compliance (CLAUDE.md)
The current homepage and components violate the MAC Cosmetics monochrome design system.

- [ ] **Remove all color accents from homepage** — replace `from-pink-soft`, `text-pink-500`, `text-fuchsia-500`, `text-rose-500`, gradient icon backgrounds with black/white/gray
- [ ] **Remove gradient hero text** — `bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent` → plain black or uppercase white
- [ ] **Remove all `rounded-2xl`, `rounded-lg`, `rounded-xl`** from interactive elements (buttons, cards, tiles) — sharp rectangular edges per design spec
- [ ] **Audit Navbar** — remove gradient brand text, use plain black `SHORTSTAMP` wordmark
- [ ] **Audit all card components** (`TrendCard`, `ProductCard`) — remove rounded corners, ensure black/white selected states
- [ ] Verify all uppercase labels use `tracking-[0.15em]` consistently
- [ ] Verify all hover transitions are ≤ 200ms, auto-advance delays ≤ 400ms

---

## Priority 7 — Wire Quiz Personalization to Build
After the quiz, the build page should filter and sort products by the user's profile.

- [ ] Read `beautyProfile` from `localStorage` (or API if logged in) on the build page
- [ ] Pass profile fields as query params to `GET /api/v1/products?skinType=oily&finish=matte` etc.
- [ ] Backend `/products` endpoint already has filter support — confirm `skinType`, `finish`, `coverage`, `undertone` are filterable
- [ ] In `/build/category/[slug]`, default sort = best ShortStamp score matching profile
- [ ] Show a "Matched for you" label on products that align with the profile
- [ ] Add "Edit Profile" link on build page back to quiz

---

## Priority 8 — Persist Profile Data to Backend
The profile page saves nothing; styles, notifications, and quiz answers exist only in `localStorage`.

- [ ] `PATCH /api/v1/users/me` endpoint accepts `beauty_profile`, `style_preferences`, `notifications_enabled`
- [ ] Confirm these fields exist on the User model / schema (add migration if needed)
- [ ] On login/signup, load saved profile from API and merge with localStorage
- [ ] On profile page save, call `PATCH /api/v1/users/me` with updated values
- [ ] On quiz completion (for logged-in users), auto-save beauty profile to API
- [ ] Display saved style preferences on profile page, persisted across devices

---

## Priority 9 — Price History Chart
The product detail page has a "coming soon" stub for price history. Build it.

- [ ] Confirm `Price` model in backend logs historical price entries with timestamps
- [ ] Add `GET /api/v1/products/{id}/price-history` endpoint returning `[{date, price, retailer}]`
- [ ] Add `api.getPriceHistory(id)` method to the API client
- [ ] On `frontend/src/app/product/[id]/page.tsx`, fetch price history on load
- [ ] Render a line chart (use `recharts` or `chart.js`) — one line per retailer, x-axis = date, y-axis = price
- [ ] Style chart in black/white per design system (no color lines — use dashed vs solid to differentiate retailers)
- [ ] Show lowest-ever price and date below the chart
