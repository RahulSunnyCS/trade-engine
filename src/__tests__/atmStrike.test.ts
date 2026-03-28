import {
  calculateATMStrike,
  getLotSize,
  buildOptionSymbol,
  getNearestExpiry,
  daysToExpiry,
} from '../signals/atmStrike';

describe('calculateATMStrike', () => {
  test('rounds NIFTY to nearest 50', () => {
    expect(calculateATMStrike(22024, 'NIFTY')).toBe(22000);
    expect(calculateATMStrike(22026, 'NIFTY')).toBe(22050);
    expect(calculateATMStrike(22050, 'NIFTY')).toBe(22050);
  });

  test('rounds SENSEX to nearest 100', () => {
    expect(calculateATMStrike(73450, 'SENSEX')).toBe(73500);
  });
});

describe('getLotSize', () => {
  test('returns correct lot sizes', () => {
    expect(getLotSize('NIFTY')).toBe(75);
    expect(getLotSize('SENSEX')).toBe(10);
  });
});

describe('getNearestExpiry', () => {
  test('NIFTY expiry is Tuesday', () => {
    // Monday 2024-01-01 → nearest Tuesday is 2024-01-02
    const d = new Date('2024-01-01');
    const expiry = getNearestExpiry(d, 'NIFTY');
    expect(expiry.getDay()).toBe(2); // Tuesday
  });

  test('SENSEX expiry is Thursday', () => {
    // Monday 2024-01-01 → nearest Thursday is 2024-01-04
    const d = new Date('2024-01-01');
    const expiry = getNearestExpiry(d, 'SENSEX');
    expect(expiry.getDay()).toBe(4); // Thursday
  });

  test('expiry day returns same day (NIFTY Tuesday)', () => {
    // Tuesday 2024-01-02
    const tue = new Date('2024-01-02');
    const expiry = getNearestExpiry(tue, 'NIFTY');
    expect(expiry.toISOString().slice(0, 10)).toBe('2024-01-02');
  });

  test('custom expiryDow override is respected', () => {
    // Pass Thursday (4) as override for NIFTY
    const d = new Date('2024-01-01'); // Monday
    const expiry = getNearestExpiry(d, 'NIFTY', 4);
    expect(expiry.getDay()).toBe(4); // Thursday
  });
});

describe('daysToExpiry', () => {
  test('returns 0 on expiry day (Tuesday for NIFTY)', () => {
    const tue = new Date('2024-01-02T09:15:00');
    expect(daysToExpiry(tue, 'NIFTY')).toBe(0);
  });

  test('returns 1 on Monday before Tuesday expiry', () => {
    const mon = new Date('2024-01-01T09:15:00');
    expect(daysToExpiry(mon, 'NIFTY')).toBe(1);
  });
});

describe('buildOptionSymbol', () => {
  test('builds correct Fyers-style symbol', () => {
    const expiry = new Date('2024-01-02');
    const sym = buildOptionSymbol('NIFTY', expiry, 22000, 'CE');
    expect(sym).toContain('NSE:NIFTY');
    expect(sym).toContain('22000');
    expect(sym).toContain('CE');
  });

  test('uses BSE prefix for SENSEX', () => {
    const expiry = new Date('2024-01-04');
    const sym = buildOptionSymbol('SENSEX', expiry, 73000, 'PE');
    expect(sym).toMatch(/^BSE:SENSEX/);
  });
});
