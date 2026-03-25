// ============================================================
// Trade Engine — Shared TypeScript Types
// ============================================================

// ---- Enums & Literals -----------------------------------

export type Underlying = 'NIFTY' | 'BANKNIFTY' | 'SENSEX';
export type OptionType = 'CE' | 'PE';
export type SignalType = 'STRADDLE_SELL' | 'STRADDLE_BUY' | 'DIRECTIONAL_CE' | 'DIRECTIONAL_PE';
export type MarketRegime = 'LOW_VOL' | 'HIGH_VOL' | 'TRENDING' | 'RANGEBOUND';
export type StrategyType = 'NON_DIRECTIONAL' | 'DIRECTIONAL';
export type ExitReason = 'stoploss' | 'target' | 'eod' | 'trailing_sl';
export type SlippageModel = 'zero' | 'halfSpread' | 'custom';
export type FillMode = 'atClose' | 'atOpen';
export type DataSource = 'fyers' | 'mock';

// ---- Market Data ----------------------------------------

export interface StraddleSnapshot {
  timestamp: Date;
  underlying: Underlying;
  spotPrice: number;
  atmStrike: number;
  atmCallPrice: number;
  atmPutPrice: number;
  straddleValue: number;
  impliedVolatility: number;
  straddleChangeFromOpen: number;       // percentage
  straddleChangeFromPrevClose: number;  // percentage
  rateOfChange1m: number;
  rateOfChange5m: number;
  rocAcceleration: number;
  vix: number;
}

export interface ROCMetrics {
  roc1m: number;
  roc5m: number;
  roc10m: number;
  acceleration: number;
  rocDivergence: boolean;
  volumeConfirmation: boolean;
}

// Raw 1-min OHLCV bar as fetched from data source
export interface OHLCVBar {
  time: Date;
  underlying: Underlying;
  contractId?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
}

// Spot index bar (no contract)
export interface SpotBar {
  time: Date;
  underlying: Underlying;
  open: number;
  high: number;
  low: number;
  close: number;
  vix: number;
}

// ---- Signals --------------------------------------------

export interface TradingSignal {
  id: string;
  timestamp: Date;
  signalType: SignalType;
  underlying: Underlying;
  suggestedStrike: number;
  suggestedPrice: number;
  winProbability: number;
  expectedValue: number;
  confidenceInterval: [number, number];
  triggerReason: string;
  marketRegime: MarketRegime;
  timeOfDay: string;
  dayOfWeek: number;
  daysToExpiry: number;
  straddleValueAtSignal: number;
  rocAtSignal: number;
  vixAtSignal: number;
}

// ---- Personalities --------------------------------------

export interface TimeWindow {
  startTime: string;  // "09:20"
  endTime: string;    // "14:30"
}

export interface PerformanceMetrics {
  winRate30d: number;
  totalPnL30d: number;
  sharpe30d: number;
  maxDrawdown30d: number;
  tradesCount30d: number;
  lastUpdated: Date;
}

export interface PersonalityConfig {
  id: string;
  name: string;
  description: string;
  isActive: boolean;

  // Entry parameters
  minProbability: number;
  maxDailyTrades: number;
  entryDelaySeconds: number;
  allowedStrategies: StrategyType[];
  allowedUnderlyings: Underlying[];

  // Risk parameters
  maxLossPerTrade: number;
  maxDailyLoss: number;
  positionSizeMultiplier: number;

  // Profit gate
  requireProfitGate: boolean;
  profitGateThreshold: number;
  profitGateLookbackDays: number;

  // Time filters
  allowedTradingWindows: TimeWindow[];
  blockedDates: Date[];

  // Regime filters
  allowedRegimes: MarketRegime[];
  maxVix: number;
  minVix: number;

  // Re-entry
  allowReentry: boolean;
  reentryDelayMinutes: number;
  maxReentriesPerSignal: number;

  // Evolution metadata
  version: number;
  parentVersion: number | null;
  evolutionReason: string | null;
  performanceMetrics: PerformanceMetrics;
}

// ---- Option Contracts -----------------------------------

export interface OptionContract {
  id?: number;
  underlying: Underlying;
  symbol: string;
  strike: number;
  optionType: OptionType;
  expiryDate: Date;
  lotSize: number;
  source: DataSource | 'truedata';
}

// ---- Backtesting ----------------------------------------

export interface ChargeStructure {
  brokeragePer100k: number;   // as fraction e.g. 0.0003 = 0.03%
  stt: number;                // STT on sell side
  exchangeFee: number;        // NSE/BSE exchange fee
  gst: number;                // 18% on (brokerage + exchange)
  sebiTurnover: number;       // SEBI charges per crore
  stampDuty: number;          // on buy side
}

export interface BacktestConfig {
  startDate: Date;
  endDate: Date;
  underlying: Underlying[];
  personalities: PersonalityConfig[];
  slippageModel: SlippageModel;
  slippagePoints: number;        // used when slippageModel = 'custom'
  fillMode: FillMode;
  startingCapital: number;
  charges: ChargeStructure;
  runCalibration: boolean;
  runName?: string;
  dataSource: DataSource;
}

export interface BacktestTrade {
  id?: number;
  backtestId?: number;
  tradeDate: Date;
  personalityId: string;
  strategy: StrategyType;
  underlying: Underlying;
  entryTime: Date;
  exitTime: Date;
  entryPrice: number;
  exitPrice: number;
  lots: number;
  grossPnL: number;
  charges: number;
  netPnL: number;
  exitReason: ExitReason;
  marketRegime: MarketRegime;
  signalProb: number;
  vixAtEntry: number;
}

export interface EquityPoint {
  date: Date;
  equity: number;
}

export interface PersonalityBacktestResult {
  personalityId: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnL: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

export interface RegimeBreakdown {
  regime: MarketRegime;
  totalTrades: number;
  winRate: number;
  totalPnL: number;
}

export interface EntryTimeBucket {
  bucket: string;  // "9:15" | "9:17" | "9:20" | "9:25" | "9:30+"
  totalTrades: number;
  winRate: number;
  avgPnL: number;
}

export interface YearlyBreakdown {
  year: number;
  totalTrades: number;
  winRate: number;
  totalPnL: number;
  sharpeRatio: number;
}

export interface MonthlyBreakdown {
  month: string;  // "2024-01"
  totalTrades: number;
  winRate: number;
  totalPnL: number;
}

export interface CalibratedPriors {
  byUnderlying: Record<string, { winRate: number; sampleSize: number }>;
  byRegime: Record<MarketRegime, { winRate: number; sampleSize: number }>;
  byEntryTimeBucket: Record<string, { winRate: number; sampleSize: number }>;
  byDayOfWeek: Record<number, { winRate: number; sampleSize: number }>;
}

export interface BacktestResult {
  runId: number;
  runName: string;
  config: BacktestConfig;
  metrics: {
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    grossPnL: number;
    netPnL: number;
    maxDrawdown: number;
    sharpeRatio: number;
    calmarRatio: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    expectancy: number;
    finalEquity: number;
    returnPct: number;
  };
  byPersonality: PersonalityBacktestResult[];
  byRegime: RegimeBreakdown[];
  byEntryTimeBucket: EntryTimeBucket[];
  byMonth: MonthlyBreakdown[];
  byYear: YearlyBreakdown[];
  equityCurve: EquityPoint[];
  trades: BacktestTrade[];
  calibratedPriors?: CalibratedPriors;
}

// ---- Data Provider Interface ----------------------------

export interface DayData {
  date: Date;
  underlying: Underlying;
  snapshots: StraddleSnapshot[];
  marketOpen: Date;
  marketClose: Date;
  expiryDate: Date;
  daysToExpiry: number;
}

export interface HistoricalDataProvider {
  /** Returns trading days between startDate and endDate */
  getTradingDays(startDate: Date, endDate: Date, underlying: Underlying): Promise<Date[]>;

  /** Returns all 1-min straddle snapshots for a given date and underlying */
  getDayData(date: Date, underlying: Underlying): Promise<DayData | null>;

  /** Check if provider is ready (credentials valid, data available) */
  isReady(): Promise<boolean>;
}
