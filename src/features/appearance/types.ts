/**
 * Theme system types.
 *
 * ThemeObject contains both application-level colors and chart-level colors.
 * WorkspaceManager stores all workspace state separately.
 */

// ─── Application Colors ────────────────────────────────────────────

export interface ThemeApp {
  background: string;
  sidebar: string;
  toolbar: string;
  panel: string;
  popup: string;
  border: string;
  shadow: string;
  hover: string;
  accent: string;
}

export interface ThemeButton {
  primary: string;
  primaryText: string;
  secondary: string;
  secondaryText: string;
}

export interface ThemeText {
  primary: string;
  secondary: string;
  muted: string;
}

// ─── Chart Colors ──────────────────────────────────────────────────

export interface ThemeChart {
  background: string;
  backgroundGradientFrom: string;
  backgroundGradientTo: string;
  useGradient: boolean;
}

export interface ThemeCandle {
  bull: { body: string; border: string; wick: string };
  bear: { body: string; border: string; wick: string };
}

export interface ThemeGrid {
  visible: boolean;
  color: string;
  opacity: number;
}

export interface ThemeCrosshair {
  visible: boolean;
  color: string;
  style: 'solid' | 'dashed';
  width: number;
}

export interface ThemeScale {
  text: string;
  background: string;
  border: string;
}

export interface ThemeWatermark {
  showSymbol: boolean;
  showTimeframe: boolean;
  color: string;
  opacity: number;
}

export interface ThemeSession {
  visible: boolean;
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
}

export interface ThemeChartBorder {
  visible: boolean;
  color: string;
  opacity: number;
}

// ─── Combined Theme ────────────────────────────────────────────────

export interface ThemeObject {
  app: ThemeApp;
  button: ThemeButton;
  text: ThemeText;
  chart: ThemeChart;
  candle: ThemeCandle;
  grid: ThemeGrid;
  crosshair: ThemeCrosshair;
  scale: { price: ThemeScale; time: ThemeScale };
  watermark: ThemeWatermark;
  session: ThemeSession;
  border: ThemeChartBorder;
}

export interface ThemePreset {
  id: string;
  name: string;
  theme: ThemeObject;
}

export interface SavedTheme {
  id: string;
  name: string;
  theme: ThemeObject;
  createdAt: number;
}

// ─── Workspace State ───────────────────────────────────────────────

export interface WorkspaceState {
  chart: {
    selectedSymbolId: number | null;
    timeframe: string;
    timezone: string;
  };
  ui: {
    activeTool: string;
    bottomPanelHeight: number;
    bottomPanelCollapsed: boolean;
    appearanceOpen: boolean;
    bottomPanelTab: string;
  };
  drawing: {
    favorites: string[];
  };
}
