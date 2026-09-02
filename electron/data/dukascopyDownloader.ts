import { getHistoricalRates, type TimeframeType } from 'dukascopy-node';
import { upsertSymbol, insertCandlesBatch, recordDataset } from '../database/db';
import { rebuildDerivedTimeframes } from './derivedTimeframes';
import { bucketStart } from './aggregate';
import type { RawCandle } from './csvParser';

export interface DukascopyDownloadParams {
  symbol: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  timeframe: string; // M1, M5, H1, etc.
}

export interface DukascopyProgress {
  status: 'downloading' | 'processing' | 'completed' | 'error';
  currentDay: number;
  totalDays: number;
  percent: number;
  message: string;
  rowsInserted?: number;
}

export const DUKASCOPY_INSTRUMENT_MAP: Record<string, string> = {
  // Indices
  NAS100: 'usatechidxusd',
  NASDAQ: 'usatechidxusd',
  NASDAQ100: 'usatechidxusd',
  NDX: 'usatechidxusd',
  US100: 'usatechidxusd',
  USTECH: 'usatechidxusd',
  US30: 'usa30idxusd',
  DJI: 'usa30idxusd',
  DOW: 'usa30idxusd',
  SPX500: 'usa500idxusd',
  SP500: 'usa500idxusd',
  US500: 'usa500idxusd',
  GER30: 'deuidxeur',
  GER40: 'deuidxeur',
  DAX: 'deuidxeur',
  DAX40: 'deuidxeur',
  UK100: 'gbridxgbp',
  FTSE: 'gbridxgbp',
  JPN225: 'jpnidxjpy',
  NIKKEI: 'jpnidxjpy',
  AUS200: 'ausidxaud',

  // Commodities
  XAUUSD: 'xauusd',
  GOLD: 'xauusd',
  XAGUSD: 'xagusd',
  SILVER: 'xagusd',
  USOUSD: 'lightcmdusd',
  OIL: 'lightcmdusd',
  WTI: 'lightcmdusd',
  CRUDE: 'lightcmdusd',
  BRENT: 'brentcmdusd',

  // Crypto
  BTCUSD: 'btcusd',
  ETHUSD: 'ethusd',
};

export function mapInstrument(symbol: string): string {
  if (!symbol) return '';
  const norm = symbol.trim().toUpperCase();
  return DUKASCOPY_INSTRUMENT_MAP[norm] || symbol.toLowerCase();
}

/** Map user timeframe selection to dukascopy-node timeframe */
function mapTimeframe(tf: string): TimeframeType {
  const lower = tf.toLowerCase();
  if (lower === 'm1') return 'm1';
  if (lower === 'm5') return 'm5';
  if (lower === 'm15') return 'm15';
  if (lower === 'm30') return 'm30';
  if (lower === 'h1') return 'h1';
  if (lower === 'h4') return 'h4';
  if (lower === 'd1') return 'd1';
  return 'm1';
}

/** Split long date ranges into monthly chunks and cap future dates (inclusive of end date) */
export function generateMonthlyChunks(startDateStr: string, endDateStr: string): { from: string; to: string }[] {
  const chunks: { from: string; to: string }[] = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  // Cap end date to current UTC date to avoid querying future dates
  const now = new Date();
  const actualEnd = end > now ? now : end;

  let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));

  while (cur <= actualEnd) {
    const year = cur.getUTCFullYear();
    const month = cur.getUTCMonth();

    const fromDate = cur < start ? start : cur;
    // First day of NEXT month, or day after actualEnd (to make dukascopy-node query inclusive of the last day)
    const firstDayOfNextMonth = new Date(Date.UTC(year, month + 1, 1));
    const dayAfterActualEnd = new Date(Date.UTC(actualEnd.getUTCFullYear(), actualEnd.getUTCMonth(), actualEnd.getUTCDate() + 1));
    const toDate = firstDayOfNextMonth > dayAfterActualEnd ? dayAfterActualEnd : firstDayOfNextMonth;

    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = toDate.toISOString().split('T')[0];

    if (fromDate < toDate) {
      chunks.push({ from: fromStr, to: toStr });
    }

    cur = firstDayOfNextMonth;
  }

  return chunks;
}

/**
 * Downloads & Ingests Real Dukascopy Historical Data using dukascopy-node.
 * Downloads month-by-month to prevent network socket timeouts on large date ranges.
 */
export async function downloadDukascopyHistoricalData(
  params: DukascopyDownloadParams,
  onProgress: (progress: DukascopyProgress) => void
): Promise<{ success: boolean; rowsInserted: number; symbol: string }> {
  const { symbol, startDate, endDate, timeframe } = params;

  const symbolId = upsertSymbol(symbol.toUpperCase());
  const instrument = mapInstrument(symbol);
  const dukasTimeframe = mapTimeframe(timeframe);

  const chunks = generateMonthlyChunks(startDate, endDate);
  if (chunks.length === 0) {
    throw new Error('Invalid date range specified for Dukascopy download.');
  }

  let grandTotalInserted = 0;
  let overallFirstTime: number | null = null;
  let overallLastTime: number | null = null;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const percent = Math.round(((i + 1) / chunks.length) * 100);

    onProgress({
      status: 'downloading',
      currentDay: i + 1,
      totalDays: chunks.length,
      percent,
      message: `[${i + 1}/${chunks.length}] Downloading ${symbol.toUpperCase()} feed (${chunk.from} to ${chunk.to})...`,
      rowsInserted: grandTotalInserted,
    });

    try {
      const rates = (await getHistoricalRates({
        instrument: instrument as any,
        dates: {
          from: chunk.from,
          to: chunk.to,
        },
        timeframe: dukasTimeframe,
        format: 'json',
        batchSize: 2,
        pauseBetweenBatchesMs: 500,
      })) as any[];

      if (rates && rates.length > 0) {
        const candles: RawCandle[] = rates.map((r: any) => ({
          time: Math.floor(r.timestamp / 1000), // UNIX seconds
          open: Number(r.open),
          high: Number(r.high),
          low: Number(r.low),
          close: Number(r.close),
          volume: Math.round(Number(r.volume || 1) * 1000),
        }));

        candles.sort((a, b) => a.time - b.time);

        if (candles.length > 0) {
          const chunkFirst = candles[0].time;
          const chunkLast = candles[candles.length - 1].time;

          if (overallFirstTime === null || chunkFirst < overallFirstTime) {
            overallFirstTime = chunkFirst;
          }
          if (overallLastTime === null || chunkLast > overallLastTime) {
            overallLastTime = chunkLast;
          }

          const res = insertCandlesBatch(symbolId, timeframe.toUpperCase(), candles);
          grandTotalInserted += res.inserted;
        }
      }
    } catch (chunkErr) {
      console.warn(`[Dukascopy Chunk Warning] Failed chunk ${chunk.from}..${chunk.to}:`, chunkErr);
      // Continue next month chunk gracefully
    }
  }

  if (grandTotalInserted > 0) {
    recordDataset({
      symbolId,
      timeframe: timeframe.toUpperCase(),
      fileName: `dukascopy_${symbol.toUpperCase()}_${startDate}_to_${endDate}.csv`,
      filePath: `dukascopy://${symbol.toUpperCase()}/${startDate}_${endDate}`,
      rowsRead: grandTotalInserted,
      rowsValid: grandTotalInserted,
      rowsSkipped: 0,
      rowsDuplicate: 0,
      rowsInserted: grandTotalInserted,
      firstTime: overallFirstTime,
      lastTime: overallLastTime,
    });

    // Auto-generate higher timeframes (M3..Monthly) for newly downloaded M1 data (incremental range only)
    if (timeframe.toUpperCase() === 'M1' && grandTotalInserted > 0) {
      try {
        if (onProgress) {
          onProgress({
            status: 'downloading',
            currentDay: chunks.length,
            totalDays: chunks.length,
            percent: 99,
            message: `Meng-generate timeframe untuk data baru ${symbol.toUpperCase()}...`,
            rowsInserted: grandTotalInserted,
          });
        }
        const fromExpanded = overallFirstTime ? bucketStart(overallFirstTime, 'Monthly') : undefined;
        const toExpanded = overallLastTime ? overallLastTime + 86400 : undefined;
        await rebuildDerivedTimeframes(symbolId, fromExpanded, toExpanded);
      } catch (genErr) {
        console.error(`[Dukascopy] Auto-generation of derived timeframes failed for ${symbol.toUpperCase()}:`, genErr);
      }
    }

    if (onProgress) {
      onProgress({
        status: 'completed',
        currentDay: chunks.length,
        totalDays: chunks.length,
        percent: 100,
        message: `Dukascopy download completed! Ingested ${grandTotalInserted.toLocaleString('en-US')} real candles for ${symbol.toUpperCase()}. Timeframes updated.`,
        rowsInserted: grandTotalInserted,
      });
    }

    return {
      success: true,
      rowsInserted: grandTotalInserted,
      symbol: symbol.toUpperCase(),
    };
  } else {
    throw new Error(`No candle data returned by Dukascopy for ${symbol.toUpperCase()} between ${startDate} and ${endDate}. Please check the symbol and date range.`);
  }
}

/**
 * Downloads missing confirmed ranges from Dukascopy and merges them into SQLite.
 */
export async function downloadMissingRanges(
  params: {
    symbolId: number;
    symbol: string;
    timeframe?: string;
    gaps: Array<{ fromTime: number; toTime: number; formattedFrom?: string; formattedTo?: string }>;
  },
  onProgress?: (progress: DukascopyProgress) => void
): Promise<{ success: boolean; rowsInserted: number; symbol: string; recoveredRanges: number }> {
  const { symbolId, symbol, gaps } = params;
  const tf = params.timeframe ?? 'M1';
  const normSymbol = symbol.toUpperCase();
  const dukasTimeframe = mapTimeframe(tf);

  let totalInserted = 0;
  let recoveredCount = 0;

  for (let i = 0; i < gaps.length; i++) {
    const gap = gaps[i];
    const fromStr = new Date(gap.fromTime * 1000).toISOString().split('T')[0];
    const toStr = new Date(gap.toTime * 1000).toISOString().split('T')[0];

    if (onProgress) {
      onProgress({
        status: 'downloading',
        currentDay: i + 1,
        totalDays: gaps.length,
        percent: Math.round(((i + 1) / gaps.length) * 100),
        message: `[${i + 1}/${gaps.length}] Recovering missing range ${fromStr} to ${toStr}...`,
        rowsInserted: totalInserted,
      });
    }

    const chunks = generateMonthlyChunks(fromStr, toStr);
    for (const chunk of chunks) {
      try {
        const rates = (await getHistoricalRates({
          instrument: mapInstrument(normSymbol) as any,
          dates: { from: chunk.from, to: chunk.to },
          timeframe: dukasTimeframe,
          format: 'json',
          batchSize: 2,
          pauseBetweenBatchesMs: 300,
        })) as any[];

        if (rates && rates.length > 0) {
          const candles: RawCandle[] = rates
            .map((r: any) => ({
              time: Math.floor(r.timestamp / 1000),
              open: Number(r.open),
              high: Number(r.high),
              low: Number(r.low),
              close: Number(r.close),
              volume: Math.round(Number(r.volume || 1) * 1000),
            }))
            .filter((c) => c.time >= gap.fromTime && c.time <= gap.toTime);

          candles.sort((a, b) => a.time - b.time);

          if (candles.length > 0) {
            const res = insertCandlesBatch(symbolId, tf.toUpperCase(), candles);
            totalInserted += res.inserted;
          }
        }
      } catch (chunkErr) {
        console.warn(`[DownloadMissingRanges] Error downloading chunk ${chunk.from}..${chunk.to}:`, chunkErr);
      }
    }
    recoveredCount++;
  }

  // Auto-generate higher timeframes for recovered missing ranges (incremental range only)
  if (tf.toUpperCase() === 'M1' && totalInserted > 0) {
    try {
      if (onProgress) {
        onProgress({
          status: 'downloading',
          currentDay: gaps.length,
          totalDays: gaps.length,
          percent: 99,
          message: `Meng-generate timeframe untuk data baru ${normSymbol}...`,
          rowsInserted: totalInserted,
        });
      }
      const minGapTime = gaps.reduce((min, g) => Math.min(min, g.fromTime), Infinity);
      const maxGapTime = gaps.reduce((max, g) => Math.max(max, g.toTime), -Infinity);
      const fromExpanded = Number.isFinite(minGapTime) ? bucketStart(minGapTime, 'Monthly') : undefined;
      const toExpanded = Number.isFinite(maxGapTime) ? maxGapTime + 86400 : undefined;
      await rebuildDerivedTimeframes(symbolId, fromExpanded, toExpanded);
    } catch (genErr) {
      console.error(`[DownloadMissingRanges] Auto-generation of derived timeframes failed for ${normSymbol}:`, genErr);
    }
  }

  if (onProgress) {
    onProgress({
      status: 'completed',
      currentDay: gaps.length,
      totalDays: gaps.length,
      percent: 100,
      message: `Gap recovery complete! Inserted ${totalInserted.toLocaleString()} missing candles. Timeframes updated.`,
      rowsInserted: totalInserted,
    });
  }

  return {
    success: true,
    rowsInserted: totalInserted,
    symbol: normSymbol,
    recoveredRanges: recoveredCount,
  };
}
