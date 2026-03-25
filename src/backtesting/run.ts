/**
 * CLI entry point for running a backtest.
 *
 * Usage:
 *   npm run backtest
 *
 * Configure via .env:
 *   DATA_PROVIDER=mock          (or fyers once credentials are ready)
 *   BACKTEST_START_DATE=2024-01-01
 *   BACKTEST_END_DATE=2024-12-31
 *   BACKTEST_UNDERLYING=NIFTY,BANKNIFTY
 *   BACKTEST_STARTING_CAPITAL=100000
 */

import 'dotenv/config';
import { Backtester } from './engine';
import { printReport } from './report';
import { createDataProvider } from '../data/providers';
import { DEFAULT_PERSONALITIES, DEFAULT_CHARGE_STRUCTURE } from '../config/personalities';
import { BacktestConfig, Underlying } from '../types';

async function main() {
  const startDate = new Date(process.env.BACKTEST_START_DATE ?? '2024-01-01');
  const endDate   = new Date(process.env.BACKTEST_END_DATE   ?? '2024-12-31');
  const underlying = (process.env.BACKTEST_UNDERLYING ?? 'NIFTY,BANKNIFTY')
    .split(',')
    .map((s) => s.trim()) as Underlying[];
  const startingCapital = parseFloat(process.env.BACKTEST_STARTING_CAPITAL ?? '100000');
  const dataSource = (process.env.DATA_PROVIDER ?? 'mock') as 'fyers' | 'mock';

  const config: BacktestConfig = {
    startDate,
    endDate,
    underlying,
    personalities: DEFAULT_PERSONALITIES,
    slippageModel: 'halfSpread',
    slippagePoints: 0,
    fillMode: 'atClose',
    startingCapital,
    charges: DEFAULT_CHARGE_STRUCTURE,
    runCalibration: true,
    runName: `Phase0_${dataSource}_${startDate.toISOString().slice(0, 10)}`,
    dataSource,
  };

  const provider = createDataProvider();
  const ready = await provider.isReady();
  if (!ready) {
    console.error('Data provider is not ready. Check credentials or use DATA_PROVIDER=mock.');
    process.exit(1);
  }

  console.log(`Starting backtest: ${config.runName}`);
  console.log(`Range: ${startDate.toISOString().slice(0, 10)} → ${endDate.toISOString().slice(0, 10)}`);
  console.log(`Underlyings: ${underlying.join(', ')} | Provider: ${dataSource}`);

  const backtester = new Backtester(config);
  const result = await backtester.run(provider, (date, ul, done, total) => {
    if (done % 20 === 0 || done === total) {
      process.stdout.write(`\r  Processing ${ul}: ${date.toISOString().slice(0, 10)} (${done}/${total})`);
    }
  });

  console.log('\n');
  printReport(result);
}

main().catch((err) => {
  console.error('Backtest failed:', err);
  process.exit(1);
});
