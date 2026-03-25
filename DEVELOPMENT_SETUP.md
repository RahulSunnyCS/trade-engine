# Development Setup

Step-by-step guide to running trade-engine locally.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20.x LTS | [nodejs.org](https://nodejs.org/) or `nvm install 20` |
| npm | 10.x (bundled with Node) | — |
| Docker + Docker Compose | 24+ | [docker.com/get-started](https://www.docker.com/get-started/) |
| Git | any | system package manager |

Verify your setup:

```bash
node -v       # should print v20.x.x
npm -v        # should print 10.x.x
docker -v     # should print 24+
```

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/rahulsunnycs/trade-engine.git
cd trade-engine
```

---

## Step 2 — Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

| Variable | Required | How to get it |
|----------|----------|---------------|
| `POSTGRES_PASSWORD` | Yes | Any string (e.g. `localdev123`) |
| `DATABASE_URL` | Yes | Replace `REPLACE_PASSWORD` with your `POSTGRES_PASSWORD` |
| `SESSION_SECRET` | Yes | `openssl rand -hex 32` |
| `JWT_SECRET` | Yes | `openssl rand -hex 32` |
| `FYERS_APP_ID` | Phase 1+ | [myapi.fyers.in](https://myapi.fyers.in/dashboard) |
| `FYERS_SECRET_KEY` | Phase 1+ | Fyers developer dashboard |
| `FYERS_ACCESS_TOKEN` | Phase 1+ | OAuth2 flow (see below) |

> **Tip:** For early development, set `DATA_PROVIDER=mock` in `.env` to skip Fyers credentials entirely.

### Getting Fyers API Credentials (optional for mock mode)

1. Create an account at [myapi.fyers.in](https://myapi.fyers.in/dashboard)
2. Create a new app → set redirect URI to `http://localhost:3000/auth/fyers/callback`
3. Copy **App ID** → `FYERS_APP_ID` and **Secret Key** → `FYERS_SECRET_KEY`
4. The access token is short-lived (1 day) — set it manually for now

---

## Step 3 — Start Infrastructure (Docker)

```bash
docker compose up -d
```

This starts:

```
TimescaleDB (PostgreSQL 16)  →  localhost:5432
Redis 7                       →  localhost:6379
```

Check services are healthy:

```bash
docker compose ps
```

**Optional** — start with pgAdmin (visual DB browser at `localhost:5050`):

```bash
docker compose --profile tools up -d
```

---

## Step 4 — Install Dependencies

```bash
npm install
```

---

## Step 5 — Run Database Migrations

```bash
npm run db:migrate
```

This applies all pending SQL migrations from `src/db/migrations/`.

---

## Step 6 — Start the Dev Server

```bash
npm run dev
```

The backend starts at `http://localhost:3000`.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend in watch mode (ts-node) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint on `src/` |
| `npm run db:migrate` | Apply pending DB migrations |
| `npm run backtest` | Run backtesting engine |
| `npm run ingest:mock` | Ingest data using mock provider |
| `npm run ingest:fyers` | Ingest data using Fyers live feed |

---

## Infrastructure Commands

```bash
# Start all services
docker compose up -d

# Start with pgAdmin
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

## Project Structure

```
trade-engine/
├── src/
│   ├── backtesting/         # Backtesting engine, metrics, reports
│   ├── config/              # Strategy personality configs
│   ├── data/                # Market data providers (mock, fyers)
│   ├── db/                  # DB client, migrations
│   ├── signals/             # Signal detection logic
│   ├── types/               # Shared TypeScript types
│   ├── utils/               # Utility helpers
│   └── __tests__/           # Jest test suites
├── infra/
│   └── db/init/             # TimescaleDB init scripts
├── docker-compose.yml       # Local dev infrastructure
├── .env.example             # Environment variable template
├── tsconfig.json
└── package.json
```

---

## Running Tests

```bash
# All tests
npm run test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

> Integration tests require Docker services to be running (`docker compose up -d`).

---

## Troubleshooting

**DB connection refused**
- Make sure Docker is running: `docker compose ps`
- Wait for the health check to pass (up to 30s on first start)

**`npm run db:migrate` fails**
- Confirm `DATABASE_URL` in `.env` has the correct password
- Confirm TimescaleDB container is healthy

**Port already in use**
- `lsof -i :5432` or `lsof -i :3000` to find the conflicting process

**Fresh start (wipe everything)**
```bash
docker compose down -v
npm run db:migrate
```

---

## Secrets Management

| Environment | Approach |
|-------------|----------|
| **Local dev** | `.env` file (gitignored). Never commit. |
| **CI (GitHub Actions)** | GitHub repository secrets (Settings → Secrets and Variables → Actions) |
| **Production (Hetzner)** | `systemd` `EnvironmentFile` pointing to root-owned `.env` with `chmod 600` |

---

## Production Deployment (Hetzner CX32)

> Not needed until Phase 6 validation.

- Hetzner CX32: 4 vCPU, 8 GB RAM, ~€14.90/month
- TimescaleDB: Timescale Cloud free tier (10 GB)
- Redis: self-hosted on same VPS
- Process manager: `systemd`
- Reverse proxy: `caddy` (auto-HTTPS)
