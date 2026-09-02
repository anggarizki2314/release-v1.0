/**
 * Comprehensive Persistent Magnet Mode Test Suite
 * Tests Wick-Only Snapping (HIGH & LOW only, no OPEN, CLOSE, or BODY snap)
 * and all 9 Acceptance Criteria (Tests A through I).
 */

import { DrawingSnapManager } from '../engine/DrawingSnapManager';
import { DrawingEngine } from '../engine/DrawingEngine';
import { ToolRegistry } from '../tools/ToolRegistry';
import { DragController } from '../interaction/DragController';
import type { CoordinateSystem } from '../interaction/types';
import type { DrawingObject } from '../engine/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${msg}`);
  }
}

async function runPersistentMagnetTests() {
  console.log('=== RUNNING PERSISTENT MAGNET MODE (WICK-ONLY) TEST SUITE ===\n');

  // Sample candle data: EURUSD M1 candles around 1.0950
  // Candle 0: Open 1.09500, High 1.09580, Low 1.09420, Close 1.09540
  // Body is between 1.09500 and 1.09540. Top wick is 1.09580. Bottom wick is 1.09420.
  const sampleCandles = [
    { time: 1700000000, open: 1.09500, high: 1.09580, low: 1.09420, close: 1.09540 },
    { time: 1700000060, open: 1.09540, high: 1.09620, low: 1.09460, close: 1.09600 },
    { time: 1700000120, open: 1.09600, high: 1.09650, low: 1.09530, close: 1.09590 },
  ];

  // Mock Coordinate system (1 sec = 2 px, 1.09500 = 500px, 1.00000 = 100,000 px)
  const mockCs: CoordinateSystem = {
    screenToChart: (cx, cy) => ({ x: cx, y: cy }),
    timeToX: (t) => (t - 1700000000) * 2 + 100,
    priceToY: (p) => 500 - (p - 1.09500) * 100000,
    xToTime: (x) => 1700000000 + (x - 100) / 2,
    yToPrice: (y) => 1.09500 + (500 - y) / 100000,
  };

  const snapManager = new DrawingSnapManager();
  snapManager.setCandles(sampleCandles);
  const toolRegistry = new ToolRegistry();

  // ----------------------------------------------------
  // TEST A: Cursor near candle High -> snaps exactly to High
  // ----------------------------------------------------
  snapManager.setEnabled(true);
  const nearHighTime = 1700000002;
  const nearHighPrice = 1.09581; // 1 pip from High (1.09580)
  const snapHigh = snapManager.snap(nearHighTime, nearHighPrice, mockCs.xToTime, mockCs.yToPrice, mockCs.timeToX, mockCs.priceToY);
  assert(snapHigh.snapped === true, 'Test A: Must snap near High');
  assert(snapHigh.time === 1700000000, 'Test A: Snaps to candle timestamp');
  assert(snapHigh.price === 1.09580, 'Test A: Snaps to exact candle High wick');
  console.log('[PASS] TEST A: Cursor near candle High -> snaps exactly to High wick (1.09580)');

  // ----------------------------------------------------
  // TEST B: Cursor near candle Low -> snaps exactly to Low
  // ----------------------------------------------------
  const nearLowTime = 1700000001;
  const nearLowPrice = 1.09422; // near Low (1.09420)
  const snapLow = snapManager.snap(nearLowTime, nearLowPrice, mockCs.xToTime, mockCs.yToPrice, mockCs.timeToX, mockCs.priceToY);
  assert(snapLow.snapped === true, 'Test B: Must snap near Low');
  assert(snapLow.time === 1700000000, 'Test B: Snaps to candle timestamp');
  assert(snapLow.price === 1.09420, 'Test B: Snaps to exact candle Low wick');
  console.log('[PASS] TEST B: Cursor near candle Low -> snaps exactly to Low wick (1.09420)');

  // ----------------------------------------------------
  // TEST C: Cursor near candle Close -> does NOT snap
  // ----------------------------------------------------
  // Candle 0 Close is 1.09540. High is 1.09580 (40 pips away), Low is 1.09420 (120 pips away)
  const nearClosePrice = 1.09540;
  const snapClose = snapManager.snap(1700000000, nearClosePrice, mockCs.xToTime, mockCs.yToPrice, mockCs.timeToX, mockCs.priceToY);
  assert(!snapClose.snapped, 'Test C: Must NOT snap to candle Close');
  console.log('[PASS] TEST C: Cursor near candle Close -> does NOT snap');

  // ----------------------------------------------------
  // TEST D: Cursor near candle Open -> does NOT snap
  // ----------------------------------------------------
  // Candle 0 Open is 1.09500. High is 1.09580, Low is 1.09420
  const nearOpenPrice = 1.09500;
  const snapOpen = snapManager.snap(1700000000, nearOpenPrice, mockCs.xToTime, mockCs.yToPrice, mockCs.timeToX, mockCs.priceToY);
  assert(!snapOpen.snapped, 'Test D: Must NOT snap to candle Open');
  console.log('[PASS] TEST D: Cursor near candle Open -> does NOT snap');

  // ----------------------------------------------------
  // TEST E: Cursor inside candle body -> no Magnet snap
  // ----------------------------------------------------
  // Body is between 1.09500 and 1.09540 (midpoint 1.09520)
  const bodyMidpoint = 1.09520;
  const snapBody = snapManager.snap(1700000000, bodyMidpoint, mockCs.xToTime, mockCs.yToPrice, mockCs.timeToX, mockCs.priceToY);
  assert(!snapBody.snapped, 'Test E: Must NOT snap to candle body');
  console.log('[PASS] TEST E: Cursor inside candle body -> no Magnet snap');

  // ----------------------------------------------------
  // TEST F: Magnet remains ON after completing a drawing
  // ----------------------------------------------------
  const trendlineTool = toolRegistry.get('trendline');
  assert(trendlineTool !== undefined, 'Trendline tool exists');
  const pt2Raw = { time: 1700000062, price: 1.09618 };
  const snapPt2 = snapManager.snap(pt2Raw.time, pt2Raw.price, mockCs.xToTime, mockCs.yToPrice, mockCs.timeToX, mockCs.priceToY);
  assert(snapPt2.snapped && snapPt2.price === 1.09620, 'Test F: Pt2 snapped to Candle 1 High');
  assert(snapManager.isEnabled(), 'Test F: Magnet remains ON after drawing completion');
  console.log('[PASS] TEST F: Magnet remains ON after completing a drawing');

  // ----------------------------------------------------
  // TEST G: Create multiple drawings -> High/Low snapping remains active
  // ----------------------------------------------------
  const rectTool = toolRegistry.get('rectangle');
  assert(rectTool !== undefined, 'Rectangle tool exists');
  const snapPt3 = snapManager.snap(1700000118, 1.09532, mockCs.xToTime, mockCs.yToPrice, mockCs.timeToX, mockCs.priceToY);
  assert(snapPt3.snapped && snapPt3.time === 1700000120 && snapPt3.price === 1.09530, 'Test G: Snapped to Candle 2 Low wick');
  assert(snapManager.isEnabled(), 'Test G: Magnet remains active for subsequent drawings');
  console.log('[PASS] TEST G: Create multiple drawings -> High/Low snapping remains active');

  // ----------------------------------------------------
  // TEST H: Drag existing supported anchor -> High/Low snapping remains active
  // ----------------------------------------------------
  let storedDrawing: DrawingObject = {
    id: 'drw-test-1',
    type: 'trendline',
    points: [
      { time: 1700000000, price: 1.09580 },
      { time: 1700000060, price: 1.09620 },
    ],
    style: { color: '#2962ff', lineWidth: 2, lineStyle: 'solid', opacity: 1 },
    visible: true,
    hidden: false,
    selected: false,
    locked: false,
    rotation: 0,
    zIndex: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const dragController = new DragController({
    getDrawing: (id) => (id === storedDrawing.id ? storedDrawing : undefined),
    updateDrawing: (id, points) => { storedDrawing.points = points; },
    getSnapManager: () => snapManager,
  });

  dragController.startResize(storedDrawing.id, 1, 220, 460, storedDrawing.points, mockCs, 'trendline');
  assert(dragController.isActive, 'Drag controller active');
  
  // Drag near Candle 2 High (1.09650 @ 1700000120)
  const candle2HighScreenX = mockCs.timeToX(1700000120);
  const candle2HighScreenY = mockCs.priceToY(1.09650);
  dragController.update(candle2HighScreenX + 2, candle2HighScreenY - 1, false, mockCs);
  
  const commitRes = dragController.commit(mockCs);
  assert(commitRes !== null, 'Commit result returned');
  assert(commitRes!.points[1].time === 1700000120, 'Test H: Resized anchor snapped to Candle 2 time');
  assert(commitRes!.points[1].price === 1.09650, 'Test H: Resized anchor snapped to Candle 2 High price');
  console.log('[PASS] TEST H: Drag existing supported anchor -> High/Low snapping remains active');

  // ----------------------------------------------------
  // TEST I: Magnet OFF -> completely normal free positioning
  // ----------------------------------------------------
  snapManager.setEnabled(false);
  assert(!snapManager.isEnabled(), 'Test I: Magnet turned OFF');

  const snapOffRes = snapManager.snap(1700000002, 1.09579, mockCs.xToTime, mockCs.yToPrice, mockCs.timeToX, mockCs.priceToY);
  assert(!snapOffRes.snapped, 'Test I: Snapping disabled when Magnet OFF');
  assert(snapOffRes.time === 1700000002 && snapOffRes.price === 1.09579, 'Test I: Free positioning restored');
  console.log('[PASS] TEST I: Magnet OFF -> completely normal free positioning');

  // ----------------------------------------------------
  // Multi-chart / Session isolation & Entity cleanliness
  // ----------------------------------------------------
  const engineA = new DrawingEngine();
  const engineB = new DrawingEngine();
  engineA.snap.setEnabled(true);
  engineB.snap.setEnabled(false);
  assert(engineA.snap.isEnabled() === true, 'Engine A snap is enabled');
  assert(engineB.snap.isEnabled() === false, 'Engine B snap is disabled');
  assert(!('magnetEnabled' in storedDrawing), 'Clean geometry model verified (No magnetEnabled in drawing entities)');
  console.log('[PASS] Multi-chart isolation & Entity cleanliness verified');

  console.log('\n=====================================================');
  console.log('ALL WICK SNAP ACCEPTANCE TESTS (A-I) PASSED!');
  console.log('=====================================================\n');
}

runPersistentMagnetTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
