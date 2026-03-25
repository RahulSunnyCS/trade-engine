import { Underlying } from '../types';

// Strike intervals per underlying (NSE/BSE spec)
const STRIKE_INTERVALS: Record<Underlying, number> = {
  NIFTY: 50,
  BANKNIFTY: 100,
  SENSEX: 100,
};

// Standard lot sizes
export const LOT_SIZES: Record<Underlying, number> = {
  NIFTY: 75,
  BANKNIFTY: 30,
  SENSEX: 10,
};

/**
 * Round spot price to nearest ATM strike for the given underlying.
 */
export function calculateATMStrike(spotPrice: number, underlying: Underlying): number {
  const interval = STRIKE_INTERVALS[underlying];
  return Math.round(spotPrice / interval) * interval;
}

/**
 * Build Fyers-style option symbol.
 * e.g. NSE:NIFTY25JAN23000CE
 */
export function buildOptionSymbol(
  underlying: Underlying,
  expiryDate: Date,
  strike: number,
  optionType: 'CE' | 'PE'
): string {
  const exchange = underlying === 'SENSEX' ? 'BSE' : 'NSE';
  const month = expiryDate.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const day = String(expiryDate.getDate()).padStart(2, '0');
  const year = String(expiryDate.getFullYear()).slice(2);
  return `${exchange}:${underlying}${year}${month}${day}${strike}${optionType}`;
}

/**
 * Get the lot size for an underlying.
 */
export function getLotSize(underlying: Underlying): number {
  return LOT_SIZES[underlying];
}

/**
 * Determine the nearest weekly expiry date from a given date.
 * Nifty/BankNifty expire on Thursday; Sensex on Friday.
 */
export function getNearestExpiry(fromDate: Date, underlying: Underlying): Date {
  const expiryDow = underlying === 'SENSEX' ? 5 : 4; // 4=Thu, 5=Fri
  const d = new Date(fromDate);
  // Zero out time so we compare dates only
  d.setHours(0, 0, 0, 0);

  const currentDow = d.getDay();
  let daysUntilExpiry = (expiryDow - currentDow + 7) % 7;
  // If today IS the expiry day, expiry is today (0 → 0)
  if (daysUntilExpiry === 0) daysUntilExpiry = 0;

  const expiry = new Date(d);
  expiry.setDate(d.getDate() + daysUntilExpiry);
  return expiry;
}

/**
 * Days to expiry from a given date.
 */
export function daysToExpiry(fromDate: Date, underlying: Underlying): number {
  const expiry = getNearestExpiry(fromDate, underlying);
  // Compare date-only (strip time) so 9:15 AM Monday → 3 days to Thursday
  const fromMidnight = new Date(fromDate);
  fromMidnight.setHours(0, 0, 0, 0);
  const diffMs = expiry.getTime() - fromMidnight.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}
