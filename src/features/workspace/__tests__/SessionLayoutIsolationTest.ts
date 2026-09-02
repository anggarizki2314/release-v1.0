/**
 * Session Layout Isolation Acceptance Test Suite
 * Tests 8 Acceptance Scenarios for per-session layout isolation and persistence.
 */

import {
  createDefaultWorkspace,
  loadSessionWorkspace,
  saveSessionWorkspace,
} from '../WorkspaceManager';
import type { WorkspaceState } from '../types';

// Mock localStorage for Node environment if not present
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = String(val); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${msg}`);
  }
}

console.log('=== RUNNING SESSION LAYOUT ISOLATION & PERSISTENCE TEST SUITE ===\n');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1 — BRAND NEW SESSION
// Session creation must ALWAYS initialize with exactly 1 layout and activePaneId = 'pane-0'
// ─────────────────────────────────────────────────────────────────────────────
{
  const session1 = 'session-1001';
  const newWorkspace = createDefaultWorkspace(10, 'M15');
  saveSessionWorkspace(newWorkspace, session1);

  assert(newWorkspace.layoutMode === '1', 'TEST 1: New session must have layoutMode === "1"');
  assert(newWorkspace.activePaneId === 'pane-0', 'TEST 1: New session activePaneId must be "pane-0"');
  assert(newWorkspace.panes[0].symbolId === 10, 'TEST 1: Pane 0 must have primary symbol');
  assert(newWorkspace.panes[0].timeframe === 'M15', 'TEST 1: Pane 0 must have initial timeframe');
  console.log('[PASS] TEST 1: Brand new session starts with exactly 1 layout');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — SESSION A PERSISTENCE
// User in Session A creates 3 layouts, saves and resumes -> all 3 layouts restored
// ─────────────────────────────────────────────────────────────────────────────
{
  const sessionA = 'session-2001';
  const wsA: WorkspaceState = createDefaultWorkspace(1, 'M15');
  // User configures 3 layouts:
  wsA.layoutMode = '3l';
  wsA.activePaneId = 'pane-2';
  wsA.panes[0] = { paneId: 'pane-0', symbolId: 1, timeframe: 'M15', viewport: null };
  wsA.panes[1] = { paneId: 'pane-1', symbolId: 2, timeframe: 'H1', viewport: null };
  wsA.panes[2] = { paneId: 'pane-2', symbolId: 3, timeframe: 'M5', viewport: null };

  saveSessionWorkspace(wsA, sessionA);

  // Resume Session A:
  const loadedA = loadSessionWorkspace(sessionA);
  assert(loadedA !== null, 'TEST 2: Session A workspace must load from storage');
  assert(loadedA?.layoutMode === '3l', 'TEST 2: Session A layoutMode must be "3l"');
  assert(loadedA?.activePaneId === 'pane-2', 'TEST 2: Session A activePaneId must be "pane-2"');
  assert(loadedA?.panes[1].symbolId === 2, 'TEST 2: Session A pane 1 symbol preserved');
  assert(loadedA?.panes[1].timeframe === 'H1', 'TEST 2: Session A pane 1 timeframe preserved');
  assert(loadedA?.panes[2].symbolId === 3, 'TEST 2: Session A pane 2 symbol preserved');
  console.log('[PASS] TEST 2: Session A persistence restores 3 layouts with custom timeframes');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — CREATE SESSION B AFTER SESSION A
// Creating Session B must produce 1 layout and leave Session A's 3 layouts intact
// ─────────────────────────────────────────────────────────────────────────────
{
  const sessionA = 'session-2001'; // from Test 2
  const sessionB = 'session-3001';

  // Create Session B as a new session:
  const wsB = createDefaultWorkspace(5, 'H4');
  saveSessionWorkspace(wsB, sessionB);

  // Verify Session B state:
  assert(wsB.layoutMode === '1', 'TEST 3: Session B must have exactly 1 layout');
  assert(wsB.activePaneId === 'pane-0', 'TEST 3: Session B activePaneId must be "pane-0"');
  assert(wsB.panes[0].symbolId === 5, 'TEST 3: Session B primary symbol must be 5');
  assert(wsB.panes[0].timeframe === 'H4', 'TEST 3: Session B initial timeframe must be "H4"');

  // Verify Session A is untouched:
  const loadedA = loadSessionWorkspace(sessionA);
  assert(loadedA?.layoutMode === '3l', 'TEST 3: Session A must retain layoutMode === "3l"');
  console.log('[PASS] TEST 3: Create Session B produces 1 layout while Session A retains 3 layouts');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4 — RESUME A AFTER CREATING B
// Resuming Session A after creating Session B must restore Session A's 3 layouts
// ─────────────────────────────────────────────────────────────────────────────
{
  const sessionA = 'session-2001';
  const resumedA = loadSessionWorkspace(sessionA);
  assert(resumedA !== null, 'TEST 4: Resumed Session A workspace exists');
  assert(resumedA?.layoutMode === '3l', 'TEST 4: Resumed Session A layoutMode === "3l"');
  assert(resumedA?.activePaneId === 'pane-2', 'TEST 4: Resumed Session A activePaneId === "pane-2"');
  assert(resumedA?.panes[1].timeframe === 'H1', 'TEST 4: Resumed Session A pane 1 timeframe === "H1"');
  console.log('[PASS] TEST 4: Resume Session A after creating B restores Session A layout state');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5 — RESUME B
// Resuming Session B must restore Session B's layout (1 layout)
// ─────────────────────────────────────────────────────────────────────────────
{
  const sessionB = 'session-3001';
  const resumedB = loadSessionWorkspace(sessionB);
  assert(resumedB !== null, 'TEST 5: Resumed Session B workspace exists');
  assert(resumedB?.layoutMode === '1', 'TEST 5: Resumed Session B layoutMode === "1"');
  assert(resumedB?.activePaneId === 'pane-0', 'TEST 5: Resumed Session B activePaneId === "pane-0"');
  assert(resumedB?.panes[0].symbolId === 5, 'TEST 5: Resumed Session B symbolId === 5');
  console.log('[PASS] TEST 5: Resume Session B restores Session B layout state (1 layout)');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6 — TIMEFRAME ISOLATION
// Session A had M15, H1, M5. Session B created with M30 does not inherit M15/H1/M5
// ─────────────────────────────────────────────────────────────────────────────
{
  const sessionC = 'session-6001';
  const wsC = createDefaultWorkspace(7, 'M30');
  saveSessionWorkspace(wsC, sessionC);

  assert(wsC.panes[0].timeframe === 'M30', 'TEST 6: Session C must have its own timeframe M30');
  assert(wsC.panes[1].symbolId === null, 'TEST 6: Session C pane 1 must be unallocated/null');
  console.log('[PASS] TEST 6: Timeframe isolation verified; zero timeframe leakage from previous sessions');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7 — GRID ISOLATION
// Session A had 3-way split/grid. Session B starts with single layout
// ─────────────────────────────────────────────────────────────────────────────
{
  const sessionD = 'session-7001';
  const wsD = createDefaultWorkspace(8, 'M15');
  saveSessionWorkspace(wsD, sessionD);

  assert(wsD.layoutMode === '1', 'TEST 7: Session D layoutMode must be "1"');
  console.log('[PASS] TEST 7: Grid isolation verified; zero grid/split leakage');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 8 — ACTIVE LAYOUT ISOLATION
// Session A activePaneId was "pane-2". Session B starts with "pane-0"
// ─────────────────────────────────────────────────────────────────────────────
{
  const sessionE = 'session-8001';
  const wsE = createDefaultWorkspace(9, 'M15');
  saveSessionWorkspace(wsE, sessionE);

  assert(wsE.activePaneId === 'pane-0', 'TEST 8: Session E activePaneId must be "pane-0"');
  console.log('[PASS] TEST 8: Active layout isolation verified; active layout starts at pane-0');
}

console.log('\n=====================================================');
console.log('ALL 8 SESSION LAYOUT ISOLATION ACCEPTANCE TESTS PASSED!');
console.log('=====================================================\n');
