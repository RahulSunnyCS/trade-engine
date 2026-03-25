import { HistoricalDataProvider } from '../../types';
import { MockDataProvider } from './mock';
import { FyersDataProvider } from './fyers';

export function createDataProvider(): HistoricalDataProvider {
  const source = process.env.DATA_PROVIDER ?? 'mock';
  if (source === 'fyers') {
    return new FyersDataProvider();
  }
  return new MockDataProvider();
}

export { MockDataProvider } from './mock';
export { FyersDataProvider } from './fyers';
