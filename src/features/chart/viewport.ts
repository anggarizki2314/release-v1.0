// Chart viewport helpers — deliberately separate from data state
// (useCandles) and from any future replay state. Reset Chart / initial
// positioning only ever touches the chart's visible logical range;
// none of this reads or writes candle data, the database, or replay
// state.

/** Default number of candles shown when no specific focus point is given. */
export const DEFAULT_VISIBLE_CANDLES = 150;

/** How many candles of "before" context to keep when centering on a focus time. */
export const FOCUS_CONTEXT_BEFORE = 30;

// --- Day 5: data-loading / pagination constants ---
// Kept here (not in useCandles.ts) so ChartContainer and useCandles
// share the exact same numbers without importing across each other.

/** How many of the most recent candles to fetch on initial load
 * (symbol/timeframe selected). Comfortably covers DEFAULT_VISIBLE_CANDLES
 * plus a lot of pan-left headroom before a pagination fetch is needed,
 * without ever pulling a symbol's entire history up front. */
export const INITIAL_CANDLE_BATCH = 5000;

/** How many additional older candles to fetch per backward-pagination
 * request once the user pans near the start of what's loaded. */
export const PAGE_CANDLE_BATCH = 5000;

/** Trigger the next backward-pagination fetch once the visible
 * logical range's `from` gets within this many candles of index 0 —
 * i.e. fetch a bit before the user actually hits the edge, so panning
 * stays smooth instead of momentarily showing blank space while the
 * IPC round-trip resolves. */
export const PAN_LOAD_THRESHOLD = 80;

export interface TimedPoint {
  time: number; // unix seconds, ascending order assumed
}

/**
 * Binary search for the index of the candle whose time is closest to
 * `targetTime`, in an ascending-sorted array. Used both for the
 * "reset to default view" case and — later — by the Replay Engine to
 * find where a chosen Replay Start Time actually sits in the loaded
 * series.
 */
export function findNearestIndex<T extends TimedPoint>(data: T[], targetTime: number): number {
  if (data.length === 0) return -1;
  let lo = 0;
  let hi = data.length - 1;
  if (targetTime <= data[lo].time) return lo;
  if (targetTime >= data[hi].time) return hi;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (data[mid].time === targetTime) return mid;
    if (data[mid].time < targetTime) lo = mid + 1;
    else hi = mid;
  }
  // lo now points to the first element >= targetTime; compare against
  // its predecessor to find whichever is actually closer.
  const prev = Math.max(0, lo - 1);
  return Math.abs(data[prev].time - targetTime) <= Math.abs(data[lo].time - targetTime)
    ? prev
    : lo;
}

export interface LogicalRange {
  from: number;
  to: number;
}

/**
 * Computes the default logical range: the most recent
 * DEFAULT_VISIBLE_CANDLES candles (or fewer if not enough data yet).
 * Used both for "Reset Chart" (no replay case) and for auto-
 * positioning when a symbol/timeframe is first loaded.
 */
export function defaultRange(length: number): LogicalRange | null {
  if (length === 0) return null;
  const visibleWidth = DEFAULT_VISIBLE_CANDLES;
  const rightPad = Math.max(5, Math.ceil(visibleWidth * 0.10));
  const to = (length - 1) + rightPad;
  const from = to - visibleWidth;
  return { from, to };
}

/**
 * Computes a logical range centered on a focus timestamp (e.g. a
 * Replay Engine's current/start time), keeping some candles of
 * "before" context visible and filling the rest with "after" candles
 * up to the default window size. Not wired to any UI yet (no Replay
 * Engine exists), but ready for it — see resetChartView(focusTime).
 */
export function focusRange<T extends TimedPoint>(data: T[], focusTime: number): LogicalRange | null {
  if (data.length === 0) return null;
  const idx = findNearestIndex(data, focusTime);
  const visibleWidth = DEFAULT_VISIBLE_CANDLES;
  const rightPad = Math.max(5, Math.ceil(visibleWidth * 0.10));
  const to = idx + rightPad;
  const from = to - visibleWidth;
  return { from, to };
}

/**
 * Converts a timeframe string (e.g. 'M1', 'M5', 'M15', 'H1', 'H4', 'D1', '1m', '15m', etc.)
 * into duration in minutes per candle.
 */
export function getTimeframeMinutes(timeframe: string): number {
  if (!timeframe) return 15;
  const tf = timeframe.toString().toUpperCase().trim();
  if (tf === 'D' || tf === 'D1' || tf === '1D') return 1440;
  if (tf === 'W' || tf === 'W1' || tf === '1W') return 10080;
  if (tf.startsWith('H')) {
    const hours = parseInt(tf.replace('H', ''), 10) || 1;
    return hours * 60;
  }
  if (tf.endsWith('H')) {
    const hours = parseInt(tf.replace('H', ''), 10) || 1;
    return hours * 60;
  }
  if (tf.startsWith('M')) {
    return parseInt(tf.replace('M', ''), 10) || 15;
  }
  if (tf.endsWith('M')) {
    return parseInt(tf.replace('M', ''), 10) || 15;
  }
  const parsed = parseInt(tf, 10);
  return isNaN(parsed) || parsed <= 0 ? 15 : parsed;
}

/**
 * Calculates buffer candles for ~2 days before and ~2 days after the Replay Start Date.
 * 2 days = 2880 minutes.
 */
export function getTwoDayBufferCandles(timeframe: string): number {
  const tfMinutes = getTimeframeMinutes(timeframe);
  const twoDaysMinutes = 2880;
  return Math.max(2, Math.round(twoDaysMinutes / tfMinutes));
}

/**
 * Computes logical viewport bounded strictly by dataset length (0 ... totalLength - 1).
 * Prevents TradingView from clamping viewport to {from: last, to: last}.
 */
export function calculateReplayViewport(
  lastIndex: number,
  totalLengthOrTimeframe: number | string,
  timeframe?: string
): LogicalRange {
  let totalLength: number;
  let tf: string;

  if (typeof totalLengthOrTimeframe === 'number') {
    totalLength = totalLengthOrTimeframe;
    tf = timeframe || 'M15';
  } else {
    tf = totalLengthOrTimeframe;
    totalLength = Math.max(1, lastIndex + 1);
  }

  const maxIdx = Math.max(0, totalLength - 1);
  const safeLastIdx = Math.max(0, Math.min(maxIdx, lastIndex));

  // Comfortable viewport window (60 bars total):
  // 45 bars before the active replay index, 15 bars padding after.
  // Gives clear, crisp candle bar width (~20px per candle).
  const visibleBarsBefore = 45;
  const visibleBarsAfter = 15;

  const from = Math.max(-5, safeLastIdx - visibleBarsBefore);
  const to = Math.min(maxIdx + 15, safeLastIdx + visibleBarsAfter);

  return { from, to };
}
