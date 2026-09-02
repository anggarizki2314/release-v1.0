/**
 * Configuration for Replay Engine and Chart Performance Optimizations.
 */

/**
 * Maximum base window size (number of candles) fed into the chart rendering layer.
 * A window of 20,000 candles covers ~14 days of M1, ~70 days of M5, or ~2.3 years of H1,
 * keeping memory lightweight while preserving deep scrollback context.
 */
export const WINDOW_SIZE = 20000;

/**
 * Margin before shifting the windowStart forward.
 * While cutoffIndex is within (windowStart + WINDOW_SIZE + WINDOW_MARGIN),
 * windowStart stays anchored at the exact same index.
 * This guarantees O(1) series.update runs continuously without
 * re-slicing or triggering setData() until the replay advances by WINDOW_MARGIN bars.
 */
export const WINDOW_MARGIN = 5000;
