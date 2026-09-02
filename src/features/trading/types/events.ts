/**
 * Trading Engine 2.0 — Event Map & Payloads
 * Strongly-typed event payloads emitted across the internal EventBus.
 */

import type { Position, Order, AccountState, ClosedTrade } from './models';

export interface TradingEvents {
  'position:opened': { position: Position };
  'position:closed': { position: Position; trade: ClosedTrade };
  'position:modified': { position: Position };
  'position:updated': { positions: Position[] };
  'order:placed': { order: Order };
  'order:triggered': { order: Order; position: Position };
  'order:cancelled': { order: Order };
  'account:updated': { account: AccountState };
  'history:updated': { trades: ClosedTrade[] };
  'tick:processed': { symbol: string; bid: number; ask: number; time: number };
  'engine:reset': { initialBalance: number };
}

export type EventKey = keyof TradingEvents;
export type EventListener<K extends EventKey> = (data: TradingEvents[K]) => void;
