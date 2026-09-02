/**
 * Trading Engine 2.0 — Account Events
 * Event types and payloads emitted during Account calculation updates.
 * Pure TypeScript without UI or framework dependencies.
 */

import type { AccountModel } from './AccountTypes';

export interface AccountEventPayloads {
  BalanceChanged: { oldBalance: number; newBalance: number; reason: string };
  EquityChanged: { oldEquity: number; newEquity: number };
  MarginChanged: {
    oldMargin: number;
    newMargin: number;
    freeMargin: number;
    marginLevel: number | typeof Infinity;
  };
  FloatingChanged: { floatingPnL: number };
  AccountReset: { account: AccountModel };
}

export type AccountEventKey = keyof AccountEventPayloads;

export type AccountEventListener<K extends AccountEventKey> = (
  payload: AccountEventPayloads[K]
) => void;
