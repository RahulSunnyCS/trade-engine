/**
 * Fyers Data Provider Unit Tests
 *
 * Tests FyersDataProvider with mocked HTTP responses.
 * No real API calls needed — all Fyers responses are fixtures.
 */

import { FyersDataProvider } from '../data/providers/fyers';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('FyersDataProvider', () => {
  let provider: FyersDataProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();

    // Set environment variables for testing
    process.env.FYERS_APP_ID = 'test-app-id';
    process.env.FYERS_ACCESS_TOKEN = 'test-token';

    provider = new FyersDataProvider();
  });

  describe('isReady()', () => {
    it('should return true when credentials are valid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'Ok', profile: {} }),
      });

      const ready = await provider.isReady();
      expect(ready).toBe(true);
    });

    it('should return false when API call fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const ready = await provider.isReady();
      expect(ready).toBe(false);
    });

    it('should include Authorization header with Bearer token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await provider.isReady();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'X-API-KEY': 'test-app-id',
          }),
        })
      );
    });
  });

  describe('getTradingDays()', () => {
    it('should exclude weekends', async () => {
      const start = new Date('2024-03-18'); // Monday
      const end = new Date('2024-03-24'); // Sunday

      const tradingDays = await provider.getTradingDays(start, end, 'NIFTY');

      // Should have Mon-Fri (5 days) but not Sat-Sun
      expect(tradingDays.length).toBe(5);
      tradingDays.forEach(day => {
        const dow = day.getDay();
        expect(dow).toBeGreaterThanOrEqual(1);
        expect(dow).toBeLessThanOrEqual(5);
      });
    });

    it('should exclude NSE market holidays', async () => {
      const start = new Date('2024-01-20');
      const end = new Date('2024-01-30');

      const tradingDays = await provider.getTradingDays(start, end, 'NIFTY');

      // 2024-01-26 is Republic Day (NSE holiday)
      const repDayStr = '2024-01-26';
      const hasRepDay = tradingDays.some(d => d.toISOString().split('T')[0] === repDayStr);
      expect(hasRepDay).toBe(false);
    });

    it('should cache results for identical date ranges', async () => {
      const start = new Date('2024-03-18');
      const end = new Date('2024-03-22');

      const result1 = await provider.getTradingDays(start, end, 'NIFTY');
      const result2 = await provider.getTradingDays(start, end, 'NIFTY');

      // Should be exact same reference (cached)
      expect(result1).toBe(result2);
    });
  });

  describe('getDayData()', () => {
    it('should return DayData with straddle snapshots', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candles: [
              [1710748500, 22000, 22050, 21950, 22000, 1000000],
              [1710748560, 22000, 22080, 21970, 22040, 1100000],
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candles: [
              [1710748500, 150, 155, 148, 152, 100000],
              [1710748560, 152, 158, 150, 156, 110000],
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candles: [
              [1710748500, 150, 155, 148, 152, 100000],
              [1710748560, 152, 158, 150, 156, 110000],
            ],
          }),
        });

      const date = new Date('2024-03-18');
      const dayData = await provider.getDayData(date, 'NIFTY');

      expect(dayData).not.toBeNull();
      expect(dayData!.date).toEqual(date);
      expect(dayData!.underlying).toBe('NIFTY');
      expect(dayData!.snapshots.length).toBeGreaterThan(0);
    });

    it('should merge CE and PE prices into straddle snapshots', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candles: [[1710748500, 22000, 22050, 21950, 22000, 1000000]],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candles: [[1710748500, 150, 155, 148, 152, 100000]],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candles: [[1710748500, 150, 155, 148, 152, 100000]],
          }),
        });

      const date = new Date('2024-03-18');
      const dayData = await provider.getDayData(date, 'NIFTY');

      expect(dayData).not.toBeNull();
      const snapshot = dayData!.snapshots[0];

      // Straddle value = CE + PE
      expect(snapshot.straddleValue).toBe(snapshot.atmCallPrice + snapshot.atmPutPrice);
      expect(snapshot.straddleValue).toBeGreaterThan(0);
    });

    it('should calculate ATM strike from opening spot price', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candles: [[1710748500, 22000, 22050, 21950, 22000, 1000000]],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candles: [[1710748500, 150, 155, 148, 152, 100000]],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candles: [[1710748500, 150, 155, 148, 152, 100000]],
          }),
        });

      const date = new Date('2024-03-18');
      const dayData = await provider.getDayData(date, 'NIFTY');

      expect(dayData).not.toBeNull();
      // ATM strike for NIFTY 22000 should be 22000 (rounded to 100)
      expect(dayData!.snapshots[0].atmStrike).toBe(22000);
    });

    it('should return null when spot data is unavailable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candles: [] }), // Empty response
      });

      const date = new Date('2024-03-18');
      const dayData = await provider.getDayData(date, 'NIFTY');

      expect(dayData).toBeNull();
    });
  });

  describe('Rate Limiting', () => {
    it('should make multiple HTTP requests', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'Ok' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'Ok' }),
        });

      // Create a new provider for this test
      const provider2 = new FyersDataProvider();

      // First request
      await provider2.isReady();

      // Second request
      await provider2.isReady();

      // Verify fetch was called twice
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing credentials with warning', () => {
      const oldAppId = process.env.FYERS_APP_ID;
      const oldToken = process.env.FYERS_ACCESS_TOKEN;

      process.env.FYERS_APP_ID = '';
      process.env.FYERS_ACCESS_TOKEN = '';

      // Should not throw
      expect(() => {
        new FyersDataProvider();
      }).not.toThrow();

      // Restore
      process.env.FYERS_APP_ID = oldAppId;
      process.env.FYERS_ACCESS_TOKEN = oldToken;
    });

    it('should catch and handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      // API errors should be caught and logged
      const ready = await provider.isReady();
      expect(ready).toBe(false);
    });
  });
});
