/**
 * Trading Engine 2.0 — ActiveChartBridge
 * Single Source of Truth bridge for active pane chart state.
 * Bridges Workspace -> Active Pane -> Pane State -> Chart State -> Trading UI / Popup.
 * Stores zero default pairs or hardcoded symbols.
 */

export interface ActiveChartState {
  paneId: string;
  symbol: string;
  timeframe: string;
  currentReplayPrice: number;
  currentReplayTime: number;
  currentReplayIndex?: number;
}

class ActiveChartBridgeService {
  private static instance: ActiveChartBridgeService | null = null;
  private registry = new Map<string, ActiveChartState>();
  private listeners = new Set<() => void>();

  public static getInstance(): ActiveChartBridgeService {
    if (!ActiveChartBridgeService.instance) {
      ActiveChartBridgeService.instance = new ActiveChartBridgeService();
    }
    return ActiveChartBridgeService.instance;
  }

  /**
   * Registers or updates the live chart state for a specific pane ID.
   */
  public registerChartState(state: ActiveChartState): void {
    if (!state.symbol || !state.paneId) return;
    this.registry.set(state.paneId, { ...state });
    this.notifyListeners();
  }

  /**
   * Retrieves the live chart state for a given pane ID, or the first active pane if not specified.
   */
  public getChartState(paneId?: string): ActiveChartState | undefined {
    if (paneId && this.registry.has(paneId)) return this.registry.get(paneId);
    return this.registry.values().next().value;
  }

  /**
   * Retrieves the live chart state strictly matching a given symbol name.
   */
  public getChartStateBySymbol(symbol: string): ActiveChartState | undefined {
    if (!symbol) return undefined;
    const clean = symbol.trim().toUpperCase();
    for (const state of this.registry.values()) {
      if (state.symbol && state.symbol.trim().toUpperCase() === clean) {
        return state;
      }
    }
    return undefined;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('[ActiveChartBridge] Listener error:', err);
      }
    });
  }
}

export const activeChartBridge = ActiveChartBridgeService.getInstance();
