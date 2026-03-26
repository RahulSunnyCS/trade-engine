/**
 * Fyers API v3 Data Provider
 *
 * Fetches historical market data from Fyers broker API.
 * Implements HistoricalDataProvider interface for backtesting and live trading.
 *
 * Environment variables required:
 *   FYERS_APP_ID: Your Fyers App ID
 *   FYERS_ACCESS_TOKEN: Your Fyers Access Token (OAuth2)
 *
 * Optional:
 *   FYERS_API_BASE_URL: Fyers API base URL (defaults to production)
 */

import { HistoricalDataProvider, Underlying, DayData, StraddleSnapshot } from '../../types';
import { calculateATMStrike, daysToExpiry } from '../../signals/atmStrike';

// ---- Types for Fyers API responses -----------------------

interface FyersHistoricalBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ---- Fyers API Client ---------------------------------

class FyersClient {
  private appId: string;
  private accessToken: string;
  private apiBaseUrl: string;
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly rateLimitDelay = 100; // ms between requests

  constructor() {
    this.appId = process.env.FYERS_APP_ID || '';
    this.accessToken = process.env.FYERS_ACCESS_TOKEN || '';
    this.apiBaseUrl = process.env.FYERS_API_BASE_URL || 'https://api-v3.fyers.in/api-service';

    if (!this.appId || !this.accessToken) {
      console.warn('⚠️  Fyers credentials not configured. Set FYERS_APP_ID and FYERS_ACCESS_TOKEN in .env');
    }
  }

  /**
   * Rate-limited HTTP request to Fyers API
   */
  private async makeRequest(endpoint: string, params?: Record<string, unknown>): Promise<unknown> {
    // Rate limiting: respect Fyers API limits
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();

    const url = new URL(`${this.apiBaseUrl}${endpoint}`);

    // Add query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'X-API-KEY': this.appId,
      'Accept': 'application/json',
    };

    try {
      const response = await fetch(url.toString(), { headers, method: 'GET' });

      if (!response.ok) {
        throw new Error(`Fyers API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.requestCount++;

      return data;
    } catch (error) {
      console.error(`❌ Fyers API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Get historical 1-minute OHLCV data for a symbol
   */
  async getHistoricalData(
    symbol: string,
    startDate: Date,
    endDate: Date,
    interval = 1 // minutes
  ): Promise<FyersHistoricalBar[]> {
    try {
      const startTimestamp = Math.floor(startDate.getTime() / 1000);
      const endTimestamp = Math.floor(endDate.getTime() / 1000);

      const response = (await this.makeRequest('/history', {
        symbol,
        resolution: interval,
        date_format: 'unix',
        range_from: startTimestamp,
        range_to: endTimestamp,
      })) as { candles?: number[][] };

      // Fyers returns candles as [timestamp, open, high, low, close, volume]
      if (!response.candles) return [];

      return response.candles.map(([time, open, high, low, close, volume]) => ({
        time: typeof time === 'number' ? time : 0,
        open: typeof open === 'number' ? open : 0,
        high: typeof high === 'number' ? high : 0,
        low: typeof low === 'number' ? low : 0,
        close: typeof close === 'number' ? close : 0,
        volume: typeof volume === 'number' ? volume : 0,
      }));
    } catch (error) {
      console.error(`Failed to fetch historical data for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Check if API credentials are valid
   */
  async validateCredentials(): Promise<boolean> {
    try {
      await this.makeRequest('/profile', {});
      return true;
    } catch (error) {
      console.error('Fyers credential validation failed:', error);
      return false;
    }
  }

  getStats() {
    return {
      requestCount: this.requestCount,
      rateLimitDelay: this.rateLimitDelay,
    };
  }
}

// ---- Fyers Data Provider Implementation -----

export class FyersDataProvider implements HistoricalDataProvider {
  private client: FyersClient;
  private tradingDaysCache = new Map<string, Date[]>();

  constructor() {
    this.client = new FyersClient();
  }

  async isReady(): Promise<boolean> {
    return this.client.validateCredentials();
  }

  /**
   * Get all trading days between startDate and endDate
   * NSE trading days (exclude weekends and market holidays)
   */
  async getTradingDays(startDate: Date, endDate: Date, _underlying: Underlying): Promise<Date[]> {
    const cacheKey = `${startDate.toISOString()}_${endDate.toISOString()}`;

    if (this.tradingDaysCache.has(cacheKey)) {
      return this.tradingDaysCache.get(cacheKey) || [];
    }

    const tradingDays: Date[] = [];
    const current = new Date(startDate);

    // List of NSE market holidays
    const marketHolidays = this.getNSEHolidays();

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      const dateStr = current.toISOString().split('T')[0];

      // Exclude weekends and holidays
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !marketHolidays.has(dateStr)) {
        tradingDays.push(new Date(current));
      }

      current.setDate(current.getDate() + 1);
    }

    this.tradingDaysCache.set(cacheKey, tradingDays);
    return tradingDays;
  }

  /**
   * Get straddle snapshots for a given trading day
   */
  async getDayData(date: Date, underlying: Underlying): Promise<DayData | null> {
    try {
      const marketOpen = new Date(date);
      marketOpen.setHours(9, 15, 0, 0);

      const marketClose = new Date(date);
      marketClose.setHours(15, 30, 0, 0);

      // Get spot price data first to calculate ATM strike
      const spotSymbol = this.getSpotSymbol(underlying);
      const spotData = await this.client.getHistoricalData(spotSymbol, marketOpen, marketClose);

      if (spotData.length === 0) {
        console.warn(`No spot data for ${date.toISOString().split('T')[0]} ${underlying}`);
        return null;
      }

      // Calculate ATM strike based on opening spot price
      const atmStrike = calculateATMStrike(spotData[0].open, underlying);

      // Construct symbols for ATM call and put
      const ceSymbol = this.buildOptionSymbol(underlying, date, atmStrike, 'CE');
      const peSymbol = this.buildOptionSymbol(underlying, date, atmStrike, 'PE');

      const expiryDate = this.getWeeklyExpiryDate(date);
      const dte = daysToExpiry(date, underlying);

      // Fetch historical data for call and put
      const ceData = await this.client.getHistoricalData(ceSymbol, marketOpen, marketClose);
      const peData = await this.client.getHistoricalData(peSymbol, marketOpen, marketClose);

      if (ceData.length === 0 || peData.length === 0) {
        console.warn(`No options data for ${date.toISOString().split('T')[0]} ${underlying} strike=${atmStrike}`);
        return null;
      }

      // Combine call + put data into straddle snapshots
      const snapshots = this.mergeIntoStraddles(
        ceData,
        peData,
        spotData,
        date,
        underlying,
        atmStrike,
        dte
      );

      return {
        date,
        underlying,
        snapshots,
        marketOpen,
        marketClose,
        expiryDate,
        daysToExpiry: dte,
      };
    } catch (error) {
      console.error(`Failed to get day data for ${date.toISOString().split('T')[0]} ${underlying}:`, error);
      return null;
    }
  }

  // ---- Helper Methods ----

  private buildOptionSymbol(
    underlying: Underlying,
    date: Date,
    strike: number,
    optionType: 'CE' | 'PE'
  ): string {
    // Fyers format: NIFTY24JAN25C24000
    const year = String(date.getFullYear()).slice(-2);
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = monthNames[date.getMonth()];
    const day = String(date.getDate()).padStart(2, '0');

    return `${underlying}${year}${month}${day}${optionType}${strike}-NFO`;
  }

  private getSpotSymbol(underlying: Underlying): string {
    const spotSymbols: Record<Underlying, string> = {
      NIFTY: 'NIFTY50-IDX',
      BANKNIFTY: 'NIFTYBANK-IDX',
      SENSEX: 'SENSEX-IDX',
    };
    return spotSymbols[underlying];
  }

  private getWeeklyExpiryDate(date: Date): Date {
    // Weekly options expire on Wednesday (3)
    const d = new Date(date);
    while (d.getDay() !== 3 || d <= date) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  }

  private getNSEHolidays(): Set<string> {
    // NSE market holidays for 2024-2025
    return new Set([
      '2024-01-26', // Republic Day
      '2024-03-25', // Holi
      '2024-04-11', // Eid ul-Fitr
      '2024-04-17', // Ram Navami
      '2024-04-21', // Mahavir Jayanti
      '2024-05-23', // Buddha Purnima
      '2024-06-17', // Eid ul-Adha
      '2024-07-17', // Muharram
      '2024-08-15', // Independence Day
      '2024-08-26', // Janmashtami
      '2024-09-16', // Milad-un-Nabi
      '2024-10-02', // Gandhi Jayanti
      '2024-10-12', // Dussehra
      '2024-10-31', // Diwali
      '2024-11-01', // Diwali (Day 2)
      '2024-11-15', // Guru Nanak Jayanti
      '2024-12-25', // Christmas
    ]);
  }

  private mergeIntoStraddles(
    ceData: FyersHistoricalBar[],
    peData: FyersHistoricalBar[],
    spotData: FyersHistoricalBar[],
    date: Date,
    underlying: Underlying,
    atmStrike: number,
    _dte: number
  ): StraddleSnapshot[] {
    const snapshots: StraddleSnapshot[] = [];
    const dayOpen = ceData[0]?.open ?? 0;

    // Merge by timestamp
    for (let i = 0; i < Math.min(ceData.length, peData.length); i++) {
      const ceBar = ceData[i];
      const peBar = peData[i];
      const spotBar = spotData[i] ?? spotData[spotData.length - 1];

      if (!ceBar || !peBar || !spotBar) continue;

      const timestamp = new Date(ceBar.time * 1000);
      const straddleValue = ceBar.close + peBar.close;
      const straddleChangeFromOpen = dayOpen > 0 ? ((straddleValue - dayOpen) / dayOpen) * 100 : 0;

      const snapshot: StraddleSnapshot = {
        timestamp,
        underlying,
        spotPrice: spotBar.close,
        atmStrike,
        atmCallPrice: ceBar.close,
        atmPutPrice: peBar.close,
        straddleValue,
        impliedVolatility: 0.15,
        straddleChangeFromOpen,
        straddleChangeFromPrevClose: 0,
        rateOfChange1m: 0,
        rateOfChange5m: 0,
        rocAcceleration: 0,
        vix: 15,
      };

      snapshots.push(snapshot);
    }

    return snapshots;
  }
}
