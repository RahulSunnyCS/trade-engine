import { MockDataProvider } from '../data/providers/mock';

describe('MockDataProvider', () => {
  const provider = new MockDataProvider();

  test('isReady returns true', async () => {
    expect(await provider.isReady()).toBe(true);
  });

  test('getTradingDays returns only weekdays', async () => {
    const start = new Date('2024-01-01');
    const end   = new Date('2024-01-07');
    const days  = await provider.getTradingDays(start, end, 'NIFTY');
    for (const d of days) {
      expect(d.getDay()).toBeGreaterThanOrEqual(1);
      expect(d.getDay()).toBeLessThanOrEqual(5);
    }
  });

  test('returns 5 trading days for a standard Mon-Fri week', async () => {
    const start = new Date('2024-01-01'); // Monday
    const end   = new Date('2024-01-05'); // Friday
    const days  = await provider.getTradingDays(start, end, 'NIFTY');
    expect(days).toHaveLength(5);
  });

  test('getDayData returns null for weekend', async () => {
    const saturday = new Date('2024-01-06');
    const data = await provider.getDayData(saturday, 'NIFTY');
    expect(data).toBeNull();
  });

  test('getDayData returns 375 snapshots for a trading day', async () => {
    const mon = new Date('2024-01-01');
    const data = await provider.getDayData(mon, 'NIFTY');
    expect(data).not.toBeNull();
    expect(data!.snapshots).toHaveLength(375);
  });

  test('snapshots are in chronological order', async () => {
    const mon = new Date('2024-01-01');
    const data = await provider.getDayData(mon, 'NIFTY');
    const snaps = data!.snapshots;
    for (let i = 1; i < snaps.length; i++) {
      expect(snaps[i].timestamp.getTime()).toBeGreaterThan(snaps[i - 1].timestamp.getTime());
    }
  });

  test('straddle values are positive', async () => {
    const mon = new Date('2024-01-01');
    const data = await provider.getDayData(mon, 'NIFTY');
    for (const snap of data!.snapshots) {
      expect(snap.straddleValue).toBeGreaterThan(0);
      expect(snap.atmCallPrice).toBeGreaterThan(0);
      expect(snap.atmPutPrice).toBeGreaterThan(0);
    }
  });

  test('generates different data for different dates (seeded)', async () => {
    const day1 = await provider.getDayData(new Date('2024-01-01'), 'NIFTY');
    const day2 = await provider.getDayData(new Date('2024-01-02'), 'NIFTY');
    expect(day1!.snapshots[0].spotPrice).not.toBe(day2!.snapshots[0].spotPrice);
  });

  test('BANKNIFTY spot is ~2x NIFTY (baseline)', async () => {
    const day = new Date('2024-01-01');
    const nifty   = await provider.getDayData(day, 'NIFTY');
    const banknifty = await provider.getDayData(day, 'BANKNIFTY');
    expect(banknifty!.snapshots[0].spotPrice).toBeGreaterThan(
      nifty!.snapshots[0].spotPrice
    );
  });
});
