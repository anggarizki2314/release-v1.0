import { DragController } from '../interaction/DragController';
import { HitTestEngine } from '../interaction/HitTestEngine';
import { createLongPositionTool } from '../tools/shapeTools';
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

function runTests() {
  console.log('=== RUNNING POSITION TOOL INDEPENDENT DRAG TESTS ===');

  // Test 1: 1-Click creation of Long Position
  const longTool = createLongPositionTool();
  const mockCtx = {
    getSnapPoint: (x: number, y: number): DrawingPoint => ({
      time: mockCs.xToTime(x),
      price: mockCs.yToPrice(y),
    }),
  };

  const createdPoints = longTool.onPointerDown(mockCtx as any, 100, 500, []);
  if (createdPoints.length !== 3) {
    throw new Error(`Expected 3 points on creation, got ${createdPoints.length}`);
  }
  if (!longTool.isComplete(createdPoints)) {
    throw new Error('Expected tool to be complete on 1-click');
  }
  console.log('[PASS] Test 1: 1-Click placement creates 3 points and is complete');

  // Test 2: Dragging TP handle (index 0) only changes TP (points[2]) and does NOT change SL (points[1])
  const testDrawing: DrawingObject = {
    id: 'pos-1',
    type: 'long-position',
    points: [
      { time: 100, price: 5.0 }, // Entry
      { time: 200, price: 4.0 }, // SL (points[1])
      { time: 200, price: 7.0 }, // TP (points[2])
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

  let updatedPoints: DrawingPoint[] = [];
  const dragController = new DragController({
    getDrawing: () => testDrawing,
    updateDrawing: (_id, pts) => { updatedPoints = pts; },
  });

  // Start resize at anchor 0 (Target Center / TP)
  dragController.startResize('pos-1', 0, 150, mockCs.priceToY(7.0), testDrawing.points, mockCs, 'long-position');
  
  // Drag TP to new price (e.g. price 9.0 -> y = 1000 - 900 = 100)
  dragController.update(150, mockCs.priceToY(9.0), false, mockCs);
  const commitRes = dragController.commit(mockCs);

  if (!commitRes) {
    throw new Error('Expected commit result');
  }

  const finalPoints = commitRes.points;
  console.log('Final points after dragging TP:', finalPoints);

  // Verify TP (points[2]) updated to 9.0
  if (Math.abs(finalPoints[2].price - 9.0) > 0.001) {
    throw new Error(`Expected TP price to be 9.0, got ${finalPoints[2].price}`);
  }

  // Verify SL (points[1]) remained EXACTLY 4.0!
  if (Math.abs(finalPoints[1].price - 4.0) > 0.001) {
    throw new Error(`FAIL: SL price moved when dragging TP! Expected 4.0, got ${finalPoints[1].price}`);
  }

  // Verify Entry (points[0]) remained EXACTLY 5.0!
  if (Math.abs(finalPoints[0].price - 5.0) > 0.001) {
    throw new Error(`FAIL: Entry price moved when dragging TP! Expected 5.0, got ${finalPoints[0].price}`);
  }

  console.log('[PASS] Test 2: Dragging TP handle changes TP without affecting SL or Entry');

  // Test 3: Dragging SL handle (index 1) only changes SL (points[1]) and does NOT change TP (points[2])
  dragController.startResize('pos-1', 1, 150, mockCs.priceToY(4.0), testDrawing.points, mockCs, 'long-position');
  dragController.update(150, mockCs.priceToY(3.0), false, mockCs);
  const commitResSL = dragController.commit(mockCs);

  if (!commitResSL) {
    throw new Error('Expected commit result');
  }

  if (Math.abs(commitResSL.points[1].price - 3.0) > 0.001) {
    throw new Error(`Expected SL price to be 3.0, got ${commitResSL.points[1].price}`);
  }

  if (Math.abs(commitResSL.points[2].price - 7.0) > 0.001) {
    throw new Error(`FAIL: TP price moved when dragging SL! Expected 7.0, got ${commitResSL.points[2].price}`);
  }

  console.log('[PASS] Test 3: Dragging SL handle changes SL without affecting TP or Entry');

  // Test 4: Hit testing returns anchor 0 when hovering over TP handle
  const hitTest = new HitTestEngine();
  hitTest.setSelectedIds(['pos-1']);
  const hitTP = hitTest.test([testDrawing], 150, mockCs.priceToY(7.0), mockCs, false);

  if (hitTP.priority !== 'anchor' || hitTP.anchorIndex !== 0) {
    throw new Error(`Expected hit test on TP to return anchorIndex 0, got priority=${hitTP.priority} anchorIndex=${hitTP.anchorIndex}`);
  }

  const hitSL = hitTest.test([testDrawing], 150, mockCs.priceToY(4.0), mockCs, false);
  if (hitSL.priority !== 'anchor' || hitSL.anchorIndex !== 1) {
    throw new Error(`Expected hit test on SL to return anchorIndex 1, got priority=${hitSL.priority} anchorIndex=${hitSL.anchorIndex}`);
  }

  console.log('[PASS] Test 4: HitTestEngine correctly identifies TP handle (0) and SL handle (1)');

  console.log('\nALL 4 POSITION TOOL TESTS PASSED SUCCESSFULLY!');
}

runTests();
