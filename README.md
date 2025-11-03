# GardenShare AI

A solo capstone project by **Angela Powell** — Project & Portfolio (Months 1–4).  
**Milestone 1 video due:** Sunday, Nov 2, 2025 @ 10:59 PM CST.

## Elevator Pitch  
GardenShare AI helps home gardeners plan beds, time plantings, and swap extra harvests with nearby growers. The app uses an AI recommender to match gardeners for trades (e.g., “your surplus basil ↔ my tomatoes”) and gives planting/harvest timing guidance using local weather and frost data.

## Problem & Why Now  
- Backyard and community gardeners overgrow some crops while lacking others.  
- Planting windows and frost dates are tricky and weather-dependent.  
- Local food exchange is fragmented across chats and ad-hoc groups.

## Goals (Month 1 MVP)  
1. **AI Trade Recommender (v1)** — rule-based + similarity scoring to propose exchange matches between users’ *Have* and *Want* lists within a set radius.  
2. **Planting Window Advisor (v1)** — basic logic that combines USDA-zone or zip with 10-day forecast to suggest “plant/harvest soon” flags per crop.  
3. **Core Backend APIs** — users, gardens, plants, inventory, wants/haves, matches, and simple notifications.  
4. **Auth** — email/password.  
5. **Minimal UI** — for the demo: sign in, edit garden profile, add plants, see suggested trades & timing flags.

> Per mentor guidance: **prioritize backend + AI**. UI can be skeletal for Month 1.

## Non-Goals (Month 1)  
- Payments, complex chat, marketplace, advanced ML, mobile app polish, geospatial clustering beyond simple radius.

## AI Components  
- **Trade Match (v1):** content-based similarity using plant taxonomy, companion/cuisine tags, seasonality; greedy matching that respects distance and quantity.  
- **Timing Advisor (v1):** rules using crop metadata (days to maturity, frost sensitivity) + current/forecast temps to raise *PLANT_NOW*, *HARVEST_SOON*, *FROST_RISK* flags.

## Architecture (proposed)  
- **Frontend:** Next.js (TS), Tailwind (minimal).  
- **Backend/API:** Next.js API routes or FastAPI.  
- **DB:** PostgreSQL (Prisma ORM) or SQLite for local dev.  
- **Auth:** NextAuth or Firebase Auth.  
- **Jobs:** cron/queue.  
- **Infra:** Vercel (frontend), Railway/Fly.io (API) — dev only.  
- **Data:** seed `plants.csv` with common crops metadata.

## Data Model (initial)  
- `User(id, name, email, zip, radius_km)`  
- `Garden(id, userId, usdaZone, bedAreaSqFt)`  
- `Plant(id, commonName, tags[], frostSensitivity, daysToMaturity, season)`  
- `Inventory(id, userId, plantId, qty, status: HAVE|WANT)`  
- `Match(id, userA, userB, plantAId, plantBId, score, distanceKm, status)`  
- `TimingFlag(id, userId, plantId, type: PLANT_NOW|HARVEST_SOON|FROST_RISK)`

## MVP Demo Flow (what the video will show)  
1. Move Jira cards to **Done** while narrating.  
2. Create user → set `zip` & `radius`.  
3. Add *Have* and *Want* items.  
4. Run **Generate Matches** → show list with scores & distances.  
5. Open **Timing Advisor** → show flags derived from forecast.  
6. Minimal UI clicks or CLI/console output proving functionality.

## Roadmap (by month)  
- **Month 1 – MVP running**: AI v1, core APIs, seed data, skeletal UI, demo video.  
- **Month 2 – Ready for user test**: better UI, persistence, notifications, CSV import, improved scoring.  
- **Month 3 – User testing**: recruit 5–8 gardeners, feedback/metrics, iterate.  
- **Month 4 – Polish & present**: stability, docs, final presentation.

## Definition of Done (DoD)  
- Unit tests for recommender & timing advisor pass.  
- API endpoints return correct JSON.  
- Demo script reliably shows end-to-end flow.  
- Jira card has acceptance criteria and is linked to commit(s).

## Getting Started (dev)  
```bash
# repo bootstrap
pnpm create next-app@latest gardenshare-ai --ts --eslint --app
cd gardenshare-ai
pnpm add @prisma/client prisma zod
# …
