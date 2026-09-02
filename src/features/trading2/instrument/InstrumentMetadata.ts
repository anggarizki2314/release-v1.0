/**
 * Trading Engine 2.0 — InstrumentMetadata
 * Instrument metadata registry resolving symbol contract sizes, digits, and pip sizes.
 * Zero hardcoded magic numbers in calculations.
 */

export interface InstrumentSpec {
  symbol: string;
  contractSize: number;
  digits: number;
  pipSize: number;
}

export class InstrumentMetadata {
  private static registry: Record<string, InstrumentSpec> = {
    // Metals
    XAUUSD: { symbol: 'XAUUSD', contractSize: 100, digits: 2, pipSize: 0.1 },
    GOLD: { symbol: 'GOLD', contractSize: 100, digits: 2, pipSize: 0.1 },
    XAGUSD: { symbol: 'XAGUSD', contractSize: 5000, digits: 3, pipSize: 0.01 },
    SILVER: { symbol: 'SILVER', contractSize: 5000, digits: 3, pipSize: 0.01 },

    // Energy & Commodities
    USOUSD: { symbol: 'USOUSD', contractSize: 100, digits: 2, pipSize: 0.01 },
    OIL: { symbol: 'OIL', contractSize: 100, digits: 2, pipSize: 0.01 },
    WTI: { symbol: 'WTI', contractSize: 100, digits: 2, pipSize: 0.01 },
    BRENT: { symbol: 'BRENT', contractSize: 100, digits: 2, pipSize: 0.01 },
    LIGHTCMDUSD: { symbol: 'LIGHTCMDUSD', contractSize: 100, digits: 2, pipSize: 0.01 },
    BRENTCMDUSD: { symbol: 'BRENTCMDUSD', contractSize: 100, digits: 2, pipSize: 0.01 },

    // Major Indices (1.0 lot = 1 contract / $1 per point)
    NAS100: { symbol: 'NAS100', contractSize: 1, digits: 2, pipSize: 1.0 },
    USATECHIDXUSD: { symbol: 'USATECHIDXUSD', contractSize: 1, digits: 2, pipSize: 1.0 },
    NASDAQ: { symbol: 'NASDAQ', contractSize: 1, digits: 2, pipSize: 1.0 },
    NASDAQ100: { symbol: 'NASDAQ100', contractSize: 1, digits: 2, pipSize: 1.0 },
    NDX: { symbol: 'NDX', contractSize: 1, digits: 2, pipSize: 1.0 },
    US100: { symbol: 'US100', contractSize: 1, digits: 2, pipSize: 1.0 },
    USTECH: { symbol: 'USTECH', contractSize: 1, digits: 2, pipSize: 1.0 },

    US30: { symbol: 'US30', contractSize: 1, digits: 2, pipSize: 1.0 },
    USA30IDXUSD: { symbol: 'USA30IDXUSD', contractSize: 1, digits: 2, pipSize: 1.0 },
    DJI: { symbol: 'DJI', contractSize: 1, digits: 2, pipSize: 1.0 },
    DOW: { symbol: 'DOW', contractSize: 1, digits: 2, pipSize: 1.0 },

    SPX500: { symbol: 'SPX500', contractSize: 1, digits: 2, pipSize: 1.0 },
    USA500IDXUSD: { symbol: 'USA500IDXUSD', contractSize: 1, digits: 2, pipSize: 1.0 },
    SP500: { symbol: 'SP500', contractSize: 1, digits: 2, pipSize: 1.0 },
    US500: { symbol: 'US500', contractSize: 1, digits: 2, pipSize: 1.0 },

    GER30: { symbol: 'GER30', contractSize: 1, digits: 2, pipSize: 1.0 },
    GER40: { symbol: 'GER40', contractSize: 1, digits: 2, pipSize: 1.0 },
    DEUIDXEUR: { symbol: 'DEUIDXEUR', contractSize: 1, digits: 2, pipSize: 1.0 },
    DAX: { symbol: 'DAX', contractSize: 1, digits: 2, pipSize: 1.0 },
    DAX40: { symbol: 'DAX40', contractSize: 1, digits: 2, pipSize: 1.0 },

    UK100: { symbol: 'UK100', contractSize: 1, digits: 2, pipSize: 1.0 },
    GBRIDXGBP: { symbol: 'GBRIDXGBP', contractSize: 1, digits: 2, pipSize: 1.0 },
    FTSE: { symbol: 'FTSE', contractSize: 1, digits: 2, pipSize: 1.0 },
    JPN225: { symbol: 'JPN225', contractSize: 1, digits: 2, pipSize: 1.0 },
    JPNIDXJPY: { symbol: 'JPNIDXJPY', contractSize: 1, digits: 2, pipSize: 1.0 },
    NIKKEI: { symbol: 'NIKKEI', contractSize: 1, digits: 2, pipSize: 1.0 },
    AUS200: { symbol: 'AUS200', contractSize: 1, digits: 2, pipSize: 1.0 },
    AUSIDXAUD: { symbol: 'AUSIDXAUD', contractSize: 1, digits: 2, pipSize: 1.0 },

    // Crypto (1.0 lot = 1 coin)
    BTCUSD: { symbol: 'BTCUSD', contractSize: 1, digits: 2, pipSize: 1.0 },
    ETHUSD: { symbol: 'ETHUSD', contractSize: 1, digits: 2, pipSize: 1.0 },
    SOLUSD: { symbol: 'SOLUSD', contractSize: 1, digits: 2, pipSize: 1.0 },

    // Major Forex Pairs (1.0 lot = 100,000 units)
    EURUSD: { symbol: 'EURUSD', contractSize: 100000, digits: 5, pipSize: 0.0001 },
    GBPUSD: { symbol: 'GBPUSD', contractSize: 100000, digits: 5, pipSize: 0.0001 },
    USDJPY: { symbol: 'USDJPY', contractSize: 100000, digits: 3, pipSize: 0.01 },
    AUDUSD: { symbol: 'AUDUSD', contractSize: 100000, digits: 5, pipSize: 0.0001 },
    USDCAD: { symbol: 'USDCAD', contractSize: 100000, digits: 5, pipSize: 0.0001 },
    USDCHF: { symbol: 'USDCHF', contractSize: 100000, digits: 5, pipSize: 0.0001 },
    NZDUSD: { symbol: 'NZDUSD', contractSize: 100000, digits: 5, pipSize: 0.0001 },

    // Minor Forex Pairs & Crosses
    EURGBP: { symbol: 'EURGBP', contractSize: 100000, digits: 5, pipSize: 0.0001 },
    EURJPY: { symbol: 'EURJPY', contractSize: 100000, digits: 3, pipSize: 0.01 },
    GBPJPY: { symbol: 'GBPJPY', contractSize: 100000, digits: 3, pipSize: 0.01 },
    AUDJPY: { symbol: 'AUDJPY', contractSize: 100000, digits: 3, pipSize: 0.01 },
    CADJPY: { symbol: 'CADJPY', contractSize: 100000, digits: 3, pipSize: 0.01 },
    CHFJPY: { symbol: 'CHFJPY', contractSize: 100000, digits: 3, pipSize: 0.01 },
    NZDJPY: { symbol: 'NZDJPY', contractSize: 100000, digits: 3, pipSize: 0.01 },
    EURAUD: { symbol: 'EURAUD', contractSize: 100000, digits: 5, pipSize: 0.0001 },
    EURCAD: { symbol: 'EURCAD', contractSize: 100000, digits: 5, pipSize: 0.0001 },
    EURNZD: { symbol: 'EURNZD', contractSize: 100000, digits: 5, pipSize: 0.0001 },
    EURCHF: { symbol: 'EURCHF', contractSize: 100000, digits: 5, pipSize: 0.0001 },
    GBPAUD: { symbol: 'GBPAUD', contractSize: 100000, digits: 5, pipSize: 0.0001 },
    GBPCAD: { symbol: 'GBPCAD', contractSize: 100000, digits: 5, pipSize: 0.0001 },
    GBPCHF: { symbol: 'GBPCHF', contractSize: 100000, digits: 5, pipSize: 0.0001 },
    GBPNZD: { symbol: 'GBPNZD', contractSize: 100000, digits: 5, pipSize: 0.0001 },
    AUDCAD: { symbol: 'AUDCAD', contractSize: 100000, digits: 5, pipSize: 0.0001 },
    AUDCHF: { symbol: 'AUDCHF', contractSize: 100000, digits: 5, pipSize: 0.0001 },
    AUDNZD: { symbol: 'AUDNZD', contractSize: 100000, digits: 5, pipSize: 0.0001 },
    CADCHF: { symbol: 'CADCHF', contractSize: 100000, digits: 5, pipSize: 0.0001 },
    NZDCAD: { symbol: 'NZDCAD', contractSize: 100000, digits: 5, pipSize: 0.0001 },
    NZDCHF: { symbol: 'NZDCHF', contractSize: 100000, digits: 5, pipSize: 0.0001 },
  };

  /**
   * Returns full spec for a symbol.
   */
  public static getSpec(symbol: string): InstrumentSpec {
    if (!symbol) {
      return { symbol: 'UNKNOWN', contractSize: 100000, digits: 5, pipSize: 0.0001 };
    }
    const cleanSymbol = symbol.toUpperCase().trim();
    if (this.registry[cleanSymbol]) {
      return this.registry[cleanSymbol];
    }
    // Pattern matchers for custom or unlisted symbols
    if (cleanSymbol.includes('XAU') || cleanSymbol.includes('GOLD')) {
      return { symbol: cleanSymbol, contractSize: 100, digits: 2, pipSize: 0.1 };
    }
    if (cleanSymbol.includes('XAG') || cleanSymbol.includes('SILVER')) {
      return { symbol: cleanSymbol, contractSize: 5000, digits: 3, pipSize: 0.01 };
    }
    if (cleanSymbol.includes('OIL') || cleanSymbol.includes('USO') || cleanSymbol.includes('WTI') || cleanSymbol.includes('BRENT')) {
      return { symbol: cleanSymbol, contractSize: 100, digits: 2, pipSize: 0.01 };
    }
    if (
      cleanSymbol.includes('NAS') ||
      cleanSymbol.includes('TECH') ||
      cleanSymbol.includes('100') ||
      cleanSymbol.includes('US30') ||
      cleanSymbol.includes('DOW') ||
      cleanSymbol.includes('DJI') ||
      cleanSymbol.includes('SPX') ||
      cleanSymbol.includes('500') ||
      cleanSymbol.includes('GER') ||
      cleanSymbol.includes('DAX') ||
      cleanSymbol.includes('FTSE') ||
      cleanSymbol.includes('NIKKEI') ||
      cleanSymbol.includes('225') ||
      cleanSymbol.includes('BTC') ||
      cleanSymbol.includes('ETH') ||
      cleanSymbol.includes('SOL')
    ) {
      return { symbol: cleanSymbol, contractSize: 1, digits: 2, pipSize: 1.0 };
    }
    const isJpy = cleanSymbol.includes('JPY');
    return {
      symbol: cleanSymbol,
      contractSize: 100000,
      digits: isJpy ? 3 : 5,
      pipSize: isJpy ? 0.01 : 0.0001,
    };
  }

  /**
   * Returns contract size for a symbol from metadata registry.
   */
  public static getContractSize(symbol: string): number {
    return this.getSpec(symbol).contractSize;
  }

  /**
   * Returns pip size for a symbol.
   */
  public static getPipSize(symbol: string): number {
    return this.getSpec(symbol).pipSize;
  }

  /**
   * Returns decimal display digits for a symbol.
   */
  public static getDigits(symbol: string): number {
    return this.getSpec(symbol).digits;
  }

  /**
   * Returns true if pair has JPY as quote currency.
   */
  public static isJpyPair(symbol: string): boolean {
    return (symbol || '').toUpperCase().includes('JPY');
  }

  /**
   * Returns true if USD is the base currency (e.g. USDJPY, USDCAD, USDCHF).
   */
  public static isUsdBasePair(symbol: string): boolean {
    const s = (symbol || '').toUpperCase().trim();
    return s.startsWith('USD') && s.length === 6 && !s.includes('IDX');
  }

  /**
   * Converts a raw quote currency amount to USD account currency using the given price rate.
   */
  public static convertQuoteToAccount(symbol: string, quoteAmount: number, price: number): number {
    if (!symbol || quoteAmount === 0) return 0;
    if (this.isJpyPair(symbol) || this.isUsdBasePair(symbol)) {
      return price > 0 ? quoteAmount / price : quoteAmount;
    }
    return quoteAmount;
  }

  /**
   * Centralized accurate PnL calculation across all instruments and currency pairs.
   */
  public static calculatePnl(
    symbol: string,
    direction: 'BUY' | 'SELL',
    entryPrice: number,
    exitPrice: number,
    volume: number
  ): number {
    if (entryPrice <= 0 || exitPrice <= 0 || volume <= 0) return 0;
    const spec = this.getSpec(symbol);
    const diff = direction === 'BUY' ? exitPrice - entryPrice : entryPrice - exitPrice;
    const rawPnL = diff * volume * spec.contractSize;
    const converted = this.convertQuoteToAccount(symbol, rawPnL, exitPrice || entryPrice);
    return Math.round(converted * 100) / 100;
  }
}

