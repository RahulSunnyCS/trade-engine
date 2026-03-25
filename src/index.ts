/**
 * Trade Engine — Main Entry Point
 *
 * Usage:
 *   npm run dev
 *
 * Configure via .env:
 *   DATA_PROVIDER=mock          (or fyers)
 *   BACKTEST_START_DATE=2024-01-01
 *   BACKTEST_END_DATE=2024-12-31
 *   BACKTEST_UNDERLYING=NIFTY,BANKNIFTY
 *   BACKTEST_STARTING_CAPITAL=100000
 */

import 'dotenv/config';
import { createDataProvider } from './data/providers';
import { DEFAULT_PERSONALITIES } from './config/personalities';

async function main() {
  console.log('Trade Engine starting...');
  console.log(`Active personalities: ${DEFAULT_PERSONALITIES.filter((p) => p.isActive).map((p) => p.name).join(', ')}`);

  const provider = createDataProvider();
  const ready = await provider.isReady();

  if (!ready) {
    console.error('Data provider is not ready. Check credentials or set DATA_PROVIDER=mock in .env');
    process.exit(1);
  }

  console.log(`Data provider ready. Use 'npm run backtest' to run a backtest or 'npm run ingest:mock' to ingest data.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
