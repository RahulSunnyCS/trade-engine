import {
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  CalibratedPriors,
  EntryTimeBucket,
  EquityPoint,
  MarketRegime,
  MonthlyBreakdown,
  PersonalityBacktestResult,
  RegimeBreakdown,
  YearlyBreakdown,
} from '../types';

// ---- Helpers --------------------------------------------

function winRate(trades: BacktestTrade[]): number {
  if (trades.length === 0) return 0;
  return trades.filter((t) => t.netPnL > 0).length / trades.length;
}

function maxDrawdown(curve: EquityPoint[]): number {
  let peak = -Infinity;
  let dd = 0;
  for (const p of curve) {
    if (p.equity > peak) peak = p.equity;
    const drawdown = (peak - p.equity) / peak;
    if (drawdown > dd) dd = drawdown;
  }
  return parseFloat((dd * 100).toFixed(2)); // as percentage
}

function sharpeRatio(trades: BacktestTrade[]): number {
  if (trades.length < 2) return 0;
  // Group P&L by day, treat each day as a return
  const dailyPnL = new Map<string, number>();
  for (const t of trades) {
    const key = t.tradeDate.toISOString().slice(0, 10);
    dailyPnL.set(key, (dailyPnL.get(key) ?? 0) + t.netPnL);
  }
  const returns = Array.from(dailyPnL.values());
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(
    returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1)
  );
  if (std === 0) return 0;
  return parseFloat(((mean / std) * Math.sqrt(252)).toFixed(3));
}

function entryTimeBucket(time: string): string {
  if (time <= '09:15') return '9:15';
  if (time <= '09:17') return '9:17';
  if (time <= '09:20') return '9:20';
  if (time <= '09:25') return '9:25';
  return '9:30+';
}

// ---- Main aggregation -----------------------------------

export function calculateMetrics(
  trades: BacktestTrade[],
  equityCurve: EquityPoint[],
  config: BacktestConfig
): BacktestResult {
  const wins   = trades.filter((t) => t.netPnL > 0);
  const losses = trades.filter((t) => t.netPnL <= 0);

  const grossPnL  = trades.reduce((s, t) => s + t.grossPnL, 0);
  const netPnL    = trades.reduce((s, t) => s + t.netPnL,   0);
  const avgWin    = wins.length   > 0 ? wins.reduce((s, t)   => s + t.netPnL, 0) / wins.length   : 0;
  const avgLoss   = losses.length > 0 ? losses.reduce((s, t) => s + t.netPnL, 0) / losses.length : 0;
  const totalWins = wins.reduce((s, t) => s + t.netPnL, 0);
  const totalLoss = Math.abs(losses.reduce((s, t) => s + t.netPnL, 0));

  const mdd          = maxDrawdown(equityCurve);
  const sharpe       = sharpeRatio(trades);
  const finalEquity  = equityCurve[equityCurve.length - 1]?.equity ?? config.startingCapital;
  const returnPct    = ((finalEquity - config.startingCapital) / config.startingCapital) * 100;
  const calmar       = mdd > 0 ? parseFloat((returnPct / mdd).toFixed(3)) : 0;
  const profitFactor = totalLoss > 0 ? parseFloat((totalWins / totalLoss).toFixed(3)) : 0;
  const expectancy   = trades.length > 0 ? netPnL / trades.length : 0;

  // ---- Per personality ----
  const personalityIds = [...new Set(trades.map((t) => t.personalityId))];
  const byPersonality: PersonalityBacktestResult[] = personalityIds.map((pid) => {
    const pt = trades.filter((t) => t.personalityId === pid);
    const pw = pt.filter((t) => t.netPnL > 0);
    const pCurve = buildEquityCurve(pt, config.startingCapital);
    return {
      personalityId: pid,
      totalTrades: pt.length,
      wins: pw.length,
      losses: pt.length - pw.length,
      winRate: parseFloat(winRate(pt).toFixed(4)),
      totalPnL: parseFloat(pt.reduce((s, t) => s + t.netPnL, 0).toFixed(2)),
      avgWin:  parseFloat((pw.length ? pw.reduce((s, t) => s + t.netPnL, 0) / pw.length : 0).toFixed(2)),
      avgLoss: parseFloat((pt.filter((t) => t.netPnL <= 0).length
        ? pt.filter((t) => t.netPnL <= 0).reduce((s, t) => s + t.netPnL, 0) /
          pt.filter((t) => t.netPnL <= 0).length
        : 0).toFixed(2)),
      maxDrawdown: maxDrawdown(pCurve),
      sharpeRatio: sharpeRatio(pt),
    };
  });

  // ---- Per regime ----
  const regimes = ['LOW_VOL', 'HIGH_VOL', 'TRENDING', 'RANGEBOUND'] as MarketRegime[];
  const byRegime: RegimeBreakdown[] = regimes
    .map((regime) => {
      const rt = trades.filter((t) => t.marketRegime === regime);
      return {
        regime,
        totalTrades: rt.length,
        winRate: parseFloat(winRate(rt).toFixed(4)),
        totalPnL: parseFloat(rt.reduce((s, t) => s + t.netPnL, 0).toFixed(2)),
      };
    })
    .filter((r) => r.totalTrades > 0);

  // ---- Per entry time bucket ----
  const buckets = ['9:15', '9:17', '9:20', '9:25', '9:30+'];
  const byEntryTimeBucket: EntryTimeBucket[] = buckets
    .map((bucket) => {
      const bt = trades.filter((t) => entryTimeBucket(t.entryTime.toTimeString().slice(0, 5)) === bucket);
      return {
        bucket,
        totalTrades: bt.length,
        winRate: parseFloat(winRate(bt).toFixed(4)),
        avgPnL: bt.length ? parseFloat((bt.reduce((s, t) => s + t.netPnL, 0) / bt.length).toFixed(2)) : 0,
      };
    })
    .filter((b) => b.totalTrades > 0);

  // ---- Monthly ----
  const monthMap = new Map<string, BacktestTrade[]>();
  for (const t of trades) {
    const key = t.tradeDate.toISOString().slice(0, 7);
    if (!monthMap.has(key)) monthMap.set(key, []);
    monthMap.get(key)!.push(t);
  }
  const byMonth: MonthlyBreakdown[] = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, mt]) => ({
      month,
      totalTrades: mt.length,
      winRate: parseFloat(winRate(mt).toFixed(4)),
      totalPnL: parseFloat(mt.reduce((s, t) => s + t.netPnL, 0).toFixed(2)),
    }));

  // ---- Yearly ----
  const yearMap = new Map<number, BacktestTrade[]>();
  for (const t of trades) {
    const y = t.tradeDate.getFullYear();
    if (!yearMap.has(y)) yearMap.set(y, []);
    yearMap.get(y)!.push(t);
  }
  const byYear: YearlyBreakdown[] = [...yearMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, yt]) => ({
      year,
      totalTrades: yt.length,
      winRate: parseFloat(winRate(yt).toFixed(4)),
      totalPnL: parseFloat(yt.reduce((s, t) => s + t.netPnL, 0).toFixed(2)),
      sharpeRatio: sharpeRatio(yt),
    }));

  // ---- Calibrated priors (if requested) ----
  const calibratedPriors: CalibratedPriors | undefined = config.runCalibration
    ? buildCalibratedPriors(trades)
    : undefined;

  return {
    runId: 0,
    runName: config.runName ?? 'Unnamed run',
    config,
    metrics: {
      totalTrades: trades.length,
      wins: wins.length,
      losses: losses.length,
      winRate: parseFloat(winRate(trades).toFixed(4)),
      grossPnL: parseFloat(grossPnL.toFixed(2)),
      netPnL: parseFloat(netPnL.toFixed(2)),
      maxDrawdown: mdd,
      sharpeRatio: sharpe,
      calmarRatio: calmar,
      avgWin: parseFloat(avgWin.toFixed(2)),
      avgLoss: parseFloat(avgLoss.toFixed(2)),
      profitFactor,
      expectancy: parseFloat(expectancy.toFixed(2)),
      finalEquity: parseFloat(finalEquity.toFixed(2)),
      returnPct: parseFloat(returnPct.toFixed(2)),
    },
    byPersonality,
    byRegime,
    byEntryTimeBucket,
    byMonth,
    byYear,
    equityCurve,
    trades,
    calibratedPriors,
  };
}

// ---- Helpers --------------------------------------------

function buildEquityCurve(trades: BacktestTrade[], startingCapital: number): EquityPoint[] {
  const sorted = [...trades].sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());
  let equity = startingCapital;
  const curve: EquityPoint[] = [{ date: sorted[0]?.tradeDate ?? new Date(), equity }];
  for (const t of sorted) {
    equity += t.netPnL;
    curve.push({ date: t.tradeDate, equity });
  }
  return curve;
}

function buildCalibratedPriors(trades: BacktestTrade[]): CalibratedPriors {
  const underlyings = [...new Set(trades.map((t) => t.underlying))];
  const regimes: MarketRegime[] = ['LOW_VOL', 'HIGH_VOL', 'TRENDING', 'RANGEBOUND'];
  const buckets = ['9:15', '9:17', '9:20', '9:25', '9:30+'];
  const days = [0, 1, 2, 3, 4, 5, 6];

  function priorFromTrades(subset: BacktestTrade[]) {
    return { winRate: parseFloat(winRate(subset).toFixed(4)), sampleSize: subset.length };
  }

  function bucketOf(t: BacktestTrade): string {
    const hhmm = t.entryTime.toTimeString().slice(0, 5);
    if (hhmm <= '09:15') return '9:15';
    if (hhmm <= '09:17') return '9:17';
    if (hhmm <= '09:20') return '9:20';
    if (hhmm <= '09:25') return '9:25';
    return '9:30+';
  }

  return {
    byUnderlying: Object.fromEntries(
      underlyings.map((u) => [u, priorFromTrades(trades.filter((t) => t.underlying === u))])
    ),
    byRegime: Object.fromEntries(
      regimes.map((r) => [r, priorFromTrades(trades.filter((t) => t.marketRegime === r))])
    ) as Record<MarketRegime, { winRate: number; sampleSize: number }>,
    byEntryTimeBucket: Object.fromEntries(
      buckets.map((b) => [b, priorFromTrades(trades.filter((t) => bucketOf(t) === b))])
    ),
    byDayOfWeek: Object.fromEntries(
      days.map((d) => [d, priorFromTrades(trades.filter((t) => t.tradeDate.getDay() === d))])
    ),
  };
}
