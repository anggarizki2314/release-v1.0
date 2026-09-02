import { getDatabase, invalidateSymbolTimeframeCache, invalidateSymbolDetailStatsCache, getAvailableTimeframes } from '../database/db';
import { aggregateCandles, normalizeTimeframe, type AggregatableCandle } from './aggregate';
import type { RawCandle } from './csvParser';

export const DERIVED_TIMEFRAMES = ['M3', 'M5', 'M15', 'M30', 'H1', 'H4', 'H7', 'D1', 'W1', 'Monthly'];

export interface DerivedGenerationResult {
  symbolId: number;
  timeframesGenerated: string[];
  totalRowsInserted: number;
  durationMs: number;
}

export interface DerivedProgressPayload {
  symbolId: number;
  timeframe: string;
  index: number;
  total: number;
  percent: number;
  status: 'generating' | 'completed' | 'error';
  message: string;
  rowsInserted?: number;
  error?: string;
}

export type DerivedProgressCallback = (payload: DerivedProgressPayload) => void;

const activeSymbolGenerations = new Set<number>();

/**
 * Checks SQLite for existing timeframes and returns any missing canonical derived timeframes.
 */
export function getMissingDerivedTimeframes(symbolId: number): string[] {
  const symId = Number(symbolId);
  const availableStats = getAvailableTimeframes(symId);
  const availableSet = new Set(availableStats.map((s) => normalizeTimeframe(s.timeframe)));
  return DERIVED_TIMEFRAMES.filter((tf) => !availableSet.has(normalizeTimeframe(tf)));
}

/**
 * Fetch raw M1 candles from SQLite for symbolId in ascending order.
 */
function fetchM1Candles(symbolId: number, fromTime?: number, toTime?: number): AggregatableCandle[] {
  const symId = Number(symbolId);
  const database = getDatabase();
  let query = 'SELECT time, open, high, low, close, volume FROM candles WHERE symbol_id = ? AND (timeframe = ? OR timeframe = ? OR timeframe = ?)';
  const params: (number | string)[] = [symId, 'M1', '1m', '1M'];

  if (fromTime !== undefined && fromTime !== null && fromTime > 0) {
    query += ' AND time >= ?';
    params.push(fromTime);
  }
  if (toTime !== undefined && toTime !== null && toTime > 0) {
    query += ' AND time <= ?';
    params.push(toTime);
  }

  query += ' ORDER BY time ASC';
  const rows = database.prepare(query).all(...params) as any[];

  const cleanRows: AggregatableCandle[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const t = Number(r.time);
    const o = Number(r.open);
    const h = Number(r.high);
    const l = Number(r.low);
    const c = Number(r.close);

    if (!Number.isFinite(t) || t <= 0) {
      continue;
    }
    if (
      !Number.isFinite(o) || o <= 0 ||
      !Number.isFinite(h) || h <= 0 ||
      !Number.isFinite(l) || l <= 0 ||
      !Number.isFinite(c) || c <= 0 ||
      h < l || h < o || h < c || l > o || l > c
    ) {
      continue;
    }

    cleanRows.push({
      time: t,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: r.volume !== null && r.volume !== undefined ? Number(r.volume) : null,
    });
  }

  return cleanRows;
}

/**
 * Fast direct batch insertion for derived candles.
 * Single prepared statement inside a SQLite transaction.
 */
function fastInsertDerivedCandles(
  database: any,
  symbolId: number,
  timeframe: string,
  rows: RawCandle[]
): number {
  if (rows.length === 0) return 0;
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO candles (symbol_id, timeframe, time, open, high, low, close, volume)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTx = database.transaction((batch: RawCandle[]) => {
    for (let i = 0; i < batch.length; i++) {
      const r = batch[i];
      stmt.run(symbolId, timeframe, r.time, r.open, r.high, r.low, r.close, r.volume ?? null);
    }
  });

  insertTx(rows);
  return rows.length;
}

/**
 * Rebuilds target derived timeframes from authoritative M1 base candles for a specific symbol.
 * Completely non-blocking with cooperative async yielding so Electron window NEVER freezes.
 */
export async function rebuildDerivedTimeframes(
  symbolId: number,
  fromTime?: number,
  toTime?: number,
  targetTimeframes?: string[],
  onProgress?: DerivedProgressCallback
): Promise<DerivedGenerationResult> {
  const t0 = performance.now();
  const symId = Number(symbolId);

  if (activeSymbolGenerations.has(symId)) {
    console.warn(`[DerivedTimeframes] Generation already in progress for symbolId ${symId}`);
    return {
      symbolId: symId,
      timeframesGenerated: [],
      totalRowsInserted: 0,
      durationMs: 0,
    };
  }

  activeSymbolGenerations.add(symId);

  try {
    const timeframesToBuild = targetTimeframes && targetTimeframes.length > 0 ? targetTimeframes : DERIVED_TIMEFRAMES;
    let totalRowsInserted = 0;
    const timeframesGenerated: string[] = [];

    const total = timeframesToBuild.length;
    console.log(`[DerivedTimeframes] Rebuilding ${total} timeframes for symbolId ${symId}:`, timeframesToBuild);

    if (onProgress) {
      onProgress({
        symbolId: symId,
        timeframe: 'M1',
        index: 0,
        total,
        percent: 0,
        status: 'generating',
        message: `Loading M1 source candles for symbol...`,
      });
    }

    // Yield to event loop so IPC progress is dispatched immediately
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 1. Fetch M1 source candles ONCE for all timeframes
    const m1Rows = fetchM1Candles(symId, fromTime, toTime);

    if (m1Rows.length === 0) {
      console.warn(`[DerivedTimeframes] No M1 rows found for symbolId ${symId}`);
      return {
        symbolId: symId,
        timeframesGenerated: [],
        totalRowsInserted: 0,
        durationMs: performance.now() - t0,
      };
    }

    const database = getDatabase();

    // 2. Process each target timeframe sequentially with cooperative yielding
    for (let idx = 0; idx < total; idx++) {
      const rawTf = timeframesToBuild[idx];
      const tf = normalizeTimeframe(rawTf);

      const percent = Math.floor((idx / total) * 100);

      if (onProgress) {
        onProgress({
          symbolId: symId,
          timeframe: tf,
          index: idx + 1,
          total,
          percent,
          status: 'generating',
          message: `Generating ${tf} (${idx + 1}/${total})...`,
        });
      }

      // Yield to event loop before aggregation
      await new Promise((resolve) => setTimeout(resolve, 10));

      try {
        const aggregated = aggregateCandles(m1Rows, tf);

        // Data Integrity Validation
        const validRows: RawCandle[] = [];
        let lastTime = -Infinity;
        for (let i = 0; i < aggregated.length; i++) {
          const c = aggregated[i];
          if (
            !Number.isFinite(c.time) ||
            !Number.isInteger(c.time) ||
            !Number.isFinite(c.open) || c.open <= 0 ||
            !Number.isFinite(c.high) || c.high <= 0 ||
            !Number.isFinite(c.low) || c.low <= 0 ||
            !Number.isFinite(c.close) || c.close <= 0 ||
            c.high < c.low ||
            c.high < c.open ||
            c.high < c.close ||
            c.low > c.open ||
            c.low > c.close ||
            c.time <= lastTime
          ) {
            continue;
          }
          lastTime = c.time;
          validRows.push({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume ?? undefined,
          });
        }

        // Fast chunked insert with periodic event loop yielding
        const CHUNK_SIZE = 20000;
        let tfInserted = 0;
        for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
          const chunk = validRows.slice(i, i + CHUNK_SIZE);
          tfInserted += fastInsertDerivedCandles(database, symId, tf, chunk);
          if (validRows.length > CHUNK_SIZE) {
            await new Promise((resolve) => setTimeout(resolve, 5));
          }
        }

        totalRowsInserted += tfInserted;
        timeframesGenerated.push(tf);

        // Invalidate caches after each timeframe
        invalidateSymbolTimeframeCache(symId);
        invalidateSymbolDetailStatsCache();
      } catch (err) {
        console.error(`[DerivedTimeframes] Error generating timeframe ${tf} for symbolId ${symId}:`, err);
        if (onProgress) {
          onProgress({
            symbolId: symId,
            timeframe: tf,
            index: idx + 1,
            total,
            percent,
            status: 'error',
            message: `Failed to generate ${tf}`,
            error: String(err),
          });
        }
      }
    }

    invalidateSymbolTimeframeCache(symId);
    invalidateSymbolDetailStatsCache();

    const durationMs = performance.now() - t0;
    console.log(`[DerivedTimeframes] Completed multi-timeframe generation for symbolId ${symId}: ${totalRowsInserted} rows inserted in ${durationMs.toFixed(2)}ms.`);

    if (onProgress) {
      onProgress({
        symbolId: symId,
        timeframe: timeframesToBuild[total - 1] || 'Done',
        index: total,
        total,
        percent: 100,
        status: 'completed',
        message: `Multi-timeframe generation complete. Inserted ${totalRowsInserted.toLocaleString()} rows.`,
        rowsInserted: totalRowsInserted,
      });
    }

    return {
      symbolId: symId,
      timeframesGenerated,
      totalRowsInserted,
      durationMs,
    };
  } finally {
    activeSymbolGenerations.delete(symId);
  }
}

/**
 * Detects missing derived timeframes for an existing M1 dataset and generates only missing timeframes.
 */
export async function backfillMissingDerivedTimeframes(
  symbolId: number,
  options?: { force?: boolean; onProgress?: DerivedProgressCallback }
): Promise<DerivedGenerationResult> {
  const symId = Number(symbolId);
  console.log(`[DerivedTimeframes] backfillMissingDerivedTimeframes called for symbolId ${symId}`);
  const missing = options?.force ? DERIVED_TIMEFRAMES : getMissingDerivedTimeframes(symId);
  console.log(`[DerivedTimeframes] Missing derived timeframes for symbolId ${symId}:`, missing);
  if (missing.length === 0) {
    return {
      symbolId: symId,
      timeframesGenerated: [],
      totalRowsInserted: 0,
      durationMs: 0,
    };
  }
  return rebuildDerivedTimeframes(symId, undefined, undefined, missing, options?.onProgress);
}
