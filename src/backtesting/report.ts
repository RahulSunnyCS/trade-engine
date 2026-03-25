/**
 * Backtest Report Generator
 * Prints a human-readable summary to stdout and returns a JSON-serialisable object.
 */

import { BacktestResult } from '../types';

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function inr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function pad(s: string, width: number): string {
  return s.padEnd(width);
}

export function printReport(result: BacktestResult): void {
  const { metrics, config } = result;
  const sep = '─'.repeat(60);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  BACKTEST REPORT — ${result.runName}`);
  console.log(`  ${config.startDate.toISOString().slice(0, 10)} → ${config.endDate.toISOString().slice(0, 10)}`);
  console.log(`  Underlyings : ${config.underlying.join(', ')}`);
  console.log(`  Personalities: ${config.personalities.map((p) => p.name).join(', ')}`);
  console.log(`  Slippage    : ${config.slippageModel}`);
  console.log(`  Data source : ${config.dataSource}`);
  console.log('═'.repeat(60));

  console.log('\n── OVERALL METRICS ─────────────────────────────────────');
  console.log(`  Total trades   : ${metrics.totalTrades}`);
  console.log(`  Win rate       : ${pct(metrics.winRate)}  (${metrics.wins}W / ${metrics.losses}L)`);
  console.log(`  Gross P&L      : ${inr(metrics.grossPnL)}`);
  console.log(`  Net P&L        : ${inr(metrics.netPnL)}`);
  console.log(`  Return         : ${metrics.returnPct.toFixed(2)}%`);
  console.log(`  Final equity   : ${inr(metrics.finalEquity)}`);
  console.log(`  Max drawdown   : ${metrics.maxDrawdown.toFixed(2)}%`);
  console.log(`  Sharpe ratio   : ${metrics.sharpeRatio}`);
  console.log(`  Calmar ratio   : ${metrics.calmarRatio}`);
  console.log(`  Profit factor  : ${metrics.profitFactor}`);
  console.log(`  Avg win        : ${inr(metrics.avgWin)}`);
  console.log(`  Avg loss       : ${inr(metrics.avgLoss)}`);
  console.log(`  Expectancy/trade: ${inr(metrics.expectancy)}`);

  if (result.byPersonality.length > 0) {
    console.log(`\n── BY PERSONALITY ${'─'.repeat(43)}`);
    console.log(`  ${pad('Name', 14)} ${pad('Trades', 7)} ${pad('WinRate', 9)} ${pad('NetP&L', 12)} Sharpe`);
    console.log(`  ${sep}`);
    for (const p of result.byPersonality) {
      const name = config.personalities.find((x) => x.id === p.personalityId)?.name ?? p.personalityId;
      console.log(
        `  ${pad(name, 14)} ${pad(String(p.totalTrades), 7)} ${pad(pct(p.winRate), 9)} ${pad(inr(p.totalPnL), 12)} ${p.sharpeRatio}`
      );
    }
  }

  if (result.byRegime.length > 0) {
    console.log(`\n── BY MARKET REGIME ${'─'.repeat(41)}`);
    console.log(`  ${pad('Regime', 14)} ${pad('Trades', 7)} ${pad('WinRate', 9)} NetP&L`);
    console.log(`  ${sep}`);
    for (const r of result.byRegime) {
      console.log(
        `  ${pad(r.regime, 14)} ${pad(String(r.totalTrades), 7)} ${pad(pct(r.winRate), 9)} ${inr(r.totalPnL)}`
      );
    }
  }

  if (result.byEntryTimeBucket.length > 0) {
    console.log(`\n── BY ENTRY TIME ${'─'.repeat(44)}`);
    console.log(`  ${pad('Bucket', 10)} ${pad('Trades', 7)} ${pad('WinRate', 9)} AvgP&L`);
    console.log(`  ${sep}`);
    for (const b of result.byEntryTimeBucket) {
      console.log(
        `  ${pad(b.bucket, 10)} ${pad(String(b.totalTrades), 7)} ${pad(pct(b.winRate), 9)} ${inr(b.avgPnL)}`
      );
    }
  }

  if (result.byYear.length > 0) {
    console.log(`\n── BY YEAR ${'─'.repeat(50)}`);
    console.log(`  ${pad('Year', 8)} ${pad('Trades', 7)} ${pad('WinRate', 9)} ${pad('NetP&L', 12)} Sharpe`);
    console.log(`  ${sep}`);
    for (const y of result.byYear) {
      console.log(
        `  ${pad(String(y.year), 8)} ${pad(String(y.totalTrades), 7)} ${pad(pct(y.winRate), 9)} ${pad(inr(y.totalPnL), 12)} ${y.sharpeRatio}`
      );
    }
  }

  if (result.calibratedPriors) {
    const cp = result.calibratedPriors;
    console.log(`\n── CALIBRATED PRIORS ${'─'.repeat(40)}`);
    console.log('  By underlying:');
    for (const [u, v] of Object.entries(cp.byUnderlying)) {
      console.log(`    ${pad(u, 12)} win=${pct(v.winRate)}  n=${v.sampleSize}`);
    }
    console.log('  By regime:');
    for (const [r, v] of Object.entries(cp.byRegime)) {
      console.log(`    ${pad(r, 14)} win=${pct(v.winRate)}  n=${v.sampleSize}`);
    }
    console.log('  By entry time:');
    for (const [b, v] of Object.entries(cp.byEntryTimeBucket)) {
      console.log(`    ${pad(b, 8)} win=${pct(v.winRate)}  n=${v.sampleSize}`);
    }
  }

  console.log('\n' + '═'.repeat(60) + '\n');
}

/** Serialise the result summary (without the full trade list) for storage */
export function toSummaryJSON(result: BacktestResult): object {
  return {
    runName: result.runName,
    startDate: result.config.startDate,
    endDate: result.config.endDate,
    underlying: result.config.underlying,
    metrics: result.metrics,
    byPersonality: result.byPersonality,
    byRegime: result.byRegime,
    byEntryTimeBucket: result.byEntryTimeBucket,
    byYear: result.byYear,
    calibratedPriors: result.calibratedPriors,
  };
}
