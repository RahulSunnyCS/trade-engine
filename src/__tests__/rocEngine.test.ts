import { computeROC, detectMomentumExhaustion, classifyRegime } from '../signals/rocEngine';
import { StraddleSnapshot } from '../types';

function makeSnapshot(straddleValue: number, minutesOffset = 0): StraddleSnapshot {
  const ts = new Date('2024-01-04T09:15:00');
  ts.setMinutes(ts.getMinutes() + minutesOffset);
  return {
    timestamp: ts,
    underlying: 'NIFTY',
    spotPrice: 22000,
    atmStrike: 22000,
    atmCallPrice: straddleValue / 2,
    atmPutPrice: straddleValue / 2,
    straddleValue,
    impliedVolatility: 0.12,
    straddleChangeFromOpen: 0,
    straddleChangeFromPrevClose: 0,
    rateOfChange1m: 0,
    rateOfChange5m: 0,
    rocAcceleration: 0,
    vix: 12,
  };
}

describe('computeROC', () => {
  test('roc1m is 0 for single bar', () => {
    const history = [makeSnapshot(200)];
    const metrics = computeROC(history);
    expect(metrics.roc1m).toBe(0);
  });

  test('roc1m reflects 1-bar delta', () => {
    const history = [makeSnapshot(200), makeSnapshot(205)];
    const metrics = computeROC(history);
    expect(metrics.roc1m).toBe(5);
  });

  test('roc5m averages over 5 bars', () => {
    const history = [200, 202, 204, 206, 208, 220].map((v, i) => makeSnapshot(v, i));
    const metrics = computeROC(history);
    // roc5m = (220 - 200) / 5 = 4
    expect(metrics.roc5m).toBeCloseTo(4);
  });

  test('acceleration is change in roc1m', () => {
    // bar[-2]=200, bar[-1]=205, current=209 → roc1m=4, prevRoc1m=5, acceleration=-1
    const history = [makeSnapshot(200), makeSnapshot(205), makeSnapshot(209)];
    const metrics = computeROC(history);
    expect(metrics.roc1m).toBe(4);
    expect(metrics.acceleration).toBe(-1);
  });
});

describe('detectMomentumExhaustion', () => {
  test('returns false for insufficient history', () => {
    expect(detectMomentumExhaustion([makeSnapshot(200)])).toBe(false);
  });

  test('detects exhaustion: expanding then decelerating', () => {
    // Strong upward move then deceleration
    const history = [
      makeSnapshot(200),
      makeSnapshot(210), // roc1m=10
      makeSnapshot(212), // roc1m=2 → acceleration=-8 (< -0.5)
    ];
    expect(detectMomentumExhaustion(history, 0.5)).toBe(true);
  });

  test('no exhaustion when still accelerating', () => {
    const history = [
      makeSnapshot(200),
      makeSnapshot(205),  // roc1m=5
      makeSnapshot(215),  // roc1m=10 → acceleration=+5
    ];
    expect(detectMomentumExhaustion(history)).toBe(false);
  });
});

describe('classifyRegime', () => {
  test('HIGH_VOL when vix > 22', () => {
    expect(classifyRegime(23, 0)).toBe('HIGH_VOL');
  });

  test('RANGEBOUND when vix < 13 and low roc5m', () => {
    expect(classifyRegime(12, 0.5)).toBe('RANGEBOUND');
  });

  test('TRENDING when high roc5m', () => {
    expect(classifyRegime(15, 4)).toBe('TRENDING');
  });

  test('LOW_VOL otherwise', () => {
    expect(classifyRegime(15, 1)).toBe('LOW_VOL');
  });
});
