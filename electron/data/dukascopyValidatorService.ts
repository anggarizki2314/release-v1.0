import { getDatabase } from '../database/db';
import { getHistoricalRates } from 'dukascopy-node';
import { generateMonthlyChunks, mapInstrument } from './dukascopyDownloader';
import { detectDataGaps } from './dataGapDetector';

export interface ConfirmedMissingRange {
  fromTime: number;
  toTime: number;
  formattedFrom: string;
  formattedTo: string;
  durationSeconds: number;
  source: 'DUKASCOPY';
  confidence: 'CONFIRMED';
}

export interface DukascopyValidationResult {
  symbolId: number;
  symbol: string;

  status:
    | 'VALIDATING'
    | 'COMPLETE'
    | 'MISSING_DATA'
    | 'SOURCE_UNAVAILABLE'
    | 'ERROR';

  sqliteRange: {
    fromTime: number;
    toTime: number;
  };

  confirmedMissingRanges: ConfirmedMissingRange[];

  expectedRangesChecked: number;
  confirmedMissingRangesCount: number;

  source: 'DUKASCOPY';

  validatedAt: number;

  error?: string;
}

export type CustomRatesFetcher = (
  symbol: string,
  fromTime: number,
  toTime: number
) => Promise<Array<{ timestamp: number }>>;

function formatUtcDate(unixSec: number): string {
  if (!unixSec) return '';
  return new Date(unixSec * 1000).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}

/**
 * Performs Source-Authoritative Dukascopy Validation for a symbol.
 * READ-ONLY: MUST NOT write candles to SQLite.
 */
export async function validateSymbolAvailability(
  params: {
    symbolId: number;
    symbol: string;
    timeframe?: string;
    fromTime?: number;
    toTime?: number;
  },
  customFetcher?: CustomRatesFetcher
): Promise<DukascopyValidationResult> {
  const { symbolId, symbol } = params;
  const timeframe = params.timeframe?.toUpperCase() ?? 'M1';
  const normSymbol = symbol.toUpperCase();
  const database = getDatabase();
  const nowSec = Math.floor(Date.now() / 1000);

  // 1. Determine local SQLite range
  const bounds = database
    .prepare('SELECT MIN(time) as minTime, MAX(time) as maxTime FROM candles WHERE symbol_id = ? AND timeframe = ?')
    .get(symbolId, timeframe) as { minTime: number | null; maxTime: number | null } | undefined;

  const minTime = bounds?.minTime ?? 0;
  const maxTime = bounds?.maxTime ?? 0;

  const sqliteRange = {
    fromTime: params.fromTime ?? minTime,
    toTime: params.toTime ?? maxTime,
  };

  // If SQLite has no candles and no explicit range requested
  if (sqliteRange.fromTime === 0 && sqliteRange.toTime === 0) {
    return {
      symbolId,
      symbol: normSymbol,
      status: 'COMPLETE',
      sqliteRange: { fromTime: 0, toTime: 0 },
      confirmedMissingRanges: [],
      expectedRangesChecked: 0,
      confirmedMissingRangesCount: 0,
      source: 'DUKASCOPY',
      validatedAt: nowSec,
    };
  }

  // 2. Generate candidate gaps from SQLite analysis
  const candidateGapRes = await detectDataGaps(symbolId, timeframe, sqliteRange.fromTime, sqliteRange.toTime);
  const candidates = candidateGapRes.gaps.filter(
    (g) => g.classification === 'LARGE_DATA_GAP' || g.classification === 'POSSIBLE_GAP'
  );

  // If SQLite is perfectly continuous (0 candidate gaps)
  if (candidates.length === 0) {
    return {
      symbolId,
      symbol: normSymbol,
      status: 'COMPLETE',
      sqliteRange,
      confirmedMissingRanges: [],
      expectedRangesChecked: candidateGapRes.gaps.length,
      confirmedMissingRangesCount: 0,
      source: 'DUKASCOPY',
      validatedAt: nowSec,
    };
  }

  // 3. Read-only validation against Dukascopy for each candidate range
  const confirmedRanges: ConfirmedMissingRange[] = [];
  let fetchError: string | undefined = undefined;

  for (const cand of candidates) {
    const candFrom = cand.fromTime;
    const candTo = cand.toTime;

    let sourceTimestamps: Set<number> = new Set();

    if (customFetcher) {
      try {
        const rates = await customFetcher(normSymbol, candFrom, candTo);
        if (rates) {
          for (const r of rates) {
            const sec = Math.floor(r.timestamp / 1000);
            if (sec >= candFrom && sec <= candTo) {
              sourceTimestamps.add(sec);
            }
          }
        }
      } catch (err: any) {
        fetchError = err?.message || 'Dukascopy source fetch failed';
      }
    } else {
      const fromStr = new Date(candFrom * 1000).toISOString().split('T')[0];
      const toStr = new Date(candTo * 1000).toISOString().split('T')[0];
      const chunks = generateMonthlyChunks(fromStr, toStr);

      for (const chunk of chunks) {
        try {
          const rates = (await getHistoricalRates({
            instrument: mapInstrument(normSymbol) as any,
            dates: { from: chunk.from, to: chunk.to },
            timeframe: 'm1',
            format: 'json',
            batchSize: 2,
            pauseBetweenBatchesMs: 300,
          })) as any[];

          if (rates) {
            for (const r of rates) {
              const sec = Math.floor(r.timestamp / 1000);
              if (sec >= candFrom && sec <= candTo) {
                sourceTimestamps.add(sec);
              }
            }
          }
        } catch (err: any) {
          fetchError = err?.message || 'Dukascopy request failed';
        }
      }
    }

    if (fetchError && sourceTimestamps.size === 0) {
      break;
    }

    // Dukascopy has 0 candles for this candidate range -> NOT missing (weekend/market closure)
    if (sourceTimestamps.size === 0) {
      continue;
    }

    // Query SQLite candles in this candidate range
    const localRows = database
      .prepare('SELECT time FROM candles WHERE symbol_id = ? AND timeframe = ? AND time >= ? AND time <= ?')
      .all(symbolId, timeframe, candFrom, candTo) as { time: number }[];

    const localSet = new Set(localRows.map((r) => r.time));

    // Calculate missing timestamps (present in Dukascopy AND NOT in SQLite)
    const missingTimestamps: number[] = [];
    for (const t of Array.from(sourceTimestamps.values())) {
      if (!localSet.has(t)) {
        missingTimestamps.push(t);
      }
    }
    missingTimestamps.sort((a, b) => a - b);

    if (missingTimestamps.length > 0) {
      let curStart = missingTimestamps[0];
      let curEnd = missingTimestamps[0];

      for (let i = 1; i < missingTimestamps.length; i++) {
        const t = missingTimestamps[i];
        if (t === curEnd + 60) {
          curEnd = t;
        } else {
          confirmedRanges.push({
            fromTime: curStart,
            toTime: curEnd,
            formattedFrom: formatUtcDate(curStart),
            formattedTo: formatUtcDate(curEnd),
            durationSeconds: curEnd - curStart + 60,
            source: 'DUKASCOPY',
            confidence: 'CONFIRMED',
          });
          curStart = t;
          curEnd = t;
        }
      }
      confirmedRanges.push({
        fromTime: curStart,
        toTime: curEnd,
        formattedFrom: formatUtcDate(curStart),
        formattedTo: formatUtcDate(curEnd),
        durationSeconds: curEnd - curStart + 60,
        source: 'DUKASCOPY',
        confidence: 'CONFIRMED',
      });
    }
  }

  if (fetchError && confirmedRanges.length === 0) {
    return {
      symbolId,
      symbol: normSymbol,
      status: 'SOURCE_UNAVAILABLE',
      sqliteRange,
      confirmedMissingRanges: [],
      expectedRangesChecked: candidates.length,
      confirmedMissingRangesCount: 0,
      source: 'DUKASCOPY',
      validatedAt: nowSec,
      error: fetchError,
    };
  }

  const finalStatus = confirmedRanges.length > 0 ? 'MISSING_DATA' : 'COMPLETE';

  return {
    symbolId,
    symbol: normSymbol,
    status: finalStatus,
    sqliteRange,
    confirmedMissingRanges: confirmedRanges,
    expectedRangesChecked: candidates.length,
    confirmedMissingRangesCount: confirmedRanges.length,
    source: 'DUKASCOPY',
    validatedAt: nowSec,
  };
}
