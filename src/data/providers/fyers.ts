/**
 * Fyers Historical Data Provider (stub)
 *
 * Implements HistoricalDataProvider using the Fyers API v3.
 * This is a stub — all methods throw until Fyers credentials are configured.
 *
 * When credentials are available:
 *   1. Set FYERS_APP_ID, FYERS_SECRET_KEY, FYERS_ACCESS_TOKEN in .env
 *   2. Implement fetchHistoricalBars() using Fyers /data/history endpoint
 *   3. Implement contractResolver() to map ATM strikes → Fyers symbols
 *
 * The rest of the system (signal generator, backtester) requires no changes.
 */

import {
  Underlying,
  DayData,
  HistoricalDataProvider,
} from '../../types';

export class FyersDataProvider implements HistoricalDataProvider {
  private readonly appId: string;
  private readonly accessToken: string;

  constructor() {
    this.appId = process.env.FYERS_APP_ID ?? '';
    this.accessToken = process.env.FYERS_ACCESS_TOKEN ?? '';
  }

  async isReady(): Promise<boolean> {
    return !!(this.appId && this.accessToken);
  }

  async getTradingDays(startDate: Date, endDate: Date, underlying: Underlying): Promise<Date[]> {
    this.assertReady();
    void startDate; void endDate; void underlying;
    // TODO: call Fyers /data/history for the index, extract unique dates
    throw new Error('FyersDataProvider.getTradingDays not yet implemented — add credentials first');
  }

  async getDayData(date: Date, underlying: Underlying): Promise<DayData | null> {
    this.assertReady();
    void date; void underlying;
    // TODO:
    //   1. Resolve ATM strike for this date using historical spot data
    //   2. Fetch 1-min CE + PE bars from Fyers /data/history
    //   3. Construct StraddleSnapshot[] and return DayData
    throw new Error('FyersDataProvider.getDayData not yet implemented — add credentials first');
  }

  private assertReady(): void {
    if (!this.appId || !this.accessToken) {
      throw new Error(
        'Fyers credentials not configured. Set FYERS_APP_ID and FYERS_ACCESS_TOKEN in .env, ' +
          'or use DATA_PROVIDER=mock.'
      );
    }
  }
}
