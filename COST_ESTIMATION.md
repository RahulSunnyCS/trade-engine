# Cost Estimation — AI-Powered Options Trading Optimization System

**Version:** 1.0
**Date:** 2026-03-24
**Scope:** Paper trading phase (Phase 1–6 of implementation roadmap)

---

## Summary

| Scenario | Monthly Cost (INR) | Notes |
|----------|--------------------|-------|
| **Minimum** (self-hosted, broker API) | ₹1,200 – ₹2,500 | Tightest viable setup |
| **Comfortable** (managed DB + monitoring) | ₹5,000 – ₹10,000 | Recommended for stability |
| **Premium** (all managed + premium data) | ₹15,000 – ₹25,000 | Enterprise-grade reliability |

> **Bottom line:** This system can run for ₹1,500–2,500/month on a lean stack. The biggest variable is whether you need premium market data or can rely on your broker's API.

---

## 1. Infrastructure

### 1.1 Application Server

The backend (TypeScript/Bun), Redis, and optionally PostgreSQL can run on a single VPS for paper trading volumes.

| Provider | Spec | Monthly Cost | Notes |
|----------|------|-------------|-------|
| Hetzner CX32 | 4 vCPU, 8GB RAM | ₹1,200 (~€13) | Best value, EU datacenter |
| DigitalOcean 4GB | 2 vCPU, 4GB RAM | ₹1,700 (~$20) | Good ecosystem, Mumbai region |
| Fly.io (shared) | Auto-scaled | ₹800 – ₹2,000 | Pay-per-use, good for variable load |
| Railway | Hobby plan | ₹800 | Simple deployment, limited control |

**Recommendation:** Hetzner CX32 — best price/performance, adequate for paper trading with all components on one box.

### 1.2 Database

| Option | Monthly Cost | Tradeoff |
|--------|-------------|----------|
| Self-hosted on app server (TimescaleDB) | ₹0 extra | Shares server resources, fine for paper trading |
| Supabase free tier (PostgreSQL) | ₹0 | 500MB limit, no TimescaleDB extension |
| Timescale Cloud (smallest) | ₹3,500 (~$40) | Managed, automatic backups, TimescaleDB native |
| Neon (serverless PostgreSQL) | ₹0 – ₹700 | Free tier generous, no TimescaleDB |
| AWS RDS PostgreSQL (t3.micro) | ₹1,500 | Reliable, expensive for this scale |

**Recommendation:** Self-host TimescaleDB on the same Hetzner VPS. For paper trading data volumes (~100–500 ticks/sec for a few hours/day), 8GB RAM is more than sufficient.

### 1.3 Redis

| Option | Monthly Cost | Notes |
|--------|-------------|-------|
| Self-hosted on app server | ₹0 extra | Fine for this workload |
| Upstash free tier | ₹0 | 10,000 commands/day limit — too low for live trading |
| Upstash pay-as-you-go | ₹200 – ₹800 | Scales with usage |
| Redis Cloud (30MB free) | ₹0 | Sufficient for session state, not tick data |

**Recommendation:** Self-host Redis on the Hetzner VPS.

### 1.4 Monitoring & Observability

| Tool | Cost | What it covers |
|------|------|---------------|
| Grafana Cloud (free tier) | ₹0 | Metrics, dashboards, 10,000 series |
| Prometheus (self-hosted) | ₹0 | Metrics collection |
| Sentry (free tier) | ₹0 | Error tracking, 5K errors/month |
| Uptime Robot (free) | ₹0 | Uptime monitoring, 50 monitors |
| Better Stack (free tier) | ₹0 | Log management, 1GB/month |

**Cost: ₹0** — free tiers are sufficient for a paper trading system.

### 1.5 Domain & SSL

| Item | Annual Cost | Notes |
|------|-------------|-------|
| Domain (e.g. .com via Namecheap) | ₹800 – ₹1,200 | Optional for paper trading |
| SSL Certificate | ₹0 | Let's Encrypt, auto-renew |

---

## 2. Market Data

This is the most critical cost variable. Options depend on your broker setup.

### 2.1 Broker API (Primary Route — Recommended)

If you have an active trading account, broker APIs are **free**:

| Broker | API Cost | Data Quality | Notes |
|--------|----------|-------------|-------|
| Zerodha (Kite API) | ₹0 with active account | Good | 1-min delay on free, real-time with subscription |
| Fyers | ₹0 | Good | WebSocket real-time included |
| Flattrade | ₹0 | Good | Full real-time WebSocket |
| Angel One SmartAPI | ₹0 | Good | Real-time, good documentation |

**Recommendation:** Fyers or Flattrade — both provide real-time WebSocket data for free with an active account. Sufficient for NSE options data on Nifty, BankNifty, Sensex.

### 2.2 Dedicated Data Providers (If Broker API Insufficient)

| Provider | Monthly Cost | Data | Notes |
|----------|-------------|------|-------|
| TrueData | ₹3,000 – ₹6,000 | Real-time + historical | Best quality for NSE |
| Global Datafeeds | ₹2,000 – ₹5,000 | Real-time | Good WebSocket API |
| NSE Direct (Level 1) | ₹15,000+ | Real-time | Enterprise-grade, overkill |
| Upstox API | ₹0 | Real-time | Free with active account |

### 2.3 Historical Data (One-Time Cost for Backtesting)

| Source | Cost | Coverage |
|--------|------|----------|
| Broker API (Fyers/Zerodha) | ₹0 | 1–3 years, 1-min OHLCV |
| TrueData historical | ₹5,000 – ₹20,000 | 5–10 years, tick level |
| Unofficed/NSEpy | ₹0 | EOD only, limited options data |
| BharatTrader (custom) | ₹3,000 – ₹8,000 | Options OI + premium history |

**Recommendation:** Start with broker API historical data (free). If backtesting reveals gaps, purchase TrueData's options history package (~₹10,000 one-time for 3 years).

### 2.4 India VIX Data

| Source | Cost | Notes |
|--------|------|-------|
| NSE website scrape | ₹0 | Reliable, real-time VIX published every minute |
| Broker API | ₹0 | Available via Fyers, Zerodha |

---

## 3. Trading Platform

### 3.1 Quantiply (Paper Trading)

Quantiply is the target paper trading platform. Pricing to be confirmed with vendor, but paper trading platforms in this space typically:

| Tier | Estimated Cost | Notes |
|------|---------------|-------|
| Paper trading only | ₹0 – ₹2,000/month | Usually free or low-cost |
| API access | ₹1,000 – ₹5,000/month | Depends on plan |

> **Action item:** Confirm Quantiply API pricing before budgeting. If cost is prohibitive, paper trading can be simulated internally using broker real-time data + our own position tracking DB.

### 3.2 Broker Account (Required)

| Item | Cost | Notes |
|------|------|-------|
| Account opening | ₹0 | Free at most brokers |
| Annual maintenance | ₹0 – ₹300 | Zerodha: ₹300/year |
| Paper trading margin | ₹0 | No real capital deployed in Phase 1 |

---

## 4. Notifications & Communication

| Service | Cost | Notes |
|---------|------|-------|
| Telegram Bot API | ₹0 | Free, no rate limits for personal bots |
| Email (Gmail SMTP) | ₹0 | Free for low volume |
| Slack (free tier) | ₹0 | 90-day message history |

---

## 5. Development & CI/CD

| Tool | Cost | Notes |
|------|------|-------|
| GitHub (free tier) | ₹0 | Private repos, Actions (2,000 min/month) |
| GitHub Actions | ₹0 | Free tier sufficient for this project |
| Docker Hub | ₹0 | Public images or 1 private |
| Linear / Notion | ₹0 | Free tiers for project management |

---

## 6. Monthly Cost Breakdown by Scenario

### Scenario A: Minimum (₹1,200 – ₹2,500/month)

| Item | Cost |
|------|------|
| Hetzner CX32 VPS (DB + Redis + App on same box) | ₹1,200 |
| Broker API for market data | ₹0 |
| Quantiply paper trading (free tier) | ₹0 |
| Monitoring (Grafana/Sentry free) | ₹0 |
| **Total** | **₹1,200/month** |

**Suitable for:** Solo developer, getting started, willing to manage one box.

---

### Scenario B: Comfortable (₹5,000 – ₹10,000/month)

| Item | Cost |
|------|------|
| Hetzner CX42 VPS (larger, dedicated DB) | ₹2,500 |
| Timescale Cloud (smallest plan) | ₹3,500 |
| Upstash Redis (pay-as-you-go) | ₹500 |
| Broker API for market data | ₹0 |
| Quantiply API | ₹2,000 (estimate) |
| **Total** | **₹8,500/month** |

**Suitable for:** More serious paper trading, better separation of concerns, easier scaling.

---

### Scenario C: Premium (₹15,000 – ₹25,000/month)

| Item | Cost |
|------|------|
| DigitalOcean Droplet (8 CPU, 16GB) | ₹5,000 |
| Timescale Cloud (standard plan) | ₹7,000 |
| Upstash Redis | ₹1,000 |
| TrueData real-time feed | ₹5,000 |
| Quantiply API (assumed paid tier) | ₹3,000 |
| Grafana Cloud Pro | ₹1,500 |
| **Total** | **₹22,500/month** |

**Suitable for:** Production-grade paper trading, premium data quality, full observability.

---

## 7. One-Time Setup Costs

| Item | Cost | Notes |
|------|------|-------|
| Historical options data (3 years) | ₹10,000 – ₹20,000 | For backtesting; optional if using broker history |
| Domain name (2-year registration) | ₹1,500 | Optional |
| Development tools / licenses | ₹0 | VS Code, GitHub — all free |
| **Total one-time** | **₹10,000 – ₹22,000** | |

---

## 8. Cost vs. Value Assessment

The system's core goal is **paper trading optimisation** — no real capital is at risk in Phase 1. At ₹1,200 – ₹2,500/month:

- If the system identifies even **one better entry parameter** that improves strategy win rate by 5%, that translates to thousands of rupees saved per month in live trading.
- The infrastructure cost is negligible compared to the capital efficiency gains the system is designed to uncover.
- At the comfortable tier (₹8,500/month), the system should more than pay for itself within 1–2 months of live deployment if parameter improvements hold.

---

## 9. Cost Reduction Options

| Option | Saving | Tradeoff |
|--------|--------|----------|
| Replace Quantiply with internal paper trading simulation | ₹2,000 – ₹5,000/month | More dev work, need to build order book simulation |
| Use broker API instead of TrueData | ₹3,000 – ₹5,000/month | Slightly less granular tick data |
| Self-host all services on one VPS | ₹3,000 – ₹5,000/month | Single point of failure, ops overhead |
| Use Neon (serverless PG) instead of TimescaleDB Cloud | ₹3,500/month | Lose time-series optimisations, possible query performance hit |

---

## 10. Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-24 | Initial cost estimation document |
