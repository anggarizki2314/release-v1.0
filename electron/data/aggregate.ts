// Timeframe aggregation: builds higher-timeframe candles from a finer
// source timeframe already sitting in the database (M1 -> M5/M15/...).
// Pure functions, no DB access — kept separate from db.ts on purpose
// so the math (bucket boundaries, OHLC rules) can be reasoned about
// and tested on its own.

/**
 * Normalizes any timeframe string (e.g. '3m', '3M', 'm3') to canonical format (e.g. 'M3').
 */
export function normalizeTimeframe(input: string): string {
  if (!input || typeof input !== 'string') return 'M1';
  const clean = input.trim();
  const upper = clean.toUpperCase();

  switch (upper) {
    case 'M1':
    case '1M':
    case '1MIN':
    case '1M':
      return 'M1';
    case 'M3':
    case '3M':
    case '3MIN':
      return 'M3';
    case 'M5':
    case '5M':
    case '5MIN':
      return 'M5';
    case 'M15':
    case '15M':
    case '15MIN':
      return 'M15';
    case 'M30':
    case '30M':
    case '30MIN':
      return 'M30';
    case 'H1':
    case '1H':
    case '1HOUR':
      return 'H1';
    case 'H4':
    case '4H':
    case '4HOUR':
      return 'H4';
    case 'H7':
    case '7H':
    case '7HOUR':
      return 'H7';
    case 'D1':
    case '1D':
    case '1DAY':
      return 'D1';
    case 'W1':
    case '1W':
    case '1WEEK':
      return 'W1';
    case 'MONTHLY':
    case '1MN':
    case 'MN':
    case 'MN1':
    case 'M1N':
    case '1MONTH':
      return 'Monthly';
    default: {
      const matchPrefix = upper.match(/^([MHDW])(\d+)$/);
      if (matchPrefix) {
        return `${matchPrefix[1]}${matchPrefix[2]}`;
      }
      const matchSuffix = upper.match(/^(\d+)([MHDW])$/);
      if (matchSuffix) {
        return `${matchSuffix[2]}${matchSuffix[1]}`;
      }
      return clean;
    }
  }
}

export function getTimeframeSeconds(tf: string): number {
  const norm = normalizeTimeframe(tf);
  if (TIMEFRAME_SECONDS[norm]) return TIMEFRAME_SECONDS[norm];
  
  if (norm === 'Monthly') return 2592000;

  const match = norm.match(/^([MHDW])(\d+)$/);
  if (match) {
    const unit = match[1];
    const val = parseInt(match[2], 10);
    if (unit === 'M') return val * 60;
    if (unit === 'H') return val * 3600;
    if (unit === 'D') return val * 86400;
    if (unit === 'W') return val * 604800;
  }
  return 60; // fallback to M1
}

export const TIMEFRAME_SECONDS: Record<string, number> = {
  M1: 60,
  M3: 180,
  M5: 300,
  M15: 900,
  M30: 1800,
  H1: 3600,
  H4: 14400,
  H7: 25200,
  D1: 86400,
  W1: 604800,
  Monthly: 2592000,
};

// Fast Daylight Saving Time (DST) calculator for New York Time.
let lastYear = 0;
let lastYearStart = 0;
let lastYearEnd = 0;
let dstStart = 0;
let dstEnd = 0;

function isUSDSTFast(timeUTC: number): boolean {
  if (timeUTC >= lastYearStart && timeUTC < lastYearEnd) {
    return timeUTC >= dstStart && timeUTC < dstEnd;
  }
  const d = new Date(timeUTC * 1000);
  const year = d.getUTCFullYear();
  lastYear = year;
  lastYearStart = Date.UTC(year, 0, 1) / 1000;
  lastYearEnd = Date.UTC(year + 1, 0, 1) / 1000;
  const march1 = new Date(Date.UTC(year, 2, 1));
  const march2ndSundayDate = 1 + ((7 - march1.getUTCDay()) % 7) + 7;
  dstStart = Date.UTC(year, 2, march2ndSundayDate, 7, 0, 0) / 1000;
  const nov1 = new Date(Date.UTC(year, 10, 1));
  const nov1stSundayDate = 1 + ((7 - nov1.getUTCDay()) % 7);
  dstEnd = Date.UTC(year, 10, nov1stSundayDate, 6, 0, 0) / 1000;
  return timeUTC >= dstStart && timeUTC < dstEnd;
}

function getNYCloseAnchor(timeUTC: number): number {
  return isUSDSTFast(timeUTC) ? 21 * 3600 : 22 * 3600;
}

// Unix epoch (1970-01-01 00:00 UTC) was a Thursday. Weekly buckets
// should start on Monday 00:00 UTC, so the anchor is shifted back 3
// days from epoch 0 rather than starting bucket math at epoch 0
// directly (which would put boundaries on Thursdays).
const WEEK_MONDAY_ANCHOR = -3 * 86400;

/**
 * Start-of-bucket timestamp (unix seconds, UTC) for a given candle
 * time under a target timeframe.
 */
export function bucketStart(time: number, targetTimeframe: string): number {
  const t = typeof time === 'number' ? time : Number(time);
  if (!Number.isFinite(t)) {
    throw new Error(`[DerivedTimeframe] Invalid source timestamp: ${time}`);
  }

  const norm = normalizeTimeframe(targetTimeframe);
  const secondsLookup = getTimeframeSeconds(norm);

  if (norm === 'Monthly') {
    const d = new Date(t * 1000);
    return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000);
  }

  if (norm === 'W1' || norm.startsWith('W')) {
    return WEEK_MONDAY_ANCHOR + Math.floor((t - WEEK_MONDAY_ANCHOR) / secondsLookup) * secondsLookup;
  }

  if (norm.startsWith('H') || norm.startsWith('D')) {
    const anchor = getNYCloseAnchor(t);
    return anchor + Math.floor((t - anchor) / secondsLookup) * secondsLookup;
  }

  return Math.floor(t / secondsLookup) * secondsLookup;
}

export interface AggregatableCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

/**
 * Groups ascending source candles into target-timeframe buckets and
 * computes OHLC mathematically from the candles actually present in
 * each bucket:
 *   Open  = open of the FIRST source candle in the bucket
 *   High  = highest high across the bucket
 *   Low   = lowest low across the bucket
 *   Close = close of the LAST source candle in the bucket
 *   Volume = sum of the bucket's volumes, but only if every source
 *            candle in that bucket has a volume — otherwise null
 *            (never fabricates a partial sum as if it were complete)
 *
 * A bucket only ever appears in the output if at least one source
 * candle actually falls in it — missing periods (data gaps) simply
 * produce no candle for that slot, never a synthesized flat/empty
 * one. `sourceRows` must already be ascending and gap/duplicate-free
 * (i.e. already passed through db.ts's sanitizeCandleRows).
 */
export function aggregateCandles<T extends AggregatableCandle>(
  sourceRows: T[],
  targetTimeframe: string
): AggregatableCandle[] {
  const result: AggregatableCandle[] = [];
  let bucketTime: number | null = null;
  let open = 0;
  let high = 0;
  let low = 0;
  let close = 0;
  let volumeSum = 0;
  let volumeComplete = true;

  const flush = () => {
    if (bucketTime === null) return;
    result.push({
      time: bucketTime,
      open,
      high,
      low,
      close,
      volume: volumeComplete ? volumeSum : null,
    });
  };

  for (const row of sourceRows) {
    const start = bucketStart(row.time, targetTimeframe);
    if (bucketTime === null || start !== bucketTime) {
      flush();
      bucketTime = start;
      open = row.open;
      high = row.high;
      low = row.low;
      close = row.close;
      volumeSum = row.volume ?? 0;
      volumeComplete = row.volume !== null;
    } else {
      if (row.high > high) high = row.high;
      if (row.low < low) low = row.low;
      close = row.close; // sourceRows is ascending, so the last write wins correctly
      if (row.volume === null) {
        volumeComplete = false;
      } else if (volumeComplete) {
        volumeSum += row.volume;
      }
    }
  }
  flush();

  return result;
}
