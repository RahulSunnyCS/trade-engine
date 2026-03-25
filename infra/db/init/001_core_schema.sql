-- ============================================================
-- Migration 001: Core Schema
-- Live trading tables (market ticks, signals, paper trades, etc.)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ---- Market ticks (live WebSocket feed) ------------------
CREATE TABLE IF NOT EXISTS market_ticks (
  time          TIMESTAMPTZ     NOT NULL,
  underlying    VARCHAR(20)     NOT NULL,
  symbol        VARCHAR(60)     NOT NULL,
  ltp           NUMERIC(10,2)   NOT NULL,
  open          NUMERIC(10,2),
  high          NUMERIC(10,2),
  low           NUMERIC(10,2),
  close         NUMERIC(10,2),
  volume        INTEGER,
  oi            INTEGER
);
SELECT create_hypertable('market_ticks', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_market_ticks_symbol ON market_ticks (symbol, time DESC);

-- ---- Straddle snapshots (derived every minute) -----------
CREATE TABLE IF NOT EXISTS straddle_snapshots (
  time                          TIMESTAMPTZ     NOT NULL,
  underlying                    VARCHAR(20)     NOT NULL,
  spot_price                    NUMERIC(10,2)   NOT NULL,
  atm_strike                    INTEGER         NOT NULL,
  atm_call_price                NUMERIC(10,2)   NOT NULL,
  atm_put_price                 NUMERIC(10,2)   NOT NULL,
  straddle_value                NUMERIC(10,2)   NOT NULL,
  implied_volatility            NUMERIC(6,4),
  straddle_change_from_open     NUMERIC(7,4),   -- percentage
  straddle_change_from_prev_close NUMERIC(7,4), -- percentage
  roc_1m                        NUMERIC(10,4),
  roc_5m                        NUMERIC(10,4),
  roc_acceleration              NUMERIC(10,4),
  vix                           NUMERIC(6,2)
);
SELECT create_hypertable('straddle_snapshots', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_straddle_snapshots_underlying ON straddle_snapshots (underlying, time DESC);

-- ---- Trading signals ------------------------------------
CREATE TABLE IF NOT EXISTS trading_signals (
  id                    VARCHAR(36)     PRIMARY KEY,
  timestamp             TIMESTAMPTZ     NOT NULL,
  signal_type           VARCHAR(30)     NOT NULL,  -- STRADDLE_SELL | STRADDLE_BUY | DIRECTIONAL_CE | DIRECTIONAL_PE
  underlying            VARCHAR(20)     NOT NULL,
  suggested_strike      INTEGER,
  suggested_price       NUMERIC(10,2),
  win_probability       NUMERIC(5,4),
  expected_value        NUMERIC(10,2),
  trigger_reason        TEXT,
  market_regime         VARCHAR(20),               -- LOW_VOL | HIGH_VOL | TRENDING | RANGEBOUND
  time_of_day           VARCHAR(10),
  day_of_week           SMALLINT,
  days_to_expiry        SMALLINT,
  straddle_value_at_signal NUMERIC(10,2),
  roc_at_signal         NUMERIC(10,4),
  vix_at_signal         NUMERIC(6,2),
  created_at            TIMESTAMPTZ     DEFAULT NOW()
);

-- ---- Personality configs --------------------------------
CREATE TABLE IF NOT EXISTS personality_configs (
  id                        VARCHAR(50)     PRIMARY KEY,
  name                      VARCHAR(100)    NOT NULL,
  description               TEXT,
  is_active                 BOOLEAN         DEFAULT TRUE,
  config                    JSONB           NOT NULL,
  version                   INTEGER         DEFAULT 1,
  parent_version            INTEGER,
  evolution_reason          TEXT,
  performance_metrics       JSONB,
  created_at                TIMESTAMPTZ     DEFAULT NOW(),
  updated_at                TIMESTAMPTZ     DEFAULT NOW()
);

-- ---- Paper trades ---------------------------------------
CREATE TABLE IF NOT EXISTS paper_trades (
  id                VARCHAR(36)     NOT NULL,
  trade_time        TIMESTAMPTZ     NOT NULL,
  personality_id    VARCHAR(50)     REFERENCES personality_configs(id),
  signal_id         VARCHAR(36)     REFERENCES trading_signals(id),
  underlying        VARCHAR(20)     NOT NULL,
  strategy          VARCHAR(30)     NOT NULL,
  atm_strike        INTEGER,
  entry_price       NUMERIC(10,2)   NOT NULL,
  exit_price        NUMERIC(10,2),
  lots              INTEGER         DEFAULT 1,
  gross_pnl         NUMERIC(10,2),
  charges           NUMERIC(10,2),
  net_pnl           NUMERIC(10,2),
  exit_reason       VARCHAR(30),               -- stoploss | target | eod | trailing_sl
  exit_time         TIMESTAMPTZ,
  market_regime     VARCHAR(20),
  vix_at_entry      NUMERIC(6,2),
  status            VARCHAR(20)     DEFAULT 'OPEN',  -- OPEN | CLOSED
  PRIMARY KEY (id, trade_time)
);
SELECT create_hypertable('paper_trades', 'trade_time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_paper_trades_personality ON paper_trades (personality_id, trade_time DESC);

-- ---- Retrospection runs ---------------------------------
CREATE TABLE IF NOT EXISTS retrospection_runs (
  id                SERIAL          PRIMARY KEY,
  run_date          DATE            NOT NULL UNIQUE,
  personalities_evaluated INTEGER,
  evolutions_proposed     INTEGER,
  evolutions_applied      INTEGER,
  summary           JSONB,
  created_at        TIMESTAMPTZ     DEFAULT NOW()
);

-- ---- Timing analysis ------------------------------------
CREATE TABLE IF NOT EXISTS timing_analysis (
  id                SERIAL          PRIMARY KEY,
  analysis_date     DATE            NOT NULL,
  entry_time_bucket VARCHAR(10)     NOT NULL,  -- 9:15, 9:17, 9:20, 9:25, 9:30+
  underlying        VARCHAR(20),
  sample_size       INTEGER,
  win_rate          NUMERIC(5,4),
  avg_pnl           NUMERIC(10,2),
  created_at        TIMESTAMPTZ     DEFAULT NOW()
);
