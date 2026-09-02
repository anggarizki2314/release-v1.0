import { rowToAnalyticsSession } from '../../backtest/sessionRepository';
import type { AnalyticsSession } from '../../analytics/types';

export function runFreshSessionReplayGateTests() {
  const logs: string[] = [];
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, description: string) {
    total++;
    if (condition) {
      passed++;
      logs.push(`  [PASS] ${description}`);
    } else {
      logs.push(`  [FAIL] ${description}`);
    }
  }

  // -----------------------------------------------------------------
  // TEST 1: Fresh Session deserialization from SQLite
  // -----------------------------------------------------------------
  const freshDbRow = {
    id: 'session-fresh-1',
    session_name: 'Fresh EURUSD Session',
    symbol_name: 'EURUSD',
    symbols_json: JSON.stringify(['EURUSD']),
    timeframe: 'M15',
    start_time: 1704067200, // 2024-01-01 00:00:00 (Session calendar start date)
    end_time: 1706745600,   // 2024-02-01 00:00:00
    initial_balance: 100000,
    mode: 'normal',
    current_replay_time: null,
    current_replay_index: null,
    status: 'active',
  };

  const freshSession: AnalyticsSession = rowToAnalyticsSession(freshDbRow);

  assert(
    freshSession.currentReplayTime === null &&
    freshSession.currentReplayIndex === null &&
    freshSession.replayStartTime === null,
    `TEST 1 — Fresh Session DB row properly maps to replayStartTime: null (not overwritten by start_time)`
  );

  // -----------------------------------------------------------------
  // TEST 2: ReplayStartGate evaluation on Fresh Session
  // -----------------------------------------------------------------
  const evaluateGate = (session: AnalyticsSession | null) => {
    const isAlreadyInitialized =
      session &&
      ((typeof session.currentReplayIndex === 'number' && session.currentReplayIndex >= 0) ||
       (typeof session.currentReplayTime === 'number' && session.currentReplayTime > 0) ||
       (typeof session.replayStartTime === 'number' && session.replayStartTime > 0));

    return Boolean(session && !isAlreadyInitialized);
  };

  const freshGateModalOpen = evaluateGate(freshSession);

  assert(
    freshGateModalOpen === true,
    `TEST 2 — ReplayStartGate evaluates to showModal: true for fresh session (ReplaySetupModal OPENS)`
  );

  // -----------------------------------------------------------------
  // TEST 3: Resumed Session with saved replay progress
  // -----------------------------------------------------------------
  const resumedDbRow = {
    id: 'session-resumed-2',
    session_name: 'Resumed Session',
    symbol_name: 'EURUSD',
    symbols_json: JSON.stringify(['EURUSD']),
    timeframe: 'M15',
    start_time: 1704067200,
    end_time: 1706745600,
    initial_balance: 100000,
    mode: 'normal',
    current_replay_time: 1704247200, // 2024-01-03 02:00:00
    current_replay_index: 2880,
    status: 'active',
  };

  const resumedSession: AnalyticsSession = rowToAnalyticsSession(resumedDbRow);
  const resumedGateModalOpen = evaluateGate(resumedSession);

  assert(
    resumedSession.currentReplayTime === 1704247200 &&
    resumedSession.currentReplayIndex === 2880 &&
    resumedGateModalOpen === false,
    `TEST 3 — Resumed Session evaluates to showModal: false (ReplaySetupModal does NOT open, directly restores)`
  );

  // -----------------------------------------------------------------
  // TEST 4: Initialized Session with confirmed replay start point
  // -----------------------------------------------------------------
  const initializedRow = {
    ...freshDbRow,
    id: 'session-initialized-3',
    replay_start_time: 1704067200,
    current_replay_time: 1704067200,
    current_replay_index: 0,
  };

  const initializedSession: AnalyticsSession = rowToAnalyticsSession(initializedRow);
  const initializedGateModalOpen = evaluateGate(initializedSession);

  assert(
    initializedGateModalOpen === false,
    `TEST 4 — Confirmed Replay Start point bypasses setup modal on future re-opens`
  );

  return {
    success: passed === total,
    passed,
    total,
    logs,
  };
}
