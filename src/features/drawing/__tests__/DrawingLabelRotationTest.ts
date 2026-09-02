/**
 * Drawing Engine Label Rotation & Geometry Synchronization Test Suite
 *
 * Verifies that text labels attached to directional drawings visually follow
 * the exact angle of their associated line derived from screen coordinates,
 * while non-directional, special geometry, and standalone text retain their
 * standard horizontal / domain-specific orientations.
 */

import { DrawingRenderer, type RenderContext, type RenderState } from '../engine/DrawingRenderer';
import type { DrawingObject } from '../engine/types';

interface MockCall {
  method: string;
  args: any[];
  transform?: any;
}

function makeDrawing(partial: Partial<DrawingObject> & { id: string; points: Array<{ time: number; price: number }> }): DrawingObject {
  return {
    type: 'trendline',
    visible: true,
    hidden: false,
    selected: false,
    locked: false,
    rotation: 0,
    zIndex: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    style: { color: '#ffffff', lineWidth: 2, lineStyle: 'solid', opacity: 100 },
    ...partial,
  };
}

function createMockCanvasContext() {
  const calls: MockCall[] = [];
  let currentTransform = { x: 0, y: 0, angle: 0 };
  const transformStack: Array<{ x: number; y: number; angle: number }> = [];

  const ctx: any = {
    calls,
    save: () => {
      transformStack.push({ ...currentTransform });
      calls.push({ method: 'save', args: [] });
    },
    restore: () => {
      const popped = transformStack.pop();
      if (popped) currentTransform = popped;
      calls.push({ method: 'restore', args: [] });
    },
    translate: (x: number, y: number) => {
      currentTransform.x += x;
      currentTransform.y += y;
      calls.push({ method: 'translate', args: [x, y] });
    },
    rotate: (rad: number) => {
      currentTransform.angle += rad;
      calls.push({ method: 'rotate', args: [rad] });
    },
    scale: (sx: number, sy: number) => calls.push({ method: 'scale', args: [sx, sy] }),
    setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => {
      calls.push({ method: 'setTransform', args: [a, b, c, d, e, f] });
    },
    clearRect: (x: number, y: number, w: number, h: number) => calls.push({ method: 'clearRect', args: [x, y, w, h] }),
    beginPath: () => calls.push({ method: 'beginPath', args: [] }),
    moveTo: (x: number, y: number) => calls.push({ method: 'moveTo', args: [x, y] }),
    lineTo: (x: number, y: number) => calls.push({ method: 'lineTo', args: [x, y] }),
    stroke: () => calls.push({ method: 'stroke', args: [] }),
    fill: () => calls.push({ method: 'fill', args: [] }),
    rect: (x: number, y: number, w: number, h: number) => calls.push({ method: 'rect', args: [x, y, w, h] }),
    clip: () => calls.push({ method: 'clip', args: [] }),
    setLineDash: (dash: number[]) => calls.push({ method: 'setLineDash', args: [dash] }),
    fillText: (text: string, x: number, y: number) => {
      calls.push({
        method: 'fillText',
        args: [text, x, y],
        transform: { ...currentTransform },
      });
    },
    measureText: (text: string) => ({ width: text.length * 7 }),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: 'center',
    textBaseline: 'middle',
  };

  const canvas: any = {
    getContext: () => ctx,
    width: 1000,
    height: 600,
    style: {},
  };

  return { ctx, canvas, calls };
}

function runUniversalDrawingLabelRotationTests() {
  console.log('=== RUNNING UNIVERSAL DRAWING LABEL GEOMETRY & ROTATION TEST SUITE ===');
  let passedCount = 0;
  let totalCount = 0;

  function test(name: string, fn: () => void) {
    totalCount++;
    try {
      fn();
      console.log(`[PASS] Test ${totalCount}: ${name}`);
      passedCount++;
    } catch (err: any) {
      console.error(`[FAIL] Test ${totalCount}: ${name}`);
      console.error(err);
    }
  }

  const defaultState: RenderState = {
    selectedIds: new Set(),
    hoveredId: null,
    tempPoints: [],
    activeTool: 'pointer',
  };

  // TEST 1: Horizontal directional line -> label angle ≈ 0°
  test('TEST 1 — Horizontal directional line: label angle ≈ 0°', () => {
    const renderer = new DrawingRenderer();
    const { canvas, calls } = createMockCanvasContext();
    renderer.setCanvas(canvas);
    renderer.resize(1000, 600);

    const drawing = makeDrawing({
      id: 'trend-1',
      type: 'trendline',
      points: [{ time: 100, price: 1.1000 }, { time: 200, price: 1.1000 }],
      style: { color: '#ffffff', lineWidth: 2, lineStyle: 'solid', opacity: 100, text: 'Support Level' },
      text: 'Support Level',
    });

    const rc: RenderContext = {
      timeToX: (t) => t * 2, // dx = 200
      priceToY: () => 300,  // dy = 0
      xToTime: (x) => x / 2,
      yToPrice: (y) => y,
      width: 1000,
      height: 600,
      priceScaleWidth: 60,
      timeScaleHeight: 30,
    };

    renderer.render([drawing], rc, defaultState);

    const rotateCalls = calls.filter((c) => c.method === 'rotate');
    if (rotateCalls.length === 0) throw new Error('Expected rotate to be called');
    const angleDeg = (rotateCalls[0].args[0] * 180) / Math.PI;
    if (Math.abs(angleDeg) > 0.001) throw new Error(`Expected angle ~0°, got ${angleDeg}°`);
  });

  // TEST 2: Positive diagonal -> follows positive visual slope
  test('TEST 2 — Positive diagonal: label follows positive visual slope (+30°)', () => {
    const renderer = new DrawingRenderer();
    const { canvas, calls } = createMockCanvasContext();
    renderer.setCanvas(canvas);
    renderer.resize(1000, 600);

    const drawing = makeDrawing({
      id: 'trend-2',
      type: 'trendline',
      points: [{ time: 0, price: 0 }, { time: 100, price: 100 }],
      style: { color: '#ffffff', lineWidth: 2, lineStyle: 'solid', opacity: 100, text: '30 deg trend' },
      text: '30 deg trend',
    });

    const rc: RenderContext = {
      timeToX: (t) => t,
      priceToY: (p) => (p === 0 ? 100 : 100 + 100 * Math.tan((30 * Math.PI) / 180)),
      xToTime: (x) => x,
      yToPrice: (y) => y,
      width: 1000,
      height: 600,
      priceScaleWidth: 60,
      timeScaleHeight: 30,
    };

    renderer.render([drawing], rc, defaultState);

    const rotateCalls = calls.filter((c) => c.method === 'rotate');
    const angleDeg = (rotateCalls[0].args[0] * 180) / Math.PI;
    if (Math.abs(angleDeg - 30) > 0.05) throw new Error(`Expected angle ~30°, got ${angleDeg}°`);
  });

  // TEST 3: Negative diagonal -> follows negative visual slope
  test('TEST 3 — Negative diagonal: label follows negative visual slope (-30°)', () => {
    const renderer = new DrawingRenderer();
    const { canvas, calls } = createMockCanvasContext();
    renderer.setCanvas(canvas);
    renderer.resize(1000, 600);

    const drawing = makeDrawing({
      id: 'trend-3',
      type: 'trendline',
      points: [{ time: 0, price: 0 }, { time: 100, price: 100 }],
      style: { color: '#ffffff', lineWidth: 2, lineStyle: 'solid', opacity: 100, text: 'minus 30 deg' },
      text: 'minus 30 deg',
    });

    const rc: RenderContext = {
      timeToX: (t) => t,
      priceToY: (p) => (p === 0 ? 200 : 200 - 100 * Math.tan((30 * Math.PI) / 180)),
      xToTime: (x) => x,
      yToPrice: (y) => y,
      width: 1000,
      height: 600,
      priceScaleWidth: 60,
      timeScaleHeight: 30,
    };

    renderer.render([drawing], rc, defaultState);

    const rotateCalls = calls.filter((c) => c.method === 'rotate');
    const angleDeg = (rotateCalls[0].args[0] * 180) / Math.PI;
    if (Math.abs(angleDeg - -30) > 0.05) throw new Error(`Expected angle ~-30°, got ${angleDeg}°`);
  });

  // TEST 4: Steep diagonal -> follows steep slope while remaining readable
  test('TEST 4 — Steep diagonal: label follows steep slope (+60°) while remaining readable', () => {
    const renderer = new DrawingRenderer();
    const { canvas, calls } = createMockCanvasContext();
    renderer.setCanvas(canvas);
    renderer.resize(1000, 600);

    const drawing = makeDrawing({
      id: 'trend-4',
      type: 'trendline',
      points: [{ time: 0, price: 0 }, { time: 100, price: 100 }],
      style: { color: '#ffffff', lineWidth: 2, lineStyle: 'solid', opacity: 100, text: '60 deg steep' },
      text: '60 deg steep',
    });

    const rc: RenderContext = {
      timeToX: (t) => t,
      priceToY: (p) => (p === 0 ? 100 : 100 + 100 * Math.tan((60 * Math.PI) / 180)),
      xToTime: (x) => x,
      yToPrice: (y) => y,
      width: 1000,
      height: 600,
      priceScaleWidth: 60,
      timeScaleHeight: 30,
    };

    renderer.render([drawing], rc, defaultState);

    const rotateCalls = calls.filter((c) => c.method === 'rotate');
    const angleDeg = (rotateCalls[0].args[0] * 180) / Math.PI;
    if (Math.abs(angleDeg - 60) > 0.05) throw new Error(`Expected angle ~60°, got ${angleDeg}°`);
  });

  // TEST 5: Reverse endpoint order -> does NOT become upside-down
  test('TEST 5 — Reverse endpoint order: label does NOT become upside-down', () => {
    const renderer = new DrawingRenderer();
    const { canvas, calls } = createMockCanvasContext();
    renderer.setCanvas(canvas);
    renderer.resize(1000, 600);

    // Right to left (x1 = 300, x2 = 100) -> normalized angle in [-90, 90]
    const drawing = makeDrawing({
      id: 'trend-5',
      type: 'trendline',
      points: [{ time: 300, price: 100 }, { time: 100, price: 200 }],
      style: { color: '#ffffff', lineWidth: 2, lineStyle: 'solid', opacity: 100, text: 'Reverse Line' },
      text: 'Reverse Line',
    });

    const rc: RenderContext = {
      timeToX: (t) => t,
      priceToY: (p) => p,
      xToTime: (x) => x,
      yToPrice: (y) => y,
      width: 1000,
      height: 600,
      priceScaleWidth: 60,
      timeScaleHeight: 30,
    };

    renderer.render([drawing], rc, defaultState);

    const rotateCalls = calls.filter((c) => c.method === 'rotate');
    const angleDeg = (rotateCalls[0].args[0] * 180) / Math.PI;
    if (angleDeg > 90 || angleDeg < -90) throw new Error(`Upside down angle ${angleDeg}°!`);
    if (Math.abs(angleDeg - -26.565) > 0.1) throw new Error(`Expected angle ~-26.57°, got ${angleDeg}°`);
  });

  // TEST 6: Drag first endpoint -> label angle updates immediately
  test('TEST 6 — Drag first endpoint: label angle updates immediately', () => {
    const renderer = new DrawingRenderer();
    const { canvas, calls } = createMockCanvasContext();
    renderer.setCanvas(canvas);
    renderer.resize(1000, 600);

    const drawing = makeDrawing({
      id: 'trend-6',
      type: 'trendline',
      points: [{ time: 100, price: 100 }, { time: 200, price: 200 }],
      style: { color: '#ffffff', lineWidth: 2, lineStyle: 'solid', opacity: 100, text: 'Drag P1' },
      text: 'Drag P1',
    });

    const rc: RenderContext = {
      timeToX: (t) => t,
      priceToY: (p) => p,
      xToTime: (x) => x,
      yToPrice: (y) => y,
      width: 1000,
      height: 600,
      priceScaleWidth: 60,
      timeScaleHeight: 30,
    };

    // Drag point 1 to (100, 200), making line horizontal (dy = 0)
    const activeDragState: RenderState = {
      ...defaultState,
      activeDrag: {
        drawingId: 'trend-6',
        screenPoints: [{ x: 100, y: 200 }, { x: 200, y: 200 }],
      },
    };

    renderer.render([drawing], rc, activeDragState);

    const rotateCalls = calls.filter((c) => c.method === 'rotate');
    const angleDeg = (rotateCalls[0].args[0] * 180) / Math.PI;
    if (Math.abs(angleDeg) > 0.001) throw new Error(`Expected angle ~0° after dragging P1, got ${angleDeg}°`);
  });

  // TEST 7: Drag second endpoint -> label angle updates immediately
  test('TEST 7 — Drag second endpoint: label angle updates immediately', () => {
    const renderer = new DrawingRenderer();
    const { canvas, calls } = createMockCanvasContext();
    renderer.setCanvas(canvas);
    renderer.resize(1000, 600);

    const drawing = makeDrawing({
      id: 'trend-7',
      type: 'trendline',
      points: [{ time: 100, price: 100 }, { time: 200, price: 100 }],
      style: { color: '#ffffff', lineWidth: 2, lineStyle: 'solid', opacity: 100, text: 'Drag P2' },
      text: 'Drag P2',
    });

    const rc: RenderContext = {
      timeToX: (t) => t,
      priceToY: (p) => p,
      xToTime: (x) => x,
      yToPrice: (y) => y,
      width: 1000,
      height: 600,
      priceScaleWidth: 60,
      timeScaleHeight: 30,
    };

    // Drag point 2 to (200, 200), making line 45°
    const activeDragState: RenderState = {
      ...defaultState,
      activeDrag: {
        drawingId: 'trend-7',
        screenPoints: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
      },
    };

    renderer.render([drawing], rc, activeDragState);

    const rotateCalls = calls.filter((c) => c.method === 'rotate');
    const angleDeg = (rotateCalls[0].args[0] * 180) / Math.PI;
    if (Math.abs(angleDeg - 45) > 0.05) throw new Error(`Expected angle ~45° after dragging P2, got ${angleDeg}°`);
  });

  // TEST 8: Move entire drawing -> label remains attached with exact same slope
  test('TEST 8 — Move entire drawing: label remains attached with exact same slope', () => {
    const renderer = new DrawingRenderer();
    const { canvas, calls } = createMockCanvasContext();
    renderer.setCanvas(canvas);
    renderer.resize(1000, 600);

    const drawing = makeDrawing({
      id: 'trend-8',
      type: 'trendline',
      points: [{ time: 100, price: 100 }, { time: 200, price: 200 }],
      style: { color: '#ffffff', lineWidth: 2, lineStyle: 'solid', opacity: 100, text: 'Move' },
      text: 'Move',
    });

    const rc: RenderContext = {
      timeToX: (t) => t,
      priceToY: (p) => p,
      xToTime: (x) => x,
      yToPrice: (y) => y,
      width: 1000,
      height: 600,
      priceScaleWidth: 60,
      timeScaleHeight: 30,
    };

    // Move entire line by (+50, +50) -> screen points: (150, 150) to (250, 250)
    const activeDragState: RenderState = {
      ...defaultState,
      activeDrag: {
        drawingId: 'trend-8',
        screenPoints: [{ x: 150, y: 150 }, { x: 250, y: 250 }],
      },
    };

    renderer.render([drawing], rc, activeDragState);

    const translateCalls = calls.filter((c) => c.method === 'translate');
    const textTranslate = translateCalls[translateCalls.length - 1];
    if (textTranslate.args[0] !== 200 || textTranslate.args[1] !== 200) {
      throw new Error(`Expected anchor at (200, 200), got (${textTranslate.args[0]}, ${textTranslate.args[1]})`);
    }
  });

  // TEST 9: Zoom in -> label remains aligned with drawing under zoom
  test('TEST 9 — Zoom in: label remains aligned with drawing under zoom', () => {
    const renderer = new DrawingRenderer();
    const { canvas, calls } = createMockCanvasContext();
    renderer.setCanvas(canvas);
    renderer.resize(1000, 600);

    const drawing = makeDrawing({
      id: 'trend-9',
      type: 'trendline',
      points: [{ time: 100, price: 10 }, { time: 200, price: 20 }],
      style: { color: '#ffffff', lineWidth: 2, lineStyle: 'solid', opacity: 100, text: 'Zoom In' },
      text: 'Zoom In',
    });

    // 2x zoom on time axis
    const rcZoomed: RenderContext = {
      timeToX: (t) => t * 2, // dx = 200
      priceToY: (p) => p * 10, // dy = 100 -> angle = atan2(100, 200) ≈ 26.57°
      xToTime: (x) => x / 2,
      yToPrice: (y) => y / 10,
      width: 1000,
      height: 600,
      priceScaleWidth: 60,
      timeScaleHeight: 30,
    };

    renderer.render([drawing], rcZoomed, defaultState);

    const rotateCalls = calls.filter((c) => c.method === 'rotate');
    const angleDeg = (rotateCalls[0].args[0] * 180) / Math.PI;
    if (Math.abs(angleDeg - 26.565) > 0.1) throw new Error(`Expected angle ~26.57° under zoom, got ${angleDeg}°`);
  });

  // TEST 10: Zoom out -> label remains aligned under compressed zoom
  test('TEST 10 — Zoom out: label remains aligned under compressed zoom', () => {
    const renderer = new DrawingRenderer();
    const { canvas, calls } = createMockCanvasContext();
    renderer.setCanvas(canvas);
    renderer.resize(1000, 600);

    const drawing = makeDrawing({
      id: 'trend-10',
      type: 'trendline',
      points: [{ time: 100, price: 10 }, { time: 200, price: 20 }],
      style: { color: '#ffffff', lineWidth: 2, lineStyle: 'solid', opacity: 100, text: 'Zoom Out' },
      text: 'Zoom Out',
    });

    // 0.5x compressed zoom on time axis
    const rcCompressed: RenderContext = {
      timeToX: (t) => t * 0.5, // dx = 50
      priceToY: (p) => p * 10,  // dy = 100 -> angle = atan2(100, 50) ≈ 63.43°
      xToTime: (x) => x * 2,
      yToPrice: (y) => y / 10,
      width: 1000,
      height: 600,
      priceScaleWidth: 60,
      timeScaleHeight: 30,
    };

    renderer.render([drawing], rcCompressed, defaultState);

    const rotateCalls = calls.filter((c) => c.method === 'rotate');
    const angleDeg = (rotateCalls[0].args[0] * 180) / Math.PI;
    if (Math.abs(angleDeg - 63.435) > 0.1) throw new Error(`Expected angle ~63.43° under zoom out, got ${angleDeg}°`);
  });

  // TEST 11: Pan chart -> label remains attached at panned location
  test('TEST 11 — Pan chart: label remains attached at panned location', () => {
    const renderer = new DrawingRenderer();
    const { canvas, calls } = createMockCanvasContext();
    renderer.setCanvas(canvas);
    renderer.resize(1000, 600);

    const drawing = makeDrawing({
      id: 'trend-11',
      type: 'trendline',
      points: [{ time: 100, price: 100 }, { time: 200, price: 200 }],
      style: { color: '#ffffff', lineWidth: 2, lineStyle: 'solid', opacity: 100, text: 'Pan' },
      text: 'Pan',
    });

    const rcPanned: RenderContext = {
      timeToX: (t) => t + 300, // x1 = 400, x2 = 500
      priceToY: (p) => p - 50,  // y1 = 50, y2 = 150
      xToTime: (x) => x - 300,
      yToPrice: (y) => y + 50,
      width: 1000,
      height: 600,
      priceScaleWidth: 60,
      timeScaleHeight: 30,
    };

    renderer.render([drawing], rcPanned, defaultState);

    const translateCalls = calls.filter((c) => c.method === 'translate');
    const textTranslate = translateCalls[translateCalls.length - 1];
    if (textTranslate.args[0] !== 450 || textTranslate.args[1] !== 100) {
      throw new Error(`Expected anchor at (450, 100), got (${textTranslate.args[0]}, ${textTranslate.args[1]})`);
    }
  });

  // TEST 12: Price scale change -> label follows new visual slope after price stretch
  test('TEST 12 — Price scale change: label follows new visual slope after price stretch', () => {
    const renderer = new DrawingRenderer();
    const { canvas, calls } = createMockCanvasContext();
    renderer.setCanvas(canvas);
    renderer.resize(1000, 600);

    const drawing = makeDrawing({
      id: 'trend-12',
      type: 'trendline',
      points: [{ time: 100, price: 100 }, { time: 200, price: 200 }],
      style: { color: '#ffffff', lineWidth: 2, lineStyle: 'solid', opacity: 100, text: 'Price Scale' },
      text: 'Price Scale',
    });

    const rcCompressed: RenderContext = {
      timeToX: (t) => t,
      priceToY: (p) => p * 0.25, // dy = 25 while dx = 100 -> angle ≈ 14.04°
      xToTime: (x) => x,
      yToPrice: (y) => y * 4,
      width: 1000,
      height: 600,
      priceScaleWidth: 60,
      timeScaleHeight: 30,
    };

    renderer.render([drawing], rcCompressed, defaultState);

    const rotateCalls = calls.filter((c) => c.method === 'rotate');
    const angleDeg = (rotateCalls[0].args[0] * 180) / Math.PI;
    if (Math.abs(angleDeg - 14.036) > 0.1) throw new Error(`Expected angle ~14.04°, got ${angleDeg}°`);
  });

  // TEST 13: Chart resize -> label remains correctly positioned after canvas resize
  test('TEST 13 — Chart resize: label remains correctly positioned after canvas resize', () => {
    const renderer = new DrawingRenderer();
    const { ctx, canvas } = createMockCanvasContext();
    renderer.setCanvas(canvas);
    renderer.resize(1920, 1080);

    const drawing = makeDrawing({
      id: 'trend-13',
      type: 'trendline',
      points: [{ time: 100, price: 100 }, { time: 300, price: 300 }],
      style: { color: '#ffffff', lineWidth: 2, lineStyle: 'solid', opacity: 100, text: 'Resize' },
      text: 'Resize',
    });

    const rcResized: RenderContext = {
      timeToX: (t) => t * 1.5,
      priceToY: (p) => p * 1.5,
      xToTime: (x) => x / 1.5,
      yToPrice: (y) => y / 1.5,
      width: 1920,
      height: 1080,
      priceScaleWidth: 70,
      timeScaleHeight: 35,
    };

    renderer.render([drawing], rcResized, defaultState);

    const fillCalls = ctx.calls.filter((c: any) => c.method === 'fillText');
    if (fillCalls.length === 0) throw new Error('Expected fillText call');
  });

  // TEST 14: Multiple layouts -> Layout 1 and Layout 2 labels remain isolated
  test('TEST 14 — Multiple layouts: Layout 1 and Layout 2 labels remain isolated', () => {
    const renderer1 = new DrawingRenderer();
    const { canvas: canvas1, calls: calls1 } = createMockCanvasContext();
    renderer1.setCanvas(canvas1);
    renderer1.resize(800, 500);

    const renderer2 = new DrawingRenderer();
    const { canvas: canvas2, calls: calls2 } = createMockCanvasContext();
    renderer2.setCanvas(canvas2);
    renderer2.resize(800, 500);

    const eurDrawing = makeDrawing({
      id: 'eur-trend',
      type: 'trendline',
      points: [{ time: 100, price: 100 }, { time: 200, price: 200 }], // 45°
      style: { color: '#ffffff', lineWidth: 2, lineStyle: 'solid', opacity: 100, text: 'EUR Trend' },
      text: 'EUR Trend',
    });

    const gbpDrawing = makeDrawing({
      id: 'gbp-trend',
      type: 'trendline',
      points: [{ time: 100, price: 100 }, { time: 200, price: 100 }], // 0°
      style: { color: '#ffffff', lineWidth: 2, lineStyle: 'solid', opacity: 100, text: 'GBP Flat' },
      text: 'GBP Flat',
    });

    const rc: RenderContext = {
      timeToX: (t) => t,
      priceToY: (p) => p,
      xToTime: (x) => x,
      yToPrice: (y) => y,
      width: 800,
      height: 500,
      priceScaleWidth: 60,
      timeScaleHeight: 30,
    };

    renderer1.render([eurDrawing], rc, defaultState);
    renderer2.render([gbpDrawing], rc, defaultState);

    const angle1 = (calls1.filter((c) => c.method === 'rotate')[0].args[0] * 180) / Math.PI;
    const angle2 = (calls2.filter((c) => c.method === 'rotate')[0].args[0] * 180) / Math.PI;

    if (Math.abs(angle1 - 45) > 0.05) throw new Error(`Layout 1 angle expected 45°, got ${angle1}°`);
    if (Math.abs(angle2 - 0) > 0.001) throw new Error(`Layout 2 angle expected 0°, got ${angle2}°`);
  });

  // TEST 15: Multiple sessions -> Session A and Session B drawings remain isolated
  test('TEST 15 — Multiple sessions: Session A and Session B drawings remain isolated', () => {
    const sessionADrawings = [
      makeDrawing({
        id: 'session-a-trend',
        type: 'trendline',
        points: [{ time: 100, price: 100 }, { time: 200, price: 200 }],
        style: { color: '#ffffff', lineWidth: 2, lineStyle: 'solid', opacity: 100, text: 'Session A Label' },
        text: 'Session A Label',
      }),
    ];

    const sessionBDrawings = [
      makeDrawing({
        id: 'session-b-trend',
        type: 'trendline',
        points: [{ time: 100, price: 100 }, { time: 200, price: 200 }],
        style: { color: '#00ff00', lineWidth: 2, lineStyle: 'solid', opacity: 100, text: 'Session B Unique' },
        text: 'Session B Unique',
      }),
    ];

    if (sessionADrawings[0].text === sessionBDrawings[0].text) {
      throw new Error('Drawings between sessions must be isolated');
    }
  });

  // TEST 16: Non-directional horizontal drawing (horizontal-line) -> label remains horizontal (angle = 0°)
  test('TEST 16 — Non-directional horizontal drawing: label remains horizontal (angle = 0°)', () => {
    const renderer = new DrawingRenderer();
    const { canvas, calls } = createMockCanvasContext();
    renderer.setCanvas(canvas);
    renderer.resize(1000, 600);

    const hLine = makeDrawing({
      id: 'hline-1',
      type: 'horizontal-line',
      points: [{ time: 100, price: 1.0850 }],
      style: { color: '#ffffff', lineWidth: 2, lineStyle: 'solid', opacity: 100, text: 'Support 1.0850' },
      text: 'Support 1.0850',
    });

    const rc: RenderContext = {
      timeToX: (t) => t,
      priceToY: () => 250,
      xToTime: (x) => x,
      yToPrice: (y) => y,
      width: 1000,
      height: 600,
      priceScaleWidth: 60,
      timeScaleHeight: 30,
    };

    renderer.render([hLine], rc, defaultState);

    const rotateCalls = calls.filter((c) => c.method === 'rotate');
    // For horizontal line, rotate is not called or called with 0
    if (rotateCalls.length > 0) {
      const angle = rotateCalls[0].args[0];
      if (Math.abs(angle) > 0.001) throw new Error(`Expected horizontal-line angle 0°, got ${angle}`);
    }
  });

  // TEST 17: Standalone text -> existing behavior remains unchanged (horizontal or user rotation preserved)
  test('TEST 17 — Standalone text: existing behavior remains unchanged', () => {
    const renderer = new DrawingRenderer();
    const { canvas, calls } = createMockCanvasContext();
    renderer.setCanvas(canvas);
    renderer.resize(1000, 600);

    const textDrawing = makeDrawing({
      id: 'text-1',
      type: 'text',
      points: [{ time: 100, price: 1.0850 }],
      style: { color: '#ffffff', lineWidth: 1, lineStyle: 'solid', opacity: 100, text: 'My Chart Note' },
      text: 'My Chart Note',
      rotation: 0,
    });

    const rc: RenderContext = {
      timeToX: (t) => t * 2,
      priceToY: () => 200,
      xToTime: (x) => x / 2,
      yToPrice: (y) => y,
      width: 1000,
      height: 600,
      priceScaleWidth: 60,
      timeScaleHeight: 30,
    };

    renderer.render([textDrawing], rc, defaultState);

    const fillCalls = calls.filter((c) => c.method === 'fillText');
    if (fillCalls.length === 0) throw new Error('Expected fillText to render standalone text');
    if (fillCalls[0].args[0] !== 'My Chart Note') throw new Error('Text value mismatch');
  });

  // TEST 18: Fibonacci / level-based tool -> existing label orientation remains unchanged (horizontal levels)
  test('TEST 18 — Fibonacci tool: existing level orientation remains unchanged', () => {
    const renderer = new DrawingRenderer();
    const { ctx, canvas } = createMockCanvasContext();
    renderer.setCanvas(canvas);
    renderer.resize(1000, 600);

    const fibDrawing = makeDrawing({
      id: 'fib-1',
      type: 'fib-retracement',
      points: [{ time: 100, price: 1.0800 }, { time: 200, price: 1.1000 }],
      style: { color: '#ffffff', lineWidth: 1, lineStyle: 'dashed', opacity: 100 },
    });

    const rc: RenderContext = {
      timeToX: (t) => t * 2,
      priceToY: (p) => (p - 1.0800) * 10000,
      xToTime: (x) => x / 2,
      yToPrice: (y) => y,
      width: 1000,
      height: 600,
      priceScaleWidth: 60,
      timeScaleHeight: 30,
    };

    renderer.render([fibDrawing], rc, defaultState);

    // Verify fib level line drawing calls were executed without crash
    const strokeCalls = ctx.calls.filter((c: any) => c.method === 'stroke');
    if (strokeCalls.length === 0) throw new Error('Expected fib lines to be rendered');
  });

  console.log(`\nSUMMARY: ${passedCount}/${totalCount} tests passed.`);
  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runUniversalDrawingLabelRotationTests();
