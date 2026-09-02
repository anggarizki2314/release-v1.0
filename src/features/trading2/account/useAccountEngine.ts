/**
 * Trading Engine 2.0 — useAccountEngine
 * React Hook for binding UI components to AccountEngine.
 * Provides real-time reactivity on every replay tick & position update without polling.
 * Zero calculation in UI — strictly reads AccountEngine state.
 */

import { useState, useEffect } from 'react';
import type { AccountEngine } from './AccountEngine';
import type { AccountState } from './AccountTypes';
import { tradingEngine } from '../TradingEngineService';

export function useAccountEngine(engine: AccountEngine = tradingEngine.accountEngine): AccountState {
  const [accountState, setAccountState] = useState<AccountState>(() => engine.getState());

  useEffect(() => {
    setAccountState(engine.getState());
    return engine.subscribe((newState) => {
      setAccountState(newState);
    });
  }, [engine]);

  return accountState;
}
