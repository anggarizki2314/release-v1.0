/**
 * Technical Indicators System — Types & Interfaces
 */

import { timeframeToSeconds } from '@/utils/dataResampler';

export type IndicatorType = 'EMA' | 'RSI' | 'SESSIONS' | 'KILLZONES' | 'MACROS' | 'SESSION_OPENS' | 'QUARTERS';

export interface VisibilityRange {
  enabled: boolean;
  min: number;
  max: number;
}

export interface VisibilityToggle {
  enabled: boolean;
}

export interface IndicatorVisibility {
  ticks?: boolean | VisibilityToggle;
  seconds?: boolean | VisibilityRange;
  minutes?: boolean | VisibilityRange;
  hours?: boolean | VisibilityRange;
  days?: boolean | VisibilityRange;
  weeks?: boolean | VisibilityRange;
  months?: boolean | VisibilityRange;
  ranges?: boolean | VisibilityToggle;
}

export type TimeframeUnit = 'ticks' | 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'ranges';

export interface ParsedTimeframe {
  unit: TimeframeUnit;
  value: number;
}

export function parseTimeframeUnitAndValue(timeframe: string): ParsedTimeframe {
  const norm = String(timeframe).trim().toUpperCase();

  // 1. Ticks
  if (norm === 'T' || norm.startsWith('TICK') || (norm.endsWith('T') && /^\d+T$/.test(norm))) {
    const digits = norm.replace(/\D/g, '');
    return { unit: 'ticks', value: digits ? parseInt(digits, 10) : 1 };
  }

  // 2. Ranges
  if (norm === 'R' || norm.startsWith('RANGE') || (norm.endsWith('R') && /^\d+R$/.test(norm))) {
    const digits = norm.replace(/\D/g, '');
    return { unit: 'ranges', value: digits ? parseInt(digits, 10) : 1 };
  }

  // 3. Seconds (S1, 1S, S30, 30S, etc.)
  if (norm.startsWith('S') && /^[S]\d+$/.test(norm)) {
    return { unit: 'seconds', value: parseInt(norm.slice(1), 10) || 1 };
  }
  if (norm.endsWith('S') && /^\d+S$/.test(norm)) {
    return { unit: 'seconds', value: parseInt(norm.slice(0, -1), 10) || 1 };
  }

  // 4. Months (MN, MN1, 1MN, MONTH, MONTHLY)
  if (norm.startsWith('MN') || norm.startsWith('MONTH') || (norm === 'M' && timeframeToSeconds(norm) >= 2592000)) {
    const digits = norm.replace(/\D/g, '');
    return { unit: 'months', value: digits ? parseInt(digits, 10) : 1 };
  }
  if (norm.endsWith('MN')) {
    const digits = norm.slice(0, -2);
    return { unit: 'months', value: digits ? parseInt(digits, 10) : 1 };
  }

  // 5. Minutes (M1, 1M, M15, 15M, etc. - except MN/MONTH)
  if (norm.startsWith('M') && !norm.startsWith('MN') && !norm.startsWith('MONTH') && /^[M]\d+$/.test(norm)) {
    return { unit: 'minutes', value: parseInt(norm.slice(1), 10) || 1 };
  }
  if (norm.endsWith('M') && !norm.endsWith('MN') && /^\d+M$/.test(norm)) {
    return { unit: 'minutes', value: parseInt(norm.slice(0, -1), 10) || 1 };
  }

  // 6. Hours (H1, 1H, H4, 4H, etc.)
  if (norm.startsWith('H') && /^[H]\d+$/.test(norm)) {
    return { unit: 'hours', value: parseInt(norm.slice(1), 10) || 1 };
  }
  if (norm.endsWith('H') && /^\d+H$/.test(norm)) {
    return { unit: 'hours', value: parseInt(norm.slice(0, -1), 10) || 1 };
  }

  // 7. Days (D, D1, 1D, etc.)
  if (norm === 'D') {
    return { unit: 'days', value: 1 };
  }
  if (norm.startsWith('D') && /^[D]\d+$/.test(norm)) {
    return { unit: 'days', value: parseInt(norm.slice(1), 10) || 1 };
  }
  if (norm.endsWith('D') && /^\d+D$/.test(norm)) {
    return { unit: 'days', value: parseInt(norm.slice(0, -1), 10) || 1 };
  }

  // 8. Weeks (W, W1, 1W, etc.)
  if (norm === 'W') {
    return { unit: 'weeks', value: 1 };
  }
  if (norm.startsWith('W') && /^[W]\d+$/.test(norm)) {
    return { unit: 'weeks', value: parseInt(norm.slice(1), 10) || 1 };
  }
  if (norm.endsWith('W') && /^\d+W$/.test(norm)) {
    return { unit: 'weeks', value: parseInt(norm.slice(0, -1), 10) || 1 };
  }

  // Fallback: derive from timeframeToSeconds
  const sec = timeframeToSeconds(norm);
  if (sec < 60) {
    return { unit: 'seconds', value: Math.max(1, Math.round(sec)) };
  }
  if (sec < 3600) {
    return { unit: 'minutes', value: Math.max(1, Math.round(sec / 60)) };
  }
  if (sec < 86400) {
    return { unit: 'hours', value: Math.max(1, Math.round(sec / 3600)) };
  }
  if (sec < 604800) {
    return { unit: 'days', value: Math.max(1, Math.round(sec / 86400)) };
  }
  if (sec < 2592000) {
    return { unit: 'weeks', value: Math.max(1, Math.round(sec / 604800)) };
  }
  return { unit: 'months', value: Math.max(1, Math.round(sec / 2592000)) };
}

export function isIndicatorVisibleOnTimeframe(
  visibility: IndicatorVisibility | undefined,
  timeframe: string | undefined
): boolean {
  if (!visibility || !timeframe) return true;
  const parsed = parseTimeframeUnitAndValue(timeframe);
  const cfg = visibility[parsed.unit];

  if (cfg === undefined) return true;

  if (typeof cfg === 'boolean') {
    return cfg;
  }

  if (typeof cfg === 'object' && cfg !== null) {
    if (cfg.enabled === false) return false;
    const r = cfg as VisibilityRange;
    if (typeof r.min === 'number' && parsed.value < r.min) return false;
    if (typeof r.max === 'number' && parsed.value > r.max) return false;
    return true;
  }

  return true;
}

export interface BaseIndicatorConfig {
  id: string;
  type: IndicatorType;
  name: string;
  enabled: boolean;
  color: string;
  visibility?: IndicatorVisibility;
}

export interface EmaLineItem {
  id: string;
  name: string;
  enabled: boolean;
  period: number;
  source: 'close' | 'open' | 'high' | 'low';
  color: string;
  opacity?: number; // 0.1 to 1.0 (default 1.0)
  lineWidth: number; // 1, 2, 3, 4
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

export interface EmaIndicatorConfig extends BaseIndicatorConfig {
  type: 'EMA';
  period: number; // legacy fallback
  source: 'close' | 'open' | 'high' | 'low';
  lineWidth: number; // 1, 2, 3, 4
  emas?: EmaLineItem[];
}

export type RsiSource = 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4';

export interface RsiIndicatorConfig extends BaseIndicatorConfig {
  type: 'RSI';
  period: number; // default 14
  source: RsiSource;
  overbought: number; // default 70
  oversold: number; // default 30
  middle: number; // default 50
  bandColor?: string; // rgba for 30-70 zone
  lineWidth?: number; // 1, 2, 3
  calcDivergence?: boolean;
  maType?: 'SMA' | 'EMA' | 'RMA' | 'WMA' | 'None';
  maLength?: number;
  maColor?: string;
  bbStdDev?: number;
  timeframeMode?: string;
  waitForClose?: boolean;
  showMa?: boolean;
  showUpperBand?: boolean;
  showMiddleBand?: boolean;
  showLowerBand?: boolean;
  showBackgroundFill?: boolean;
}

export interface SessionItemConfig {
  id: string;
  name: string;
  enabled: boolean;
  startUtc: string; // e.g. "00:00"
  endUtc: string; // e.g. "09:00"
  bgColor: string; // rgba highlight or hex
  fillEnabled?: boolean; // default true
  opacity?: number; // 0.0 to 1.0 (default 0.15)
  showHighLow: boolean;
  highLowColor: string;
  borderOpacity?: number; // 0.0 to 1.0 (default 0.85)
}

export interface SessionsIndicatorConfig extends BaseIndicatorConfig {
  type: 'SESSIONS';
  sessions: SessionItemConfig[];
}

export interface KillzonesIndicatorConfig extends BaseIndicatorConfig {
  type: 'KILLZONES';
  sessions: SessionItemConfig[];
}

export interface MacrosIndicatorConfig extends BaseIndicatorConfig {
  type: 'MACROS';
  sessions: SessionItemConfig[];
}

export interface OpenLevelConfig {
  id: string;
  name: string;
  enabled: boolean;
  timeUtc: string; // e.g. "00:00", "07:00", "12:00"
  color: string;
  opacity?: number; // 0.1 to 1.0 (default 0.9)
  lineStyle: 'solid' | 'dashed' | 'dotted';
  lineWidth: number;
}

export interface SessionOpensIndicatorConfig extends BaseIndicatorConfig {
  type: 'SESSION_OPENS';
  opens: OpenLevelConfig[];
}

export interface QuartersIndicatorConfig extends BaseIndicatorConfig {
  type: 'QUARTERS';
  plotType: 'bottom_pane' | 'overlay';
  plotSize?: number; // default 2
  historicalCycles?: boolean;
  showLabels?: boolean;
  borderAuto?: boolean;
  borderColor?: string;
  q1Color?: string;
  q2Color?: string;
  q3Color?: string;
  q4Color?: string;
  showYearlyQuarters?: boolean;
  showMonthlyQuarters?: boolean;
  showWeeklyQuarters: boolean;
  showDailyQuarters: boolean;
  show90minCycles: boolean;
  showMicroCycles?: boolean;
}

export type IndicatorConfig =
  | EmaIndicatorConfig
  | RsiIndicatorConfig
  | SessionsIndicatorConfig
  | KillzonesIndicatorConfig
  | MacrosIndicatorConfig
  | SessionOpensIndicatorConfig
  | QuartersIndicatorConfig;

export interface IndicatorCategoryItem {
  type: IndicatorType;
  name: string;
  category: 'Trend' | 'Oscillator' | 'Smart Money / ICT' | 'Price Action';
  shortDesc: string;
  badge: string;
  author?: string;
  boost?: string;
  defaultConfig: IndicatorConfig;
}
