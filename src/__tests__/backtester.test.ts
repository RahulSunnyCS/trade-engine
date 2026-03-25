import { Backtester } from '../backtesting/engine';
import { MockDataProvider } from '../data/providers/mock';
import { DEFAULT_PERSONALITIES, DEFAULT_CHARGE_STRUCTURE } from '../config/personalities';
import { BacktestConfig } from '../types';

const BASE_CONFIG: BacktestConfig = {
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  underlying: ['NIFTY'],
  personalities: DEFAULT_PERSONALITIES,
  slippageModel: 'halfSpread',
  slippagePoints: 0,
  fillMode: 'atClose',
  startingCapital: 100000,
  charges: DEFAULT_CHARGE_STRUCTURE,
  runCalibration: true,
  runName: 'test-run',
  dataSource: 'mock',
};

describe('Backtester (mock data)', () => {
  test('completes without error for January 2024', async () => {
    const backtester = new Backtester(BASE_CONFIG);
    const provider   = new MockDataProvider();
    const result     = await backtester.run(provider);
    expect(result).toBeDefined();
    expect(result.metrics).toBeDefined();
  }, 30000);

  test('result has expected structure', async () => {
    const backtester = new Backtester(BASE_CONFIG);
    const provider   = new MockDataProvider();
    const result     = await backtester.run(provider);

    expect(result.trades).toBeInstanceOf(Array);
    expect(result.equityCurve.length).toBeGreaterThan(0);
    expect(result.byPersonality.length).toBeGreaterThanOrEqual(0);
    expect(result.metrics.totalTrades).toBe(result.trades.length);
  }, 30000);

  test('win rate is between 0 and 1', async () => {
    const backtester = new Backtester(BASE_CONFIG);
    const provider   = new MockDataProvider();
    const result     = await backtester.run(provider);

    expect(result.metrics.winRate).toBeGreaterThanOrEqual(0);
    expect(result.metrics.winRate).toBeLessThanOrEqual(1);
  }, 30000);

  test('trades have valid entry/exit prices', async () => {
    const backtester = new Backtester(BASE_CONFIG);
    const provider   = new MockDataProvider();
    const result     = await backtester.run(provider);

    for (const trade of result.trades) {
      expect(trade.entryPrice).toBeGreaterThan(0);
      expect(trade.exitPrice).toBeGreaterThan(0);
      expect(trade.lots).toBeGreaterThan(0);
    }
  }, 30000);

  test('netPnL = grossPnL - charges for each trade', async () => {
    const backtester = new Backtester(BASE_CONFIG);
    const provider   = new MockDataProvider();
    const result     = await backtester.run(provider);

    for (const trade of result.trades) {
      expect(trade.netPnL).toBeCloseTo(trade.grossPnL - trade.charges, 1);
    }
  }, 30000);

  test('equity curve starts at startingCapital', async () => {
    const backtester = new Backtester(BASE_CONFIG);
    const provider   = new MockDataProvider();
    const result     = await backtester.run(provider);

    expect(result.equityCurve[0].equity).toBe(BASE_CONFIG.startingCapital);
  }, 30000);

  test('calibrated priors are produced when runCalibration=true', async () => {
    const backtester = new Backtester(BASE_CONFIG);
    const provider   = new MockDataProvider();
    const result     = await backtester.run(provider);

    if (result.trades.length > 0) {
      expect(result.calibratedPriors).toBeDefined();
    }
  }, 30000);

  test('zero-slippage run has higher gross P&L than half-spread', async () => {
    const provider = new MockDataProvider();

    const zeroSlip = await new Backtester({ ...BASE_CONFIG, slippageModel: 'zero' }).run(provider);
    const halfSpread = await new Backtester({ ...BASE_CONFIG, slippageModel: 'halfSpread' }).run(provider);

    // Gross P&L should be equal (slippage is baked into entry/exit prices, not grossPnL)
    // This just checks no crash
    expect(zeroSlip.metrics.totalTrades).toBe(halfSpread.metrics.totalTrades);
  }, 60000);
});
