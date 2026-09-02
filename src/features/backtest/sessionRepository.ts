import type { AnalyticsSession } from '../analytics/types';

const SESSION_STORAGE_KEY = 'fxreplay:sessions_v1';

export function formatTimeAgo(timestampMs: number): string {
  if (!timestampMs) return 'Just now';
  const diffSec = Math.floor((Date.now() - timestampMs) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

export function rowToAnalyticsSession(row: any): AnalyticsSession {
  if (!row || typeof row !== 'object') {
    return {
      id: `session-${Date.now()}`,
      name: 'Backtest Session',
      symbol: 'XAUUSD',
      symbols: ['XAUUSD'],
      timeframe: 'M15',
      dateRange: 'Full Range',
      mode: 'normal',
      status: 'active',
      initialBalance: 100000,
      currentBalance: 100000,
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
    };
  }

  // Always extract initialBalance and currentBalance (prioritizing SQLite account_balance column)
  const initialBal = Number(row.initial_balance ?? row.initialBalance) || 100000;
  const currentBal = row.account_balance != null
    ? Number(row.account_balance)
    : (row.currentBalance != null ? Number(row.currentBalance) : initialBal);

  const netPnl = currentBal - initialBal;
  const netPnlPct = initialBal > 0 ? (netPnl / initialBal) * 100 : 0;

  const startDateStr = row.start_time
    ? new Date(row.start_time * 1000).toISOString().split('T')[0]
    : (row.startDate || '');
  const endDateStr = row.end_time
    ? new Date(row.end_time * 1000).toISOString().split('T')[0]
    : (row.endDate || '');

  const updatedAtMs = row.updated_at
    ? row.updated_at * 1000
    : (row.updatedAt ? Number(row.updatedAt) : Date.now());
  const lastPlayedStr = formatTimeAgo(updatedAtMs);

  const primarySymbol = row.symbol_name || row.symbol || 'XAUUSD';

  let parsedSymbols: string[] = [];
  if (row.symbols_json) {
    try {
      const p = typeof row.symbols_json === 'string' ? JSON.parse(row.symbols_json) : row.symbols_json;
      if (Array.isArray(p) && p.length > 0) {
        parsedSymbols = p.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
      }
    } catch {}
  }
  if (parsedSymbols.length === 0 && Array.isArray(row.symbols) && row.symbols.length > 0) {
    parsedSymbols = row.symbols;
  }
  if (parsedSymbols.length === 0) {
    parsedSymbols = [primarySymbol];
  }
  if (!parsedSymbols.includes(primarySymbol)) {
    parsedSymbols.unshift(primarySymbol);
  }

  return {
    id: String(row.id),
    name: row.session_name || row.name || 'Backtest Session',
    symbol: primarySymbol,
    symbols: parsedSymbols,
    timeframe: row.timeframe || row.active_timeframe || 'M15',
    dateRange: row.dateRange || (startDateStr && endDateStr ? `${startDateStr} – ${endDateStr}` : 'Full Range'),
    startDate: startDateStr,
    endDate: endDateStr,
    mode: row.mode === 'challenge' ? 'challenge' : 'normal',
    status: row.status || 'active',
    initialBalance: initialBal,
    currentBalance: currentBal,
    netProfit: netPnl,
    netProfitPercent: netPnlPct,
    winRate: Number(row.winRate) || 0,
    totalTrades: Number(row.totalTrades) || 0,
    profitFactor: Number(row.profitFactor) || 0,
    expectancy: Number(row.expectancy) || 0,
    lastPlayed: lastPlayedStr,
    winningTrades: Number(row.winningTrades) || 0,
    losingTrades: Number(row.losingTrades) || 0,
    avgRR: Number(row.avgRR) || 0,
    avgWin: Number(row.avgWin) || 0,
    avgLoss: Number(row.avgLoss) || 0,
    largestWin: Number(row.largestWin) || 0,
    largestLoss: Number(row.largestLoss) || 0,
    currentReplayIndex: row.current_replay_index ?? row.currentReplayIndex ?? null,
    currentReplayTime: row.current_replay_time ?? row.currentReplayTime ?? null,
    replayStartTime: row.replay_start_time ?? row.replayStartTime ?? null,
    updatedAt: updatedAtMs,

    challengeRules: row.challenge_rules_json
      ? (typeof row.challenge_rules_json === 'string' ? JSON.parse(row.challenge_rules_json) : row.challenge_rules_json)
      : (row.challengeRules ?? (row.mode === 'challenge' ? {
          dailyLossPercent: Number(row.daily_drawdown != null ? row.daily_drawdown * 100 : 5),
          maxLossPercent: Number(row.max_drawdown != null ? row.max_drawdown * 100 : 10),
          profitTargetPercent: Number(row.profit_target != null ? row.profit_target * 100 : 8),
          minimumTradingDays: Number(row.minimum_trading_days ?? 3),
        } : undefined)),

    challengeStatus: row.mode === 'challenge' ? {
      dailyLossCurrent: Number(row.challengeStatus?.dailyLossCurrent ?? 0),
      dailyLossLimit: (row.daily_drawdown != null ? Number(row.daily_drawdown) : (row.challengeRules?.dailyLossPercent ? row.challengeRules.dailyLossPercent / 100 : 0.05)) * initialBal,
      maxLossCurrent: Number(row.challengeStatus?.maxLossCurrent ?? 0),
      maxLossLimit: (row.max_drawdown != null ? Number(row.max_drawdown) : (row.challengeRules?.maxLossPercent ? row.challengeRules.maxLossPercent / 100 : 0.10)) * initialBal,
      targetCurrent: Number(row.challengeStatus?.targetCurrent ?? 0),
      targetLimit: (row.profit_target != null ? Number(row.profit_target) : (row.challengeRules?.profitTargetPercent ? row.challengeRules.profitTargetPercent / 100 : 0.08)) * initialBal,
      minimumTradingDays: Number(row.minimum_trading_days ?? row.challengeRules?.minimumTradingDays ?? 3),
      currentTradingDays: Number(row.challengeStatus?.currentTradingDays ?? 0),
    } : undefined,
  };
}

export function analyticsSessionToRow(sess: Partial<AnalyticsSession> & { id: string }): Record<string, any> {
  const now = Math.floor(Date.now() / 1000);

  let startTimeNum: number = now;
  if (sess.startDate) {
    const startDateStr = sess.startDate.includes('T') ? sess.startDate : `${sess.startDate}T00:00:00Z`;
    const t = Math.floor(new Date(startDateStr).getTime() / 1000);
    if (!isNaN(t) && t > 0) startTimeNum = t;
  } else if (sess.replayStartTime) {
    startTimeNum = sess.replayStartTime;
  }

  let endTimeNum: number = now;
  if (sess.endDate) {
    const endDateStr = sess.endDate.includes('T') ? sess.endDate : `${sess.endDate}T23:59:59Z`;
    const t = Math.floor(new Date(endDateStr).getTime() / 1000);
    if (!isNaN(t) && t > 0) endTimeNum = t;
  }

  const symbolsArr = sess.symbols && sess.symbols.length > 0
    ? sess.symbols
    : [sess.symbol || 'XAUUSD'];

  return {
    id: sess.id,
    session_name: sess.name || 'Backtest Session',
    symbol_id: 1,
    symbol_name: sess.symbol || 'XAUUSD',
    symbols_json: JSON.stringify(symbolsArr),
    timeframe: sess.timeframe || 'M15',
    start_time: startTimeNum,
    end_time: endTimeNum,
    initial_balance: sess.initialBalance ?? 100000,
    mode: sess.mode || 'normal',
    daily_drawdown: sess.challengeRules ? sess.challengeRules.dailyLossPercent / 100 : (sess.challengeStatus && sess.initialBalance ? sess.challengeStatus.dailyLossLimit / sess.initialBalance : null),
    max_drawdown: sess.challengeRules ? sess.challengeRules.maxLossPercent / 100 : (sess.challengeStatus && sess.initialBalance ? sess.challengeStatus.maxLossLimit / sess.initialBalance : null),
    profit_target: sess.challengeRules ? sess.challengeRules.profitTargetPercent / 100 : (sess.challengeStatus && sess.initialBalance ? sess.challengeStatus.targetLimit / sess.initialBalance : null),
    challenge_rules_json: sess.challengeRules ? JSON.stringify(sess.challengeRules) : null,
    current_replay_time: sess.currentReplayTime ?? null,
    current_replay_index: sess.currentReplayIndex ?? null,
    account_balance: sess.currentBalance ?? sess.initialBalance ?? 100000,
    account_equity: sess.currentBalance ?? sess.initialBalance ?? 100000,
    active_timeframe: sess.timeframe || 'M15',
    status: sess.status || 'active',
    updated_at: sess.updatedAt ? Math.floor(sess.updatedAt / 1000) : now,
  };
}

/**
 * Fetches all sessions from local SQLite Database (via IPC) or localStorage fallback.
 * Hydrates each session with its latest persisted trading engine balance & metrics.
 */
export async function getAllSessions(): Promise<AnalyticsSession[]> {
  try {
    let sessions: AnalyticsSession[] = [];

    if (window.forexReplay?.listBacktestSessions) {
      const dbRows = await window.forexReplay.listBacktestSessions();
      if (Array.isArray(dbRows)) {
        sessions = dbRows.map((row) =>
          typeof row === 'string' ? rowToAnalyticsSession(JSON.parse(row)) : rowToAnalyticsSession(row)
        );
      }
    }

    if (sessions.length === 0) {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored !== null) {
        const raw = JSON.parse(stored);
        if (Array.isArray(raw)) {
          sessions = raw.map((r) => rowToAnalyticsSession(r));
        }
      }
    }

    // Hydrate sessions list (trading state persistence disabled during Trading Engine Reset)
    const hydratedSessions = sessions;

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(hydratedSessions));
    return hydratedSessions;
  } catch (err) {
    console.error('[Session] Failed to load sessions from repository:', err);
  }

  return [];
}

/**
 * Inserts or updates a session record in DB and localStorage.
 */
export async function saveSession(session: AnalyticsSession): Promise<boolean> {
  try {
    console.log('[Session] Saving to SQLite...', session);
    const rowData = analyticsSessionToRow(session);

    let success = false;
    if (window.forexReplay?.saveBacktestSession) {
      success = await window.forexReplay.saveBacktestSession(rowData);
    } else {
      console.warn('[Session] Electron IPC window.forexReplay.saveBacktestSession not available, using localStorage fallback');
      success = true;
    }

    if (success) {
      console.log('[Session] Save Success');
      // Sync localStorage
      const currentSessions = await getAllSessions();
      const index = currentSessions.findIndex((s) => s.id === session.id);
      let updated: AnalyticsSession[];
      if (index >= 0) {
        updated = [...currentSessions];
        updated[index] = session;
      } else {
        updated = [session, ...currentSessions];
      }
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
      return true;
    } else {
      console.error('[Session] Save FAILED: IPC returned false');
      return false;
    }
  } catch (err) {
    console.error('[Session] Save FAILED:', err);
    return false;
  }
}

/**
 * Permanently deletes a session by ID from DB and localStorage.
 */
export async function deleteSessionFromDB(id: string): Promise<boolean> {
  try {
    const currentSessions = await getAllSessions();
    const updated = currentSessions.filter((s) => s.id !== id);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));

    if (window.forexReplay?.deleteBacktestSession) {
      await window.forexReplay.deleteBacktestSession(id);
    }
    return true;
  } catch (err) {
    console.error('[Session] Delete FAILED:', err);
    return false;
  }
}

/**
 * Permanently deletes ALL sessions from DB and localStorage.
 */
export async function deleteAllSessionsFromDB(): Promise<boolean> {
  try {
    const currentSessions = await getAllSessions();
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify([]));
    localStorage.removeItem('forex_replay_last_opened_session_id');

    for (const sess of currentSessions) {
      if (window.forexReplay?.deleteBacktestSession) {
        await window.forexReplay.deleteBacktestSession(sess.id);
      }
      try {
        localStorage.removeItem(`fxreplay:trading_state_${sess.id}`);
      } catch {}
    }
    return true;
  } catch (err) {
    console.error('[Session] Delete All FAILED:', err);
    return false;
  }
}

/**
 * Saves ONLY Replay Pointer (currentReplayIndex, currentReplayTime, updated_at).
 * Replay Engine is the SOLE OWNER of Replay Pointer metrics.
 * NEVER touches account_balance, account_equity, or positions.
 */
export async function saveReplayState(
  sessionId: string,
  currentReplayIndex: number | null,
  currentReplayTime: number | null
): Promise<boolean> {
  try {
    if (window.forexReplay?.updateReplayState) {
      await window.forexReplay.updateReplayState(sessionId, currentReplayIndex, currentReplayTime);
    }

    // Sync localStorage cache strictly for replay index/time
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      try {
        const currentSessions: AnalyticsSession[] = JSON.parse(stored);
        const idx = currentSessions.findIndex((s) => s.id === sessionId);
        if (idx >= 0) {
          currentSessions[idx] = {
            ...currentSessions[idx],
            currentReplayIndex,
            currentReplayTime,
            updatedAt: Date.now(),
          };
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(currentSessions));
        }
      } catch (e) {
        console.error('[ReplayState] Failed to sync localStorage:', e);
      }
    }
    return true;
  } catch (err) {
    console.error('[ReplayState] Failed to save replay state:', err);
    return false;
  }
}

const inMemoryTradingStateCache = new Map<string, string>();

function safeGetStorage(key: string): string | null {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return inMemoryTradingStateCache.get(key) ?? null;
}

function safeSetStorage(key: string, value: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
  }
  inMemoryTradingStateCache.set(key, value);
}

const pendingSqliteSaves = new Map<string, { timeout: any; stateJson: string }>();

function scheduleSqliteSave(sessionId: string, stateJson: string) {
  const existing = pendingSqliteSaves.get(sessionId);
  if (existing) {
    clearTimeout(existing.timeout);
  }

  const timeout = setTimeout(async () => {
    pendingSqliteSaves.delete(sessionId);
    if (typeof window !== 'undefined' && window.forexReplay?.saveTradingState) {
      try {
        await window.forexReplay.saveTradingState(sessionId, stateJson);
      } catch (err) {
        console.error('[TradingState] SQLite Async Save Error:', err);
      }
    }
  }, 150);

  pendingSqliteSaves.set(sessionId, { timeout, stateJson });
}

/**
 * Saves Trading Engine state snapshot to SQLite database and localStorage cache.
 */
export async function saveTradingState(sessionId: string, state: any): Promise<boolean> {
  try {
    if (!sessionId) return false;
    const stateObj = typeof state === 'string' ? JSON.parse(state) : state;
    const stateJson = typeof state === 'string' ? state : JSON.stringify(state);

    // Always update storage cache immediately
    safeSetStorage(`fxreplay:trading_state_${sessionId}`, stateJson);

    // Debounce SQLite disk persistence to prevent IPC flooding
    scheduleSqliteSave(sessionId, stateJson);
    return true;
  } catch (err) {
    console.error('[TradingState] Save FAILED:', err);
    return false;
  }
}

/**
 * Loads persisted trading state for a session from SQLite database or localStorage cache.
 */
export async function loadTradingState(sessionId: string): Promise<any | null> {
  try {
    if (!sessionId) return null;
    let rawJson: string | null = null;
    if (typeof window !== 'undefined' && window.forexReplay?.loadTradingState) {
      rawJson = await window.forexReplay.loadTradingState(sessionId);
    }
    if (!rawJson) {
      rawJson = safeGetStorage(`fxreplay:trading_state_${sessionId}`);
    }
    if (!rawJson) return null;

    // Authoritative SQLite write to local cache so sync reads also succeed
    safeSetStorage(`fxreplay:trading_state_${sessionId}`, rawJson);

    const parsed = JSON.parse(rawJson);

    console.log('[FORENSIC-RESTART-RAW-STATE]', {
      sessionId,
      historyCount: parsed.schema?.history?.length ?? 0,
      positionsCount: parsed.schema?.positions?.length ?? 0,
      ordersCount: parsed.schema?.orders?.length ?? 0,
      positions: (parsed.schema?.positions ?? []).map((p: any) => ({
        positionId: p.positionId,
        symbol: p.symbol,
        status: p.status,
        direction: p.direction,
        entryPrice: p.entryPrice,
        stopLoss: p.stopLoss,
        takeProfit: p.takeProfit,
      })),
      history: (parsed.schema?.history ?? []).map((h: any) => ({
        tradeId: h.tradeId,
        positionId: h.positionId,
        symbol: h.symbol,
        closeReason: h.comment ?? h.closeReason,
        exitPrice: h.exitPrice,
        profit: h.profit,
        closedAt: h.closedAt,
      })),
    });

    console.log('[HYDRATION-AUDIT-DESERIALIZED]', {
      positionsCount: parsed.schema?.positions?.length ?? 0,
      positionIds: (parsed.schema?.positions ?? []).map((p: any) => p.id || p.positionId),
      historyCount: parsed.schema?.history?.length ?? 0,
      historyTradeIds: (parsed.schema?.history ?? []).map((h: any) => h.tradeId),
      historyPositionIds: (parsed.schema?.history ?? []).map((h: any) => h.positionId),
    });

    console.log('[TRADING-STATE-HYDRATE]', {
      sessionId,
      openPositionsCount: parsed?.schema?.positions?.length ?? 0,
      closedTradesCount: parsed?.schema?.history?.length ?? 0,
      pendingOrdersCount: parsed?.schema?.orders?.length ?? 0,
    });

    if (parsed?.schema?.history && parsed.schema.history.length > 0) {
      const lastClosed = parsed.schema.history[parsed.schema.history.length - 1];
      console.log('[TRADING-STATE-RESUME-CLOSE]', {
        positionId: lastClosed.positionId,
        tradeId: lastClosed.tradeId,
        symbol: lastClosed.symbol,
        closeReason: lastClosed.comment ?? 'CLOSED',
        closePrice: lastClosed.exitPrice,
        realizedPnL: lastClosed.profit,
      });
    }

    return parsed;
  } catch (err) {
    console.error('[TradingState] Load FAILED:', err);
    return null;
  }
}

/**
 * Synchronous fallback read from storage cache for instant engine hydration.
 */
export function loadTradingStateSync(sessionId: string): any | null {
  try {
    if (!sessionId) return null;
    const rawJson = safeGetStorage(`fxreplay:trading_state_${sessionId}`);
    if (!rawJson) return null;
    return JSON.parse(rawJson);
  } catch (err) {
    return null;
  }
}
