-- ============================================================
-- Migration 002: Phase 0 — Historical Data & Backtesting Schema
-- ============================================================

-- ---- Option contract master (historical token registry) --
CREATE TABLE IF NOT EXISTS option_contracts (
  id            SERIAL          PRIMARY KEY,
  underlying    VARCHAR(20)     NOT NULL,
  symbol        VARCHAR(60)     NOT NULL UNIQUE,
  strike        INTEGER         NOT NULL,
  option_type   CHAR(2)         NOT NULL,   -- CE | PE
  expiry_date   DATE            NOT NULL,
  lot_size      INTEGER         NOT NULL,
  source        VARCHAR(30),                -- fyers | truedata | mock
  created_at    TIMESTAMPTZ     DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_option_contracts_lookup
  ON option_contracts (underlying, strike, option_type, expiry_date);

-- ---- Historical 1-min OHLCV -----------------------------
-- Separate hypertable from live market_ticks to avoid mixing live/historical
CREATE TABLE IF NOT EXISTS historical_ticks (
  time          TIMESTAMPTZ     NOT NULL,
  underlying    VARCHAR(20)     NOT NULL,
  contract_id   INTEGER         REFERENCES option_contracts(id),
  open          NUMERIC(10,2),
  high          NUMERIC(10,2),
  low           NUMERIC(10,2),
  close         NUMERIC(10,2),
  volume        INTEGER,
  oi            INTEGER
);
SELECT create_hypertable('historical_ticks', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_historical_ticks_contract ON historical_ticks (contract_id, time DESC);

-- ---- Historical spot data (Nifty/BankNifty index values) -
CREATE TABLE IF NOT EXISTS historical_spot (
  time          TIMESTAMPTZ     NOT NULL,
  underlying    VARCHAR(20)     NOT NULL,
  open          NUMERIC(10,2),
  high          NUMERIC(10,2),
  low           NUMERIC(10,2),
  close         NUMERIC(10,2),
  vix           NUMERIC(6,2)
);
SELECT create_hypertable('historical_spot', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_historical_spot_underlying ON historical_spot (underlying, time DESC);

-- ---- Backtest run metadata ------------------------------
CREATE TABLE IF NOT EXISTS backtest_runs (
  id                  SERIAL          PRIMARY KEY,
  run_name            VARCHAR(100),
  start_date          DATE            NOT NULL,
  end_date            DATE            NOT NULL,
  underlying          TEXT[]          NOT NULL,
  personality_config  JSONB           NOT NULL,
  slippage_model      VARCHAR(20)     DEFAULT 'halfSpread',
  fill_mode           VARCHAR(20)     DEFAULT 'atClose',
  starting_capital    NUMERIC(12,2)   DEFAULT 100000,
  results_summary     JSONB,          -- aggregate stats
  calibration_output  JSONB,          -- updated priors if calibration=true
  data_source         VARCHAR(20)     DEFAULT 'mock',  -- mock | fyers
  created_at          TIMESTAMPTZ     DEFAULT NOW()
);

-- ---- Individual backtest trades -------------------------
CREATE TABLE IF NOT EXISTS backtest_trades (
  id              SERIAL          PRIMARY KEY,
  backtest_id     INTEGER         REFERENCES backtest_runs(id) ON DELETE CASCADE,
  trade_date      DATE            NOT NULL,
  personality     VARCHAR(50),
  strategy        VARCHAR(50),
  underlying      VARCHAR(20),
  entry_time      TIMESTAMPTZ     NOT NULL,
  exit_time       TIMESTAMPTZ,
  entry_price     NUMERIC(10,2),
  exit_price      NUMERIC(10,2),
  lots            INTEGER,
  gross_pnl       NUMERIC(10,2),
  charges         NUMERIC(10,2),
  net_pnl         NUMERIC(10,2),
  exit_reason     VARCHAR(50),    -- stoploss | target | eod | trailing_sl
  market_regime   VARCHAR(20),
  signal_prob     NUMERIC(5,4),   -- probability score at entry
  vix_at_entry    NUMERIC(6,2)
);
CREATE INDEX IF NOT EXISTS idx_backtest_trades_run ON backtest_trades (backtest_id, trade_date);
