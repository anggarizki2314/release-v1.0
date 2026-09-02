import type { EconomicEvent, EconomicNewsStats } from './types';

/** Extract associated currencies from trading symbol (e.g. XAUUSD -> ['USD'], EURUSD -> ['EUR', 'USD']) */
export function getCurrenciesForSymbol(symbol: string): string[] {
  if (!symbol) return ['USD'];
  const s = symbol.toUpperCase().replace(/[^A-Z]/g, '');

  if (s === 'XAUUSD' || s === 'XAGUSD' || s === 'BTCUSD' || s === 'ETHUSD' || s === 'US30' || s === 'NAS100' || s === 'SPX500') {
    return ['USD'];
  }

  if (s.length === 6) {
    const base = s.substring(0, 3);
    const quote = s.substring(3, 6);
    const majorCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];
    const result: string[] = [];
    if (majorCurrencies.includes(base)) result.push(base);
    if (majorCurrencies.includes(quote)) result.push(quote);
    return result.length > 0 ? result : ['USD'];
  }

  return ['USD'];
}

/** Get country flag emoji / icon from country code or currency */
export function getFlagForCurrency(currency: string): string {
  const map: Record<string, string> = {
    USD: '🇺🇸',
    EUR: '🇪🇺',
    GBP: '🇬🇧',
    JPY: '🇯🇵',
    AUD: '🇦🇺',
    CAD: '🇨🇦',
    CHF: '🇨🇭',
    NZD: '🇳🇿',
    US: '🇺🇸',
    EU: '🇪🇺',
    GB: '🇬🇧',
    JP: '🇯🇵',
    AU: '🇦🇺',
    CA: '🇨🇦',
    CH: '🇨🇭',
    NZ: '🇳🇿',
  };
  return map[currency?.toUpperCase()] || '🌐';
}

/** Fetch Economic News range from SQLite via Electron IPC */
export async function getEconomicNewsForRange(
  currencies: string[],
  fromTime: number,
  toTime: number,
  minImpact: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH'
): Promise<EconomicEvent[]> {
  try {
    if (window.forexReplay?.getEconomicNewsRange) {
      const res = await window.forexReplay.getEconomicNewsRange({
        currencies,
        fromTime,
        toTime,
        minImpact,
      });
      return res as EconomicEvent[];
    }
  } catch (err) {
    console.error('[NewsApi] Failed to get news events:', err);
  }
  return [];
}

/** Fetch Economic News stats from SQLite */
export async function getEconomicNewsStats(): Promise<EconomicNewsStats | null> {
  try {
    if (window.forexReplay?.getEconomicNewsStats) {
      return await window.forexReplay.getEconomicNewsStats();
    }
  } catch (err) {
    console.error('[NewsApi] Failed to get news stats:', err);
  }
  return null;
}

/** Download / sync news from Dukascopy via Electron IPC */
export async function downloadEconomicNews(
  startDate: string,
  endDate: string,
  currencies: string[] = ['USD', 'EUR', 'GBP', 'JPY']
): Promise<{ success: boolean; totalInserted: number; message: string }> {
  try {
    if (window.forexReplay?.downloadEconomicNews) {
      return await window.forexReplay.downloadEconomicNews({
        startDate,
        endDate,
        currencies,
      });
    }
  } catch (err: any) {
    console.error('[NewsApi] Download news failed:', err);
    return { success: false, totalInserted: 0, message: err?.message || 'Download failed' };
  }
  return { success: false, totalInserted: 0, message: 'Electron bridge not available' };
}
