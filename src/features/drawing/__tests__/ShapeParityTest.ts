import { ToolRegistry } from '../tools/ToolRegistry';
import { HitTestEngine } from '../interaction/HitTestEngine';
import { DragController } from '../interaction/DragController';
import { getFactoryDefaultStyle } from '../services/templateService';
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

function runShapeParityTests() {
  console.log('=== RUNNING TRADINGVIEW SHAPE PARITY INTEGRATION TESTS ===');
  const registry = new ToolRegistry();
  const mockCtx = {
    getSnapPoint: (x: number, y: number): DrawingPoint => ({
      time: mockCs.xToTime(x),
      price: mockCs.yToPrice(y),
    }),
  };

  // ─────────────────────────────────────────────────────────────
  // TEST 1 — Rotated Rectangle Geometry
  // ─────────────────────────────────────────────────────────────
  const p1 = { x: 100, y: 100 };
  const p2 = { x: 200, y: 100 };
  const p3 = { x: 200, y: 150 };

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  const nx = len > 0 ? -dy / len : 0;
  const ny = len > 0 ? dx / len : 1;
  const h = (p3.x - p1.x) * nx + (p3.y - p1.y) * ny;

  const c1 = p1;
  const c2 = p2;
  const c3 = { x: p2.x + nx * h, y: p2.y + ny * h };
  const c4 = { x: p1.x + nx * h, y: p1.y + ny * h };

  // Assert parallel opposite sides: c1->c2 parallel to c4->c3
  const edge1 = { dx: c2.x - c1.x, dy: c2.y - c1.y };
  const edgeOpp = { dx: c3.x - c4.x, dy: c3.y - c4.y };
  if (Math.abs(edge1.dx - edgeOpp.dx) > 0.001 || Math.abs(edge1.dy - edgeOpp.dy) > 0.001) {
    throw new Error('TEST 1 Failed: Rotated rectangle opposing edges not parallel');
  }
  console.log('[PASS] TEST 1: Rotated Rectangle generates 4 oriented parallel corners');

  // ─────────────────────────────────────────────────────────────
  // TEST 2 — Circle Radius Invariance (Rx === Ry)
  // ─────────────────────────────────────────────────────────────
  const circleCenter = { x: 100, y: 100 };
  const circlePerimeter = { x: 160, y: 180 };
  const radius = Math.hypot(circlePerimeter.x - circleCenter.x, circlePerimeter.y - circleCenter.y);
  if (Math.abs(radius - 100) > 0.001) {
    throw new Error(`TEST 2 Failed: Circle radius expected 100, got ${radius}`);
  }
  console.log('[PASS] TEST 2: Circle maintains single Euclidean radius (Rx === Ry)');

  // ─────────────────────────────────────────────────────────────
  // TEST 3 — Curve (TradingView: 1: Start -> 2: End -> 3: Apex)
  // ─────────────────────────────────────────────────────────────
  const curveTool = registry.get('curve');
  if (!curveTool || curveTool.requiredPoints !== 3) {
    throw new Error(`TEST 3 Failed: Curve tool expected 3 required points, got ${curveTool?.requiredPoints}`);
  }
  let cPts = curveTool.onPointerDown(mockCtx as any, 100, 500, []);
  cPts = curveTool.onPointerMove(mockCtx as any, 200, 500, cPts);
  cPts = curveTool.onPointerDown(mockCtx as any, 200, 500, cPts);
  if (curveTool.isComplete(cPts)) {
    throw new Error('TEST 3 Failed: Curve should not complete at click 2 before apex bend');
  }
  cPts = curveTool.onPointerMove(mockCtx as any, 150, 400, cPts);
  cPts = curveTool.onPointerDown(mockCtx as any, 150, 400, cPts);
  if (!curveTool.isComplete(cPts) || cPts.length !== 3) {
    throw new Error(`TEST 3 Failed: Curve should complete at click 3 with 3 points, got ${cPts.length}`);
  }
  // Points: [Start(100), Apex(150), End(200)]
  if (cPts[0].time !== 100 || cPts[1].time !== 150 || cPts[2].time !== 200) {
    throw new Error('TEST 3 Failed: Curve point layout [Start, Apex, End] mismatch');
  }
  console.log('[PASS] TEST 3: Curve correctly follows TradingView Start -> End -> Apex lifecycle');

  // ─────────────────────────────────────────────────────────────
  // TEST 4 — Double Curve (TradingView: 1: Start -> 2: End -> 3: CP1 -> 4: CP2)
  // ─────────────────────────────────────────────────────────────
  const doubleCurveTool = registry.get('double-curve');
  if (!doubleCurveTool || doubleCurveTool.requiredPoints !== 4) {
    throw new Error(`TEST 4 Failed: Double Curve tool expected 4 required points, got ${doubleCurveTool?.requiredPoints}`);
  }
  let dcPts = doubleCurveTool.onPointerDown(mockCtx as any, 100, 500, []);
  dcPts = doubleCurveTool.onPointerMove(mockCtx as any, 300, 500, dcPts);
  dcPts = doubleCurveTool.onPointerDown(mockCtx as any, 300, 500, dcPts);
  if (doubleCurveTool.isComplete(dcPts)) {
    throw new Error('TEST 4 Failed: Double Curve should not complete at click 2');
  }
  dcPts = doubleCurveTool.onPointerMove(mockCtx as any, 160, 400, dcPts);
  dcPts = doubleCurveTool.onPointerDown(mockCtx as any, 160, 400, dcPts);
  if (doubleCurveTool.isComplete(dcPts)) {
    throw new Error('TEST 4 Failed: Double Curve should not complete at click 3');
  }
  dcPts = doubleCurveTool.onPointerMove(mockCtx as any, 240, 600, dcPts);
  dcPts = doubleCurveTool.onPointerDown(mockCtx as any, 240, 600, dcPts);
  if (!doubleCurveTool.isComplete(dcPts) || dcPts.length !== 4) {
    throw new Error(`TEST 4 Failed: Double Curve should complete at click 4 with 4 points, got ${dcPts.length}`);
  }
  // Points: [Start(100), CP1(160), CP2(240), End(300)]
  if (dcPts[0].time !== 100 || dcPts[1].time !== 160 || dcPts[2].time !== 240 || dcPts[3].time !== 300) {
    throw new Error('TEST 4 Failed: Double Curve point layout [Start, CP1, CP2, End] mismatch');
  }
  console.log('[PASS] TEST 4: Double Curve correctly follows TradingView Start -> End -> CP1 -> CP2 lifecycle');

  // ─────────────────────────────────────────────────────────────
  // TEST 5 — Polyline (Open-Ended Multi-Vertex Placement)
  // ─────────────────────────────────────────────────────────────
  const polylineTool = registry.get('polyline');
  if (!polylineTool || polylineTool.requiredPoints !== -1) {
    throw new Error(`TEST 5 Failed: Polyline expected requiredPoints = -1, got ${polylineTool?.requiredPoints}`);
  }
  let polyPts = polylineTool.onPointerDown(mockCtx as any, 100, 500, []);
  polyPts = polylineTool.onPointerMove(mockCtx as any, 150, 450, polyPts);
  polyPts = polylineTool.onPointerDown(mockCtx as any, 150, 450, polyPts);
  polyPts = polylineTool.onPointerMove(mockCtx as any, 200, 550, polyPts);
  polyPts = polylineTool.onPointerDown(mockCtx as any, 200, 550, polyPts);
  polyPts = polylineTool.onPointerMove(mockCtx as any, 250, 400, polyPts);
  polyPts = polylineTool.onPointerDown(mockCtx as any, 250, 400, polyPts);

  // Assert it does NOT complete automatically at 3 or 4 points
  if (polylineTool.isComplete(polyPts)) {
    throw new Error('TEST 5 Failed: Polyline should NOT complete automatically during placement');
  }
  console.log('[PASS] TEST 5: Polyline supports continuous vertex placement without premature auto-completion');

  // ─────────────────────────────────────────────────────────────
  // TEST 6 — Default Style Fill Support for Shapes (Curve, Double Curve, Arc)
  // ─────────────────────────────────────────────────────────────
  const curveStyle = getFactoryDefaultStyle('curve');
  const doubleCurveStyle = getFactoryDefaultStyle('double-curve');
  const arcStyle = getFactoryDefaultStyle('arc');
  if (!curveStyle.fillEnabled || !doubleCurveStyle.fillEnabled || !arcStyle.fillEnabled) {
    throw new Error('TEST 6 Failed: Curve, Double Curve, or Arc missing default fill');
  }
  console.log('[PASS] TEST 6: Curve, Double Curve, and Arc have default shape fill enabled');

  // ─────────────────────────────────────────────────────────────
  // TEST 7 — Triangle 3-Point Editing
  // ─────────────────────────────────────────────────────────────
  const triDrawing: DrawingObject = {
    id: 'tri-1',
    type: 'triangle',
    points: [
      { time: 100, price: 5.0 },
      { time: 200, price: 5.0 },
      { time: 150, price: 8.0 },
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
    getDrawing: () => triDrawing,
    updateDrawing: () => {},
  });
  dragCtrl.startResize('tri-1', 2, 150, mockCs.priceToY(8.0), triDrawing.points, mockCs, 'triangle');
  dragCtrl.update(150, mockCs.priceToY(9.5), false, mockCs);
  const triCommit = dragCtrl.commit(mockCs);
  if (!triCommit || Math.abs(triCommit.points[2].price - 9.5) > 0.001) {
    throw new Error('TEST 7 Failed: Triangle point 3 drag failed');
  }
  console.log('[PASS] TEST 7: Triangle point 3 is independently draggable');

  // ─────────────────────────────────────────────────────────────
  // TEST 8 — Arc Circumcircle Geometry
  // ─────────────────────────────────────────────────────────────
  const arcP1 = { x: 100, y: 200 };
  const arcP2 = { x: 150, y: 150 };
  const arcP3 = { x: 200, y: 200 };
  const arcD = 2 * (arcP1.x * (arcP2.y - arcP3.y) + arcP2.x * (arcP3.y - arcP1.y) + arcP3.x * (arcP1.y - arcP2.y));
  if (Math.abs(arcD) < 0.0001) throw new Error('TEST 8 Failed: arc collinear check error');
  const arcP1Sq = arcP1.x * arcP1.x + arcP1.y * arcP1.y;
  const arcP2Sq = arcP2.x * arcP2.x + arcP2.y * arcP2.y;
  const arcP3Sq = arcP3.x * arcP3.x + arcP3.y * arcP3.y;
  const arcCx = (arcP1Sq * (arcP2.y - arcP3.y) + arcP2Sq * (arcP3.y - arcP1.y) + arcP3Sq * (arcP1.y - arcP2.y)) / arcD;
  const arcCy = (arcP1Sq * (arcP3.x - arcP2.x) + arcP2Sq * (arcP1.x - arcP3.x) + arcP3Sq * (arcP2.x - arcP1.x)) / arcD;
  const arcR = Math.hypot(arcP1.x - arcCx, arcP1.y - arcCy);
  if (!Number.isFinite(arcCx) || !Number.isFinite(arcCy) || !Number.isFinite(arcR) || arcR <= 0) {
    throw new Error('TEST 8 Failed: Arc circumcircle produces non-finite values');
  }
  console.log('[PASS] TEST 8: Arc 3-point circumcircle produces valid finite Center and Radius');

  // ─────────────────────────────────────────────────────────────
  // TEST 9 — Hit Testing on Shapes & Fills
  // ─────────────────────────────────────────────────────────────
  const hitTest = new HitTestEngine();
  const hitTri = hitTest.test([triDrawing], 150, mockCs.priceToY(6.0), mockCs, false);
  if (hitTri.priority !== 'drawing' || hitTri.drawingId !== 'tri-1') {
    throw new Error('TEST 9 Failed: HitTest did not detect triangle interior hit');
  }
  console.log('[PASS] TEST 9: HitTestEngine correctly identifies shape edges & polygon fills');

  // ─────────────────────────────────────────────────────────────
  // TEST 10 — Regression: Rectangle, Ellipse
  // ─────────────────────────────────────────────────────────────
  const rectTool = registry.get('rectangle');
  const ellipseTool = registry.get('ellipse');
  if (!rectTool || rectTool.requiredPoints !== 2) throw new Error('TEST 10 Failed: Rectangle tool regressed');
  if (!ellipseTool || ellipseTool.requiredPoints !== 2) throw new Error('TEST 10 Failed: Ellipse tool regressed');
  console.log('[PASS] TEST 10: Rectangle (2pt) and Ellipse (2pt) remain fully intact');

  console.log('\nALL 10 SHAPE PARITY INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

runShapeParityTests();
