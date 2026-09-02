/**
 * Technical Indicators System — Types & Interfaces
 */

import { timeframeToSeconds } from '@/utils/dataResampler';

export type IndicatorType = 'EMA' | 'RSI' | 'SESSIONS' | 'KILLZONES' | 'MACROS' | 'SESSION_OPENS' | 'QUARTERS';

export interface IndicatorVisibility {
  seconds?: boolean;
  minutes?: boolean;
  hours?: boolean;
  days?: boolean;
  weeks?: boolean;
  months?: boolean;
}

export function isIndicatorVisibleOnTimeframe(
  visibility: IndicatorVisibility | undefined,
  timeframe: string | undefined
): boolean {
  if (!visibility || !timeframe) return true;
  const sec = timeframeToSeconds(timeframe);
  if (sec < 60) {
    return visibility.seconds !== false;
  }
  if (sec < 3600) {
    return visibility.minutes !== false;
  }
  if (sec < 86400) {
    return visibility.hours !== false;
  }
  if (sec < 604800) {
    return visibility.days !== false;
  }
  if (sec < 2592000) {
    return visibility.weeks !== false;
  }
  return visibility.months !== false;
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
