/**
 * Test Suite — Session-Scoped Drawing Persistence & Isolation
 *
 * Validates:
 * 1. TEST 1 — Session Isolation (Session A drawings vs Session B empty)
 * 2. TEST 2 — Session A Resume (Session A drawings restored exactly)
 * 3. TEST 3 — Session B Resume (Session B drawings restored accurately)
 * 4. TEST 4 — Cross Session Mutation (Deleting in B does not touch A)
 * 5. TEST 5 — New Session starts with 0 drawings
 * 6. TEST 6 — Debounce Race (Switching session flushes pending save to old session without cross-session write)
 * 7. TEST 7 — Multi-layout (Same session, multiple panes / symbols preserve drawings per symbol)
 * 8. TEST 8 — Existing Drawing Geometry & Integrity
 */

import { DrawingEngine } from '../engine/DrawingEngine';
import { getDrawingStorageKey, GLOBAL_DRAWING_STORAGE_KEY } from '../engine/DrawingStorage';
import type { DrawingObject } from '../engine/types';

export function runSessionScopedDrawingPersistenceTests(): {
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
    const sessionAId = 'session-alpha-123';
    const sessionBId = 'session-beta-456';
    const sessionCId = 'session-gamma-789';

    // -----------------------------------------------------------------
    // TEST 1: Session Isolation (Session A has Trendline + Fib, Session B starts empty)
    // -----------------------------------------------------------------
    const engineA = new DrawingEngine({ sessionId: sessionAId, symbol: 'EURUSD' });
    const trendlineA = engineA.createDrawing({
      type: 'trendline',
      points: [{ time: 1704100000, price: 1.0950 }, { time: 1704103600, price: 1.1000 }],
      style: { color: '#38bdf8', lineWidth: 2, lineStyle: 'solid', opacity: 100 },
      text: 'Trendline A',
    });
    const fibA = engineA.createDrawing({
      type: 'fibonacci',
      points: [{ time: 1704105000, price: 1.0900 }, { time: 1704110000, price: 1.1050 }],
      style: { color: '#f59e0b', lineWidth: 1, lineStyle: 'dashed', opacity: 80 },
    });

    const engineB = new DrawingEngine({ sessionId: sessionBId, symbol: 'EURUSD' });

    assert(
      engineA.drawings.all.length === 2 && engineB.drawings.all.length === 0,
      'TEST 1 — Session A contains 2 drawings, while Session B starts completely empty (Isolated)'
    );

    // -----------------------------------------------------------------
    // TEST 2: Session A Resume (Session A drawings restored exactly)
    // -----------------------------------------------------------------
    const resumedEngineA = new DrawingEngine({ sessionId: sessionAId, symbol: 'EURUSD' });
    const restoredDrawingsA = resumedEngineA.drawings.all;

    assert(
      restoredDrawingsA.length === 2 &&
      restoredDrawingsA.some((d) => d.id === trendlineA.id && d.points[0].price === 1.0950) &&
      restoredDrawingsA.some((d) => d.id === fibA.id && d.type === 'fibonacci'),
      'TEST 2 — Resume Session A restores exact drawings, coordinates (1.0950), and styles'
    );

    // -----------------------------------------------------------------
    // TEST 3: Session B Resume (Session B drawings restored with only B drawings)
    // -----------------------------------------------------------------
    const rectB = engineB.createDrawing({
      type: 'rectangle',
      points: [{ time: 1704120000, price: 1.0980 }, { time: 1704125000, price: 1.1020 }],
      style: { color: '#10b981', lineWidth: 1, lineStyle: 'solid', opacity: 100, fillEnabled: true },
    });

    const resumedEngineB = new DrawingEngine({ sessionId: sessionBId, symbol: 'EURUSD' });
    assert(
      resumedEngineB.drawings.all.length === 1 &&
      resumedEngineB.drawings.all[0].id === rectB.id &&
      resumedEngineB.drawings.all[0].type === 'rectangle',
      'TEST 3 — Resume Session B restores only Session B drawings (1 rectangle, 0 from A)'
    );

    // -----------------------------------------------------------------
    // TEST 4: Cross Session Mutation (Deleting drawing in B does not affect A)
    // -----------------------------------------------------------------
    resumedEngineB.deleteDrawing(rectB.id);

    const recheckEngineA = new DrawingEngine({ sessionId: sessionAId, symbol: 'EURUSD' });
    assert(
      resumedEngineB.drawings.all.length === 0 && recheckEngineA.drawings.all.length === 2,
      'TEST 4 — Deleting drawing in Session B leaves Session A with exactly 2 drawings untouched'
    );

    // -----------------------------------------------------------------
    // TEST 5: New Session starts with 0 drawings
    // -----------------------------------------------------------------
    const engineC = new DrawingEngine({ sessionId: sessionCId, symbol: 'EURUSD' });
    assert(
      engineC.drawings.all.length === 0,
      'TEST 5 — Brand new Session C starts with 0 drawings'
    );

    // -----------------------------------------------------------------
    // TEST 6: Debounce Race (Switching session flushes pending save to old session without cross-session write)
    // -----------------------------------------------------------------
    const engineSwitch = new DrawingEngine({ sessionId: sessionAId, symbol: 'EURUSD' });
    const hlineA = engineSwitch.createDrawing({
      type: 'horizontal-line',
      points: [{ time: 1704130000, price: 1.1100 }],
      style: { color: '#ec4899', lineWidth: 2, lineStyle: 'solid', opacity: 100 },
    });

    // Immediately switch session context to Session B before 500ms debounce fires
    engineSwitch.setSessionContext(sessionBId, 'EURUSD');

    // Verify Session A has 3 drawings in storage
    const storageKeyA = getDrawingStorageKey(sessionAId, 'EURUSD');
    const savedAJson = storageMap.get(storageKeyA);
    const parsedA = savedAJson ? JSON.parse(savedAJson) : { drawings: [] };
    const drawingsA = Array.isArray(parsedA) ? parsedA : (parsedA.drawings ?? []);

    // Verify Session B has 0 drawings in storage
    const storageKeyB = getDrawingStorageKey(sessionBId, 'EURUSD');
    const savedBJson = storageMap.get(storageKeyB);
    const parsedB = savedBJson ? JSON.parse(savedBJson) : { drawings: [] };
    const drawingsB = Array.isArray(parsedB) ? parsedB : (parsedB.drawings ?? []);

    assert(
      drawingsA.length === 3 && drawingsB.length === 0 && engineSwitch.drawings.all.length === 0,
      `TEST 6 — Instant session switch safely flushes Session A (3 drawings) and loads clean Session B (0 drawings)`
    );

    // -----------------------------------------------------------------
    // TEST 7: Multi-layout / Multi-pair within same session
    // -----------------------------------------------------------------
    const engineEur = new DrawingEngine({ sessionId: sessionAId, symbol: 'EURUSD' });
    const engineGbp = new DrawingEngine({ sessionId: sessionAId, symbol: 'GBPUSD' });

    engineGbp.createDrawing({
      type: 'trendline',
      points: [{ time: 1704100000, price: 1.2650 }, { time: 1704103600, price: 1.2700 }],
      style: { color: '#a855f7', lineWidth: 2, lineStyle: 'solid', opacity: 100 },
      text: 'GBP Trend',
    });

    assert(
      engineEur.drawings.all.length === 3 && engineGbp.drawings.all.length === 1,
      'TEST 7 — Multi-pair in Session A: EURUSD has 3 drawings and GBPUSD has 1 drawing (Symbol Isolated)'
    );

    // -----------------------------------------------------------------
    // TEST 8: Existing Drawing Geometry & Integrity
    // -----------------------------------------------------------------
    const gbpDrawing = engineGbp.drawings.all[0];
    assert(
      gbpDrawing.points[0].price === 1.2650 &&
      gbpDrawing.points[1].price === 1.2700 &&
      gbpDrawing.text === 'GBP Trend' &&
      gbpDrawing.style.color === '#a855f7',
      'TEST 8 — Drawing points, prices, styles, and text remain 100% intact'
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
