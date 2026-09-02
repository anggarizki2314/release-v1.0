/**
 * Trading Engine 2.0 — useChallengeEngine
 * React Hook for binding UI components to ChallengeEngine.
 * Provides real-time reactivity without polling.
 * Zero UI calculation — strictly reads ChallengeEngine state.
 */

import { useState, useEffect } from 'react';
import type { ChallengeEngine } from './ChallengeEngine';
import type { ChallengeState } from './ChallengeTypes';
import { tradingEngine } from '../TradingEngineService';

export function useChallengeEngine(engine: ChallengeEngine = tradingEngine.challengeEngine): ChallengeState {
  const [challengeState, setChallengeState] = useState<ChallengeState>(() => engine.getState());

  useEffect(() => {
    setChallengeState(engine.getState());
    return engine.subscribe((newState) => {
      setChallengeState(newState);
    });
  }, [engine]);

  return challengeState;
}
