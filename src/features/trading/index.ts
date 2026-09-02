/**
 * Trading Engine 2.0 — Public Module API
 * Clean exports for Trading Engine 2.0 Foundation Architecture.
 */

// Facade & Orchestrator
export { TradingEngine } from './TradingEngine';

// Core Architecture & Managers
export { TradingEventBus } from './core/EventBus';
export { TradingStore } from './core/TradingStore';
export { AccountManager } from './core/AccountManager';
export { PositionManager } from './core/PositionManager';
export { OrderManager } from './core/OrderManager';
export { RiskManager } from './core/RiskManager';
export { MarginManager } from './core/MarginManager';
export { HistoryManager } from './core/HistoryManager';
export { ReplayAdapter } from './core/ReplayAdapter';

// Types & Models
export type {
  Position,
  PositionSide,
  PositionStatus,
  Order,
  OrderType,
  OrderStatus,
  AccountState,
  ClosedTrade,
  TradeCloseReason,
} from './types/models';

export type {
  OpenPositionCommand,
  ClosePositionCommand,
  ModifyPositionCommand,
  PartialCloseCommand,
  ReversePositionCommand,
  PlaceOrderCommand,
  CancelOrderCommand,
  ProcessTickCommand,
  ResetAccountCommand,
} from './types/commands';

export type { TradingEvents, EventKey, EventListener } from './types/events';
export type { TradingEngineConfig } from './types/config';
export { DEFAULT_ENGINE_CONFIG } from './types/config';
