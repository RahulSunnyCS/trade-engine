# Trade Engine

AI-powered options trading optimization system focused on **paper trading** and entry-timing research for weekly index options.

This repository currently contains the core project specification, development setup documentation, and local infrastructure definitions.

## What this project does

Trade Engine is designed to help you systematically answer questions like:
- *When should I enter a weekly options strategy?*
- *Can momentum exhaustion in ATM straddle premiums be detected in near real-time?*
- *Which strategy personality performs best in different volatility regimes?*

The system architecture is centered on:
- Real-time market data ingestion
- Multi-personality paper-trading agents
- End-of-day retrospection and parameter evolution
- Performance analytics and reporting

## Project status

This is currently in planning/early implementation mode.

Available in this repo now:
- Technical specification (`OPTIONS_TRADING_OPTIMIZER_TECH_SPEC.md`)
- Cost and deployment planning (`COST_ESTIMATION.md`)
- Local development setup guide (`DEVELOPMENT_SETUP.md`)
- Local infra stack (`docker-compose.yml`)

## Repository docs

- **Technical Spec**: [`OPTIONS_TRADING_OPTIMIZER_TECH_SPEC.md`](./OPTIONS_TRADING_OPTIMIZER_TECH_SPEC.md)
- **Development Setup**: [`DEVELOPMENT_SETUP.md`](./DEVELOPMENT_SETUP.md)
- **Cost Estimation**: [`COST_ESTIMATION.md`](./COST_ESTIMATION.md)

## Local infrastructure

`docker-compose.yml` defines a local stack for development:
- **TimescaleDB/PostgreSQL 16** on `localhost:5432`
- **Redis 7** on `localhost:6379`
- **pgAdmin 4** (optional profile) on `localhost:5050`

Start services:

```bash
docker compose up -d
```

Start with optional pgAdmin:

```bash
docker compose --profile tools up -d
```

Stop services:

```bash
docker compose down
```

## Quick start (planned app workflow)

When the application code is in place, the expected flow is:

```bash
# 1) Clone repository
git clone https://github.com/rahulsunnycs/trade-engine.git
cd trade-engine

# 2) Configure environment
cp .env.example .env
# Fill required values

# 3) Start infra
docker compose up -d

# 4) Install dependencies
bun install

# 5) Run migrations
bun run db:migrate

# 6) Start backend/frontend
bun run dev
bun run dev:frontend
```

See full details in [`DEVELOPMENT_SETUP.md`](./DEVELOPMENT_SETUP.md).

## Architecture (high-level)

Planned module areas include:
- `src/services/market-data` — live feed + historical ingestion
- `src/services/straddle` — ATM straddle and ROC analysis
- `src/services/signals` — peak/momentum signal generation
- `src/services/personalities` — risk-profiled strategy agents
- `src/services/executor` — paper order execution
- `src/services/retrospection` — performance analysis and adaptation

The full roadmap and system design are documented in the technical spec.

## Safety and scope notes

- This system is targeted at **paper trading workflows** in early phases.
- Nothing in this repository is financial advice.
- Live trading should only be considered after thorough validation, controls, and compliance checks.

## License

No license file is currently defined in this repository.
Add a `LICENSE` file before public/open-source distribution.
