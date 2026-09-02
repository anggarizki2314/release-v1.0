// Shared cross-feature types. Kept intentionally small on day 1 —
// each feature module owns its own detailed types under src/features/*.

export type Timeframe = 'M1' | 'M3' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'H7' | 'D1' | 'W1' | 'Monthly' | (string & {});

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  source?: string;
}

export interface SymbolInfo {
  id: number;
  name: string;
  timeframes: Timeframe[];
  candleCount: number;
  firstTime: number | null;
  lastTime: number | null;
  lastUpdatedAt: number | null;
}

export interface ImportFileResult {
  filePath: string;
  fileName: string;
  symbol: string;
  timeframe: string;
  rowsRead: number;
  rowsValid: number;
  rowsSkipped: number;
  rowsDuplicate: number;
  rowsInserted: number;
  outOfOrderRows: number;
  firstTime: number | null;
  lastTime: number | null;
  error?: string;
}

export interface DatasetInfo {
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

export type DrawingTool =
  // ── Cursor
  | 'crosshair'
  // ── Trend
  | 'trendline'
  | 'ray'
  | 'info-line'
  | 'extended-line'
  | 'trend-angle'
  // ── Horizontal
  | 'horizontal-line'
  | 'horizontal-ray'
  | 'vertical-line'
  | 'cross-line'
  // ── Pitchfork
  | 'pitchfork'
  | 'schiff-pitchfork'
  | 'modified-schiff-pitchfork'
  | 'inside-pitchfork'
  // ── Fibonacci
  | 'fib-retracement'
  | 'fib-extension'
  | 'fib-channel'
  | 'fib-timezone'
  | 'fib-fan'
  | 'fib-time'
  | 'fib-circles'
  | 'fib-spiral'
  | 'fib-speed-resistance-arcs'
  | 'fib-wedge'
  | 'pitchfan'
  // ── Gann
  | 'gann-box'
  | 'fixed-gann-box'
  | 'gann-square'
  | 'gann-fan'
  // ── Pattern / Volume / Measurement
  | 'long-position'
  | 'short-position'
  | 'forecast'
  | 'bars-pattern'
  | 'ghost-feed'
  | 'cycles'
  | 'anchored-vwap'
  | 'fixed-range-volume-profile'
  | 'anchored-volume-profile'
  | 'price-range'
  | 'date-range'
  | 'date-price-range'
  // ── Shapes / Brush / Arrow
  | 'brush'
  | 'highlighter'
  | 'arrow-marker'
  | 'arrow'
  | 'arrow-up'
  | 'arrow-down'
  | 'rectangle'
  | 'rotated-rectangle'
  | 'path'
  | 'circle'
  | 'ellipse'
  | 'polyline'
  | 'triangle'
  | 'arc'
  | 'curve'
  | 'double-curve'
  // ── Text
  | 'text'
  | 'anchored-text'
  | 'note'
  | 'anchored-note'
  | 'callout'
  | 'balloon'
  | 'price-label'
  // ── Utility (non-flyout)
  | 'select'
  | 'magnet'
  | 'settings';

export type BottomPanelTab =
  | 'data'
  | 'database'
  | 'trades'
  | 'positions'
  | 'orders'
  | 'journal'
  | 'statistics'
  | 'equity-curve';

// ─── Day 20: Database Maintenance Types ───────────────────────────

export interface DatabaseStats {
  totalSymbols: number;
  totalDatasets: number;
  totalCandles: number;
  earliestData: number | null;
  latestData: number | null;
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

export interface DatabaseHealth {
  healthy: boolean;
  message: string;
  details: string[];
}

export interface DatasetStatsInfo {
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

export interface SymbolDetailStats {
  symbolId: number;
  symbolName: string;
  nativeTimeframes: string[];
  availableTimeframes: string[];
  totalCandles: number;
  firstTime: number | null;
  lastTime: number | null;
}

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

// Shared timeframe list used by both the chart's timeframe selector
// (TopBar) and the replay engine's timeframe selector (FloatingReplayBar).
// Kept in one place so the two selectors always offer the same options —
// "timeframe lain yang tersedia pada data" will extend this list once
// features/data can introspect what's actually been imported.
export const TIMEFRAME_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: 'M1', label: '1m' },
  { value: 'M3', label: '3m' },
  { value: 'M5', label: '5m' },
  { value: 'M15', label: '15m' },
  { value: 'M30', label: '30m' },
  { value: 'H1', label: '1H' },
  { value: 'H4', label: '4H' },
  { value: 'H7', label: '7H' },
  { value: 'D1', label: '1D' },
  { value: 'W1', label: '1W' },
  { value: 'Monthly', label: '1MN' },
];
