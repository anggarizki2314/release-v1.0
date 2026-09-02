import { useState, useEffect, useCallback } from 'react';
import type { AnalyticsSession } from '../analytics/types';
import type { SessionConfig } from '../sessionWizard/CreateSessionWizard';
import { getAllSessions, saveSession, deleteSessionFromDB, deleteAllSessionsFromDB } from './sessionRepository';

export function useSessionStore() {
  const [sessions, setSessions] = useState<AnalyticsSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // 1. Initialize sessions from DB
  const initSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllSessions();
      setSessions(data);
      if (data.length > 0) {
        setActiveSessionId((prev) => prev || data[0].id);
      }
    } catch (e) {
      console.error('[useSessionStore] Error fetching sessions:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initSessions();
  }, [initSessions]);

  // 2. Create new session & persist to DB
  const createNewSession = useCallback(async (config: SessionConfig): Promise<AnalyticsSession> => {
    console.log('[Session] Creating...', config);

    let initialReplayTime: number | null = null;
    if (config.startDate) {
      const startDateStr = config.startDate.includes('T') ? config.startDate : `${config.startDate}T00:00:00Z`;
      const t = Math.floor(new Date(startDateStr).getTime() / 1000);
      if (!isNaN(t) && t > 0) {
        initialReplayTime = t;
      }
    }

    const newSession: AnalyticsSession = {
      id: `session-${Date.now()}`,
      name: config.name,
      symbol: config.symbol,
      symbols: config.symbols || [config.symbol],
      timeframe: config.timeframe,
      dateRange: `${config.startDate} – ${config.endDate}`,
      startDate: config.startDate,
      endDate: config.endDate,
      mode: config.mode,
      status: 'active',
      initialBalance: config.initialBalance,
      currentBalance: config.initialBalance,
      netProfit: 0,
      netProfitPercent: 0,
      winRate: 0,
      totalTrades: 0,
      profitFactor: 0,
      expectancy: 0,
      lastPlayed: 'Just now',
      winningTrades: 0,
      losingTrades: 0,
      avgRR: 0,
      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      currentReplayIndex: null,
      currentReplayTime: initialReplayTime,
      replayStartTime: initialReplayTime,
      updatedAt: Date.now(),

      challengeRules: config.mode === 'challenge' ? {
        dailyLossPercent: config.challengeRules?.dailyLossPercent ?? 5.0,
        maxLossPercent: config.challengeRules?.maxLossPercent ?? 10.0,
        profitTargetPercent: config.challengeRules?.profitTargetPercent ?? 8.0,
        minimumTradingDays: config.challengeRules?.minimumTradingDays ?? 3,
      } : undefined,

      challengeStatus: config.mode === 'challenge' ? {
        dailyLossCurrent: 0,
        dailyLossLimit: config.initialBalance * ((config.challengeRules?.dailyLossPercent ?? 5.0) / 100),
        maxLossCurrent: 0,
        maxLossLimit: config.initialBalance * ((config.challengeRules?.maxLossPercent ?? 10.0) / 100),
        targetCurrent: 0,
        targetLimit: config.initialBalance * ((config.challengeRules?.profitTargetPercent ?? 8.0) / 100),
        minimumTradingDays: config.challengeRules?.minimumTradingDays ?? 3,
        currentTradingDays: 0,
      } : undefined,
    };

    const saved = await saveSession(newSession);
    if (!saved) {
      console.error('[Session] Save FAILED: saveSession returned false');
      throw new Error('Failed to save session to SQLite database');
    }

    console.log('[Session] Refresh Session List');
    const refreshed = await getAllSessions();
    console.log('STORE:', refreshed.length);
    setSessions(refreshed.length > 0 ? refreshed : [newSession]);
    setActiveSessionId(newSession.id);
    return newSession;
  }, []);

  // 3. Delete session & update DB (DO NOT RE-SEED ON EMPTY)
  const deleteSession = useCallback(async (id: string) => {
    await deleteSessionFromDB(id);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`tradepro_indicators_session_${id}`);
        localStorage.removeItem(`tradepro_daye_quarters_height_session_${id}`);
        localStorage.removeItem(`tradepro_rsi_pane_height_session_${id}`);
      }
    } catch {}
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      return updated;
    });
    setActiveSessionId((prev) => (prev === id ? null : prev));
  }, []);

  // 4. Delete ALL sessions & clear DB
  const deleteAllSessions = useCallback(async () => {
    await deleteAllSessionsFromDB();
    setSessions([]);
    setActiveSessionId(null);
  }, []);

  // 5. Auto-save current session stats (balance, PnL, lastPlayed, replay state) to DB
  const autoSaveCurrentSession = useCallback(async (
    sessionId: string,
    statsUpdate: Partial<AnalyticsSession>
  ) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === sessionId);
      if (idx === -1) return prev;
      const initialBal = prev[idx].initialBalance ?? 0;
      const curBal = statsUpdate.currentBalance ?? prev[idx].currentBalance ?? initialBal;
      const netPnl = curBal - initialBal;
      const netPnlPct = initialBal > 0 ? (netPnl / initialBal) * 100 : 0;

      const updatedSess: AnalyticsSession = {
        ...prev[idx],
        ...statsUpdate,
        currentBalance: curBal,
        netProfit: netPnl,
        netProfitPercent: netPnlPct,
        lastPlayed: 'Just now',
        updatedAt: Date.now(),
      };
      saveSession(updatedSess);
      const newSessions = [...prev];
      newSessions[idx] = updatedSess;
      return newSessions;
    });
  }, []);

  // 6. Update replay pointer (currentReplayIndex, currentReplayTime) in memory without full DB write
  const updateSessionReplayPointer = useCallback((
    sessionId: string,
    currentReplayIndex: number | null,
    currentReplayTime: number | null
  ) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === sessionId);
      if (idx === -1) return prev;
      if (prev[idx].currentReplayIndex === currentReplayIndex && prev[idx].currentReplayTime === currentReplayTime) {
        return prev;
      }
      const updatedSess: AnalyticsSession = {
        ...prev[idx],
        currentReplayIndex,
        currentReplayTime,
        updatedAt: Date.now(),
      };
      const newSessions = [...prev];
      newSessions[idx] = updatedSess;
      return newSessions;
    });
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  return {
    sessions,
    activeSessionId,
    activeSession,
    loading,
    initSessions,
    createNewSession,
    deleteSession,
    deleteAllSessions,
    autoSaveCurrentSession,
    updateSessionReplayPointer,
    setActiveSessionId,
  };
}

