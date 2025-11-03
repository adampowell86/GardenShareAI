# GardenShare AI  
Solo capstone project by **Adam L. Powell** – Project & Portfolio (Months 1–4)  


## Introduction  
GardenShare AI is a home-gardening companion powered by artificial intelligence. It helps gardeners plan beds, schedule plantings, swap surplus produce within a local community, and time crop cycles with weather-based alerts. By merging the joy of gardening with the precision of data, this project empowers growers to harvest more than just vegetables — they harvest connection and insight.

## Alpha Features (by end of Month 1)  
- **Trade Recommender v1** – rule-based + similarity scoring to propose exchange matches between users’ *Have* and *Want* lists within a set radius.  
- **Timing Advisor v1** – logic combining USDA-zone or zip with short-term forecast to flag “plant now”, “harvest soon”, or “frost risk”.  
- **Core Backend APIs** – support for users, gardens, plants, inventories, matches & timing flags.  
- **Auth** – email/password login and session management.  
- **Minimal UI** – sign-in, garden profile edit, add plants, view matches & timing indicators.

## Technologies  
- **Frontend:** Next.js, TypeScript, Tailwind CSS  
- **Backend/API:** Node.js (or FastAPI) + Prisma ORM + PostgreSQL (or SQLite for dev)  
- **Authentication:** NextAuth (or Firebase Auth)  
- **External APIs:** Weather forecast API, Geolocation/Radius filter service  
- **DevOps & Workflow:** GitHub (main/dev/feature branching), GitHub Actions (CI), Vercel + Railway/Fly.io (deployments)  
- **Data:** `plants.csv` seed file with metadata (tags, frost sensitivity, maturity days, season).

## Installation  
```bash
git clone https://github.com/your-username/GardenShareAI.git  
cd GardenShareAI  
pnpm install  
pnpm dev  
