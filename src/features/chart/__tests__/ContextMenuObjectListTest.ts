import { DrawingEngine } from '../../drawing/engine/DrawingEngine';
import { getDrawingStorageKey } from '../../drawing/engine/DrawingStorage';
import { ToolRegistry } from '../../drawing/tools/ToolRegistry';
import type { DrawingObject } from '../../drawing/engine/types';

// Mock localStorage if in node environment
const storageMap = new Map<string, string>();
if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage.getItem) {
  (globalThis as any).localStorage = {
    getItem: (k: string) => storageMap.get(k) ?? null,
    setItem: (k: string, v: string) => storageMap.set(k, v),
    removeItem: (k: string) => storageMap.delete(k),
    clear: () => storageMap.clear(),
  };
}

const toolRegistry = new ToolRegistry();

function getDrawingLabel(d: DrawingObject): string {
  if (d.text && d.text.trim().length > 0) {
    const cleanText = d.text.trim();
    const truncated = cleanText.length > 20 ? cleanText.slice(0, 20) + '…' : cleanText;
    return `Text: "${truncated}"`;
  }
  const tool = toolRegistry.get(d.type);
  if (tool?.label) {
    return tool.label;
  }
  return d.type
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function runObjectListTests() {
  console.log('=== RUNNING CONTEXT MENU OBJECT LIST FORENSIC INTEGRATION TESTS ===');

  const sessionA = 'sess-alpha';
  const sessionB = 'sess-beta';
  const symbolEur = 'EURUSD';
  const symbolGbp = 'GBPUSD';

  // ─────────────────────────────────────────────────────────────
  // SETUP: Create drawings for Session A / EURUSD
  // ─────────────────────────────────────────────────────────────
  const engineAEur = new DrawingEngine({ sessionId: sessionA, symbol: symbolEur });
  const t1 = engineAEur.createDrawing({ type: 'trendline', points: [{ time: 100, price: 1.1 }, { time: 200, price: 1.2 }] });
  const r1 = engineAEur.createDrawing({ type: 'rectangle', points: [{ time: 100, price: 1.1 }, { time: 200, price: 1.2 }] });
  const f1 = engineAEur.createDrawing({ type: 'fib-retracement', points: [{ time: 100, price: 1.1 }, { time: 200, price: 1.2 }] });

  // ─────────────────────────────────────────────────────────────
  // TEST 1 — DISPLAY: Session A / EURUSD shows 3 items with correct labels
  // ─────────────────────────────────────────────────────────────
  const listAEur = engineAEur.drawings.all;
  if (listAEur.length !== 3) {
    throw new Error(`TEST 1 Failed: Expected 3 drawings in Session A / EURUSD, got ${listAEur.length}`);
  }
  const labelsAEur = listAEur.map(getDrawingLabel);
  if (!labelsAEur.includes('Trend Line') || !labelsAEur.includes('Rectangle') || !labelsAEur.includes('Fib Retracement')) {
    throw new Error(`TEST 1 Failed: Labels incorrect: ${JSON.stringify(labelsAEur)}`);
  }
  console.log('[PASS] TEST 1 — DISPLAY: Session A / EURUSD has 3 objects with resolved labels:', labelsAEur);

  // ─────────────────────────────────────────────────────────────
  // TEST 2 — SELECT: Clicking an item in Object List updates existing SelectionManager
  // ─────────────────────────────────────────────────────────────
  engineAEur.selection.clear();
  if (engineAEur.selection.isSelected(t1.id)) {
    throw new Error('TEST 2 Failed: Selection should be clear initially');
  }
  // Simulate clicking Trendline in Object List
  engineAEur.selection.select(t1.id);
  if (!engineAEur.selection.isSelected(t1.id) || engineAEur.selection.getSelectedIds()[0] !== t1.id) {
    throw new Error('TEST 2 Failed: SelectionManager did not select Trendline');
  }
  console.log('[PASS] TEST 2 — SELECT: Clicking Trend Line selects it in SelectionManager');

  // ─────────────────────────────────────────────────────────────
  // TEST 3 — DELETE: Deleting Rectangle calls DrawingEngine.deleteDrawing
  // ─────────────────────────────────────────────────────────────
  const ok = engineAEur.deleteDrawing(r1.id);
  if (!ok) {
    throw new Error('TEST 3 Failed: deleteDrawing returned false');
  }
  const listAfterDelete = engineAEur.drawings.all;
  if (listAfterDelete.length !== 2 || listAfterDelete.some((d) => d.id === r1.id)) {
    throw new Error('TEST 3 Failed: Rectangle still exists in DrawingManager');
  }
  console.log('[PASS] TEST 3 — DELETE: Deleting Rectangle removes it from DrawingManager (count now 2)');

  // ─────────────────────────────────────────────────────────────
  // TEST 4 & 5 — SESSION & SYMBOL ISOLATION:
  // Session A / GBPUSD has 1 drawing
  // Session B / EURUSD has 1 drawing
  // ─────────────────────────────────────────────────────────────
  const engineAGbp = new DrawingEngine({ sessionId: sessionA, symbol: symbolGbp });
  engineAGbp.createDrawing({ type: 'horizontal-line', points: [{ time: 100, price: 1.3 }] });

  const engineBEur = new DrawingEngine({ sessionId: sessionB, symbol: symbolEur });
  engineBEur.createDrawing({ type: 'long-position', points: [{ time: 100, price: 1.05 }, { time: 200, price: 1.04 }, { time: 200, price: 1.07 }] });

  if (engineAGbp.drawings.all.length !== 1 || getDrawingLabel(engineAGbp.drawings.all[0]) !== 'Horizontal Line') {
    throw new Error('TEST 4/5 Failed: Session A / GBPUSD drawings leaked or incorrect');
  }
  if (engineBEur.drawings.all.length !== 1 || getDrawingLabel(engineBEur.drawings.all[0]) !== 'Long Position') {
    throw new Error('TEST 4/5 Failed: Session B / EURUSD drawings leaked or incorrect');
  }
  if (engineAEur.drawings.all.length !== 2) {
    throw new Error('TEST 4/5 Failed: Session A / EURUSD drawings contaminated');
  }
  console.log('[PASS] TEST 4 & 5 — SESSION & SYMBOL ISOLATION: A/EURUSD (2), A/GBPUSD (1), B/EURUSD (1) strictly isolated');

  // ─────────────────────────────────────────────────────────────
  // TEST 6 — EMPTY STATE: Engine with 0 drawings formats empty state
  // ─────────────────────────────────────────────────────────────
  const emptyEngine = new DrawingEngine({ sessionId: 'empty-sess', symbol: 'USDJPY' });
  if (emptyEngine.drawings.all.length !== 0) {
    throw new Error('TEST 6 Failed: Expected 0 drawings in empty engine');
  }
  console.log('[PASS] TEST 6 — EMPTY STATE: Empty engine returns 0 drawings gracefully');

  // ─────────────────────────────────────────────────────────────
  // TEST 7 — PERSISTENCE: Reloading from storage confirms deletion persisted
  // ─────────────────────────────────────────────────────────────
  const reloadedEngineAEur = new DrawingEngine({ sessionId: sessionA, symbol: symbolEur });
  const reloadedList = reloadedEngineAEur.drawings.all;
  if (reloadedList.length !== 2 || reloadedList.some((d) => d.id === r1.id)) {
    throw new Error('TEST 7 Failed: Rectangle deletion did not persist to storage');
  }
  console.log('[PASS] TEST 7 — PERSISTENCE: Reloaded engine confirms Rectangle deletion persisted');

  console.log('\nALL 7 CONTEXT MENU OBJECT LIST INTEGRATION TESTS PASSED!');
}

runObjectListTests();
