/**
 * Replay Engine V3 — React Context Provider
 * Architecture Frozen v1.0
 */

import React, { createContext, useContext } from 'react';
import { useReplayEngineV3 } from './useReplayEngineV3';

type ReplayContextV3Type = ReturnType<typeof useReplayEngineV3>;

const ReplayContextV3 = createContext<ReplayContextV3Type | undefined>(undefined);

export const ReplayProviderV3: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useReplayEngineV3();
  return <ReplayContextV3.Provider value={value}>{children}</ReplayContextV3.Provider>;
};

export function useReplayV3(): ReplayContextV3Type {
  const ctx = useContext(ReplayContextV3);
  if (!ctx) {
    throw new Error('useReplayV3 must be used within a ReplayProviderV3');
  }
  return ctx;
}
