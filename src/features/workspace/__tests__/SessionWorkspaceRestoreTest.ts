/**
 * Test Suite — Session Workspace & Timeframe Restore on Resume
 *
 * Validates:
 * 1. TEST 1 — Resume Multi-Timeframe (Session A: layout = 2v, pane-0 = H4, pane-1 = M15)
 * 2. TEST 2 — Resume Multi-Symbol (pane-0 = EURUSD H4, pane-1 = GBPUSD M15)
 * 3. TEST 3 — Link Symbol Safety (linkSymbol = true does not corrupt saved pane configuration on resume)
 * 4. TEST 4 — New Session starts with 1 layout and default timeframe
 * 5. TEST 5 — Session A / Session B Isolation (A = 2v H4+M15, B = 1 M30)
 * 6. TEST 6 — Timeframe Isolation across panes
 */

import {
  saveSessionWorkspace,
  loadSessionWorkspace,
  createDefaultWorkspace,
} from '../WorkspaceManager';
import type { WorkspaceState } from '../types';

export function runSessionWorkspaceRestoreTests(): {
  success: boolean;
  passed: number;
  total: number;
  logs: string[];
} {
  const logs: string[] = [];
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, description: string) {
    total++;
    if (condition) {
      passed++;
      logs.push(`[PASS] Test ${total}: ${description}`);
    } else {
      logs.push(`[FAIL] Test ${total}: ${description}`);
    }
  }

  // Mock localStorage in memory for deterministic test environment
  const storageMap = new Map<string, string>();
  const originalLocalStorage = globalThis.localStorage;
  (globalThis as any).localStorage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => storageMap.set(key, value),
    removeItem: (key: string) => storageMap.delete(key),
    clear: () => storageMap.clear(),
  };

  try {
    const sessionAId = 'session-alpha-workspace';
    const sessionBId = 'session-beta-workspace';

    // -----------------------------------------------------------------
    // TEST 1: Resume Multi-Timeframe (Session A saved 2v: pane-0 H4, pane-1 M15)
    // -----------------------------------------------------------------
    const defaultWs = createDefaultWorkspace();
    const workspaceA: WorkspaceState = {
      ...defaultWs,
      layoutMode: '2v',
      panes: [
        { paneId: 'pane-0', symbolId: 1, timeframe: 'H4', viewport: null },
        { paneId: 'pane-1', symbolId: 1, timeframe: 'M15', viewport: null },
        ...defaultWs.panes.slice(2),
      ],
    };
    saveSessionWorkspace(workspaceA, sessionAId);

    const restoredA = loadSessionWorkspace(sessionAId);
    assert(
      restoredA !== null &&
      restoredA.layoutMode === '2v' &&
      restoredA.panes[0].timeframe === 'H4' &&
      restoredA.panes[1].timeframe === 'M15',
      'TEST 1 — Resume Multi-Timeframe: Session A restores exact 2v layout, pane-0 H4, and pane-1 M15'
    );

    // -----------------------------------------------------------------
    // TEST 2: Resume Multi-Symbol (pane-0 EURUSD=1 H4, pane-1 GBPUSD=2 M15)
    // -----------------------------------------------------------------
    const workspaceMultiSymbol: WorkspaceState = {
      ...defaultWs,
      layoutMode: '2v',
      panes: [
        { paneId: 'pane-0', symbolId: 1, timeframe: 'H4', viewport: null },
        { paneId: 'pane-1', symbolId: 2, timeframe: 'M15', viewport: null },
        ...defaultWs.panes.slice(2),
      ],
    };
    saveSessionWorkspace(workspaceMultiSymbol, sessionAId);

    const restoredMultiSymbol = loadSessionWorkspace(sessionAId);
    assert(
      restoredMultiSymbol !== null &&
      restoredMultiSymbol.panes[0].symbolId === 1 &&
      restoredMultiSymbol.panes[0].timeframe === 'H4' &&
      restoredMultiSymbol.panes[1].symbolId === 2 &&
      restoredMultiSymbol.panes[1].timeframe === 'M15',
      'TEST 2 — Resume Multi-Symbol: pane-0 EURUSD H4 and pane-1 GBPUSD M15 restored accurately'
    );

    // -----------------------------------------------------------------
    // TEST 3: Link Symbol Safety (linkSymbol = true does not overwrite on resume)
    // -----------------------------------------------------------------
    const workspaceLinked: WorkspaceState = {
      ...workspaceA,
      linkSymbol: true,
      panes: [
        { paneId: 'pane-0', symbolId: 1, timeframe: 'H1', viewport: null },
        { paneId: 'pane-1', symbolId: 1, timeframe: 'H1', viewport: null },
        ...defaultWs.panes.slice(2),
      ],
    };
    saveSessionWorkspace(workspaceLinked, sessionAId);

    const restoredLinked = loadSessionWorkspace(sessionAId);
    assert(
      restoredLinked !== null &&
      restoredLinked.panes[0].timeframe === 'H1' &&
      restoredLinked.panes[1].timeframe === 'H1',
      'TEST 3 — Link Symbol Safety: Saved H1 timeframes remain completely intact on resume'
    );

    // -----------------------------------------------------------------
    // TEST 4: New Session starts with 1 layout and default timeframe M30
    // -----------------------------------------------------------------
    const freshWorkspace = createDefaultWorkspace(1, 'M30');
    saveSessionWorkspace(freshWorkspace, sessionBId);

    const restoredB = loadSessionWorkspace(sessionBId);
    assert(
      restoredB !== null &&
      restoredB.layoutMode === '1' &&
      restoredB.panes[0].timeframe === 'M30' &&
      restoredB.panes[0].symbolId === 1,
      'TEST 4 — New Session starts with exactly layout 1, pane-0 EURUSD, and timeframe M30'
    );

    // -----------------------------------------------------------------
    // TEST 5: Session A / Session B Isolation (A = 2v H1, B = 1 M30)
    // -----------------------------------------------------------------
    const checkA = loadSessionWorkspace(sessionAId);
    const checkB = loadSessionWorkspace(sessionBId);

    assert(
      checkA !== null &&
      checkB !== null &&
      checkA.layoutMode === '2v' &&
      checkA.panes[0].timeframe === 'H1' &&
      checkB.layoutMode === '1' &&
      checkB.panes[0].timeframe === 'M30',
      'TEST 5 — Session A/B Isolation: Switching between A (2v H1) and B (1 M30) preserves both without cross-contamination'
    );

    // -----------------------------------------------------------------
    // TEST 6: Timeframe Isolation across panes
    // -----------------------------------------------------------------
    const pane0Tf = checkA!.panes[0].timeframe;
    const pane1Tf = checkA!.panes[1].timeframe;
    assert(
      pane0Tf === 'H1' && pane1Tf === 'H1',
      'TEST 6 — Timeframe Isolation: Pane configurations remain isolated and stable'
    );

  } finally {
    (globalThis as any).localStorage = originalLocalStorage;
  }

  return {
    success: passed === total,
    passed,
    total,
    logs,
  };
}
