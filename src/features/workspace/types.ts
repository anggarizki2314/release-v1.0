/**
 * Workspace state types.
 * Stores all UI state that should persist across app restarts.
 *
 * SSOT hierarchy:
 *   panes[i].symbolId   → single authority for which symbol each pane shows
 *   panes[i].timeframe  → single authority for which timeframe each pane shows
 *   panes[i].viewport   → saved scroll/zoom state per pane
 *
 * Legacy fields (selectedSymbolId, chart.timeframe) have been removed.
 * There is no global chart symbol — only per-pane.
 */

export type LayoutMode = '1' | '2v' | '2h' | '3l' | '3r' | '3t' | '3b' | '4' | '6' | '8';

/** Per-pane viewport (logical candle range, nullable = not yet saved). */
export interface PaneViewport {
  from: number;
  to: number;
}

/** All state that belongs to one chart pane. */
export interface PaneConfig {
  paneId: string;
  symbolId: number | null;
  timeframe: string;
  viewport: PaneViewport | null;
}

/** Chart-area workspace (timezone only — symbol/tf live in panes[]). */
export interface WorkspaceChart {
  timezone: string;
}

export interface WorkspaceUI {
  activeTool: string;
  bottomPanelHeight: number;
  bottomPanelCollapsed: boolean;
  bottomPanelTab: string;
}

export interface WorkspaceDrawing {
  favorites: string[];
}

export interface WorkspaceState {
  /** All panes. Index 0 is always present (default single-chart). */
  panes: PaneConfig[];
  /** Which pane is currently focused / receives TopBar changes. */
  activePaneId: string;
  /** Current layout mode. */
  layoutMode: LayoutMode;
  /** Optional sync links */
  linkSymbol?: boolean;
  linkTimeframe?: boolean;
  syncCrosshair?: boolean;
  chart: WorkspaceChart;
  ui: WorkspaceUI;
  drawing: WorkspaceDrawing;
}
