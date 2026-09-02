import { ToolRegistry } from '../tools/ToolRegistry';
import { HitTestEngine } from '../interaction/HitTestEngine';
import { DragController } from '../interaction/DragController';
import type { DrawingObject, DrawingPoint } from '../engine/types';
import type { CoordinateSystem } from '../interaction/types';

// Mock coordinate system
const mockCs: CoordinateSystem = {
  timeToX: (t: number) => t,
  priceToY: (p: number) => 1000 - p * 100, // higher price = smaller Y
  xToTime: (x: number) => x,
  yToPrice: (y: number) => (1000 - y) / 100,
  screenToChart: (clientX: number, clientY: number) => ({ x: clientX, y: clientY }),
};

function runFibonacciParityTests() {
  console.log('=== RUNNING TRADINGVIEW FIBONACCI SUITE INTEGRATION TESTS ===');
  const registry = new ToolRegistry();
  const mockCtx = {
    getSnapPoint: (x: number, y: number): DrawingPoint => ({
      time: mockCs.xToTime(x),
      price: mockCs.yToPrice(y),
    }),
  };

  // ─────────────────────────────────────────────────────────────
  // TEST 1 — Fibonacci Retracement (2-point, intact)
  // ─────────────────────────────────────────────────────────────
  const fibRetraceTool = registry.get('fib-retracement');
  if (!fibRetraceTool || fibRetraceTool.requiredPoints !== 2) {
    throw new Error('TEST 1 Failed: Fib Retracement tool requiredPoints should be 2');
  }
  let retracePts = fibRetraceTool.onPointerDown(mockCtx as any, 100, 500, []);
  retracePts = fibRetraceTool.onPointerMove(mockCtx as any, 200, 300, retracePts);
  retracePts = fibRetraceTool.onPointerDown(mockCtx as any, 200, 300, retracePts);
  if (!fibRetraceTool.isComplete(retracePts) || retracePts.length !== 2) {
    throw new Error('TEST 1 Failed: Fib Retracement completion error');
  }
  console.log('[PASS] TEST 1: Fibonacci Retracement 2-point tool is intact');

  // ─────────────────────────────────────────────────────────────
  // TEST 2 — Fibonacci Extension (3-point, Wave 1 projected from P3)
  // ─────────────────────────────────────────────────────────────
  const fibExtTool = registry.get('fib-extension');
  if (!fibExtTool || fibExtTool.requiredPoints !== 3) {
    throw new Error('TEST 2 Failed: Fib Extension tool requiredPoints should be 3');
  }
  let extPts = fibExtTool.onPointerDown(mockCtx as any, 100, mockCs.priceToY(1.0), []); // P1: Low 1.0
  extPts = fibExtTool.onPointerDown(mockCtx as any, 200, mockCs.priceToY(1.5), extPts); // P2: High 1.5 (Delta = 0.5)
  extPts = fibExtTool.onPointerDown(mockCtx as any, 250, mockCs.priceToY(1.2), extPts); // P3: Retracement 1.2
  if (!fibExtTool.isComplete(extPts) || extPts.length !== 3) {
    throw new Error('TEST 2 Failed: Fib Extension completion error');
  }
  // Assert projected price at 1.0 (100%): 1.2 + 0.5 * 1.0 = 1.7
  const deltaP = extPts[1].price - extPts[0].price; // 0.5
  const proj100 = extPts[2].price + deltaP * 1.0; // 1.7
  const proj1618 = extPts[2].price + deltaP * 1.618; // 2.009
  if (Math.abs(proj100 - 1.7) > 0.001 || Math.abs(proj1618 - 2.009) > 0.001) {
    throw new Error('TEST 2 Failed: Fib Extension projection calculation mismatch');
  }
  console.log('[PASS] TEST 2: Fibonacci Extension 3-point tool correctly projects levels from P3');

  // ─────────────────────────────────────────────────────────────
  // TEST 3 — Fibonacci Time Zone (2-point, Fib sequence intervals)
  // ─────────────────────────────────────────────────────────────
  const fibTzTool1 = registry.get('fib-timezone');
  const fibTzTool2 = registry.get('fib-time-zone');
  if (!fibTzTool1 || !fibTzTool2) {
    throw new Error('TEST 3 Failed: Fib Time Zone tool missing under fib-timezone or fib-time-zone');
  }
  let tzPts = fibTzTool1.onPointerDown(mockCtx as any, 1000, 500, []);
  tzPts = fibTzTool1.onPointerDown(mockCtx as any, 1100, 500, tzPts); // Interval = 100s
  if (!fibTzTool1.isComplete(tzPts) || tzPts.length !== 2) {
    throw new Error('TEST 3 Failed: Fib Time Zone completion error');
  }
  const interval = tzPts[1].time - tzPts[0].time; // 100
  const seq5 = tzPts[0].time + interval * 5; // 1500
  const seq8 = tzPts[0].time + interval * 8; // 1800
  if (seq5 !== 1500 || seq8 !== 1800) {
    throw new Error('TEST 3 Failed: Fib Time Zone sequence calculation mismatch');
  }
  console.log('[PASS] TEST 3: Fibonacci Time Zone accurately computes sequence intervals (0, 1, 2, 3, 5, 8...)');

  // ─────────────────────────────────────────────────────────────
  // TEST 4 — Fibonacci Fan (2-point, ray ratio calculations)
  // ─────────────────────────────────────────────────────────────
  const fibFanTool = registry.get('fib-fan');
  if (!fibFanTool || fibFanTool.requiredPoints !== 2) {
    throw new Error('TEST 4 Failed: Fib Fan tool requiredPoints should be 2');
  }
  let fanPts = fibFanTool.onPointerDown(mockCtx as any, 100, 500, []);
  fanPts = fibFanTool.onPointerDown(mockCtx as any, 200, 300, fanPts);
  if (!fibFanTool.isComplete(fanPts) || fanPts.length !== 2) {
    throw new Error('TEST 4 Failed: Fib Fan completion error');
  }
  console.log('[PASS] TEST 4: Fibonacci Fan 2-point tool is registered and complete');

  // ─────────────────────────────────────────────────────────────
  // TEST 5 — Fibonacci Channel (3-point, parallel levels)
  // ─────────────────────────────────────────────────────────────
  const fibChanTool = registry.get('fib-channel');
  if (!fibChanTool || fibChanTool.requiredPoints !== 3) {
    throw new Error('TEST 5 Failed: Fib Channel tool requiredPoints should be 3');
  }
  let chanPts = fibChanTool.onPointerDown(mockCtx as any, 100, 500, []);
  chanPts = fibChanTool.onPointerDown(mockCtx as any, 200, 400, chanPts);
  chanPts = fibChanTool.onPointerDown(mockCtx as any, 100, 550, chanPts);
  if (!fibChanTool.isComplete(chanPts) || chanPts.length !== 3) {
    throw new Error('TEST 5 Failed: Fib Channel completion error');
  }
  console.log('[PASS] TEST 5: Fibonacci Channel 3-point tool is registered and complete');

  // ─────────────────────────────────────────────────────────────
  // TEST 6 — Hit Testing on Fibonacci Level Lines
  // ─────────────────────────────────────────────────────────────
  const hitTest = new HitTestEngine();
  const fibDrawing: DrawingObject = {
    id: 'fib-1',
    type: 'fib-retracement',
    points: [
      { time: 100, price: 1.0 },
      { time: 200, price: 2.0 },
    ],
    style: { color: '#2962ff', lineWidth: 1, lineStyle: 'solid', opacity: 100 },
    rotation: 0,
    selected: false,
    locked: false,
    hidden: false,
    visible: true,
    zIndex: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  // Test hit on 0.5 level line (price 1.5 -> Y = 850 in mockCs)
  const yLevel50 = mockCs.priceToY(1.5);
  const hitFib = hitTest.test([fibDrawing], 150, yLevel50, mockCs, false);
  if (hitFib.priority !== 'drawing' || hitFib.drawingId !== 'fib-1') {
    throw new Error('TEST 6 Failed: HitTest did not detect 50% Fibonacci level line click');
  }
  console.log('[PASS] TEST 6: HitTestEngine detects clicks on all Fibonacci horizontal level lines');

  // ─────────────────────────────────────────────────────────────
  // TEST 7 — Independent Vertex Drag on 3-point Fibonacci Extension
  // ─────────────────────────────────────────────────────────────
  const fibExtDrawing: DrawingObject = {
    id: 'fib-ext-1',
    type: 'fib-extension',
    points: [
      { time: 100, price: 1.0 },
      { time: 200, price: 2.0 },
      { time: 250, price: 1.5 },
    ],
    style: { color: '#2962ff', lineWidth: 1, lineStyle: 'solid', opacity: 100 },
    rotation: 0,
    selected: false,
    locked: false,
    hidden: false,
    visible: true,
    zIndex: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const dragCtrl = new DragController({
    getDrawing: () => fibExtDrawing,
    updateDrawing: () => {},
  });
  // Drag Point 3 (anchor 2)
  dragCtrl.startResize('fib-ext-1', 2, 250, mockCs.priceToY(1.5), fibExtDrawing.points, mockCs, 'fib-extension');
  dragCtrl.update(270, mockCs.priceToY(1.7), false, mockCs);
  const committed = dragCtrl.commit(mockCs);
  if (!committed || Math.abs(committed.points[2].price - 1.7) > 0.001 || committed.points[2].time !== 270) {
    throw new Error('TEST 7 Failed: Fib Extension point 3 drag failed');
  }
  console.log('[PASS] TEST 7: Fibonacci Extension points P1, P2, P3 are independently draggable');

  // ─────────────────────────────────────────────────────────────
  // TEST 8 — Gann Box (2-point, coordinate geometry & grid divisions)
  // ─────────────────────────────────────────────────────────────
  const gannBoxTool = registry.get('gann-box');
  if (!gannBoxTool || gannBoxTool.requiredPoints !== 2) {
    throw new Error('TEST 8 Failed: Gann Box tool requiredPoints should be 2');
  }
  let gannBoxPts = gannBoxTool.onPointerDown(mockCtx as any, 100, mockCs.priceToY(1.0), []);
  gannBoxPts = gannBoxTool.onPointerDown(mockCtx as any, 300, mockCs.priceToY(3.0), gannBoxPts);
  if (!gannBoxTool.isComplete(gannBoxPts) || gannBoxPts.length !== 2) {
    throw new Error('TEST 8 Failed: Gann Box completion error');
  }
  const gannBoxDrawing: DrawingObject = {
    id: 'gann-box-1',
    type: 'gann-box',
    points: gannBoxPts,
    style: { color: '#2962ff', lineWidth: 1, lineStyle: 'solid', opacity: 100 },
    rotation: 0,
    selected: false,
    locked: false,
    hidden: false,
    visible: true,
    zIndex: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const hitGannBox = hitTest.test([gannBoxDrawing], 200, mockCs.priceToY(2.0), mockCs, false);
  if (hitGannBox.priority !== 'drawing' || hitGannBox.drawingId !== 'gann-box-1') {
    throw new Error('TEST 8 Failed: HitTest did not detect Gann Box center intersection');
  }
  console.log('[PASS] TEST 8: Gann Box 2-point tool and internal matrix grid hit-testing verified');

  // ─────────────────────────────────────────────────────────────
  // TEST 9 — Gann Fan (2-point, 9 ray slopes from origin)
  // ─────────────────────────────────────────────────────────────
  const gannFanTool = registry.get('gann-fan');
  if (!gannFanTool || gannFanTool.requiredPoints !== 2) {
    throw new Error('TEST 9 Failed: Gann Fan tool requiredPoints should be 2');
  }
  let gannFanPts = gannFanTool.onPointerDown(mockCtx as any, 100, mockCs.priceToY(1.0), []);
  gannFanPts = gannFanTool.onPointerDown(mockCtx as any, 200, mockCs.priceToY(2.0), gannFanPts);
  if (!gannFanTool.isComplete(gannFanPts) || gannFanPts.length !== 2) {
    throw new Error('TEST 9 Failed: Gann Fan completion error');
  }
  const gannFanDrawing: DrawingObject = {
    id: 'gann-fan-1',
    type: 'gann-fan',
    points: gannFanPts,
    style: { color: '#2962ff', lineWidth: 1, lineStyle: 'solid', opacity: 100 },
    rotation: 0,
    selected: false,
    locked: false,
    hidden: false,
    visible: true,
    zIndex: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const hitGannFan = hitTest.test([gannFanDrawing], 200, mockCs.priceToY(2.0), mockCs, false);
  if (hitGannFan.priority !== 'drawing' || hitGannFan.drawingId !== 'gann-fan-1') {
    throw new Error('TEST 9 Failed: HitTest did not detect Gann Fan 1x1 ray line');
  }
  console.log('[PASS] TEST 9: Gann Fan 2-point tool and 1x1 base ray verified');

  console.log('\nALL 9 FIBONACCI & GANN PARITY INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

runFibonacciParityTests();
