# Development Setup

Complete guide to running trade-engine locally.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Bun | 1.x | `curl -fsSL https://bun.sh/install \| bash` |
| Docker + Docker Compose | 24+ | [docker.com/get-started](https://www.docker.com/get-started/) |
| Git | any | system package manager |

---

## Quick Start

```bash
# 1. Clone and enter repo
git clone https://github.com/rahulsunnycs/trade-engine.git
cd trade-engine

# 2. Copy environment template
cp .env.example .env

# 3. Fill in required values (see Environment Variables below)
# At minimum: POSTGRES_PASSWORD, FYERS_APP_ID, FYERS_SECRET_KEY

# 4. Start infrastructure
docker compose up -d

# 5. Install dependencies
bun install

# 6. Run database migrations
bun run db:migrate

# 7. Start the backend dev server
bun run dev

# 8. (Separate terminal) Start the frontend dev server
bun run dev:frontend
```

Backend will be at `http://localhost:3000`
Frontend will be at `http://localhost:5173`

---

## Infrastructure (Docker Compose)

The local stack runs three services:

```
TimescaleDB (PostgreSQL 16)  →  localhost:5432
Redis 7                       →  localhost:6379
pgAdmin 4 (optional)          →  localhost:5050
```

### Common commands

```bash
# Start all services
docker compose up -d

# Start with pgAdmin (optional dev tool)
docker compose --profile tools up -d

# Stop services (data preserved)
docker compose down

# Stop and wipe all data (fresh start)
docker compose down -v

# View logs
docker compose logs -f timescaledb
docker compose logs -f redis

# Connect to DB directly
docker exec -it trade-engine-db psql -U trade_engine -d trade_engine
```

---

## Environment Variables

See `.env.example` for the full list. Key variables to set before first run:

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_PASSWORD` | Yes | Any string for local dev |
| `DATABASE_URL` | Yes | Update with your `POSTGRES_PASSWORD` |
| `FYERS_APP_ID` | Yes (Phase 1+) | From [myapi.fyers.in](https://myapi.fyers.in/dashboard) |
| `FYERS_SECRET_KEY` | Yes (Phase 1+) | From Fyers developer dashboard |
| `FYERS_ACCESS_TOKEN` | Yes (Phase 1+) | Retrieved via OAuth2 flow (daily) |
| `SESSION_SECRET` | Yes | `openssl rand -hex 32` |
| `JWT_SECRET` | Yes | `openssl rand -hex 32` |

Everything else is optional for early phases.

### Getting Fyers API credentials

1. Create an account at [myapi.fyers.in](https://myapi.fyers.in/dashboard)
2. Create a new app → set redirect URI to `http://localhost:3000/auth/fyers/callback`
3. Copy `App ID` → `FYERS_APP_ID` and `Secret Key` → `FYERS_SECRET_KEY`
4. Run `bun run auth:fyers` to complete the OAuth2 flow and get your first access token
5. The app will auto-refresh the token daily, but you may need to re-auth manually if it expires

---

## Database Migrations

Migrations are managed with **Drizzle ORM**. Schema files live in `src/db/schema/`.

```bash
# Apply all pending migrations
bun run db:migrate

# Generate a new migration from schema changes
bun run db:generate

# Open Drizzle Studio (visual DB browser)
bun run db:studio

# Reset DB and re-run all migrations (dev only — destroys data)
bun run db:reset
```

Migration files are in `src/db/migrations/` and are committed to the repo. Never delete or edit existing migration files.

---

## Running Tests

```bash
# All tests
bun run test

# Unit tests only (no DB/Redis required)
bun run test:unit

# Integration tests (requires Docker services running)
bun run test:integration

# Watch mode
bun run test --watch

# Coverage
bun run test:coverage
```

---

## Secrets Management

| Environment | Approach |
|-------------|----------|
| **Local dev** | `.env` file (gitignored). Never commit. |
| **CI (GitHub Actions)** | GitHub repository secrets. Add via Settings → Secrets and Variables → Actions. |
| **Production (Hetzner)** | Environment variables set directly on the server. Use `systemd` `EnvironmentFile` pointing to a root-owned `.env` with `chmod 600`. |

**CI secrets needed** (add to GitHub repo secrets):
- `DATABASE_URL` — not needed; CI uses ephemeral service containers
- `SENTRY_DSN` — optional, for CI error reporting
- No Fyers credentials in CI — integration tests use stub clients

**Rotating secrets:**
- Fyers access token: auto-rotated daily by the app
- `SESSION_SECRET` / `JWT_SECRET`: rotate by updating `.env` + restarting the server (invalidates all sessions)
- Database password: update in `.env`, `docker-compose.yml`, and restart compose

---

## Project Structure (planned)

```
trade-engine/
├── src/
│   ├── db/
│   │   ├── schema/          # Drizzle schema definitions (TypeScript)
│   │   └── migrations/      # Auto-generated SQL migration files
│   ├── services/
│   │   ├── market-data/     # Fyers WebSocket feed + historical ingestion
│   │   ├── straddle/        # ATM straddle calculator + ROC engine
│   │   ├── signals/         # Peak detector + signal generator
│   │   ├── personalities/   # Bot configs + personality router
│   │   ├── executor/        # Fyers paper trade executor
│   │   ├── positions/       # Position manager + P&L tracker
│   │   └── retrospection/   # EOD analysis + parameter evolution
│   ├── api/                 # Fastify routes + WebSocket handlers
│   └── utils/
├── frontend/                # React + Vite dashboard
├── infra/
│   └── db/init/             # One-time DB init scripts (TimescaleDB extensions)
├── .github/workflows/       # CI pipeline
├── docker-compose.yml       # Local dev infrastructure
├── .env.example             # Environment variable template
└── OPTIONS_TRADING_OPTIMIZER_TECH_SPEC.md
```

---

## Production Deployment (Hetzner CX32)

> Not needed until Phase 6 validation. Document this when ready.

- Hetzner CX32: 4 vCPU, 8GB RAM, €14.90/month
- TimescaleDB: Timescale Cloud free tier (10GB, sufficient for 1-year history)
- Redis: self-hosted on the same VPS
- Process manager: `systemd` service unit
- Reverse proxy: `caddy` (auto-HTTPS)
