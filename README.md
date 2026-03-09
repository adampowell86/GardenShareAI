# GardenShare AI

GardenShare AI is a full-stack capstone app for local gardeners to:
- Track what they have and need.
- Get AI-assisted swap suggestions with nearby gardeners.
- View planting and harvest timing flags based on profile, zone, and weather.

## Stack
- Client: React + Vite + React Router
- Server: Node.js + Express
- Database: Prisma + SQLite (local dev)
- Auth: Cookie-based JWT with refresh tokens + CSRF protection

## Core Features
- Email/password signup, login, logout, refresh flow
- Optional OAuth provider integration hooks
- HAVE and NEED inventory management
- Trade creation and status updates
- Matching/suggestions scoring service
- Timing flags for planting and frost risk
- Garden profile and plant catalog management

## Project Structure
- `client/` frontend app
- `server/` API, Prisma schema/migrations, scripts, and tests
- `.github/workflows/ci.yml` CI pipeline

## Prerequisites
- Node.js 20+
- npm 10+

## Local Setup

### 1) Server
```bash
cd server
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed:plants
npm run dev
```

### 2) Client
```bash
cd client
cp .env.example .env
npm install
npm run dev
```

## Test and Build

### Server
```bash
cd server
npm test
```

### Client
```bash
cd client
npm test -- --run
npm run build
```

## Useful Scripts
- `cd server && npm run seed:plants`
- `cd server && npm run seed:test-user`
- `cd server && npm run bench:matching`
- `cd server && npm run prisma:migrate:deploy`

## Environment Files
- Server template: `server/.env.example`
- Client template: `client/.env.example`

Do not commit real `.env` files or local database artifacts.

## CI
GitHub Actions runs on push and pull request:
- Server install + tests
- Client install + tests + production build

## Submission Status
As of February 26, 2026:
- Server tests passing
- Client tests passing
- Client production build passing
