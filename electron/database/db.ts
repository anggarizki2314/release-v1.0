import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import type { RawCandle } from '../data/csvParser';
import { aggregateCandles, TIMEFRAME_SECONDS, normalizeTimeframe } from '../data/aggregate';

// Local-only SQLite database. No network access, ever.
//
// Schema history (additive only — never drops/alters existing data):
//  Day 1: symbols, candles
//  Day 3: + datasets (one row per imported file — import history /
//          metadata, does NOT store candle data itself). candles and
//          symbols are untouched, so data imported on Day 2 is safe.
//  Day 4 (bugfix): + app_settings (generic key/value store — used to
//          persist the last selected symbol/timeframe across app
//          restarts). Reuses the existing local SQLite file — no new
//          database, no change to symbols/candles/datasets.
//  Day 5: no schema change. getCandles() default batch shrunk
//          (20000 → 5000) and getCandlesBefore() added for backward
//          pagination as the chart is panned into older history —
//          see features/chart/useCandles.ts.
//  Day 6: no schema change — no new candle rows are stored for M5/
//          M15/H1/etc. getCandles()/getCandlesBefore() now aggregate
//          on the fly from the finest native timeframe available
//          (see resolveSourceTimeframe + electron/data/aggregate.ts)
//          whenever the requested timeframe has no native data.

let db: Database.Database | null = null;

export function initDatabase(userDataPath: string): Database.Database {
  const dbPath = path.join(userDataPath, 'forex-replay.db');
  console.log('Database Path:', dbPath);
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000'); // 64MB in-memory cache for ultra-fast queries
  db.pragma('temp_store = MEMORY');
  db.pragma('mmap_size = 268435456'); // 256MB mmap to avoid repetitive OS disk read intercepts

  db.exec(`
    CREATE TABLE IF NOT EXISTS symbols (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS candles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol_id INTEGER NOT NULL REFERENCES symbols(id),
      timeframe TEXT NOT NULL,
      time INTEGER NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL,
      UNIQUE(symbol_id, timeframe, time)
    );

    CREATE INDEX IF NOT EXISTS idx_candles_lookup
      ON candles (symbol_id, timeframe, time);

    -- Day 3: import history / metadata per file. Deliberately does NOT
    -- reference individual candle rows (candles from different monthly
    -- files already share one indexed space per symbol+timeframe, by
    -- design from Day 2) — this table is for reporting/coverage only.
    CREATE TABLE IF NOT EXISTS datasets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol_id INTEGER NOT NULL REFERENCES symbols(id),
      timeframe TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT,
      imported_at INTEGER NOT NULL,
      rows_read INTEGER NOT NULL,
      rows_valid INTEGER NOT NULL,
      rows_skipped INTEGER NOT NULL,
      rows_duplicate INTEGER NOT NULL,
      rows_inserted INTEGER NOT NULL,
      first_time INTEGER,
      last_time INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_datasets_symbol
      ON datasets (symbol_id, imported_at);

    -- Day 4 (bugfix): generic key/value store for small pieces of UI
    -- state that should survive an app restart (currently: last
    -- selected symbol + timeframe). Deliberately generic (not a
    -- dedicated "last_selection" table) so future settings can reuse
    -- it without another migration.
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Day 20: import history log with status tracking.
    CREATE TABLE IF NOT EXISTS import_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      file_name TEXT NOT NULL,
      imported_at INTEGER NOT NULL,
      rows_read INTEGER NOT NULL,
      rows_valid INTEGER NOT NULL,
      rows_inserted INTEGER NOT NULL,
      rows_duplicate INTEGER NOT NULL,
      rows_skipped INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('SUCCESS', 'FAILED', 'PARTIAL')),
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS backtest_sessions (
      id TEXT PRIMARY KEY,
      session_name TEXT NOT NULL,
      symbol_id INTEGER NOT NULL,
      symbol_name TEXT NOT NULL,
      timeframe TEXT NOT NULL DEFAULT 'M1',
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      initial_balance REAL NOT NULL DEFAULT 10000,
      mode TEXT NOT NULL DEFAULT 'normal',
      daily_drawdown REAL,
      max_drawdown REAL,
      profit_target REAL,
      current_replay_time INTEGER,
      current_replay_index INTEGER,
      account_balance REAL,
      account_equity REAL,
      active_timeframe TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      symbols_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS economic_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      currency TEXT NOT NULL,
      country TEXT NOT NULL,
      event_name TEXT NOT NULL,
      impact TEXT NOT NULL,
      actual TEXT,
      forecast TEXT,
      previous TEXT,
      UNIQUE(timestamp, currency, event_name)
    );

    CREATE INDEX IF NOT EXISTS idx_economic_events_lookup
      ON economic_events (currency, timestamp);
  `);

  try {
    const tableInfo = db.prepare("PRAGMA table_info(backtest_sessions)").all() as { name: string }[];
    const hasSymbolsJson = tableInfo.some((col) => col.name === 'symbols_json');
    if (!hasSymbolsJson) {
      db.exec("ALTER TABLE backtest_sessions ADD COLUMN symbols_json TEXT");
    }
    const hasTradingStateJson = tableInfo.some((col) => col.name === 'trading_state_json');
    if (!hasTradingStateJson) {
      db.exec("ALTER TABLE backtest_sessions ADD COLUMN trading_state_json TEXT");
    }
  } catch (err) {
    console.error('[DB Migration] Error checking/adding columns to backtest_sessions:', err);
  }

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized yet');
  return db;
}

/** Get-or-create a symbol row, returns its id. */
export function upsertSymbol(name: string): number {
  const database = getDatabase();
  database.prepare('INSERT OR IGNORE INTO symbols (name) VALUES (?)').run(name);
  const row = database.prepare('SELECT id FROM symbols WHERE name = ?').get(name) as {
    id: number;
  };
  return row.id;
}

export interface InsertBatchResult {
  inserted: number;
  duplicates: number;
}

/**
 * Inserts candles for one (symbol, timeframe) in a single transaction.
 * INSERT OR REPLACE so re-importing a corrected monthly file overwrites
 * old rows instead of erroring on the UNIQUE constraint — this is how
 * monthly files "merge" into one continuous series: they all write into
 * the same indexed (symbol, timeframe, time) space, and every read
 * downstream (features/chart, features/replay) queries ORDER BY time,
 * so no separate physical merge step is needed.
 *
 * Duplicate prevention: the UNIQUE(symbol_id, timeframe, time) constraint
 * is what actually stops candle counts from doubling — REPLACE means a
 * repeated timestamp overwrites in place rather than adding a new row.
 * The `duplicates` count returned here (via a pre-check SELECT) is purely
 * for reporting how many of this batch's rows already existed — it does
 * not change insert behavior.
 */
export function insertCandlesBatch(
  symbolId: number,
  timeframe: string,
  rows: RawCandle[]
): InsertBatchResult {
  const database = getDatabase();
  if (rows.length === 0) return { inserted: 0, duplicates: 0 };

  const placeholders = rows.map(() => '?').join(',');
  const existing = database
    .prepare(
      `SELECT time FROM candles WHERE symbol_id = ? AND timeframe = ? AND time IN (${placeholders})`
    )
    .all(symbolId, timeframe, ...rows.map((r) => r.time)) as { time: number }[];
  const existingTimes = new Set(existing.map((r) => r.time));
  const duplicates = rows.reduce((n, r) => n + (existingTimes.has(r.time) ? 1 : 0), 0);

  const stmt = database.prepare(`
    INSERT OR REPLACE INTO candles (symbol_id, timeframe, time, open, high, low, close, volume)
    VALUES (@symbolId, @timeframe, @time, @open, @high, @low, @close, @volume)
  `);
  const insertMany = database.transaction((batch: RawCandle[]) => {
    for (const row of batch) {
      stmt.run({
        symbolId,
        timeframe,
        time: row.time,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume ?? null,
      });
    }
  });
  insertMany(rows);
  invalidateSymbolTimeframeCache(symbolId);
  invalidateSymbolDetailStatsCache();

  return { inserted: rows.length - duplicates, duplicates };
}

export function upsertCandlesBatch(
  symbolId: number,
  timeframe: string,
  rows: RawCandle[]
): InsertBatchResult {
  return insertCandlesBatch(symbolId, timeframe, rows);
}

export interface RecordDatasetParams {
  symbolId: number;
  timeframe: string;
  fileName: string;
  filePath: string;
  rowsRead: number;
  rowsValid: number;
  rowsSkipped: number;
  rowsDuplicate: number;
  rowsInserted: number;
  firstTime: number | null;
  lastTime: number | null;
}

/** Records one row of import history per file — used for the Data Management UI. */
export function recordDataset(params: RecordDatasetParams): void {
  const database = getDatabase();
  database
    .prepare(
      `INSERT INTO datasets
        (symbol_id, timeframe, file_name, file_path, imported_at, rows_read, rows_valid, rows_skipped, rows_duplicate, rows_inserted, first_time, last_time)
       VALUES
        (@symbolId, @timeframe, @fileName, @filePath, @importedAt, @rowsRead, @rowsValid, @rowsSkipped, @rowsDuplicate, @rowsInserted, @firstTime, @lastTime)`
    )
    .run({
      ...params,
      importedAt: Math.floor(Date.now() / 1000),
    });
  invalidateSymbolDetailStatsCache();
}

export interface DatasetRecord {
  id: number;
  timeframe: string;
  fileName: string;
  filePath: string | null;
  importedAt: number;
  rowsRead: number;
  rowsValid: number;
  rowsSkipped: number;
  rowsDuplicate: number;
  rowsInserted: number;
  firstTime: number | null;
  lastTime: number | null;
}

/** Import history for one symbol, most recent first — for the Data Management UI. */
export function listDatasetsForSymbol(symbolId: number): DatasetRecord[] {
  const database = getDatabase();
  const rows = database
    .prepare(
      `SELECT id, timeframe, file_name, file_path, imported_at, rows_read, rows_valid,
              rows_skipped, rows_duplicate, rows_inserted, first_time, last_time
       FROM datasets WHERE symbol_id = ? ORDER BY imported_at DESC`
    )
    .all(symbolId) as {
    id: number;
    timeframe: string;
    file_name: string;
    file_path: string | null;
    imported_at: number;
    rows_read: number;
    rows_valid: number;
    rows_skipped: number;
    rows_duplicate: number;
    rows_inserted: number;
    first_time: number | null;
    last_time: number | null;
  }[];

  return rows.map((r) => ({
    id: r.id,
    timeframe: r.timeframe,
    fileName: r.file_name,
    filePath: r.file_path,
    importedAt: r.imported_at,
    rowsRead: r.rows_read,
    rowsValid: r.rows_valid,
    rowsSkipped: r.rows_skipped,
    rowsDuplicate: r.rows_duplicate,
    rowsInserted: r.rows_inserted,
    firstTime: r.first_time,
    lastTime: r.last_time,
  }));
}

/** Deletes a symbol and all child data (candles + datasets + drawings + trades + symbols). */
export function deleteSymbol(symbolId: number): void {
  const database = getDatabase();

  // SQLite PRAGMA foreign_keys cannot be changed inside an active transaction,
  // so we toggle it outside the transaction block.
  database.pragma('foreign_keys = OFF');
  console.log(`[Database] Attempting to delete symbol ${symbolId}`);

  try {
    const symRow = database.prepare('SELECT name FROM symbols WHERE id = ?').get(symbolId) as
      | { name: string }
      | undefined;

    const tx = database.transaction((id: number, symName?: string) => {
      // 1. Delete candles (child)
      database.prepare('DELETE FROM candles WHERE symbol_id = ?').run(id);

      // 2. Delete datasets (child)
      database.prepare('DELETE FROM datasets WHERE symbol_id = ?').run(id);

      // 3. Delete drawings / trades if tables exist
      try {
        database.prepare('DELETE FROM drawings WHERE symbol_id = ?').run(id);
      } catch (_) {}
      try {
        database.prepare('DELETE FROM trades WHERE symbol_id = ?').run(id);
      } catch (_) {}

      // 4. Delete import_logs by symbol name if available
      if (symName) {
        try {
          database.prepare('DELETE FROM import_logs WHERE symbol = ?').run(symName);
        } catch (_) {}
      }

      // 5. Delete parent symbol
      database.prepare('DELETE FROM symbols WHERE id = ?').run(id);
    });

    tx(symbolId, symRow?.name);
    invalidateSymbolTimeframeCache(symbolId);
    invalidateSymbolDetailStatsCache();
    console.log(`[Database] Successfully deleted symbol ${symbolId}`);
  } catch (error) {
    console.error(`[Database] Error deleting symbol ${symbolId}:`, error);
    throw error;
  } finally {
    database.pragma('foreign_keys = ON');
  }
}

/** Deletes a specific timeframe for a symbol (e.g. custom timeframe 6H) */
export function deleteTimeframe(symbolId: number, timeframe: string): void {
  const database = getDatabase();
  console.log(`[Database] Attempting to delete timeframe ${timeframe} for symbol ${symbolId}`);

  if (timeframe === 'M1') {
    throw new Error('Cannot delete M1 timeframe because it is the master source of truth. Delete the pair entirely if you want to remove it.');
  }

  try {
    const tx = database.transaction(() => {
      // 1. Delete all candles for this timeframe
      database.prepare('DELETE FROM candles WHERE symbol_id = ? AND timeframe = ?').run(symbolId, timeframe);
      
      // 2. Delete dataset record for this timeframe
      database.prepare('DELETE FROM datasets WHERE symbol_id = ? AND timeframe = ?').run(symbolId, timeframe);
    });

    tx();
    invalidateSymbolTimeframeCache(symbolId);
    invalidateSymbolDetailStatsCache();
    console.log(`[Database] Successfully deleted timeframe ${timeframe} for symbol ${symbolId}`);
  } catch (error) {
    console.error(`[Database] Error deleting timeframe ${timeframe} for symbol ${symbolId}:`, error);
    throw error;
  }
}

/**
 * Day 19: Deletes a single dataset (import history) by its id.
 * This only removes the metadata row from the datasets table.
 * Candles are NOT deleted because they are shared between imports
 * and there's no way to know which candle came from which file.
 */
export function deleteDataset(datasetId: number): void {
  const database = getDatabase();
  database.prepare('DELETE FROM datasets WHERE id = ?').run(datasetId);
  invalidateSymbolDetailStatsCache();
}

export interface CandleRow {
  time: number; // unix SECONDS — already converted once, at CSV-import
  // time (see electron/data/csvParser.ts parseTimestampCell). Never
  // divide this by 1000 again anywhere downstream (chart, replay,
  // etc.) — that would silently corrupt every timestamp.
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

type RawCandleRow = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

// Hard ceiling on candles returned per IPC call (100k candles ~ 2 months M1)
const MAX_CANDLES_PER_REQUEST = 100000;

/**
 * Defensive validation shared by getCandles()/getCandlesBefore()
 * (data should already be clean from import-time validation in Day 3,
 * but this is the last line of defense right before the chart
 * boundary):
 *  - assumes rows already ORDER BY time ASC from the query
 *  - OHLC sanity re-checked (high>=open/close, low<=open/close, no NaN)
 *  - de-duplicated by time (defense in depth on top of the DB's
 *    UNIQUE(symbol_id, timeframe, time) constraint, which already
 *    makes duplicates impossible at the storage level)
 */
function sanitizeCandleRows(rows: RawCandleRow[]): CandleRow[] {
  const seen = new Set<number>();
  const clean: CandleRow[] = [];
  for (const r of rows) {
    if (seen.has(r.time)) continue; // shouldn't happen (UNIQUE constraint), defensive only
    if (
      !Number.isFinite(r.time) ||
      !Number.isFinite(r.open) ||
      !Number.isFinite(r.high) ||
      !Number.isFinite(r.low) ||
      !Number.isFinite(r.close)
    ) {
      continue;
    }
    if (r.high < r.low || r.high < r.open || r.high < r.close || r.low > r.open || r.low > r.close) {
      continue;
    }
    seen.add(r.time);
    clean.push(r);
  }
  return clean;
}

/**
 * Returns the timeframe to actually read from `candles` for a
 * requested timeframe:
 *  - the requested timeframe itself, if that symbol has native data
 *    at exactly that timeframe (fast path, zero aggregation — this
 *    is the only path M1 charts ever took before day 6, unchanged);
 *  - otherwise the FINEST native timeframe finer than requested, so
 *    it can be aggregated up (day 6);
 *  - null if no native timeframe exists that's fine enough to
 *    aggregate from (e.g. only H1 imported but M15 requested — you
 *    cannot manufacture finer resolution than what was imported).
 */
const symbolTimeframeCache = new Map<number, Set<string>>();

export function invalidateSymbolTimeframeCache(symbolId?: number) {
  if (symbolId !== undefined) {
    symbolTimeframeCache.delete(symbolId);
  } else {
    symbolTimeframeCache.clear();
  }
}

function getAvailableTimeframesForSymbol(symbolId: number): Set<string> {
  if (symbolTimeframeCache.has(symbolId)) {
    return symbolTimeframeCache.get(symbolId)!;
  }
  const database = getDatabase();
  const candleRows = database
    .prepare('SELECT DISTINCT timeframe FROM candles WHERE symbol_id = ?')
    .all(symbolId) as { timeframe: string }[];
  const dsRows = database
    .prepare('SELECT DISTINCT timeframe FROM datasets WHERE symbol_id = ?')
    .all(symbolId) as { timeframe: string }[];

  const tfSet = new Set([
    ...candleRows.map((r) => r.timeframe),
    ...dsRows.map((r) => r.timeframe),
  ]);
  symbolTimeframeCache.set(symbolId, tfSet);
  return tfSet;
}

function resolveSourceTimeframe(symbolId: number, requestedTimeframe: string): string | null {
  const normReq = normalizeTimeframe(requestedTimeframe);
  const availableTfs = getAvailableTimeframesForSymbol(symbolId);

  // 1. Direct exact or normalized match from stored timeframes
  for (const tf of availableTfs) {
    if (tf === requestedTimeframe || normalizeTimeframe(tf) === normReq || tf.toUpperCase() === requestedTimeframe.toUpperCase()) {
      return tf;
    }
  }

  // 2. Finer timeframe for on-the-fly aggregation
  const requestedSeconds = TIMEFRAME_SECONDS[normReq] ?? TIMEFRAME_SECONDS[requestedTimeframe];
  if (requestedSeconds !== undefined) {
    const finerCandidates = Array.from(availableTfs)
      .map((tf) => ({ tf, norm: normalizeTimeframe(tf) }))
      .filter(({ norm }) => TIMEFRAME_SECONDS[norm] !== undefined && TIMEFRAME_SECONDS[norm] < requestedSeconds)
      .sort((a, b) => TIMEFRAME_SECONDS[a.norm] - TIMEFRAME_SECONDS[b.norm]);

    return finerCandidates[0]?.tf ?? null;
  }

  return null;
}

function rawFetchRecent(symbolId: number, timeframe: string, limit: number): RawCandleRow[] {
  const database = getDatabase();
  return database
    .prepare(
      `SELECT time, open, high, low, close, volume FROM (
         SELECT time, open, high, low, close, volume FROM candles
         WHERE symbol_id = ? AND timeframe = ?
         ORDER BY time DESC
         LIMIT ?
       ) sub ORDER BY time ASC`
    )
    .all(symbolId, timeframe, limit) as RawCandleRow[];
}

function rawFetchBefore(
  symbolId: number,
  timeframe: string,
  beforeTime: number,
  limit: number
): RawCandleRow[] {
  const database = getDatabase();
  return database
    .prepare(
      `SELECT time, open, high, low, close, volume FROM (
         SELECT time, open, high, low, close, volume FROM candles
         WHERE symbol_id = ? AND timeframe = ? AND time < ?
         ORDER BY time DESC
         LIMIT ?
       ) sub ORDER BY time ASC`
    )
    .all(symbolId, timeframe, beforeTime, limit) as RawCandleRow[];
}

/**
 * Aggregates a fetched window of source (finer) candles up to the
 * requested target timeframe, and drops the OLDEST resulting bucket
 * unless the source fetch came back short of what it asked for (i.e.
 * genuinely reached the start of that symbol's history). A bucket at
 * the edge of a limited fetch window might be missing earlier source
 * candles that exist further back but weren't inside this window —
 * dropping it is the only way to guarantee every bucket actually
 * returned is complete, matching the "OHLC dihitung dari SELURUH
 * candle sumber" requirement. The caller's pagination will pick that
 * dropped bucket back up on the next fetch further into history.
 */
function aggregateFetchedWindow(
  sourceRows: RawCandleRow[],
  sourceLimitRequested: number,
  targetTimeframe: string,
  clampedLimit: number
): CandleRow[] {
  const clean = sanitizeCandleRows(sourceRows);
  const sourceExhausted = sourceRows.length < sourceLimitRequested;
  let buckets = aggregateCandles(clean, targetTimeframe);
  if (!sourceExhausted && buckets.length > 0) buckets = buckets.slice(1);
  return buckets.slice(Math.max(0, buckets.length - clampedLimit));
}

function aggregationSourceLimit(clampedLimit: number, targetTimeframe: string, sourceTimeframe: string): number {
  const ratio = TIMEFRAME_SECONDS[targetTimeframe] / TIMEFRAME_SECONDS[sourceTimeframe];
  return Math.min(MAX_CANDLES_PER_REQUEST, Math.ceil(clampedLimit * ratio) + Math.ceil(ratio));
}

/**
 * Returns the most recent `limit` candles for one (symbol, timeframe),
 * oldest-first — ready to feed straight into Lightweight Charts with
 * no further transformation. Capped so a huge history can't be sent
 * across IPC in one shot (see Day 2 "jangan kirim jutaan candle"
 * constraint). This is the INITIAL load only — day 5 adds
 * getCandlesBefore() below for paging further back as the user pans.
 *
 * Day 6: if `timeframe` has no native data for this symbol, it's
 * aggregated on the fly from the finest native timeframe that's finer
 * than it (e.g. M15 built from stored M1) — see resolveSourceTimeframe
 * and aggregateCandles (electron/data/aggregate.ts). Returns [] if
 * even that isn't possible (no native timeframe fine enough exists).
 */
export function getCandles(symbolId: number, timeframe: string, limit = 30000): CandleRow[] {
  const clampedLimit = Math.min(Math.max(1, limit), MAX_CANDLES_PER_REQUEST);
  const source = resolveSourceTimeframe(symbolId, timeframe);
  
  if (!source) {
    return [];
  }

  let rows: CandleRow[];
  if (source === timeframe) {
    rows = sanitizeCandleRows(rawFetchRecent(symbolId, timeframe, clampedLimit));
  } else {
    const sourceLimit = aggregationSourceLimit(clampedLimit, timeframe, source);
    const sourceRows = rawFetchRecent(symbolId, source, sourceLimit);
    rows = aggregateFetchedWindow(sourceRows, sourceLimit, timeframe, clampedLimit);
  }
  return rows;
}

/**
 * Returns up to `limit` candles strictly older than `beforeTime`
 * (exclusive) for one (symbol, timeframe), oldest-first — day 5
 * backward pagination: called when the user pans the chart toward
 * older history than what's currently loaded, instead of ever
 * fetching a symbol's entire history up front.
 *
 * An empty result tells the caller there's no more history before
 * that point, so it can stop asking (see features/chart/useCandles.ts
 * `hasMoreBefore`) instead of issuing unbounded repeat queries once
 * the true start of the data is reached. (Day 6: a result shorter
 * than `limit` no longer implies that by itself — an aggregated
 * timeframe can legitimately return fewer buckets than requested
 * while more history still exists further back, if the source fetch
 * window was capped. Only a genuinely empty result means "no more".
 * useCandles.ts was updated accordingly.)
 *
 * Day 6: same on-the-fly aggregation as getCandles() when `timeframe`
 * has no native data — `beforeTime` is passed straight through as the
 * cutoff on the finer source timeframe, which is safe because it's
 * always a target-timeframe bucket-start value (see aggregateCandles),
 * so every source row before it is guaranteed to belong to an earlier
 * bucket, never the one already loaded.
 */
export function getCandlesBefore(
  symbolId: number,
  timeframe: string,
  beforeTime: number,
  limit = 5000
): CandleRow[] {
  const clampedLimit = Math.min(Math.max(1, limit), MAX_CANDLES_PER_REQUEST);
  const source = resolveSourceTimeframe(symbolId, timeframe);
  if (!source) return [];

  if (source === timeframe) {
    return sanitizeCandleRows(rawFetchBefore(symbolId, timeframe, beforeTime, clampedLimit));
  }

  const sourceLimit = aggregationSourceLimit(clampedLimit, timeframe, source);
  const sourceRows = rawFetchBefore(symbolId, source, beforeTime, sourceLimit);
  return aggregateFetchedWindow(sourceRows, sourceLimit, timeframe, clampedLimit);
}

function rawFetchFrom(
  symbolId: number,
  timeframe: string,
  fromTime: number,
  limit: number
): RawCandleRow[] {
  const database = getDatabase();
  return database
    .prepare(
      `SELECT time, open, high, low, close, volume FROM candles
       WHERE symbol_id = ? AND timeframe = ? AND time >= ?
       ORDER BY time ASC
       LIMIT ?`
    )
    .all(symbolId, timeframe, fromTime, limit) as RawCandleRow[];
}

export function getCandlesFrom(
  symbolId: number,
  timeframe: string,
  fromTime: number,
  limit = 10000
): CandleRow[] {
  const clampedLimit = Math.min(Math.max(1, limit), MAX_CANDLES_PER_REQUEST);
  const source = resolveSourceTimeframe(symbolId, timeframe);
  if (!source) return [];

  if (source === timeframe) {
    return sanitizeCandleRows(rawFetchFrom(symbolId, timeframe, fromTime, clampedLimit));
  }

  const sourceLimit = aggregationSourceLimit(clampedLimit, timeframe, source);
  const sourceRows = rawFetchFrom(symbolId, source, fromTime, sourceLimit);
  return aggregateFetchedWindow(sourceRows, sourceLimit, timeframe, clampedLimit);
}

function rawFetchRange(
  symbolId: number,
  timeframe: string,
  fromTime: number,
  toTime?: number | null
): RawCandleRow[] {
  const database = getDatabase();
  if (toTime !== undefined && toTime !== null && toTime > 0) {
    return database
      .prepare(
        `SELECT time, open, high, low, close, volume FROM candles
         WHERE symbol_id = ? AND timeframe = ? AND time >= ? AND time <= ?
         ORDER BY time ASC`
      )
      .all(symbolId, timeframe, fromTime, toTime) as RawCandleRow[];
  }
  return database
    .prepare(
      `SELECT time, open, high, low, close, volume FROM candles
       WHERE symbol_id = ? AND timeframe = ? AND time >= ?
       ORDER BY time ASC`
    )
    .all(symbolId, timeframe, fromTime) as RawCandleRow[];
}

export function getCandlesRange(
  symbolId: number,
  timeframe: string,
  fromTime: number,
  toTime?: number | null
): CandleRow[] {
  const source = resolveSourceTimeframe(symbolId, timeframe);
  if (!source) {
    console.warn('[DB-GET-CANDLES-RANGE] resolveSourceTimeframe returned null for', { symbolId, timeframe });
    return [];
  }

  const sourceRows = rawFetchRange(symbolId, source, fromTime, toTime);
  const clean = sanitizeCandleRows(sourceRows);
  const isDirect = source === timeframe || normalizeTimeframe(source) === normalizeTimeframe(timeframe);
  const result = isDirect ? clean : aggregateCandles(clean, timeframe);

  console.log('[DB-GET-CANDLES-RANGE]', {
    symbolId,
    timeframe,
    source,
    fromTime,
    fromISO: new Date(fromTime * 1000).toISOString(),
    toTime,
    toISO: toTime ? new Date(toTime * 1000).toISOString() : null,
    sourceRowsCount: sourceRows.length,
    resultCount: result.length,
    firstResultISO: result[0]?.time ? new Date(result[0].time * 1000).toISOString() : null,
    lastResultISO: result[result.length - 1]?.time ? new Date(result[result.length - 1].time * 1000).toISOString() : null,
  });

  return result;
}



/**
 * Reads one value from the generic app_settings key/value store.
 * Returns null if the key was never set (e.g. first run) — callers
 * treat that as "no persisted state yet", not an error.
 */
export function getSetting(key: string): string | null {
  const database = getDatabase();
  const row = database.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row ? row.value : null;
}

/** Writes/overwrites one value in the generic app_settings key/value store. */
export function setSetting(key: string, value: string): void {
  const database = getDatabase();
  database
    .prepare(
      `INSERT INTO app_settings (key, value) VALUES (@key, @value)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run({ key, value });
}

export interface SymbolSummary {
  id: number;
  name: string;
  timeframes: string[];
  candleCount: number;
  firstTime: number | null;
  lastTime: number | null;
  lastUpdatedAt: number | null;
  timeframeStats?: Record<string, { candleCount: number; firstTime: number | null; lastTime: number | null }>;
}

let symbolSummariesCache: SymbolSummary[] | null = null;

/** Lightweight metadata only — never returns raw candle rows. Ultra-fast cascade (in-memory cache -> datasets metadata -> D1 candles -> B-tree index seek). */
export function listSymbolSummaries(): SymbolSummary[] {
  if (symbolSummariesCache) {
    return symbolSummariesCache;
  }

  const database = getDatabase();
  const symbolRows = database.prepare('SELECT id, name FROM symbols ORDER BY name').all() as {
    id: number;
    name: string;
  }[];

  if (symbolRows.length === 0) {
    symbolSummariesCache = [];
    return [];
  }

  // 1. Fast query for all timeframes present in candles table
  const candleTfStats = database
    .prepare(
      `SELECT symbol_id, timeframe, COUNT(*) as cnt, MIN(time) as minT, MAX(time) as maxT
       FROM candles
       GROUP BY symbol_id, timeframe`
    )
    .all() as {
    symbol_id: number;
    timeframe: string;
    cnt: number;
    minT: number | null;
    maxT: number | null;
  }[];

  // 2. Fast metadata aggregation from datasets (< 0.1ms)
  const datasetTfStats = database
    .prepare(
      `SELECT symbol_id, timeframe, SUM(rows_inserted) as cnt, MIN(first_time) as minT, MAX(last_time) as maxT
       FROM datasets
       GROUP BY symbol_id, timeframe`
    )
    .all() as {
    symbol_id: number;
    timeframe: string;
    cnt: number;
    minT: number | null;
    maxT: number | null;
  }[];

  // 3. Single query for latest imported_at across datasets
  const allLastUpdated = database
    .prepare('SELECT symbol_id, MAX(imported_at) as t FROM datasets GROUP BY symbol_id')
    .all() as { symbol_id: number; t: number | null }[];

  const lastUpdatedMap = new Map<number, number | null>();
  for (const row of allLastUpdated) {
    lastUpdatedMap.set(row.symbol_id, row.t);
  }

  const tfStatsBySymbol = new Map<number, Array<{ timeframe: string; cnt: number; minT: number | null; maxT: number | null }>>();
  for (const row of candleTfStats) {
    let list = tfStatsBySymbol.get(row.symbol_id);
    if (!list) {
      list = [];
      tfStatsBySymbol.set(row.symbol_id, list);
    }
    list.push(row);
  }

  // Merge dataset stats if any timeframe not yet in candles
  for (const row of datasetTfStats) {
    let list = tfStatsBySymbol.get(row.symbol_id);
    if (!list) {
      list = [];
      tfStatsBySymbol.set(row.symbol_id, list);
    }
    const existing = list.find((item) => normalizeTimeframe(item.timeframe) === normalizeTimeframe(row.timeframe));
    if (!existing) {
      list.push(row);
    }
  }

  // Fast B-tree index seeks (0.005ms each) only for symbols without dataset records
  const minTimeStmt = database.prepare('SELECT time FROM candles WHERE symbol_id = ? ORDER BY time ASC LIMIT 1');
  const maxTimeStmt = database.prepare('SELECT time FROM candles WHERE symbol_id = ? ORDER BY time DESC LIMIT 1');
  const countStmt = database.prepare('SELECT COUNT(*) as c FROM candles WHERE symbol_id = ?');

  const summaries: SymbolSummary[] = symbolRows.map((s) => {
    let tfRows = tfStatsBySymbol.get(s.id);

    // Fallback: If symbol has no dataset rows (e.g. direct candle insert), use fast B-tree index seeks
    if (!tfRows || tfRows.length === 0) {
      const minRow = minTimeStmt.get(s.id) as { time: number } | undefined;
      const maxRow = maxTimeStmt.get(s.id) as { time: number } | undefined;
      const cntRow = countStmt.get(s.id) as { c: number } | undefined;
      if (minRow && maxRow) {
        tfRows = [{
          timeframe: 'M1',
          cnt: cntRow?.c ?? 0,
          minT: minRow.time,
          maxT: maxRow.time,
        }];
      } else {
        tfRows = [];
      }
    }

    let totalCandles = 0;
    let overallMinT: number | null = null;
    let overallMaxT: number | null = null;

    const normTfs: string[] = [];
    const tfStatsMap: Record<string, { candleCount: number; firstTime: number | null; lastTime: number | null }> = {};

    for (const r of tfRows) {
      const norm = normalizeTimeframe(r.timeframe);
      if (!normTfs.includes(norm)) {
        normTfs.push(norm);
      }
      totalCandles += r.cnt;
      if (r.minT !== null) {
        overallMinT = overallMinT === null ? r.minT : Math.min(overallMinT, r.minT);
      }
      if (r.maxT !== null) {
        overallMaxT = overallMaxT === null ? r.maxT : Math.max(overallMaxT, r.maxT);
      }

      tfStatsMap[norm] = {
        candleCount: r.cnt,
        firstTime: r.minT,
        lastTime: r.maxT,
      };
    }

    return {
      id: s.id,
      name: s.name,
      timeframes: normTfs.length > 0 ? normTfs : ['M1'],
      candleCount: totalCandles,
      firstTime: overallMinT,
      lastTime: overallMaxT,
      lastUpdatedAt: lastUpdatedMap.get(s.id) ?? null,
      timeframeStats: tfStatsMap,
    };
  });

  symbolSummariesCache = summaries;
  return summaries;
}

// ─── Day 20: Database Maintenance & Statistics ────────────────────

export interface DatabaseStats {
  totalSymbols: number;
  totalDatasets: number;
  totalCandles: number;
  earliestData: number | null;
  latestData: number | null;
}

/** Aggregate counts across the entire database. */
export function getDatabaseStats(): DatabaseStats {
  const database = getDatabase();
  const symbols = database.prepare('SELECT COUNT(*) as cnt FROM symbols').get() as { cnt: number };
  const datasets = database.prepare('SELECT COUNT(*) as cnt FROM datasets').get() as { cnt: number };
  const candles = database.prepare('SELECT COUNT(*) as cnt FROM candles').get() as { cnt: number };
  const range = database
    .prepare('SELECT MIN(time) as minT, MAX(time) as maxT FROM candles')
    .get() as { minT: number | null; maxT: number | null };

  return {
    totalSymbols: symbols.cnt,
    totalDatasets: datasets.cnt,
    totalCandles: candles.cnt,
    earliestData: range.minT,
    latestData: range.maxT,
  };
}

const CANONICAL_TIMEFRAME_ORDER = ['M1', 'M3', 'M5', 'M15', 'M30', 'H1', 'H4', 'H7', 'D1', 'W1', 'Monthly'];

export interface TimeframeStat {
  timeframe: string;
  candleCount: number;
  firstTime: number | null;
  lastTime: number | null;
  isMaster?: boolean;
  sourceType?: string;
}

export function getAvailableTimeframes(symbolId: number): TimeframeStat[] {
  const database = getDatabase();
  const rows = database
    .prepare(
      `SELECT timeframe, COUNT(*) as cnt, MIN(time) as minT, MAX(time) as maxT
       FROM candles
       WHERE symbol_id = ?
       GROUP BY timeframe`
    )
    .all(symbolId) as { timeframe: string; cnt: number; minT: number | null; maxT: number | null }[];

  const orderMap = new Map(CANONICAL_TIMEFRAME_ORDER.map((tf, idx) => [tf, idx]));

  const stats: TimeframeStat[] = rows.map((r) => {
    const norm = normalizeTimeframe(r.timeframe);
    const isMaster = norm === 'M1';
    return {
      timeframe: norm,
      candleCount: r.cnt,
      firstTime: r.minT,
      lastTime: r.maxT,
      isMaster,
      sourceType: isMaster ? 'Dukascopy / CSV' : 'Derived from M1',
    };
  });

  stats.sort((a, b) => {
    const normA = normalizeTimeframe(a.timeframe);
    const normB = normalizeTimeframe(b.timeframe);
    const idxA = orderMap.has(normA) ? orderMap.get(normA)! : 999;
    const idxB = orderMap.has(normB) ? orderMap.get(normB)! : 999;
    return idxA - idxB;
  });

  return stats;
}

export interface DatabaseInfo {
  dbPath: string;
  sqliteVersion: string;
  dbSizeBytes: number;
  totalTables: number;
  totalSymbols: number;
  totalDatasets: number;
  totalCandles: number;
}

let cachedDbInfo: { info: DatabaseInfo; timestamp: number } | null = null;

/** Invalidate cached database info (call when candles/symbols change) */
export function invalidateDbInfoCache(): void {
  cachedDbInfo = null;
}

/** Full database metadata for the info panel (cached for 30 seconds). */
export function getDatabaseInfo(forceRefresh = false): DatabaseInfo {
  const now = Date.now();
  if (!forceRefresh && cachedDbInfo && now - cachedDbInfo.timestamp < 30_000) {
    return cachedDbInfo.info;
  }

  const database = getDatabase();
  const dbPath = path.join(database.name);

  let dbSizeBytes = 0;
  try {
    const stat = fs.statSync(dbPath);
    dbSizeBytes = stat.size;
  } catch {
    // file may not exist yet or be inaccessible
  }

  const sqliteRow = database.prepare('SELECT sqlite_version() as ver').get() as { ver: string };
  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all() as { name: string }[];
  const symbols = database.prepare('SELECT COUNT(*) as cnt FROM symbols').get() as { cnt: number };
  const datasets = database.prepare('SELECT COUNT(*) as cnt FROM datasets').get() as { cnt: number };
  const candles = database.prepare('SELECT COUNT(*) as cnt FROM candles').get() as { cnt: number };

  const info: DatabaseInfo = {
    dbPath,
    sqliteVersion: sqliteRow.ver,
    dbSizeBytes,
    totalTables: tables.length,
    totalSymbols: symbols.cnt,
    totalDatasets: datasets.cnt,
    totalCandles: candles.cnt,
  };

  cachedDbInfo = { info, timestamp: now };
  return info;
}

/** Vacuum the database — reclaims unused space. Returns true on success. */
export function vacuumDatabase(): boolean {
  const database = getDatabase();
  database.exec('VACUUM');
  return true;
}

/** Analyze the database — updates query planner statistics. Returns true on success. */
export function analyzeDatabase(): boolean {
  const database = getDatabase();
  database.exec('ANALYZE');
  return true;
}

export interface DatabaseHealth {
  healthy: boolean;
  message: string;
  details: string[];
}

/** Simple integrity check using PRAGMA integrity_check. */
export function getDatabaseHealth(): DatabaseHealth {
  const database = getDatabase();
  const details: string[] = [];
  let healthy = true;

  try {
    const result = database.pragma('integrity_check', { simple: true }) as string;
    if (result === 'ok') {
      details.push('Integrity check: OK');
    } else {
      healthy = false;
      details.push(`Integrity check: ${result}`);
    }
  } catch (err) {
    healthy = false;
    details.push(`Integrity check error: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const wal = database.pragma('journal_mode', { simple: true }) as string;
    details.push(`Journal mode: ${wal}`);
  } catch {
    // non-critical
  }

  const stats = getDatabaseStats();
  if (stats.totalCandles === 0) {
    details.push('No candle data imported yet');
  } else {
    details.push(`${stats.totalCandles.toLocaleString('id-ID')} candles across ${stats.totalSymbols} symbols`);
  }

  return {
    healthy,
    message: healthy ? 'Database OK' : 'Database Warning',
    details,
  };
}

export interface DatasetStats {
  datasetId: number;
  symbolName: string;
  timeframe: string;
  fileName: string;
  importedAt: number;
  candleCount: number;
  firstTime: number | null;
  lastTime: number | null;
  estimatedSizeBytes: number;
  status: string;
}

/** Per-dataset statistics including estimated candle size. */
export function listDatasetStats(): DatasetStats[] {
  const database = getDatabase();
  const rows = database
    .prepare(
      `SELECT d.id as datasetId, s.name as symbolName, d.timeframe, d.file_name, d.imported_at,
              d.rows_inserted as candleCount, d.first_time, d.last_time, d.status
       FROM datasets d
       JOIN symbols s ON d.symbol_id = s.id
       ORDER BY d.imported_at DESC`
    )
    .all() as {
    datasetId: number;
    symbolName: string;
    timeframe: string;
    file_name: string;
    imported_at: number;
    candleCount: number;
    first_time: number | null;
    last_time: number | null;
    status: string;
  }[];

  // Estimated size per candle row: ~64 bytes (6 fields * 8 bytes avg + overhead)
  const CANDLE_ROW_SIZE = 64;

  return rows.map((r) => ({
    datasetId: r.datasetId,
    symbolName: r.symbolName,
    timeframe: r.timeframe,
    fileName: r.file_name,
    importedAt: r.imported_at,
    candleCount: r.candleCount,
    firstTime: r.first_time,
    lastTime: r.last_time,
    estimatedSizeBytes: r.candleCount * CANDLE_ROW_SIZE,
    status: r.status,
  }));
}

export interface SymbolDetailStats {
  symbolId: number;
  symbolName: string;
  nativeTimeframes: string[];
  availableTimeframes: string[];
  totalCandles: number;
  firstTime: number | null;
  lastTime: number | null;
}

let symbolDetailStatsCache: SymbolDetailStats[] | null = null;

export function invalidateSymbolDetailStatsCache(): void {
  symbolSummariesCache = null;
  symbolDetailStatsCache = null;
}

/** Detailed statistics for each symbol (cached in memory). */
export function listSymbolDetailStats(): SymbolDetailStats[] {
  if (symbolDetailStatsCache) {
    return symbolDetailStatsCache;
  }

  const database = getDatabase();
  const symbolRows = database.prepare('SELECT id, name FROM symbols ORDER BY name').all() as {
    id: number;
    name: string;
  }[];

  if (symbolRows.length === 0) {
    symbolDetailStatsCache = [];
    return [];
  }

  // 1. Fast query for all timeframes present in candles table
  const candleTfStats = database
    .prepare(
      `SELECT symbol_id, timeframe, COUNT(*) as cnt, MIN(time) as minT, MAX(time) as maxT
       FROM candles
       GROUP BY symbol_id, timeframe`
    )
    .all() as {
    symbol_id: number;
    timeframe: string;
    cnt: number;
    minT: number | null;
    maxT: number | null;
  }[];

  // 2. Fast metadata aggregation from datasets (< 0.1ms)
  const datasetTfStats = database
    .prepare(
      `SELECT symbol_id, timeframe, SUM(rows_inserted) as cnt, MIN(first_time) as minT, MAX(last_time) as maxT
       FROM datasets
       GROUP BY symbol_id, timeframe`
    )
    .all() as {
    symbol_id: number;
    timeframe: string;
    cnt: number;
    minT: number | null;
    maxT: number | null;
  }[];

  const tfStatsBySymbol = new Map<number, Array<{ timeframe: string; cnt: number; minT: number | null; maxT: number | null }>>();
  for (const row of candleTfStats) {
    let list = tfStatsBySymbol.get(row.symbol_id);
    if (!list) {
      list = [];
      tfStatsBySymbol.set(row.symbol_id, list);
    }
    list.push(row);
  }

  // Merge dataset stats if any timeframe not yet in candles
  for (const row of datasetTfStats) {
    let list = tfStatsBySymbol.get(row.symbol_id);
    if (!list) {
      list = [];
      tfStatsBySymbol.set(row.symbol_id, list);
    }
    const existing = list.find((item) => normalizeTimeframe(item.timeframe) === normalizeTimeframe(row.timeframe));
    if (!existing) {
      list.push(row);
    }
  }

  const minTimeStmt = database.prepare('SELECT time FROM candles WHERE symbol_id = ? ORDER BY time ASC LIMIT 1');
  const maxTimeStmt = database.prepare('SELECT time FROM candles WHERE symbol_id = ? ORDER BY time DESC LIMIT 1');
  const countStmt = database.prepare('SELECT COUNT(*) as c FROM candles WHERE symbol_id = ?');

  const result: SymbolDetailStats[] = symbolRows.map((s) => {
    let tfRows = tfStatsBySymbol.get(s.id);

    if (!tfRows || tfRows.length === 0) {
      const minRow = minTimeStmt.get(s.id) as { time: number } | undefined;
      const maxRow = maxTimeStmt.get(s.id) as { time: number } | undefined;
      const cntRow = countStmt.get(s.id) as { c: number } | undefined;
      if (minRow && maxRow) {
        tfRows = [{
          timeframe: 'M1',
          cnt: cntRow?.c ?? 0,
          minT: minRow.time,
          maxT: maxRow.time,
        }];
      } else {
        tfRows = [];
      }
    }

    let totalCandles = 0;
    let overallMinT: number | null = null;
    let overallMaxT: number | null = null;

    const nativeTfs: string[] = [];
    for (const r of tfRows) {
      if (!nativeTfs.includes(r.timeframe)) {
        nativeTfs.push(r.timeframe);
      }
      totalCandles += r.cnt;
      if (r.minT !== null) {
        overallMinT = overallMinT === null ? r.minT : Math.min(overallMinT, r.minT);
      }
      if (r.maxT !== null) {
        overallMaxT = overallMaxT === null ? r.maxT : Math.max(overallMaxT, r.maxT);
      }
    }

    // Available timeframes include native + any that can be aggregated
    const allAvailable = new Set<string>(nativeTfs.length > 0 ? nativeTfs : ['M1']);
    for (const tf of Object.keys(TIMEFRAME_SECONDS)) {
      if (allAvailable.has(tf)) continue;
      const targetSeconds = TIMEFRAME_SECONDS[tf];
      if (nativeTfs.some((nt) => TIMEFRAME_SECONDS[nt] !== undefined && TIMEFRAME_SECONDS[nt] < targetSeconds)) {
        allAvailable.add(tf);
      }
    }

    return {
      symbolId: s.id,
      symbolName: s.name,
      nativeTimeframes: nativeTfs,
      availableTimeframes: Array.from(allAvailable).sort((a, b) => TIMEFRAME_SECONDS[a] - TIMEFRAME_SECONDS[b]),
      totalCandles,
      firstTime: overallMinT,
      lastTime: overallMaxT,
    };
  });

  symbolDetailStatsCache = result;
  return result;
}

// ─── Day 20: Import History Logging ───────────────────────────────

export interface ImportLogRecord {
  id: number;
  symbol: string;
  timeframe: string;
  fileName: string;
  importedAt: number;
  rowsRead: number;
  rowsValid: number;
  rowsInserted: number;
  rowsDuplicate: number;
  rowsSkipped: number;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  errorMessage: string | null;
}

/** Record an import attempt in the import_logs table. */
export function recordImportLog(params: {
  symbol: string;
  timeframe: string;
  fileName: string;
  rowsRead: number;
  rowsValid: number;
  rowsInserted: number;
  rowsDuplicate: number;
  rowsSkipped: number;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  errorMessage?: string;
}): void {
  const database = getDatabase();
  database
    .prepare(
      `INSERT INTO import_logs
        (symbol, timeframe, file_name, imported_at, rows_read, rows_valid, rows_inserted, rows_duplicate, rows_skipped, status, error_message)
       VALUES
        (@symbol, @timeframe, @fileName, @importedAt, @rowsRead, @rowsValid, @rowsInserted, @rowsDuplicate, @rowsSkipped, @status, @errorMessage)`
    )
    .run({
      symbol: params.symbol,
      timeframe: params.timeframe,
      fileName: params.fileName,
      importedAt: Math.floor(Date.now() / 1000),
      rowsRead: params.rowsRead,
      rowsValid: params.rowsValid,
      rowsInserted: params.rowsInserted,
      rowsDuplicate: params.rowsDuplicate,
      rowsSkipped: params.rowsSkipped,
      status: params.status,
      errorMessage: params.errorMessage ?? null,
    });
}

/** List recent import logs, most recent first. */
export function listImportLogs(limit = 100): ImportLogRecord[] {
  const database = getDatabase();
  const rows = database
    .prepare(
      `SELECT id, symbol, timeframe, file_name, imported_at, rows_read, rows_valid,
              rows_inserted, rows_duplicate, rows_skipped, status, error_message
       FROM import_logs ORDER BY imported_at DESC LIMIT ?`
    )
    .all(limit) as {
    id: number;
    symbol: string;
    timeframe: string;
    file_name: string;
    imported_at: number;
    rows_read: number;
    rows_valid: number;
    rows_inserted: number;
    rows_duplicate: number;
    rows_skipped: number;
    status: string;
    error_message: string | null;
  }[];

  return rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    timeframe: r.timeframe,
    fileName: r.file_name,
    importedAt: r.imported_at,
    rowsRead: r.rows_read,
    rowsValid: r.rows_valid,
    rowsInserted: r.rows_inserted,
    rowsDuplicate: r.rows_duplicate,
    rowsSkipped: r.rows_skipped,
    status: r.status as 'SUCCESS' | 'FAILED' | 'PARTIAL',
    errorMessage: r.error_message,
  }));
}

export interface BacktestSessionRow {
  id: string;
  session_name: string;
  symbol_id: number;
  symbol_name: string;
  timeframe: string;
  start_time: number;
  end_time: number;
  initial_balance: number;
  mode: string;
  daily_drawdown: number | null;
  max_drawdown: number | null;
  profit_target: number | null;
  current_replay_time: number | null;
  current_replay_index: number | null;
  account_balance: number | null;
  account_equity: number | null;
  active_timeframe: string | null;
  status: string;
  symbols_json?: string | null;
  created_at: number;
  updated_at: number;
}

export function listBacktestSessionsDb(): BacktestSessionRow[] {
  const database = getDatabase();
  const rows = database
    .prepare(`
      SELECT 
        id, session_name, symbol_id, symbol_name, timeframe, 
        start_time, end_time, initial_balance, mode, 
        daily_drawdown, max_drawdown, profit_target, 
        current_replay_time, current_replay_index, 
        account_balance, account_equity, active_timeframe, 
        status, symbols_json, created_at, updated_at
      FROM backtest_sessions 
      ORDER BY created_at DESC
    `)
    .all() as BacktestSessionRow[];
  return rows;
}

export function getBacktestSessionDb(id: string): BacktestSessionRow | undefined {
  const database = getDatabase();
  return database
    .prepare('SELECT * FROM backtest_sessions WHERE id = ?')
    .get(id) as BacktestSessionRow | undefined;
}

export function saveBacktestSessionDb(s: Partial<BacktestSessionRow> & { id: string }): boolean {
  const database = getDatabase();
  console.log('Database Path:', database.name);

  const symName = s.symbol_name || 'XAUUSD';
  const symbolId = upsertSymbol(symName);

  const existing = database
    .prepare('SELECT id FROM backtest_sessions WHERE id = ?')
    .get(s.id) as { id: string } | undefined;

  const now = Math.floor(Date.now() / 1000);

  if (existing) {
    database
      .prepare(
        `UPDATE backtest_sessions SET
          session_name = COALESCE(@session_name, session_name),
          symbol_id = @symbol_id,
          symbol_name = COALESCE(@symbol_name, symbol_name),
          timeframe = COALESCE(@timeframe, timeframe),
          start_time = COALESCE(@start_time, start_time),
          end_time = COALESCE(@end_time, end_time),
          initial_balance = COALESCE(@initial_balance, initial_balance),
          mode = COALESCE(@mode, mode),
          daily_drawdown = COALESCE(@daily_drawdown, daily_drawdown),
          max_drawdown = COALESCE(@max_drawdown, max_drawdown),
          profit_target = COALESCE(@profit_target, profit_target),
          current_replay_time = COALESCE(@current_replay_time, current_replay_time),
          current_replay_index = COALESCE(@current_replay_index, current_replay_index),
          account_balance = COALESCE(@account_balance, account_balance),
          account_equity = COALESCE(@account_equity, account_equity),
          active_timeframe = COALESCE(@active_timeframe, active_timeframe),
          status = COALESCE(@status, status),
          symbols_json = COALESCE(@symbols_json, symbols_json),
          updated_at = @updated_at
        WHERE id = @id`
      )
      .run({
        id: s.id,
        session_name: s.session_name ?? null,
        symbol_id: symbolId,
        symbol_name: s.symbol_name ?? null,
        timeframe: s.timeframe ?? null,
        start_time: s.start_time ?? null,
        end_time: s.end_time ?? null,
        initial_balance: s.initial_balance ?? null,
        mode: s.mode ?? null,
        daily_drawdown: s.daily_drawdown ?? null,
        max_drawdown: s.max_drawdown ?? null,
        profit_target: s.profit_target ?? null,
        current_replay_time: s.current_replay_time ?? null,
        current_replay_index: s.current_replay_index ?? null,
        account_balance: s.account_balance ?? null,
        account_equity: s.account_equity ?? null,
        active_timeframe: s.active_timeframe ?? null,
        status: s.status ?? null,
        symbols_json: s.symbols_json ?? null,
        updated_at: s.updated_at ?? now,
      });
  } else {
    database
      .prepare(
        `INSERT INTO backtest_sessions (
          id, session_name, symbol_id, symbol_name, timeframe, start_time, end_time,
          initial_balance, mode, daily_drawdown, max_drawdown, profit_target,
          current_replay_time, current_replay_index, account_balance, account_equity,
          active_timeframe, status, symbols_json, created_at, updated_at
        ) VALUES (
          @id, @session_name, @symbol_id, @symbol_name, @timeframe, @start_time, @end_time,
          @initial_balance, @mode, @daily_drawdown, @max_drawdown, @profit_target,
          @current_replay_time, @current_replay_index, @account_balance, @account_equity,
          @active_timeframe, @status, @symbols_json, @created_at, @updated_at
        )`
      )
      .run({
        id: s.id,
        session_name: s.session_name ?? 'New Backtest Session',
        symbol_id: symbolId,
        symbol_name: symName,
        timeframe: s.timeframe ?? 'M15',
        start_time: s.start_time ?? now,
        end_time: s.end_time ?? now,
        initial_balance: s.initial_balance ?? 10000,
        mode: s.mode ?? 'normal',
        daily_drawdown: s.daily_drawdown ?? null,
        max_drawdown: s.max_drawdown ?? null,
        profit_target: s.profit_target ?? null,
        current_replay_time: s.current_replay_time ?? null,
        current_replay_index: s.current_replay_index ?? null,
        account_balance: s.account_balance ?? s.initial_balance ?? 10000,
        account_equity: s.account_equity ?? s.initial_balance ?? 10000,
        active_timeframe: s.active_timeframe ?? s.timeframe ?? 'M15',
        status: s.status ?? 'active',
        symbols_json: s.symbols_json ?? null,
        created_at: s.created_at ?? now,
        updated_at: s.updated_at ?? now,
      });
  }

  console.log('[Session DB] INSERT SUCCESS');
  const countRow = database.prepare('SELECT COUNT(*) as cnt FROM backtest_sessions').get() as { cnt: number };
  console.log('COUNT:', countRow.cnt);

  return true;
}

export function updateBacktestSessionDb(id: string, updates: Partial<BacktestSessionRow>): boolean {
  return saveBacktestSessionDb({ ...updates, id });
}

export function updateReplayStateDb(
  id: string,
  currentReplayIndex: number | null,
  currentReplayTime: number | null
): boolean {
  const database = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  database
    .prepare(
      `UPDATE backtest_sessions SET
        current_replay_index = COALESCE(@current_replay_index, current_replay_index),
        current_replay_time = COALESCE(@current_replay_time, current_replay_time),
        updated_at = @updated_at
      WHERE id = @id`
    )
    .run({
      id,
      current_replay_index: currentReplayIndex,
      current_replay_time: currentReplayTime,
      updated_at: now,
    });
  return true;
}

export function updateTradingStateDb(
  id: string,
  accountBalance: number,
  accountEquity: number
): boolean {
  const database = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  console.log('---------------------------------');
  console.log('[Trading DB] Executing UPDATE');
  console.log('session_id:', id);
  console.log('accountBalance:', accountBalance);
  console.log('---------------------------------');

  const res = database
    .prepare(
      `UPDATE backtest_sessions SET
        account_balance = @account_balance,
        account_equity = @account_equity,
        updated_at = @updated_at
      WHERE id = @id`
    )
    .run({
      id,
      account_balance: accountBalance,
      account_equity: accountEquity,
      updated_at: now,
    });

  console.log('[Trading DB] Rows Affected:', res.changes);

  const checkRow = database
    .prepare('SELECT account_balance FROM backtest_sessions WHERE id = ?')
    .get(id) as { account_balance: number } | undefined;

  console.log('[Trading DB] SELECT account_balance Result:', checkRow ? checkRow.account_balance : 'ROW NOT FOUND');
  console.log('---------------------------------');

  return res.changes > 0;
}

export function deleteBacktestSessionDb(id: string): boolean {
  const database = getDatabase();
  database.prepare('DELETE FROM backtest_sessions WHERE id = ?').run(id);
  return true;
}

export function saveTradingStateJsonDb(id: string, stateJson: string): boolean {
  try {
    const parsed = JSON.parse(stateJson);
    console.log('[HYDRATION-AUDIT-SAVE]', {
      sessionId: id,
      positionsCount: parsed.schema?.positions?.length ?? 0,
      positionIds: (parsed.schema?.positions ?? []).map((p: any) => p.id || p.positionId),
      historyCount: parsed.schema?.history?.length ?? 0,
      historyTradeIds: (parsed.schema?.history ?? []).map((h: any) => h.tradeId),
      historyPositionIds: (parsed.schema?.history ?? []).map((h: any) => h.positionId),
    });
  } catch (e) {}

  const database = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const res = database
    .prepare(
      `UPDATE backtest_sessions SET
        trading_state_json = @trading_state_json,
        updated_at = @updated_at
      WHERE id = @id`
    )
    .run({
      id,
      trading_state_json: stateJson,
      updated_at: now,
    });
  return res.changes > 0;
}

export function loadTradingStateJsonDb(id: string): string | null {
  const database = getDatabase();
  const row = database
    .prepare('SELECT trading_state_json FROM backtest_sessions WHERE id = ?')
    .get(id) as { trading_state_json: string | null } | undefined;

  return row?.trading_state_json ?? null;
}

export interface EconomicEventRecord {
  id?: number;
  timestamp: number;
  currency: string;
  country: string;
  event_name: string;
  impact: string;
  actual?: string | null;
  forecast?: string | null;
  previous?: string | null;
}

export function insertEconomicEventsDb(events: EconomicEventRecord[]): number {
  if (!events || events.length === 0) return 0;
  const database = getDatabase();
  const insertStmt = database.prepare(`
    INSERT OR IGNORE INTO economic_events (
      timestamp, currency, country, event_name, impact, actual, forecast, previous
    ) VALUES (
      @timestamp, @currency, @country, @event_name, @impact, @actual, @forecast, @previous
    )
  `);

  const insertMany = database.transaction((items: EconomicEventRecord[]) => {
    let inserted = 0;
    for (const item of items) {
      const res = insertStmt.run({
        timestamp: item.timestamp,
        currency: item.currency.toUpperCase(),
        country: item.country?.toUpperCase() || item.currency.toUpperCase().slice(0, 2),
        event_name: item.event_name,
        impact: item.impact?.toUpperCase() || 'HIGH',
        actual: item.actual ?? null,
        forecast: item.forecast ?? null,
        previous: item.previous ?? null,
      });
      if (res.changes > 0) inserted++;
    }
    return inserted;
  });

  return insertMany(events);
}

export function getEconomicEventsRangeDb(
  currencies: string[],
  fromTime: number,
  toTime: number,
  minImpact?: string
): EconomicEventRecord[] {
  const database = getDatabase();
  if (!currencies || currencies.length === 0) return [];

  const upperCurrencies = currencies.map((c) => c.toUpperCase());
  const placeholders = upperCurrencies.map(() => '?').join(',');

  let impactFilter = '';
  const params: any[] = [...upperCurrencies, fromTime, toTime];

  if (minImpact === 'HIGH') {
    impactFilter = 'AND impact = ?';
    params.push('HIGH');
  } else if (minImpact === 'MEDIUM') {
    impactFilter = 'AND impact IN (?, ?)';
    params.push('HIGH', 'MEDIUM');
  }

  const query = `
    SELECT id, timestamp, currency, country, event_name, impact, actual, forecast, previous
    FROM economic_events
    WHERE currency IN (${placeholders})
      AND timestamp >= ?
      AND timestamp <= ?
      ${impactFilter}
    ORDER BY timestamp ASC
  `;

  return database.prepare(query).all(...params) as EconomicEventRecord[];
}

export function getEconomicEventsStatsDb(): {
  totalEvents: number;
  countByCurrency: Record<string, number>;
  minTime: number | null;
  maxTime: number | null;
} {
  const database = getDatabase();
  const totalRow = database
    .prepare('SELECT COUNT(*) as total, MIN(timestamp) as minTime, MAX(timestamp) as maxTime FROM economic_events')
    .get() as { total: number; minTime: number | null; maxTime: number | null };

  const currencyRows = database
    .prepare('SELECT currency, COUNT(*) as count FROM economic_events GROUP BY currency')
    .all() as { currency: string; count: number }[];

  const countByCurrency: Record<string, number> = {};
  for (const row of currencyRows) {
    countByCurrency[row.currency] = row.count;
  }

  return {
    totalEvents: totalRow.total || 0,
    countByCurrency,
    minTime: totalRow.minTime,
    maxTime: totalRow.maxTime,
  };
}



