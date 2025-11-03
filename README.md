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
