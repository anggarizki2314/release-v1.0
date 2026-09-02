export interface TradingSessionCalendar {
  instrumentType: 'FX' | 'METAL' | 'CRYPTO' | 'INDEX';
  isTradableMinute(timeUtcSec: number): boolean;
  isExpectedClosure(timeUtcSec: number): boolean;
  isExpectedClosureRange(fromUtcSec: number, toUtcSec: number): boolean;
}

export class FxSessionCalendar implements TradingSessionCalendar {
  readonly instrumentType = 'FX';

  isTradableMinute(timeUtcSec: number): boolean {
    return !this.isExpectedClosure(timeUtcSec);
  }

  isExpectedClosure(timeUtcSec: number): boolean {
    const d = new Date(timeUtcSec * 1000);
    const day = d.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
    const hour = d.getUTCHours();

    // Saturday: all day closed
    if (day === 6) return true;
    // Friday: closed after 21:00 UTC
    if (day === 5 && hour >= 21) return true;
    // Sunday: closed before 21:00 UTC
    if (day === 0 && hour < 21) return true;

    // Daily rollover maintenance break: 21:00-22:00 UTC on Mon-Thu
    if (day >= 1 && day <= 4 && hour === 21) return true;

    return false;
  }

  isExpectedClosureRange(fromUtcSec: number, toUtcSec: number): boolean {
    if (fromUtcSec >= toUtcSec) return true;

    const durationSec = toUtcSec - fromUtcSec;
    const step = Math.max(60, Math.floor(durationSec / 50));

    let tradableCount = 0;
    let totalSamples = 0;

    for (let t = fromUtcSec; t <= toUtcSec; t += step) {
      totalSamples++;
      if (this.isTradableMinute(t)) {
        tradableCount++;
      }
    }

    if (totalSamples === 0) return true;
    // If there are zero (or < 5%) tradable minutes in range, it's an expected closure
    return (tradableCount / totalSamples) <= 0.05;
  }
}

export class MetalSessionCalendar implements TradingSessionCalendar {
  readonly instrumentType = 'METAL';

  isTradableMinute(timeUtcSec: number): boolean {
    return !this.isExpectedClosure(timeUtcSec);
  }

  isExpectedClosure(timeUtcSec: number): boolean {
    const d = new Date(timeUtcSec * 1000);
    const day = d.getUTCDay();
    const hour = d.getUTCHours();

    // Saturday: all day closed
    if (day === 6) return true;
    // Friday: closed after 21:00 UTC
    if (day === 5 && hour >= 21) return true;
    // Sunday: closed before 22:00 UTC
    if (day === 0 && hour < 22) return true;

    // Daily 1-hour maintenance break: 21:00-22:00 UTC on weekdays
    if (day >= 1 && day <= 4 && hour === 21) return true;

    return false;
  }

  isExpectedClosureRange(fromUtcSec: number, toUtcSec: number): boolean {
    if (fromUtcSec >= toUtcSec) return true;

    const durationSec = toUtcSec - fromUtcSec;
    const step = Math.max(60, Math.floor(durationSec / 50));

    let tradableCount = 0;
    let totalSamples = 0;

    for (let t = fromUtcSec; t <= toUtcSec; t += step) {
      totalSamples++;
      if (this.isTradableMinute(t)) {
        tradableCount++;
      }
    }

    if (totalSamples === 0) return true;
    return (tradableCount / totalSamples) <= 0.05;
  }
}

export class CryptoSessionCalendar implements TradingSessionCalendar {
  readonly instrumentType = 'CRYPTO';

  isTradableMinute(): boolean {
    return true; // 24/7
  }

  isExpectedClosure(): boolean {
    return false;
  }

  isExpectedClosureRange(): boolean {
    return false;
  }
}

export class IndexSessionCalendar implements TradingSessionCalendar {
  readonly instrumentType = 'INDEX';

  isTradableMinute(timeUtcSec: number): boolean {
    return !this.isExpectedClosure(timeUtcSec);
  }

  isExpectedClosure(timeUtcSec: number): boolean {
    const d = new Date(timeUtcSec * 1000);
    const day = d.getUTCDay();
    const hour = d.getUTCHours();

    // Saturday: all day closed
    if (day === 6) return true;
    // Friday: closed after 21:00 UTC
    if (day === 5 && hour >= 21) return true;
    // Sunday: closed before 22:00 UTC
    if (day === 0 && hour < 22) return true;

    // Daily maintenance break: 21:00-22:00 UTC on weekdays
    if (day >= 1 && day <= 4 && hour === 21) return true;

    return false;
  }

  isExpectedClosureRange(fromUtcSec: number, toUtcSec: number): boolean {
    if (fromUtcSec >= toUtcSec) return true;

    const durationSec = toUtcSec - fromUtcSec;
    const step = Math.max(60, Math.floor(durationSec / 50));

    let tradableCount = 0;
    let totalSamples = 0;

    for (let t = fromUtcSec; t <= toUtcSec; t += step) {
      totalSamples++;
      if (this.isTradableMinute(t)) {
        tradableCount++;
      }
    }

    if (totalSamples === 0) return true;
    return (tradableCount / totalSamples) <= 0.05;
  }
}

const fxCalendar = new FxSessionCalendar();
const metalCalendar = new MetalSessionCalendar();
const cryptoCalendar = new CryptoSessionCalendar();
const indexCalendar = new IndexSessionCalendar();

/**
 * Returns the appropriate session calendar for a symbol name (e.g., XAUUSD -> METAL, EURUSD -> FX, NAS100 -> INDEX).
 */
export function getTradingSessionCalendar(symbol: string): TradingSessionCalendar {
  const norm = symbol.trim().toUpperCase();
  if (norm.startsWith('XAU') || norm.startsWith('XAG') || norm.includes('GOLD') || norm.includes('SILVER') || norm.startsWith('USO')) {
    return metalCalendar;
  }
  if (norm.startsWith('BTC') || norm.startsWith('ETH') || norm.includes('CRYPTO')) {
    return cryptoCalendar;
  }
  if (norm.startsWith('NAS') || norm.startsWith('US30') || norm.startsWith('SPX') || norm.startsWith('GER') || norm.startsWith('DAX') || norm.includes('IDX') || norm.includes('INDEX')) {
    return indexCalendar;
  }
  return fxCalendar;
}
