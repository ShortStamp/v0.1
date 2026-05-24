# ShortStamp — Project Instructions

ShortStamp is a desktop overlay widget that checks the legitimacy of things on screen using AI vision.

## Components

- `website/` — Next.js 14 marketing + subscription site (port 3000)
- `backend/` — FastAPI auth + Stripe + AI proxy (port 8000)
- `desktop/` — Electron overlay widget app

## Dev

```bash
./dev.sh
```

Starts all three concurrently.

## What it does

Users install the Electron desktop app. They press Cmd+Shift+S (Mac) / Ctrl+Shift+S (Windows) to trigger the overlay. The widget captures their screen and sends it to the backend AI proxy, which calls Claude vision to return a verdict:

- **REAL** — content is legitimate/factual
- **FAKE** — content is fabricated or false
- **SCAM** — link or content is a scam
- **AI_GENERATED** — content appears AI-generated
- **UNCERTAIN** — not enough signal to determine

## Subscription

$60/month via Stripe. Users subscribe on the website, get a JWT, and the desktop app stores it to authenticate API calls.

## Design

Black/white high-contrast, minimal, professional. No colored accents. Clean sans-serif typography.
