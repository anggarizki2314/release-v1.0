import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import type { WorkspaceState, PaneConfig, LayoutMode, PaneViewport } from './types';
import { switchSessionIndicators } from '@features/indicators';

const STORAGE_PREFIX = 'fxreplay:workspace:session:';
const GLOBAL_STORAGE_KEY = 'fxreplay:workspace:v2';

function getWorkspaceStorageKey(sessionId?: string | null): string {
  if (sessionId && typeof sessionId === 'string' && sessionId.trim().length > 0) {
    return `${STORAGE_PREFIX}${sessionId.trim()}`;
  }
  return GLOBAL_STORAGE_KEY;
}

// ─── Default pane ─────────────────────────────────────────────────

const DEFAULT_PANES: PaneConfig[] = Array.from({ length: 8 }, (_, i) => ({
  paneId: `pane-${i}`,
  symbolId: null,
  timeframe: 'M15',
  viewport: null,
}));

export function createDefaultWorkspace(
  defaultSymbolId: number | null = null,
  defaultTimeframe: string = 'M15'
): WorkspaceState {
  const panes: PaneConfig[] = Array.from({ length: 8 }, (_, i) => ({
    paneId: `pane-${i}`,
    symbolId: i === 0 ? defaultSymbolId : null,
    timeframe: (i === 0 && defaultTimeframe) ? defaultTimeframe : 'M15',
    viewport: null,
  }));

  return {
    panes,
    activePaneId: 'pane-0',
    layoutMode: '1',
    syncCrosshair: true,
    chart: { timezone: 'UTC' },
    ui: { activeTool: 'crosshair', bottomPanelHeight: 220, bottomPanelCollapsed: false, bottomPanelTab: 'data' },
    drawing: { favorites: [] },
  };
}

const DEFAULT_WORKSPACE: WorkspaceState = createDefaultWorkspace();

// ─── Load / Save ───────────────────────────────────────────────────

function migrateLegacy(raw: any, defaultSymbolId: number | null = null, defaultTimeframe = 'M15'): WorkspaceState {
  const def = createDefaultWorkspace(defaultSymbolId, defaultTimeframe);
  const result: WorkspaceState = { ...def };

  if (raw.chart) {
    result.chart = { timezone: raw.chart.timezone ?? 'UTC' };
  }
  if (raw.ui) {
    result.ui = { ...def.ui, ...raw.ui };
  }
  if (raw.drawing) {
    result.drawing = { ...def.drawing, ...raw.drawing };
  }

  // Ensure all 8 panes exist so switching layout modes never deletes pane configs
  const loadedPanes = Array.isArray(raw.panes) ? raw.panes : [];
  const panes: PaneConfig[] = def.panes.map((defPane, i) => {
    if (loadedPanes[i]) {
      return {
        ...defPane,
        ...loadedPanes[i],
        paneId: `pane-${i}`,
      };
    }
    return { ...defPane };
  });

  result.panes = panes;
  result.activePaneId = raw.activePaneId ?? 'pane-0';
  result.layoutMode = raw.layoutMode ?? '1';

  return result;
}

export function loadSessionWorkspace(sessionId?: string | null): WorkspaceState | null {
  try {
    const key = getWorkspaceStorageKey(sessionId);
    const raw = localStorage.getItem(key);
    if (raw) return migrateLegacy(JSON.parse(raw));

    if (!sessionId) {
      const oldRaw = localStorage.getItem('fxreplay:workspace');
      if (oldRaw) {
        return migrateLegacy(JSON.parse(oldRaw));
      }
    }
  } catch {}
  return null;
}

export function saveSessionWorkspace(state: WorkspaceState, sessionId?: string | null) {
  try {
    const key = getWorkspaceStorageKey(sessionId);
    localStorage.setItem(key, JSON.stringify(state));
  } catch {}
}

// ─── Context ───────────────────────────────────────────────────────

export interface WorkspaceContextType {
  workspace: WorkspaceState;
  /** Update the active pane's symbolId. */
  updatePaneSymbol: (paneId: string, symbolId: number | null, timeframe?: string) => void;
  /** Update the active pane's timeframe. */
  updatePaneTimeframe: (paneId: string, timeframe: string) => void;
  /** Update a pane's saved viewport. */
  updatePaneViewport: (paneId: string, viewport: PaneViewport | null) => void;
  /** Switch which pane is active (receives TopBar changes). */
  setActivePaneId: (paneId: string) => void;
  /** Change the layout mode. */
  setLayoutMode: (mode: LayoutMode, defaultSymbolId?: number | null, defaultTimeframe?: string) => void;
  /** Toggle Link Symbol across panes */
  toggleLinkSymbol: () => void;
  /** Toggle Link Timeframe across panes */
  toggleLinkTimeframe: () => void;
  /** Toggle Crosshair Sync across panes */
  toggleSyncCrosshair: () => void;
  /** Update chart-level config (timezone). */
  updateChart: (patch: Partial<WorkspaceState['chart']>) => void;
  updateUI: (patch: Partial<WorkspaceState['ui']>) => void;
  updateDrawing: (patch: Partial<WorkspaceState['drawing']>) => void;
  resetWorkspace: () => void;
  /** Switch or initialize session workspace cleanly */
  switchSessionWorkspace: (sessionId: string | null, isNew: boolean, defaultSymbolId?: number | null, defaultTimeframe?: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

// ─── Provider ──────────────────────────────────────────────────────

/** Number of panes visible in each layout mode. */
export const PANE_COUNT: Record<LayoutMode, number> = {
  '1': 1,
  '2v': 2,
  '2h': 2,
  '3l': 3,
  '3r': 3,
  '3t': 4,
  '3b': 4,
  '4': 4,
  '6': 6,
  '8': 8,
};

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<WorkspaceState>(() => loadSessionWorkspace(null) ?? DEFAULT_WORKSPACE);
  const currentSessionIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save debounced per active session
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveSessionWorkspace(workspace, currentSessionIdRef.current);
    }, 300);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [workspace]);

  const switchSessionWorkspace = useCallback((
    sessionId: string | null,
    isNew: boolean,
    defaultSymbolId: number | null = null,
    defaultTimeframe = 'M15'
  ) => {
    currentSessionIdRef.current = sessionId;
    switchSessionIndicators(sessionId, isNew);
    if (!sessionId) {
      const fallback = loadSessionWorkspace(null) ?? createDefaultWorkspace(defaultSymbolId, defaultTimeframe);
      setWorkspace(fallback);
      return;
    }

    if (isNew) {
      // 1. BRAND NEW SESSION: ALWAYS initialize fresh default 1-layout state!
      const fresh = createDefaultWorkspace(defaultSymbolId, defaultTimeframe);
      saveSessionWorkspace(fresh, sessionId);
      setWorkspace(fresh);
      console.log('[WorkspaceManager] Initialized fresh 1-layout workspace for new session:', sessionId);
    } else {
      // 2. RESUME EXISTING SESSION: restore persisted layout state for this sessionId if available
      const existing = loadSessionWorkspace(sessionId);
      const targetTf = 'M3';
      if (existing) {
        const updatedPanes = existing.panes.map((p) => ({
          ...p,
          timeframe: targetTf,
        }));
        const updated = { ...existing, panes: updatedPanes };
        setWorkspace(updated);
        console.log('[WorkspaceManager] Restored existing workspace for session with timeframe M3:', sessionId);
      } else {
        const fresh = createDefaultWorkspace(defaultSymbolId, targetTf);
        saveSessionWorkspace(fresh, sessionId);
        setWorkspace(fresh);
        console.log('[WorkspaceManager] Initialized default workspace for session without saved layout:', sessionId);
      }
    }
  }, []);

  // ── Pane helpers ──────────────────────────────────────────────────

  const updatePaneSymbol = useCallback((paneId: string, symbolId: number | null, timeframe?: string) => {
    setWorkspace((prev) => ({
      ...prev,
      panes: prev.panes.map((p) =>
        (prev.linkSymbol || p.paneId === paneId)
          ? { ...p, symbolId, ...(timeframe ? { timeframe } : {}) }
          : p
      ),
    }));
  }, []);

  const updatePaneTimeframe = useCallback((paneId: string, timeframe: string) => {
    setWorkspace((prev) => ({
      ...prev,
      panes: prev.panes.map((p) => (prev.linkTimeframe || p.paneId === paneId) ? { ...p, timeframe } : p),
    }));
  }, []);

  const updatePaneViewport = useCallback((paneId: string, viewport: PaneViewport | null) => {
    setWorkspace((prev) => ({
      ...prev,
      panes: prev.panes.map((p) => p.paneId === paneId ? { ...p, viewport } : p),
    }));
  }, []);

  const setActivePaneId = useCallback((paneId: string) => {
    setWorkspace((prev) => ({ ...prev, activePaneId: paneId }));
  }, []);

  const toggleLinkSymbol = useCallback(() => {
    setWorkspace((prev) => ({ ...prev, linkSymbol: !prev.linkSymbol }));
  }, []);

  const toggleLinkTimeframe = useCallback(() => {
    setWorkspace((prev) => ({ ...prev, linkTimeframe: !prev.linkTimeframe }));
  }, []);

  const toggleSyncCrosshair = useCallback(() => {
    setWorkspace((prev) => ({ ...prev, syncCrosshair: !prev.syncCrosshair }));
  }, []);

  const setLayoutMode = useCallback((
    mode: LayoutMode,
    defaultSymbolId: number | null = null,
    defaultTimeframe = 'M15'
  ) => {
    setWorkspace((prev) => {
      // Keep all 8 pre-allocated panes intact so switching layout modes never deletes pane configs.
      const panes = prev.panes.map((p) => {
        if (p.symbolId === null && defaultSymbolId !== null) {
          return { ...p, symbolId: defaultSymbolId, timeframe: defaultTimeframe };
        }
        return p;
      });

      return {
        ...prev,
        layoutMode: mode,
        panes,
      };
    });
  }, []);

  // ── Chart / UI / Drawing ──────────────────────────────────────────

  const updateChart = useCallback((patch: Partial<WorkspaceState['chart']>) => {
    setWorkspace((prev) => ({ ...prev, chart: { ...prev.chart, ...patch } }));
  }, []);

  const updateUI = useCallback((patch: Partial<WorkspaceState['ui']>) => {
    setWorkspace((prev) => ({ ...prev, ui: { ...prev.ui, ...patch } }));
  }, []);

  const updateDrawing = useCallback((patch: Partial<WorkspaceState['drawing']>) => {
    setWorkspace((prev) => ({ ...prev, drawing: { ...prev.drawing, ...patch } }));
  }, []);

  const resetWorkspace = useCallback(() => {
    setWorkspace({ ...DEFAULT_WORKSPACE, panes: DEFAULT_PANES });
  }, []);

  const value: WorkspaceContextType = {
    workspace,
    updatePaneSymbol,
    updatePaneTimeframe,
    updatePaneViewport,
    setActivePaneId,
    setLayoutMode,
    toggleLinkSymbol,
    toggleLinkTimeframe,
    toggleSyncCrosshair,
    updateChart,
    updateUI,
    updateDrawing,
    resetWorkspace,
    switchSessionWorkspace,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

// ─── Hook ──────────────────────────────────────────────────────────

export function useWorkspace(): WorkspaceContextType {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be inside WorkspaceProvider');
  return ctx;
}
