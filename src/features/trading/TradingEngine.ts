/**
 * Trading Engine 2.0 — Main Facade / Orchestrator Class
 * Assembles Store, EventBus, Managers, and Adapters into a single isolated Trading Engine.
 */

import type { TradingEngineConfig } from './types/config';
import { DEFAULT_ENGINE_CONFIG } from './types/config';
import type { Position, Order, ClosedTrade, AccountState } from './types/models';
import type {
  OpenPositionCommand,
  ClosePositionCommand,
  ModifyPositionCommand,
  PartialCloseCommand,
  ReversePositionCommand,
  PlaceOrderCommand,
  CancelOrderCommand,
  ProcessTickCommand,
} from './types/commands';
import { TradingEventBus } from './core/EventBus';
import { TradingStore } from './core/TradingStore';
import { MarginManager } from './core/MarginManager';
import { AccountManager } from './core/AccountManager';
import { PositionManager } from './core/PositionManager';
import { OrderManager } from './core/OrderManager';
import { RiskManager } from './core/RiskManager';
import { HistoryManager } from './core/HistoryManager';
import { ReplayAdapter } from './core/ReplayAdapter';

export class TradingEngine {
  public readonly eventBus: TradingEventBus;
  public readonly store: TradingStore;
  public readonly marginManager: MarginManager;
  public readonly accountManager: AccountManager;
  public readonly positionManager: PositionManager;
  public readonly orderManager: OrderManager;
  public readonly riskManager: RiskManager;
  public readonly historyManager: HistoryManager;
  public readonly replayAdapter: ReplayAdapter;

  private config: TradingEngineConfig;

  constructor(config: Partial<TradingEngineConfig> = {}) {
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };

    this.eventBus = new TradingEventBus();
    this.store = new TradingStore(this.config.initialBalance);

    this.marginManager = new MarginManager(this.config);
    this.accountManager = new AccountManager(this.store, this.eventBus, this.marginManager);
    this.positionManager = new PositionManager(this.store, this.eventBus, this.accountManager);
    this.orderManager = new OrderManager(this.store, this.eventBus, this.positionManager);
    this.riskManager = new RiskManager(this.store);
    this.historyManager = new HistoryManager(this.store);
    this.replayAdapter = new ReplayAdapter(this);
  }

  // ─── COMMAND HANDLERS (PUBLIC API) ─────────────────────────────────

  public openPosition(cmd: OpenPositionCommand, currentPrice: number, now: number = Date.now()): Position {
    return this.positionManager.openPosition(cmd, currentPrice, now);
  }

  public closePosition(cmd: ClosePositionCommand, now: number = Date.now()): ClosedTrade | undefined {
    return this.positionManager.closePosition(cmd.positionId, cmd.closePrice ?? 0, now, cmd.reason ?? 'MANUAL');
  }

  public modifyPosition(cmd: ModifyPositionCommand, now: number = Date.now()): Position | undefined {
    return this.positionManager.modifyPosition(cmd, now);
  }

  public partialClose(cmd: PartialCloseCommand, exitPrice: number, now: number = Date.now()): ClosedTrade | undefined {
    return this.positionManager.partialClose(cmd, exitPrice, now);
  }

  public reversePosition(cmd: ReversePositionCommand, currentPrice: number, now: number = Date.now()): Position | undefined {
    return this.positionManager.reversePosition(cmd, currentPrice, now);
  }

  public placeOrder(cmd: PlaceOrderCommand, now: number = Date.now()): Order {
    return this.orderManager.placeOrder(cmd, now);
  }

  public cancelOrder(cmd: CancelOrderCommand, now: number = Date.now()): Order | undefined {
    return this.orderManager.cancelOrder(cmd, now);
  }

  public processTick(tick: ProcessTickCommand): void {
    // 1. Update Floating PnL of all open positions
    this.positionManager.updateFloatingPnlOnTick(tick.symbol, tick.bid, tick.ask);

    // 2. Check pending limit & stop orders
    this.orderManager.checkPendingOrders(tick.symbol, tick.bid, tick.ask, tick.time);

    // 3. Emit tick:processed event
    this.eventBus.emit('tick:processed', tick);
  }

  public reset(initialBalance: number = this.config.initialBalance): void {
    this.accountManager.reset(initialBalance);
    this.eventBus.emit('engine:reset', { initialBalance });
  }

  // ─── READ-ONLY QUERY API ──────────────────────────────────────────

  public getAccount(): AccountState {
    return this.store.getAccount();
  }

  public getPositions(): Position[] {
    return Array.from(this.store.getPositions());
  }

  public getOrders(): Order[] {
    return Array.from(this.store.getOrders());
  }

  public getHistory(): ClosedTrade[] {
    return Array.from(this.store.getHistory());
  }

  public getConfig(): Readonly<TradingEngineConfig> {
    return { ...this.config };
  }
}
