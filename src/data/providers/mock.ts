/**
 * Mock Historical Data Provider
 *
 * Generates realistic synthetic ATM straddle data for Nifty/BankNifty.
 * Produces day sessions of 1-min bars from 9:15 to 15:30 IST.
 * Uses mean-reverting GBM with intraday volatility patterns
 * (higher vol at open + close, lower in mid-session).
 *
 * Purpose: lets the backtest engine run end-to-end without Fyers credentials.
 * Swap for FyersProvider once credentials are available — no other code changes needed.
 */

import { Underlying, StraddleSnapshot, DayData, HistoricalDataProvider } from '../../types';
import { calculateATMStrike, daysToExpiry } from '../../signals/atmStrike';

// ---- Baseline parameters --------------------------------

interface UnderlyingParams {
  baseSpot: number;
  spotDailyVolPct: number;   // annualised vol for spot GBM
  baseIV: number;            // typical ATM IV (e.g. 0.12 = 12%)
  ivDailyRange: number;      // +/- random daily shift in IV
}

const UNDERLYING_PARAMS: Record<Underlying, UnderlyingParams> = {
  NIFTY:     { baseSpot: 22000, spotDailyVolPct: 0.12, baseIV: 0.12, ivDailyRange: 0.03 },
  BANKNIFTY: { baseSpot: 48000, spotDailyVolPct: 0.18, baseIV: 0.16, ivDailyRange: 0.05 },
  SENSEX:    { baseSpot: 73000, spotDailyVolPct: 0.12, baseIV: 0.13, ivDailyRange: 0.03 },
};

// Indian market session in minutes from midnight IST
const MARKET_OPEN_MINUTES  = 9 * 60 + 15;   // 9:15
const MARKET_CLOSE_MINUTES = 15 * 60 + 30;  // 15:30
const BARS_PER_DAY         = MARKET_CLOSE_MINUTES - MARKET_OPEN_MINUTES; // 375 bars

// ---- Helpers --------------------------------------------

/** Seeded pseudo-random number generator (mulberry32) */
function makePrng(seed: number) {
  let s = seed >>> 0;
  return function (): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller normal sample from uniform rng */
function normalSample(rand: () => number): number {
  const u1 = Math.max(1e-10, rand());
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Approximate Black-Scholes ATM straddle price.
 * For ATM: straddle ≈ 2 * S * IV * sqrt(T) * 0.3989...
 */
function atmStraddlePrice(spot: number, iv: number, dteYears: number): number {
  if (dteYears <= 0) return spot * iv * 0.001; // expiry day — very small theta
  return 2 * spot * iv * Math.sqrt(dteYears) * 0.3989422804;
}

/** Convert date to a stable integer seed */
function dateSeed(date: Date, underlying: Underlying): number {
  const base = underlying === 'NIFTY' ? 1 : underlying === 'BANKNIFTY' ? 2 : 3;
  return (
    base * 1e8 +
    date.getFullYear() * 10000 +
    (date.getMonth() + 1) * 100 +
    date.getDate()
  );
}

/** Check if a date is a weekday (Mon-Fri). Doesn't model Indian holidays. */
function isWeekday(date: Date): boolean {
  const dow = date.getDay();
  return dow >= 1 && dow <= 5;
}

/** Generate all weekdays between two dates inclusive */
function getWeekdays(startDate: Date, endDate: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(startDate);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    if (isWeekday(cur)) days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/** Intraday volatility multiplier — higher at open and close */
function intradayVolMultiplier(minuteOfDay: number): number {
  // Parabola peaking at open (0 min) and close (375 min), trough at mid
  const x = minuteOfDay / BARS_PER_DAY; // 0 → 1
  return 1.0 + 1.5 * (4 * x * x - 4 * x + 1); // U-shaped
}

// ---- Core generator -------------------------------------

function generateDaySnapshots(
  date: Date,
  underlying: Underlying,
  prevDayClose: number | null
): { snapshots: StraddleSnapshot[]; closeSpot: number } {
  const params = UNDERLYING_PARAMS[underlying];
  const rand = makePrng(dateSeed(date, underlying));

  // Daily IV with random shift
  const dailyIV = params.baseIV + (rand() - 0.5) * 2 * params.ivDailyRange;

  // Starting spot — either from prev close or base with random walk
  let spot = prevDayClose ?? params.baseSpot * (0.95 + rand() * 0.10);

  // Compute opening straddle value for reference
  const dte = daysToExpiry(date, underlying);
  const dteYears = dte / 252;

  const snapshots: StraddleSnapshot[] = [];
  const dailyVolPerMin = (params.spotDailyVolPct / Math.sqrt(252)) / Math.sqrt(BARS_PER_DAY);

  let prevRoc1m = 0;
  let openStraddleValue: number | null = null;
  let prevDayCloseStraddle = 0; // simplified: no prev data for first day

  for (let bar = 0; bar < BARS_PER_DAY; bar++) {
    const barDate = new Date(date);
    barDate.setHours(
      Math.floor(MARKET_OPEN_MINUTES / 60) + Math.floor((MARKET_OPEN_MINUTES % 60 + bar) / 60),
      (MARKET_OPEN_MINUTES % 60 + bar) % 60,
      0,
      0
    );

    // GBM step with intraday vol scaling
    const volMul = intradayVolMultiplier(bar);
    const dSpot = spot * dailyVolPerMin * volMul * normalSample(rand);
    spot = Math.max(spot * 0.8, spot + dSpot); // floor at 80% to avoid negatives

    const atmStrike = calculateATMStrike(spot, underlying);
    const timeRemainingYears = Math.max(0, dteYears - bar / (252 * BARS_PER_DAY));
    const callPrice = atmStraddlePrice(spot, dailyIV, timeRemainingYears) / 2;
    const putPrice = callPrice; // ATM symmetry approximation
    const straddleValue = callPrice + putPrice;

    if (openStraddleValue === null) {
      openStraddleValue = straddleValue;
      prevDayCloseStraddle = straddleValue * (0.95 + rand() * 0.10);
    }

    const roc1m = bar === 0 ? 0 : straddleValue - snapshots[bar - 1].straddleValue;
    const roc5m =
      bar < 5
        ? roc1m
        : (straddleValue - snapshots[bar - 5].straddleValue) / 5;
    const rocAcceleration = roc1m - prevRoc1m;
    prevRoc1m = roc1m;

    // VIX: simulate around India VIX baseline with daily noise
    const vix = Math.max(8, 13 + (rand() - 0.5) * 8);

    snapshots.push({
      timestamp: barDate,
      underlying,
      spotPrice: parseFloat(spot.toFixed(2)),
      atmStrike,
      atmCallPrice: parseFloat(callPrice.toFixed(2)),
      atmPutPrice: parseFloat(putPrice.toFixed(2)),
      straddleValue: parseFloat(straddleValue.toFixed(2)),
      impliedVolatility: parseFloat(dailyIV.toFixed(4)),
      straddleChangeFromOpen: parseFloat(
        (((straddleValue - openStraddleValue) / openStraddleValue) * 100).toFixed(4)
      ),
      straddleChangeFromPrevClose: parseFloat(
        (((straddleValue - prevDayCloseStraddle) / prevDayCloseStraddle) * 100).toFixed(4)
      ),
      rateOfChange1m: parseFloat(roc1m.toFixed(4)),
      rateOfChange5m: parseFloat(roc5m.toFixed(4)),
      rocAcceleration: parseFloat(rocAcceleration.toFixed(4)),
      vix: parseFloat(vix.toFixed(2)),
    });
  }

  return { snapshots, closeSpot: spot };
}

// ---- Provider implementation ----------------------------

export class MockDataProvider implements HistoricalDataProvider {
  private spotCache = new Map<string, number>();

  async isReady(): Promise<boolean> {
    return true;
  }

  async getTradingDays(startDate: Date, endDate: Date, underlying: Underlying): Promise<Date[]> {
    void underlying; // same weekday logic regardless of underlying
    return getWeekdays(startDate, endDate);
  }

  async getDayData(date: Date, underlying: Underlying): Promise<DayData | null> {
    if (!isWeekday(date)) return null;

    const cacheKey = `${underlying}_${date.toISOString().slice(0, 10)}`;
    const prevKey = this.getPrevDayCacheKey(date, underlying);
    const prevClose = this.spotCache.get(prevKey) ?? null;

    const { snapshots, closeSpot } = generateDaySnapshots(date, underlying, prevClose);
    this.spotCache.set(cacheKey, closeSpot);

    if (snapshots.length === 0) return null;

    const marketOpen = snapshots[0].timestamp;
    const marketClose = snapshots[snapshots.length - 1].timestamp;
    const expiryDate = new Date(getNearestExpiryDate(date, underlying));
    const dte = daysToExpiry(date, underlying);

    return {
      date,
      underlying,
      snapshots,
      marketOpen,
      marketClose,
      expiryDate,
      daysToExpiry: dte,
    };
  }

  private getPrevDayCacheKey(date: Date, underlying: Underlying): string {
    const prev = new Date(date);
    prev.setDate(prev.getDate() - 1);
    while (prev.getDay() === 0 || prev.getDay() === 6) {
      prev.setDate(prev.getDate() - 1);
    }
    return `${underlying}_${prev.toISOString().slice(0, 10)}`;
  }
}

// Re-export helper used inside getDayData
function getNearestExpiryDate(date: Date, underlying: Underlying): Date {
  const expiryDow = underlying === 'SENSEX' ? 5 : 4;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const currentDow = d.getDay();
  const daysUntil = (expiryDow - currentDow + 7) % 7;
  const expiry = new Date(d);
  expiry.setDate(d.getDate() + daysUntil);
  return expiry;
}
