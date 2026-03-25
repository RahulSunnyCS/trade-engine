/**
 * Backtesting Engine
 *
 * Replays historical data through the signal + personality pipeline
 * with strict zero look-ahead guarantee: data is fed one bar at a time.
 *
 * Fill model: atClose (conservative default) — entry fills at the close
 * price of the bar where the signal fired.
 */

import {
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  DayData,
  EquityPoint,
  PersonalityConfig,
  StraddleSnapshot,
  TradingSignal,
  Underlying,
  ExitReason,
  MarketRegime,
  StrategyType,
} from '../types';
import { evaluateSignals } from '../signals/signalGenerator';
import { classifyRegime, computeROC } from '../signals/rocEngine';
import { getLotSize } from '../signals/atmStrike';
import { calculateMetrics } from './metrics';

// ---- Charge calculation ---------------------------------

function calculateCharges(
  config: BacktestConfig,
  entryPrice: number,
  exitPrice: number,
  lots: number,
  lotSize: number
): number {
  const c = config.charges;
  const turnover = (entryPrice + exitPrice) * lots * lotSize;
  const brokerage = Math.min(20, turnover * c.brokeragePer100k);
  const stt = exitPrice * lots * lotSize * c.stt;
  const exchange = turnover * c.exchangeFee;
  const gst = (brokerage + exchange) * c.gst;
  const sebi = (turnover / 10_000_000) * c.sebiTurnover;
  const stamp = entryPrice * lots * lotSize * c.stampDuty;
  return parseFloat((brokerage + stt + exchange + gst + sebi + stamp).toFixed(2));
}

// ---- Slippage -------------------------------------------

function applySlippage(price: number, config: BacktestConfig, isBuy: boolean): number {
  if (config.slippageModel === 'zero') return price;
  if (config.slippageModel === 'custom') {
    return isBuy ? price + config.slippagePoints : price - config.slippagePoints;
  }
  // halfSpread: approximate as 0.1% of price each side
  const slip = price * 0.001;
  return isBuy ? price + slip : price - slip;
}

// ---- Personality filter ---------------------------------

function personalityAllows(
  personality: PersonalityConfig,
  signal: TradingSignal,
  dayTrades: number,
  snapshot: StraddleSnapshot
): boolean {
  if (!personality.isActive) return false;
  if (signal.winProbability < personality.minProbability) return false;
  if (dayTrades >= personality.maxDailyTrades) return false;
  if (snapshot.vix > personality.maxVix) return false;
  if (snapshot.vix < personality.minVix) return false;
  if (!personality.allowedRegimes.includes(signal.marketRegime)) return false;
  if (!personality.allowedUnderlyings.includes(signal.underlying)) return false;

  // Time window check
  const timeStr = signal.timeOfDay;
  const inWindow = personality.allowedTradingWindows.some(
    (w) => timeStr >= w.startTime && timeStr <= w.endTime
  );
  if (!inWindow) return false;

  return true;
}

// ---- Trade simulation -----------------------------------

function simulateTrade(
  signal: TradingSignal,
  personality: PersonalityConfig,
  dayData: DayData,
  config: BacktestConfig,
  entrySnapshot: StraddleSnapshot
): BacktestTrade {
  const underlying = signal.underlying;
  const lotSize = getLotSize(underlying);
  const lots = personality.positionSizeMultiplier >= 1
    ? Math.max(1, Math.round(personality.positionSizeMultiplier))
    : 1;

  const entryPrice = applySlippage(entrySnapshot.straddleValue, config, true);

  let exitPrice = entryPrice;
  let exitReason: ExitReason = 'eod';
  let exitTime = dayData.marketClose;

  // Simulate forward from entry bar — check stop-loss
  const entryIdx = dayData.snapshots.findIndex(
    (s) => s.timestamp >= entrySnapshot.timestamp
  );

  for (let i = entryIdx + 1; i < dayData.snapshots.length; i++) {
    const snap = dayData.snapshots[i];
    const pnlPct = (snap.straddleValue - entryPrice) / entryPrice;

    // For STRADDLE_SELL: adverse move is premium increasing
    if (signal.signalType === 'STRADDLE_SELL' && pnlPct > 0.15) {
      exitPrice = applySlippage(snap.straddleValue, config, false);
      exitReason = 'stoploss';
      exitTime = snap.timestamp;
      break;
    }

    // Target: premium decays by 40%
    if (signal.signalType === 'STRADDLE_SELL' && pnlPct < -0.40) {
      exitPrice = applySlippage(snap.straddleValue, config, false);
      exitReason = 'target';
      exitTime = snap.timestamp;
      break;
    }
  }

  // EOD exit
  if (exitReason === 'eod') {
    const eodSnap = dayData.snapshots[dayData.snapshots.length - 1];
    exitPrice = applySlippage(eodSnap.straddleValue, config, false);
    exitTime = eodSnap.timestamp;
  }

  // P&L for short straddle: entry - exit (we sold premium, want it to fall)
  const grossPnL =
    signal.signalType === 'STRADDLE_SELL'
      ? (entryPrice - exitPrice) * lots * lotSize
      : (exitPrice - entryPrice) * lots * lotSize;

  const charges = calculateCharges(config, entryPrice, exitPrice, lots, lotSize);
  const netPnL = parseFloat((grossPnL - charges).toFixed(2));

  const regime: MarketRegime = classifyRegime(
    entrySnapshot.vix,
    computeROC(dayData.snapshots.slice(0, entryIdx + 1)).roc5m
  );

  return {
    tradeDate: dayData.date,
    personalityId: personality.id,
    strategy: personality.allowedStrategies[0] as StrategyType,
    underlying,
    entryTime: entrySnapshot.timestamp,
    exitTime,
    entryPrice: parseFloat(entryPrice.toFixed(2)),
    exitPrice: parseFloat(exitPrice.toFixed(2)),
    lots,
    grossPnL: parseFloat(grossPnL.toFixed(2)),
    charges,
    netPnL,
    exitReason,
    marketRegime: regime,
    signalProb: signal.winProbability,
    vixAtEntry: entrySnapshot.vix,
  };
}

// ---- Main Backtester ------------------------------------

export class Backtester {
  constructor(private readonly config: BacktestConfig) {}

  async run(
    provider: import('../types').HistoricalDataProvider,
    onProgress?: (day: Date, underlying: Underlying, done: number, total: number) => void
  ): Promise<BacktestResult> {
    const allTrades: BacktestTrade[] = [];
    let equity = this.config.startingCapital;
    const equityCurve: EquityPoint[] = [
      { date: this.config.startDate, equity },
    ];

    for (const underlying of this.config.underlying) {
      const tradingDays = await provider.getTradingDays(
        this.config.startDate,
        this.config.endDate,
        underlying
      );

      for (let dayIdx = 0; dayIdx < tradingDays.length; dayIdx++) {
        const date = tradingDays[dayIdx];
        const dayData = await provider.getDayData(date, underlying);
        if (!dayData || dayData.snapshots.length === 0) continue;

        onProgress?.(date, underlying, dayIdx + 1, tradingDays.length);

        const dayTrades = await this.processDay(dayData, underlying);
        allTrades.push(...dayTrades);

        const dayPnL = dayTrades.reduce((sum, t) => sum + t.netPnL, 0);
        equity += dayPnL;
        equityCurve.push({ date, equity });
      }
    }

    return calculateMetrics(allTrades, equityCurve, this.config);
  }

  private async processDay(
    dayData: DayData,
    underlying: Underlying
  ): Promise<BacktestTrade[]> {
    const trades: BacktestTrade[] = [];
    const history: StraddleSnapshot[] = [];

    // Track how many trades each personality has taken today
    const personalityDayCount = new Map<string, number>(
      this.config.personalities.map((p) => [p.id, 0])
    );

    for (const snapshot of dayData.snapshots) {
      history.push(snapshot);

      // Zero look-ahead: signal evaluated only on data up to this bar
      const signal = evaluateSignals(history, underlying);
      if (!signal) continue;

      // Evaluate each personality
      for (const personality of this.config.personalities) {
        const dayCount = personalityDayCount.get(personality.id) ?? 0;
        if (!personalityAllows(personality, signal, dayCount, snapshot)) continue;

        // Entry delay: find snapshot closest to signal.timestamp + delaySeconds
        const entryTargetMs =
          snapshot.timestamp.getTime() + personality.entryDelaySeconds * 1000;
        const entrySnapshot =
          dayData.snapshots.find((s) => s.timestamp.getTime() >= entryTargetMs) ??
          snapshot;

        const trade = simulateTrade(signal, personality, dayData, this.config, entrySnapshot);
        trades.push(trade);
        personalityDayCount.set(personality.id, dayCount + 1);
      }
    }

    return trades;
  }
}
