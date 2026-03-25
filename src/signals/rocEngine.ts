import { StraddleSnapshot, ROCMetrics } from '../types';

/**
 * Compute ROC metrics for a sliding window of straddle snapshots.
 * Call this after each new bar is appended.
 *
 * @param history - ordered array of snapshots (oldest first), including current bar
 * @returns ROCMetrics for the latest bar
 */
export function computeROC(history: StraddleSnapshot[]): ROCMetrics {
  const n = history.length;
  const current = history[n - 1];

  const prev1  = n >= 2  ? history[n - 2]  : null;
  const prev5  = n >= 6  ? history[n - 6]  : null;
  const prev10 = n >= 11 ? history[n - 11] : null;

  const roc1m  = prev1  ? current.straddleValue - prev1.straddleValue                      : 0;
  const roc5m  = prev5  ? (current.straddleValue - prev5.straddleValue)  / 5               : roc1m;
  const roc10m = prev10 ? (current.straddleValue - prev10.straddleValue) / 10              : roc5m;

  // Acceleration = change in roc1m vs previous bar's roc1m
  const prevRoc1m = prev1 && n >= 3
    ? prev1.straddleValue - history[n - 3].straddleValue
    : 0;
  const acceleration = roc1m - prevRoc1m;

  // Divergence: straddle at new high but ROC declining
  const straddleAtNewHigh =
    prev5 !== null && current.straddleValue >= Math.max(...history.slice(-5).map((s) => s.straddleValue));
  const rocDivergence = straddleAtNewHigh && roc1m < prevRoc1m;

  // Volume confirmation placeholder (no volume in straddle snapshots — always false for now)
  const volumeConfirmation = false;

  return { roc1m, roc5m, roc10m, acceleration, rocDivergence, volumeConfirmation };
}

/**
 * Returns true when the straddle shows classic momentum exhaustion:
 * premium was expanding but rate of change is decelerating.
 *
 * Threshold is tunable via the `decelerationThreshold` parameter.
 */
export function detectMomentumExhaustion(
  history: StraddleSnapshot[],
  decelerationThreshold = 0.5
): boolean {
  if (history.length < 3) return false;
  const metrics = computeROC(history);
  const wasExpanding     = metrics.roc1m > 0;
  const isDecelerating   = metrics.acceleration < 0;
  const significantEnough = Math.abs(metrics.acceleration) > decelerationThreshold;
  return wasExpanding && isDecelerating && significantEnough;
}

/**
 * Classify VIX level into a broad market regime.
 */
export function classifyRegime(
  vix: number,
  roc5m: number
): import('../types').MarketRegime {
  if (vix > 22) return 'HIGH_VOL';
  if (vix < 13 && Math.abs(roc5m) < 1.0) return 'RANGEBOUND';
  if (Math.abs(roc5m) > 3.0) return 'TRENDING';
  return 'LOW_VOL';
}
