# GardenShare AI  
Solo capstone project by **Adam L. Powell** – Project & Portfolio (Months 1-4)  

## Introduction  
GardenShare AI is a home-gardening companion powered by artificial intelligence. It helps gardeners plan beds, schedule plantings, swap surplus produce within a local community, and time crop cycles with weather-based alerts. By merging the joy of gardening with the precision of data, this project empowers growers to harvest more than just vegetables — they harvest connection and insight.

## Alpha Features (by end of Month 1)  
- **Trade Recommender v1** – rule-based + similarity scoring to propose exchange matches between users’ *Have* and *Want* lists within a set radius.  
- **Timing Advisor v1** – logic combining USDA-zone or ZIP code with short-term forecast to flag “plant now”, “harvest soon”, or “frost risk”.  
- **Core Backend APIs** – support for users, gardens, plants, inventories, matches & timing flags.  
- **Authentication** – email/password login and session management.  
- **Minimal UI** – sign-in, garden profile edit, add plants, view matches & timing indicators.

## Technologies  
- Frontend: Next.js, TypeScript, Tailwind CSS  
- Backend/API: Node.js (or FastAPI) + Prisma ORM + PostgreSQL (or SQLite for dev)  
- Authentication: NextAuth (or Firebase Auth)  
- External APIs: Weather forecast API, Geolocation/Radius filter service  
- DevOps & Workflow: GitHub (main/dev/feature branching), GitHub Actions (CI), deployment via Vercel + Railway/Fly.io  
- Data: `plants.csv` seed file with metadata (tags, frost-sensitivity, days-to-maturity, season)

## Installation  
```bash
git clone https://github.com/adampowell86/GardenShareAI.git  
cd GardenShareAI  
pnpm install  
pnpm dev  
````

**Prerequisites:** Node.js v16+, pnpm (or npm/yarn), PostgreSQL (or use SQLite for local dev).
**Usage:** Visit `http://localhost:3000` to explore the UI, or call backend endpoints.

## Development Setup

1. Fork or clone the repo above.
2. Create a `.env.local` file with required variables:

   ```
   DATABASE_URL=...
   NEXTAUTH_URL=http://localhost:3000
   WEATHER_API_KEY=...
   ```
3. Run `pnpm prisma migrate dev` to build the database schema.
4. Run `pnpm seed` to populate sample data (users, plants, gardens).
5. Branch strategy:

   ```bash
   git checkout -b dev
   git checkout -b feature/<issue-key>-<short-description>
   ```
6. Commit regularly; merge feature branches into `dev`, then merge `dev` into `main` when ready for demo.

## Contributors

* Adam L. Powell — sole developer, designer, and maintainer

## License

This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.

## Project Status

**Alpha** – Core backend and AI modules are under active development. UI is minimal but functional for demo.

## Roadmap

* **Month 2 – User Test-Ready:** polish UI, notifications, seed/import CSV, improve AI scoring
* **Month 3 – Pilot Users:** recruit 5-8 gardeners, collect feedback, iterate
* **Month 4 – Final Presentation & Polish:** build final version, write docs, deliver presentation

## Known Issues

* Seed dataset is limited; more crop metadata needed
* UI lacks mobile responsiveness in this alpha version
* Weather API calls are currently mocked for demo purposes

## Data Model & Backend Architecture

### Data Model (Entity Relationship Diagram)

Below is a simplified model of core entities for **GardenShare AI**:

```
User (id, name, email, zip, radius_km)
  └─<has>─ Garden (id, userId, usdaZone, bedAreaSqFt)
           └─<has many>─ Inventory (id, gardenId, plantId, qty, status {HAVE, WANT})
                             └─<refers to>─ Plant (id, commonName, tags[], frostSensitivity, daysToMaturity, season)
  Match (id, userAId, userBId, plantAId, plantBId, score, distanceKm, status)
  TimingFlag (id, userId, plantId, type {PLANT_NOW, HARVEST_SOON, FROST_RISK}, generatedAt)
```

**Notes on relationships:**

* A **User** can own one or more **Gardens**.
* Each **Garden** has an **Inventory** of plants the user *Has* or *Wants*.
* The **Plant** entity holds metadata used by the AI components (tags, maturity, season, frostSensitivity).
* **Match** connects two users (via their inventories) for potential trades, with scoring and distance considerations.
* **TimingFlag** captures AI-generated alerts for a given user & plant.

### Backend Architecture Overview

1. **Frontend**

   * Built in Next.js (TypeScript) + Tailwind CSS for rapid UI scaffolding.
   * Handles sign-in, garden profile edits, inventory views, match & timing notifications.

2. **Backend/API Layer**

   * Using Next.js API routes (or optionally FastAPI) to implement REST endpoints.
   * Example endpoints: `POST /api/auth/login`, `GET /api/inventory`, `POST /api/match/generate`, `GET /api/timing/flags`.

3. **Database & ORM**

   * Primary storage: Prisma ORM on top of PostgreSQL (SQLite for dev fallback).
   * Schema follows the data model above; Prisma migrations handle schema evolution.

4. **AI/Logic Services**

   * **Trade Recommender Service**: retrieves inventories, applies similarity logic (tags + season + quantity + distance), stores/updates Match entities.
   * **Timing Advisor Service**: uses Plant metadata + weather forecast API + zip/usda zone logic → generates TimingFlag entries.

5. **DevOps & Workflow**

   * Version control: branches structured as `main` (release/demo), `dev` (integration), and `feature/<issue-key-short>` (task work).
   * CI/CD: GitHub Actions runs lint, tests, deploys front/back to Vercel + Railway/Fly.io.
   * Deployment: Frontend on Vercel, Backend/API on Railway/Fly.io; environment variables managed in `.env` or secret store.

### How It All Fits Together

* The user logs in via the Frontend → Backend Auth API → session.
* The Frontend fetches Inventory & Plant data from API → Database.
* User triggers “Generate Matches” → Trade Recommender Service computes and writes Match data.
* Timing Advisor Service runs on schedule (cron/queue) using weather API + Plant metadata → writes TimingFlags.
* Frontend displays Matches & TimingFlags to user, enabling informed action (swap or plant/harvest).
* All code lives in `dev` branch, merged into `main` when ready for demo/submission.
