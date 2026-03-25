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

  test('rounds BANKNIFTY to nearest 100', () => {
    expect(calculateATMStrike(48049, 'BANKNIFTY')).toBe(48000);
    expect(calculateATMStrike(48051, 'BANKNIFTY')).toBe(48100);
  });

  test('rounds SENSEX to nearest 100', () => {
    expect(calculateATMStrike(73450, 'SENSEX')).toBe(73500);
  });
});

describe('getLotSize', () => {
  test('returns correct lot sizes', () => {
    expect(getLotSize('NIFTY')).toBe(75);
    expect(getLotSize('BANKNIFTY')).toBe(30);
    expect(getLotSize('SENSEX')).toBe(10);
  });
});

describe('getNearestExpiry', () => {
  test('NIFTY expiry is Thursday', () => {
    // Monday 2024-01-01 → nearest Thursday is 2024-01-04
    const d = new Date('2024-01-01');
    const expiry = getNearestExpiry(d, 'NIFTY');
    expect(expiry.getDay()).toBe(4); // Thursday
  });

  test('SENSEX expiry is Friday', () => {
    const d = new Date('2024-01-01');
    const expiry = getNearestExpiry(d, 'SENSEX');
    expect(expiry.getDay()).toBe(5); // Friday
  });

  test('expiry day returns same day', () => {
    // Thursday
    const thu = new Date('2024-01-04');
    const expiry = getNearestExpiry(thu, 'NIFTY');
    expect(expiry.toISOString().slice(0, 10)).toBe('2024-01-04');
  });
});

describe('daysToExpiry', () => {
  test('returns 0 on expiry day', () => {
    const thu = new Date('2024-01-04T09:15:00');
    expect(daysToExpiry(thu, 'NIFTY')).toBe(0);
  });

  test('returns 3 on Monday before Thursday expiry', () => {
    const mon = new Date('2024-01-01T09:15:00');
    expect(daysToExpiry(mon, 'NIFTY')).toBe(3);
  });
});

describe('buildOptionSymbol', () => {
  test('builds correct Fyers-style symbol', () => {
    const expiry = new Date('2024-01-04');
    const sym = buildOptionSymbol('NIFTY', expiry, 22000, 'CE');
    expect(sym).toContain('NSE:NIFTY');
    expect(sym).toContain('22000');
    expect(sym).toContain('CE');
  });

  test('uses BSE prefix for SENSEX', () => {
    const expiry = new Date('2024-01-05');
    const sym = buildOptionSymbol('SENSEX', expiry, 73000, 'PE');
    expect(sym).toMatch(/^BSE:SENSEX/);
  });
});
