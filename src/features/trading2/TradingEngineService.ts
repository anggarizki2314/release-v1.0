/**
 * Trading Engine 2.0 — TradingEngineService
 * Central Service Singleton for Trading Engine 2.0.
 * Orchestrates TradingStore, OrderManager, PositionManager, AccountManager, HistoryManager, ExecutionEngine, and OrderExecutionBridge.
 * Enforces strict Architecture Flow: UI -> Command -> OrderManager -> TradingStore -> ExecutionEngine -> PositionManager -> HistoryManager.
 */

import { createTradingStore } from './store/TradingStoreFactory';
import { RiskManager } from './risk/RiskManager';
import { AccountManager } from './account/AccountManager';
import { OrderManager } from './order/OrderManager';
import { PositionManager } from './position/PositionManager';
import { HistoryManager } from './history/HistoryManager';
import { ExecutionEngine } from './execution/ExecutionEngine';
import { ReplayAdapter } from './replay/ReplayAdapter';
import { ReplaySnapshotManager } from './replay/ReplaySnapshotManager';
import { OrderExecutionBridge } from './integration/OrderExecutionBridge';
import { activeChartBridge } from './integration/ActiveChartBridge';

import { TradingStoreSelectors } from './store/TradingStoreSelectors';
import { ClosedPositionRepository } from './repository/ClosedPositionRepository';
import { saveTradingState, loadTradingState, loadTradingStateSync } from '../backtest/sessionRepository';
import { AccountEngine } from './account/AccountEngine';
import { ChallengeEngine } from './challenge/ChallengeEngine';
import { InstrumentMetadata } from './instrument/InstrumentMetadata';
import { PriceComparator } from './execution/PriceComparator';
import type { ChallengeRules, ChallengeMode } from './challenge/ChallengeTypes';
import type { CreateOrderParams, OrderModel } from './order/OrderTypes';
import type { PositionModel, ModifyPositionParams } from './position/PositionTypes';

export class TradingEngineService {
  private static instance: TradingEngineService | null = null;
  private activeSessionId: string | null = null;

  public store = createTradingStore();
  public accountManager = new AccountManager(this.store);
  public riskManager = new RiskManager(this.store, this.accountManager);
  public orderManager = new OrderManager(this.store, this.riskManager);
  public positionManager = new PositionManager(this.store, this.accountManager, this.orderManager);
  public closedPositionRepository = new ClosedPositionRepository(this.positionManager);
  public accountEngine = new AccountEngine(this.positionManager, this.closedPositionRepository);
  public challengeEngine = new ChallengeEngine(this.accountEngine, this.closedPositionRepository);
  public historyManager = new HistoryManager(this.store);

  public executionEngine = new ExecutionEngine(
    this.store,
    this.orderManager,
    this.positionManager,
    this.accountManager,
    this.historyManager
  );

  public bridge = new OrderExecutionBridge(
    this.orderManager,
    this.executionEngine,
    this.positionManager
  );

  public replayAdapter = new ReplayAdapter(this.executionEngine);
  public snapshotManager = new ReplaySnapshotManager(this.store);

  private listeners: Set<() => void> = new Set();

  constructor() {
    // Subscribe to store updates to notify UI listeners and auto-persist state changes
    this.store.subscribe('OrderAdded', () => {
      this.persistTradingState();
      this.notifyListeners();
    });
    this.store.subscribe('OrderUpdated', () => {
      this.persistTradingState();
      this.notifyListeners();
    });
    this.store.subscribe('OrderRemoved', () => {
      this.persistTradingState();
      this.notifyListeners();
    });
    this.store.subscribe('PositionAdded', () => {
      this.persistTradingState();
      this.notifyListeners();
    });
    this.store.subscribe('PositionUpdated', () => {
      this.notifyListeners();
    });
    this.store.subscribe('PositionRemoved', () => {
      this.persistTradingState();
      this.notifyListeners();
    });
    this.store.subscribe('HistoryAdded', () => {
      this.persistTradingState();
      this.notifyListeners();
    });
    this.store.subscribe('StoreReset', () => this.notifyListeners());
    this.store.subscribe('SnapshotLoaded', () => this.notifyListeners());

    this.executionEngine.on('OrderFilled', () => {
      this.persistTradingState();
      this.notifyListeners();
    });
    this.executionEngine.on('PositionOpened', () => {
      this.persistTradingState();
      this.notifyListeners();
    });
    this.executionEngine.on('PositionClosed', () => {
      this.persistTradingState();
      this.notifyListeners();
    });
    this.executionEngine.on('StopLossHit', () => {
      this.persistTradingState();
      this.notifyListeners();
    });
    this.executionEngine.on('TakeProfitHit', () => {
      this.persistTradingState();
      this.notifyListeners();
    });
  }

  public persistTradingState(): void {
    if (this.activeSessionId) {
      const snapshot = TradingStoreSelectors.getSnapshot(this.store.getSchemaRaw());
      saveTradingState(this.activeSessionId, snapshot);
    }
  }

  /**
   * Centralized Trading Engine state mutation boundary.
   * Called whenever user creates/cancels orders or modifies positions.
   * Invalidates any snapshots after currentReplayIndex to establish a new replay branch.
   */
  public onTradingStateMutation(currentIndex?: number): void {
    const bridgeState = activeChartBridge.getChartState();
    const effectiveIdx = currentIndex ?? bridgeState?.currentReplayIndex;
    if (effectiveIdx !== undefined) {
      this.snapshotManager.invalidateAfter(effectiveIdx);
    }
    this.persistTradingState();
    this.notifyListeners();
  }

  public static getInstance(): TradingEngineService {
    if (!TradingEngineService.instance) {
      TradingEngineService.instance = new TradingEngineService();
    }
    return TradingEngineService.instance;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('[TradingEngineService] Listener error:', err);
      }
    });
  }

  /**
   * Initializes or resets TradingEngine for an active Session's initialBalance, mode, & challenge rules.
   * Hydrates from saved trading state (SQLite authoritative) if available.
   */
  public async initializeSession(session: {
    id?: string;
    initialBalance: number;
    currency?: string;
    leverage?: number;
    mode?: ChallengeMode;
    challengeRules?: Partial<ChallengeRules>;
  }): Promise<void> {
    if (!session || typeof session.initialBalance !== 'number') return;
    const initialBal = session.initialBalance;
    const curr = session.currency ?? 'USD';
    const lev = session.leverage ?? 100;
    const mode: ChallengeMode = session.mode ?? 'NORMAL';

    this.activeSessionId = session.id ?? null;

    console.log('[TRADING-HYDRATION-BEGIN]', { sessionId: session.id });

    let loadedState: any = null;
    if (session.id) {
      // 1. Authoritative SQLite hydration via IPC
      loadedState = await loadTradingState(session.id);
      // 2. Synchronous cache fallback
      if (!loadedState) {
        loadedState = loadTradingStateSync(session.id);
      }
    }

    console.log('[TRADING-HYDRATION-SQLITE]', {
      sessionId: session.id,
      hasState: !!loadedState,
      payloadLength: loadedState ? JSON.stringify(loadedState).length : 0,
    });

    console.log('[FORENSIC-INIT-STEP]', {
      step: 'START_INITIALIZATION',
      sessionId: session.id,
      positionsCount: this.store.getPositions().length,
      historyCount: this.store.getHistory().length,
      positionIds: this.store.getPositions().map((p) => p.positionId),
    });

    if (loadedState && loadedState.schema) {
      // ENFORCE INVARIANT: A position that is in history or whose status is CLOSED must NEVER be in schema.positions
      if (loadedState.schema.positions && loadedState.schema.history) {
        const closedPositionIds = new Set(
          loadedState.schema.history.map((h: any) => h.positionId).filter(Boolean)
        );
        loadedState.schema.positions = loadedState.schema.positions.filter(
          (p: any) => (p.status === 'OPEN' || !p.status) && !closedPositionIds.has(p.positionId)
        );
      }

      console.log('[FORENSIC-INIT-STEP]', {
        step: 'LOAD_PERSISTED_STATE',
        sessionId: session.id,
        positionsCount: loadedState.schema?.positions?.length ?? 0,
        historyCount: loadedState.schema?.history?.length ?? 0,
        positionIds: (loadedState.schema?.positions ?? []).map((p: any) => p.positionId),
      });

      console.log('[HYDRATION-AUDIT-BEFORE-LOADSNAPSHOT]', {
        positionsCount: loadedState.schema?.positions?.length ?? 0,
        positionIds: (loadedState.schema?.positions ?? []).map((p: any) => p.id || p.positionId),
        historyCount: loadedState.schema?.history?.length ?? 0,
        historyTradeIds: (loadedState.schema?.history ?? []).map((h: any) => h.tradeId),
      });

      // Log order restoration
      if (loadedState.schema.orders) {
        for (const o of loadedState.schema.orders) {
          console.log('[ORDER-RESTORE]', {
            orderId: o.orderId,
            positionId: o.positionId ?? null,
            symbol: o.symbol,
            status: o.status,
            type: o.type,
          });
        }
      }

      this.store.loadSnapshot(loadedState);

      console.log('[FORENSIC-INIT-STEP]', {
        step: 'LOAD_SNAPSHOT',
        sessionId: session.id,
        positionsCount: this.store.getPositions().length,
        historyCount: this.store.getHistory().length,
        positionIds: this.store.getPositions().map((p) => p.positionId),
      });

      console.log('[HYDRATION-AUDIT-AFTER-LOADSNAPSHOT]', {
        positionsCount: this.store.getPositions().length,
        positionIds: this.store.getPositions().map((p) => p.positionId),
        historyCount: this.store.getHistory().length,
        historyTradeIds: this.store.getHistory().map((h) => h.tradeId),
      });

      if (loadedState.schema.history) {
        this.closedPositionRepository.clear();
        for (const h of loadedState.schema.history) {
          this.closedPositionRepository.addClosedPositionRecord({
            positionId: h.positionId,
            orderId: h.tradeId ?? `TRD-${h.positionId}`,
            symbol: h.symbol,
            direction: h.direction,
            volume: h.volume,
            entryPrice: h.entryPrice,
            exitPrice: h.exitPrice,
            stopLoss: h.stopLoss ?? null,
            takeProfit: h.takeProfit ?? null,
            floatingPnL: 0,
            realizedPnL: h.profit,
            commission: h.commission ?? 0,
            swap: h.swap ?? 0,
            openedAt: h.openedAt,
            closedAt: h.closedAt,
            comment: h.comment ?? null,
            magicNumber: h.magicNumber ?? null,
          });
        }
      }

      console.log('[FORENSIC-INIT-STEP]', {
        step: 'RESTORE_CLOSED_POSITION_REPO',
        sessionId: session.id,
        positionsCount: this.store.getPositions().length,
        historyCount: this.store.getHistory().length,
        positionIds: this.store.getPositions().map((p) => p.positionId),
      });

      this.accountManager.setInitialDeposit(initialBal);
      this.accountEngine.initializeSession(initialBal, curr, lev);
      this.challengeEngine.initializeSession(mode, {
        initialBalance: initialBal,
        currency: curr,
        leverage: lev,
        ...session.challengeRules,
      });

      // Forensic consistency check: Active positions vs closed history invariant
      const activePositions = this.store.getPositions();
      const historyTrades = this.store.getHistory();
      for (const ht of historyTrades) {
        const dualActive = activePositions.find((p) => p.positionId === ht.positionId);
        if (dualActive) {
          console.log('[FORENSIC-INVALID-DUAL-STATE]', {
            positionId: ht.positionId,
            historyTrade: ht,
            activePosition: dualActive,
          });
        }
      }

      console.log('[TRADING-HYDRATION-RESTORED]', {
        sessionId: session.id,
        historyCount: loadedState.schema.history?.length ?? 0,
        positionCount: loadedState.schema.positions?.length ?? 0,
        pendingOrderCount: loadedState.schema.orders?.length ?? 0,
        balance: loadedState.schema.account?.balance ?? initialBal,
        tradeIds: loadedState.schema.history?.map((h: any) => h.tradeId) ?? [],
      });

      console.log('[TRADING-HYDRATION-COMPLETE]', {
        sessionId: session.id,
        historyCount: loadedState.schema.history?.length ?? 0,
        positionCount: loadedState.schema.positions?.length ?? 0,
      });
    } else {
      console.log('[TRADING-HYDRATION-FRESH-SESSION]', {
        sessionId: session.id,
        reason: 'no SQLite trading_state_json',
      });

      this.store.resetStore();
      this.snapshotManager.clear();
      this.store.updateAccount({
        balance: initialBal,
        equity: initialBal,
        freeMargin: initialBal,
        currency: curr,
        leverage: lev,
      });
      this.positionManager.reset();
      this.closedPositionRepository.clear();
      this.accountManager.initialize(initialBal, curr, lev);
      this.accountEngine.initializeSession(initialBal, curr, lev);
      this.challengeEngine.initializeSession(mode, {
        initialBalance: initialBal,
        currency: curr,
        leverage: lev,
        ...session.challengeRules,
      });
    }

    console.log('[FORENSIC-INIT-STEP]', {
      step: 'FINISH_INITIALIZATION',
      sessionId: session.id,
      positionsCount: this.store.getPositions().length,
      historyCount: this.store.getHistory().length,
      positionIds: this.store.getPositions().map((p) => p.positionId),
    });

    console.log('[HYDRATION-AUDIT-INITIALIZE-COMPLETE]', {
      sessionId: session.id,
      positionsCount: this.store.getPositions().length,
      positionIds: this.store.getPositions().map((p) => p.positionId),
      historyCount: this.store.getHistory().length,
      historyTradeIds: this.store.getHistory().map((h) => h.tradeId),
    });

    this.notifyListeners();
  }

  /**
   * Places an order from UI via OrderExecutionBridge
   */
  public placeOrder(cmd: CreateOrderParams, now?: number, currentReplayIndex?: number) {
    const bridgeState = activeChartBridge.getChartStateBySymbol(cmd.symbol) ?? activeChartBridge.getChartState();
    const replayNow = bridgeState?.currentReplayTime ? bridgeState.currentReplayTime * 1000 : null;
    const effectiveNow = now ?? replayNow ?? Date.now();

    if (cmd.type.includes('MARKET') && (!cmd.entryPrice || cmd.entryPrice <= 0)) {
      if (bridgeState && bridgeState.symbol && bridgeState.symbol.toUpperCase() === cmd.symbol.toUpperCase() && bridgeState.currentReplayPrice > 0) {
        cmd.entryPrice = bridgeState.currentReplayPrice;
      }
    }

    const result = this.bridge.executeOrderCommand(cmd, effectiveNow);
    this.onTradingStateMutation(currentReplayIndex);
    return result;
  }

  /**
   * Process market candle tick from Replay Loop
   */
  public processTick(
    symbol: string,
    open: number,
    high: number,
    low: number,
    close: number,
    timestamp: number
  ) {
    const summary = this.executionEngine.processMarketTick({
      symbol,
      open,
      high,
      low,
      close,
      bid: close,
      ask: close,
      timestamp,
    });
    if (summary.positionsClosed > 0 || summary.ordersFilled > 0) {
      this.persistTradingState();
    }
    this.notifyListeners();
    return summary;
  }

  /**
   * Cancels a pending order by ID (or closes position if positionId passed)
   */
  public cancelOrder(orderId: string, now?: number, currentReplayIndex?: number) {
    const order = this.orderManager.getOrder(orderId);
    const pos = this.positionManager.getPosition(orderId) ||
      this.positionManager.getOpenPositions().find((p) => p.orderId === orderId || p.positionId === orderId);
    const targetSymbol = order?.symbol ?? pos?.symbol;

    const bridgeState = targetSymbol ? activeChartBridge.getChartStateBySymbol(targetSymbol) : activeChartBridge.getChartState();
    const replayNow = bridgeState?.currentReplayTime ? bridgeState.currentReplayTime * 1000 : null;
    const effectiveNow = now ?? replayNow ?? Date.now();
    const effectiveReplayIdx = currentReplayIndex ?? bridgeState?.currentReplayIndex;

    let res = this.orderManager.cancelOrder(orderId, 'User Cancelled', effectiveNow);
    if (!res && pos) {
      this.closePosition(pos.positionId, undefined, effectiveNow, effectiveReplayIdx);
    }

    this.onTradingStateMutation(effectiveReplayIdx);
    return res;
  }


  /**
   * Closes an open position manually by ID
   */
  public closePosition(positionId: string, exitPrice?: number, now?: number, currentReplayIndex?: number) {
    const pos = this.positionManager.getPosition(positionId) ||
      this.positionManager.getOpenPositions().find((p) => p.positionId === positionId || p.orderId === positionId);

    if (!pos) {
      console.warn('[TradingEngineService] closePosition: Position not found for ID', positionId);
      return undefined;
    }

    const bridgeState = activeChartBridge.getChartStateBySymbol(pos.symbol);
    const replayNow = bridgeState?.currentReplayTime ? bridgeState.currentReplayTime * 1000 : null;
    const effectiveNow = now ?? replayNow ?? Date.now();

    const actualExitPrice = (exitPrice !== undefined && exitPrice !== null && exitPrice > 0)
      ? exitPrice
      : (bridgeState && bridgeState.symbol && bridgeState.symbol.toUpperCase() === pos.symbol.toUpperCase() && bridgeState.currentReplayPrice > 0)
        ? bridgeState.currentReplayPrice
        : (pos.currentPrice > 0 ? pos.currentPrice : pos.entryPrice);

    const res = this.positionManager.closePosition(pos.positionId, actualExitPrice, effectiveNow);
    if (res) {
      const realizedPnL = this.closedPositionRepository.calculateRealizedPnL(res);
      this.accountManager.applyRealizedPnL(realizedPnL);
      this.historyManager.addHistory({
        tradeId: `TRD-${effectiveNow}-${res.positionId}`,
        positionId: res.positionId,
        orderId: res.orderId,
        symbol: res.symbol,
        direction: res.direction,
        volume: res.volume,
        entryPrice: res.entryPrice,
        exitPrice: actualExitPrice,
        stopLoss: res.stopLoss,
        takeProfit: res.takeProfit,
        realizedPnL: realizedPnL,
        commission: res.commission,
        swap: res.swap,
        comment: res.comment,
        magicNumber: res.magicNumber,
        openedAt: res.openedAt,
        closedAt: effectiveNow,
        closeReason: 'MANUAL',
        screenshots: res.screenshots,
      });
      this.onTradingStateMutation(currentReplayIndex);
    } else {
      this.notifyListeners();
    }
    return res;
  }

  /**
   * Modifies an order or position parameters (Volume, Entry Price, SL, TP)
   */
  public modifyOrder(orderId: string, updates: Partial<OrderModel>, now?: number, currentReplayIndex?: number) {
    const order = this.orderManager.getOrder(orderId);
    const pos = this.positionManager.getPosition(orderId) ||
      this.positionManager.getOpenPositions().find((p) => p.orderId === orderId || p.positionId === orderId);
    const targetSymbol = order?.symbol ?? pos?.symbol;

    const bridgeState = targetSymbol ? activeChartBridge.getChartStateBySymbol(targetSymbol) : activeChartBridge.getChartState();
    const replayNow = bridgeState?.currentReplayTime ? bridgeState.currentReplayTime * 1000 : null;
    const effectiveNow = now ?? replayNow ?? Date.now();

    if (order) {
      this.orderManager.updateOrder(orderId, updates, effectiveNow);
    }

    if (pos && pos.status !== 'CLOSED') {
      this.positionManager.modifyPosition({
        positionId: pos.positionId,
        volume: updates.volume,
        stopLoss: updates.stopLoss,
        takeProfit: updates.takeProfit,
        comment: updates.comment,
      }, effectiveNow);

      if (pos.orderId && pos.orderId !== orderId) {
        this.orderManager.updateOrder(pos.orderId, updates, effectiveNow);
      }
    }

    this.onTradingStateMutation(currentReplayIndex);
  }

  /**
   * Modifies an active position directly and syncs linked order
   */
  public modifyPosition(params: ModifyPositionParams, now?: number, currentReplayIndex?: number) {
    const pos = this.positionManager.getPosition(params.positionId) ||
      this.positionManager.getOpenPositions().find((p) => p.orderId === params.positionId || p.positionId === params.positionId);

    if (!pos) return undefined;

    const bridgeState = activeChartBridge.getChartStateBySymbol(pos.symbol);
    const replayNow = bridgeState?.currentReplayTime ? bridgeState.currentReplayTime * 1000 : null;
    const effectiveNow = now ?? replayNow ?? Date.now();

    const res = this.positionManager.modifyPosition({
      ...params,
      positionId: pos.positionId,
    }, effectiveNow);

    if (pos.orderId) {
      this.orderManager.updateOrder(pos.orderId, {
        volume: params.volume,
        stopLoss: params.stopLoss,
        takeProfit: params.takeProfit,
        comment: params.comment,
      }, effectiveNow);
    }

    if (bridgeState && bridgeState.symbol && bridgeState.symbol.toUpperCase() === pos.symbol.toUpperCase() && bridgeState.currentReplayPrice > 0) {
      const currentPrice = bridgeState.currentReplayPrice;
      const symbolContractSize = InstrumentMetadata.getContractSize(pos.symbol);
      const floatingPnL = PriceComparator.calculatePositionPnl(
        pos.direction,
        pos.entryPrice,
        currentPrice,
        pos.volume,
        symbolContractSize,
        pos.symbol
      );
      this.positionManager.updatePosition(pos.positionId, {
        currentPrice,
        floatingPnL,
      });
      const totalFloating = this.positionManager.getOpenPositions().reduce((sum, p) => sum + p.floatingPnL, 0);
      this.accountManager.updateFloatingPnL(totalFloating);
    }

    this.onTradingStateMutation(currentReplayIndex);
    return res;
  }

  public getPendingOrders() {
    return this.orderManager.getPendingOrders();
  }

  public getOpenPositions() {
    return this.positionManager.getOpenPositions();
  }

  public getTradeHistory() {
    return this.historyManager.getHistory();
  }

  public attachScreenshotToHistory(tradeId: string, dataUrl: string, timeframe: string): void {
    const history = this.store.getHistory();
    const trade = history.find(h => h.tradeId === tradeId);
    if (trade) {
      const screenshots = trade.screenshots ? [...trade.screenshots] : [];
      screenshots.push({ id: `ss_${Date.now()}_${Math.floor(Math.random()*1000)}`, dataUrl, timeframe });
      this.store.updateHistory(tradeId, { screenshots });
      this.persistTradingState();
      this.notifyListeners();
    }
  }

  public removeScreenshotFromHistory(tradeId: string, screenshotId: string): void {
    const history = this.store.getHistory();
    const trade = history.find(h => h.tradeId === tradeId);
    if (trade && trade.screenshots) {
      const screenshots = trade.screenshots.filter(s => s.id !== screenshotId);
      this.store.updateHistory(tradeId, { screenshots });
      this.persistTradingState();
      this.notifyListeners();
    }
  }

  public attachScreenshotToPosition(positionId: string, dataUrl: string, timeframe: string): void {
    const pos = this.positionManager.getPosition(positionId) || 
                this.positionManager.getOpenPositions().find(p => p.positionId === positionId);
    if (pos) {
      const screenshots = pos.screenshots ? [...pos.screenshots] : [];
      screenshots.push({ id: `ss_${Date.now()}_${Math.floor(Math.random()*1000)}`, dataUrl, timeframe });
      this.positionManager.updatePosition(positionId, { screenshots });
      this.persistTradingState();
      this.notifyListeners();
    }
  }

  public removeScreenshotFromPosition(positionId: string, screenshotId: string): void {
    const pos = this.positionManager.getPosition(positionId) || 
                this.positionManager.getOpenPositions().find(p => p.positionId === positionId);
    if (pos && pos.screenshots) {
      const screenshots = pos.screenshots.filter(s => s.id !== screenshotId);
      this.positionManager.updatePosition(positionId, { screenshots });
      this.persistTradingState();
      this.notifyListeners();
    }
  }

  public getAllOrders(): ReadonlyArray<OrderModel> {
    return this.orderManager.getOrders();
  }

  public getAllPositions(): ReadonlyArray<PositionModel> {
    return this.positionManager.getPositions();
  }

  public getAccountModel() {
    return this.accountManager.getAccountModel();
  }

  public getAccountState() {
    return this.store.getAccount();
  }
}

export const tradingEngine = TradingEngineService.getInstance();
