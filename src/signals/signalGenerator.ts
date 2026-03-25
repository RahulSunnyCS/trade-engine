import { v4 as uuidv4 } from 'uuid';
import {
  StraddleSnapshot,
  TradingSignal,
  MarketRegime,
  Underlying,
} from '../types';
import { detectMomentumExhaustion, computeROC, classifyRegime } from './rocEngine';
import { daysToExpiry } from './atmStrike';

// ---- Time helpers ---------------------------------------

function timeHHMM(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function isInWindow(date: Date, startHHMM: string, endHHMM: string): boolean {
  const t = timeHHMM(date);
  return t >= startHHMM && t <= endHHMM;
}

// ---- Probability adjustments ---------------------------

function applyAdjustments(
  baseProb: number,
  snapshot: StraddleSnapshot,
  regime: MarketRegime,
  dte: number
): number {
  let p = baseProb;
  if (snapshot.vix < 14) p += 0.05;
  if (snapshot.timestamp.getDay() === 4) p += 0.05; // Thursday expiry edge
  if (dte === 0) p += 0.10;                          // expiry day theta
  if (regime === 'HIGH_VOL') p -= 0.10;
  if (regime === 'RANGEBOUND') p += 0.05;
  return Math.min(0.95, Math.max(0.10, p));
}

// ---- Signal rules ---------------------------------------

/**
 * Evaluate a rolling history of snapshots and emit a TradingSignal if conditions are met.
 * Returns null if no signal fires.
 *
 * Two rules (matching spec Section 5.2.3):
 *   1. Momentum Exhaustion after Expansion
 *   2. Scheduled/time-based entry at 9:17 (fallback)
 */
export function evaluateSignals(
  history: StraddleSnapshot[],
  underlying: Underlying
): TradingSignal | null {
  if (history.length < 3) return null;

  const current = history[history.length - 1];
  const ts = current.timestamp;
  const time = timeHHMM(ts);
  const dte = daysToExpiry(ts, underlying);
  const metrics = computeROC(history);
  const regime = classifyRegime(current.vix, metrics.roc5m);
  const dow = ts.getDay();

  // ---- Rule 1: Momentum Exhaustion after Expansion ----
  if (
    isInWindow(ts, '09:20', '11:00') &&
    current.straddleChangeFromOpen > 10 &&
    detectMomentumExhaustion(history, 0.5)
  ) {
    const prob = applyAdjustments(0.55, current, regime, dte);
    return buildSignal({
      ts,
      underlying,
      current,
      regime,
      dte,
      dow,
      prob,
      roc: metrics.roc1m,
      triggerReason: 'Momentum exhaustion after ≥10% expansion from open',
    });
  }

  // ---- Rule 2: Scheduled entry at 9:17 (fallback) -----
  if (time === '09:17') {
    const prob = applyAdjustments(0.50, current, regime, dte);
    return buildSignal({
      ts,
      underlying,
      current,
      regime,
      dte,
      dow,
      prob,
      roc: metrics.roc1m,
      triggerReason: 'Scheduled 9:17 AM baseline entry',
    });
  }

  return null;
}

// ---- Internal builder -----------------------------------

interface SignalParams {
  ts: Date;
  underlying: Underlying;
  current: StraddleSnapshot;
  regime: MarketRegime;
  dte: number;
  dow: number;
  prob: number;
  roc: number;
  triggerReason: string;
}

function buildSignal(p: SignalParams): TradingSignal {
  const ci: [number, number] = [
    parseFloat((p.prob - 0.08).toFixed(4)),
    parseFloat((p.prob + 0.08).toFixed(4)),
  ];
  return {
    id: uuidv4(),
    timestamp: p.ts,
    signalType: 'STRADDLE_SELL',
    underlying: p.underlying,
    suggestedStrike: p.current.atmStrike,
    suggestedPrice: parseFloat(p.current.straddleValue.toFixed(2)),
    winProbability: parseFloat(p.prob.toFixed(4)),
    expectedValue: parseFloat((p.prob * p.current.straddleValue * 0.5 - (1 - p.prob) * p.current.straddleValue * 0.3).toFixed(2)),
    confidenceInterval: ci,
    triggerReason: p.triggerReason,
    marketRegime: p.regime,
    timeOfDay: timeHHMM(p.ts),
    dayOfWeek: p.dow,
    daysToExpiry: p.dte,
    straddleValueAtSignal: p.current.straddleValue,
    rocAtSignal: p.roc,
    vixAtSignal: p.current.vix,
  };
}
