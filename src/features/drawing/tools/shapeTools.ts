/**
 * Drawing Tools — Comprehensive Shape, Text, Position & Fibonacci Tools
 *
 * Two-point tools (P1 = first click, P2 = second click or live mouse).
 * onPointerDown REPLACES last point (never appends past requiredPoints).
 */

import type { DrawingPoint, DrawingTypeId } from '../engine/types';
import type { BaseTool, ToolContext } from './BaseTool';

const validPt = (p: DrawingPoint | null | undefined): boolean =>
  !!(p && Number.isFinite(p.time) && Number.isFinite(p.price) && p.time >= 0);

// ─────────────────────────────────────────────────────────────────────
// HELPER: Generic 2-Point Tool factory
// ─────────────────────────────────────────────────────────────────────

function make2Point(
  id: DrawingTypeId,
  label: string,
  icon: string,
): BaseTool {
  return {
    id,
    label,
    icon,
    requiredPoints: 2,
    onPointerDown(_ctx: ToolContext, x: number, y: number, pts: DrawingPoint[]): DrawingPoint[] {
      const p = _ctx.getSnapPoint(x, y);
      if (!validPt(p)) return pts;
      if (pts.length === 0) return [p];
      return [pts[0], p];
    },
    onPointerMove(_ctx: ToolContext, x: number, y: number, pts: DrawingPoint[]): DrawingPoint[] {
      if (pts.length === 0) return pts;
      const p = _ctx.getSnapPoint(x, y);
      if (!validPt(p)) return pts;
      return [pts[0], p];
    },
    isComplete(pts: DrawingPoint[]): boolean {
      return pts.length >= 2;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// HELPER: Generic 1-Point Tool factory
// ─────────────────────────────────────────────────────────────────────

function make1Point(
  id: DrawingTypeId,
  label: string,
  icon: string,
): BaseTool {
  return {
    id,
    label,
    icon,
    requiredPoints: 1,
    onPointerDown(_ctx: ToolContext, x: number, y: number, pts: DrawingPoint[]): DrawingPoint[] {
      const p = _ctx.getSnapPoint(x, y);
      if (!validPt(p)) return pts;
      return [p];
    },
    onPointerMove(_ctx: ToolContext, _x: number, _y: number, pts: DrawingPoint[]): DrawingPoint[] {
      return pts;
    },
    isComplete(pts: DrawingPoint[]): boolean {
      return pts.length >= 1;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// HELPER: Generic 3-Point Tool factory (e.g., Position, Gann, Fib Channel)
// ─────────────────────────────────────────────────────────────────────

function make3Point(
  id: DrawingTypeId,
  label: string,
  icon: string,
): BaseTool {
  return {
    id,
    label,
    icon,
    requiredPoints: 3,
    onPointerDown(_ctx: ToolContext, x: number, y: number, pts: DrawingPoint[]): DrawingPoint[] {
      const p = _ctx.getSnapPoint(x, y);
      if (!validPt(p)) return pts;
      if (pts.length === 0) return [p];
      if (pts.length === 1) return [pts[0], p];
      return [pts[0], pts[1], p];
    },
    onPointerMove(_ctx: ToolContext, x: number, y: number, pts: DrawingPoint[]): DrawingPoint[] {
      if (pts.length === 0) return pts;
      const p = _ctx.getSnapPoint(x, y);
      if (!validPt(p)) return pts;
      if (pts.length === 1) return [pts[0], p];
      return [pts[0], pts[1], p];
    },
    isComplete(pts: DrawingPoint[]): boolean {
      return pts.length >= 3;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// HELPER: Generic 4-Point Tool factory (e.g., Double Curve / Cubic Bézier)
// ─────────────────────────────────────────────────────────────────────

function make4Point(
  id: DrawingTypeId,
  label: string,
  icon: string,
): BaseTool {
  return {
    id,
    label,
    icon,
    requiredPoints: 4,
    onPointerDown(_ctx: ToolContext, x: number, y: number, pts: DrawingPoint[]): DrawingPoint[] {
      const p = _ctx.getSnapPoint(x, y);
      if (!validPt(p)) return pts;
      if (pts.length === 0) return [p];
      if (pts.length === 1) return [pts[0], p];
      if (pts.length === 2) return [pts[0], pts[1], p];
      return [pts[0], pts[1], pts[2], p];
    },
    onPointerMove(_ctx: ToolContext, x: number, y: number, pts: DrawingPoint[]): DrawingPoint[] {
      if (pts.length === 0) return pts;
      const p = _ctx.getSnapPoint(x, y);
      if (!validPt(p)) return pts;
      if (pts.length === 1) return [pts[0], p];
      if (pts.length === 2) return [pts[0], pts[1], p];
      return [pts[0], pts[1], pts[2], p];
    },
    isComplete(pts: DrawingPoint[]): boolean {
      return pts.length >= 4;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// SHAPES
// ─────────────────────────────────────────────────────────────────────

export class RectangleTool implements BaseTool {
  readonly id: DrawingTypeId = 'rectangle';
  readonly label = 'Rectangle';
  readonly icon = 'square';
  readonly requiredPoints = 2;

  onPointerDown(ctx: ToolContext, x: number, y: number, pts: DrawingPoint[]): DrawingPoint[] {
    const p = ctx.getSnapPoint(x, y);
    if (!validPt(p)) return pts;
    if (pts.length === 0) return [p];
    return [pts[0], p];
  }

  onPointerMove(ctx: ToolContext, x: number, y: number, pts: DrawingPoint[]): DrawingPoint[] {
    if (pts.length === 0) return pts;
    const p = ctx.getSnapPoint(x, y);
    if (!validPt(p)) return pts;
    return [pts[0], p];
  }

  isComplete(pts: DrawingPoint[]): boolean {
    return pts.length >= 2;
  }
}

export const RotatedRectangleTool = () => make3Point('rotated-rectangle', 'Rotated Rectangle', 'rectangle-horizontal');
export const CircleTool = () => make2Point('circle', 'Circle', 'circle');
export const EllipseTool = () => make2Point('ellipse', 'Ellipse', 'circle');
export const TriangleTool = () => make3Point('triangle', 'Triangle', 'triangle');
export const ArcTool = () => make3Point('arc', 'Arc', 'corner-down-right');

// ─────────────────────────────────────────────────────────────────────
// BRUSH & FREEFORM
// ─────────────────────────────────────────────────────────────────────

class PolylineTool implements BaseTool {
  readonly id: DrawingTypeId;
  readonly label: string;
  readonly icon: string;
  readonly requiredPoints = -1; // Continuous multi-click vertices

  constructor(id: DrawingTypeId, label: string, icon: string) {
    this.id = id;
    this.label = label;
    this.icon = icon;
  }

  onPointerDown(ctx: ToolContext, x: number, y: number, pts: DrawingPoint[]): DrawingPoint[] {
    const p = ctx.getSnapPoint(x, y);
    if (!validPt(p)) return pts;
    if (pts.length === 0) {
      return [p, p];
    }
    const fixed = [...pts.slice(0, -1), p];
    return [...fixed, p];
  }

  onPointerMove(ctx: ToolContext, x: number, y: number, pts: DrawingPoint[]): DrawingPoint[] {
    if (pts.length === 0) return pts;
    const p = ctx.getSnapPoint(x, y);
    if (!validPt(p)) return pts;
    return [...pts.slice(0, -1), p];
  }

  isComplete(_pts: DrawingPoint[]): boolean {
    // Open-ended: only completes via double-click or Enter key
    return false;
  }
}

class FreehandBrushTool implements BaseTool {
  readonly id: DrawingTypeId;
  readonly label: string;
  readonly icon: string;
  readonly requiredPoints = -1; // Continuous freehand points

  constructor(id: DrawingTypeId, label: string, icon: string) {
    this.id = id;
    this.label = label;
    this.icon = icon;
  }

  onPointerDown(ctx: ToolContext, x: number, y: number, pts: DrawingPoint[]): DrawingPoint[] {
    const p = ctx.getSnapPoint(x, y);
    if (!validPt(p)) return pts;
    return [p];
  }

  onPointerMove(ctx: ToolContext, x: number, y: number, pts: DrawingPoint[]): DrawingPoint[] {
    if (pts.length === 0) return pts;
    const p = ctx.getSnapPoint(x, y);
    if (!validPt(p)) return pts;
    const last = pts[pts.length - 1];
    if (Math.abs(last.time - p.time) < 0.00001 && Math.abs(last.price - p.price) < 0.00001) return pts;
    return [...pts, p];
  }

  isComplete(_pts: DrawingPoint[]): boolean {
    // Brush completes on pointer-up (handled in InteractionController), never by point count
    return false;
  }
}

class CurveTool implements BaseTool {
  readonly id: DrawingTypeId = 'curve';
  readonly label = 'Curve';
  readonly icon = 'spline';
  readonly requiredPoints = 3;
  private step = 0;

  onPointerDown(ctx: ToolContext, x: number, y: number, pts: DrawingPoint[]): DrawingPoint[] {
    const p = ctx.getSnapPoint(x, y);
    if (!validPt(p)) return pts;
    if (pts.length === 0) {
      this.step = 1;
      return [p];
    }
    if (this.step === 1 || pts.length <= 2) {
      this.step = 2;
      return [pts[0], p, p];
    }
    this.step = 0;
    return [pts[0], p, pts[2]];
  }

  onPointerMove(ctx: ToolContext, x: number, y: number, pts: DrawingPoint[]): DrawingPoint[] {
    if (pts.length === 0) return pts;
    const p = ctx.getSnapPoint(x, y);
    if (!validPt(p)) return pts;
    if (this.step === 1 || pts.length <= 2) {
      return [pts[0], p];
    }
    if (this.step === 2 || pts.length === 3) {
      return [pts[0], p, pts[2]];
    }
    return pts;
  }

  isComplete(pts: DrawingPoint[]): boolean {
    return this.step === 0 && pts.length >= 3;
  }
}

class DoubleCurveTool implements BaseTool {
  readonly id: DrawingTypeId = 'double-curve';
  readonly label = 'Double Curve';
  readonly icon = 'spline';
  readonly requiredPoints = 4;
  private step = 0;

  onPointerDown(ctx: ToolContext, x: number, y: number, pts: DrawingPoint[]): DrawingPoint[] {
    const p = ctx.getSnapPoint(x, y);
    if (!validPt(p)) return pts;
    if (pts.length === 0) {
      this.step = 1;
      return [p];
    }
    if (this.step === 1 || pts.length <= 2) {
      this.step = 2;
      return [pts[0], p, p, p];
    }
    if (this.step === 2) {
      this.step = 3;
      return [pts[0], p, p, pts[3]];
    }
    this.step = 0;
    return [pts[0], pts[1], p, pts[3]];
  }

  onPointerMove(ctx: ToolContext, x: number, y: number, pts: DrawingPoint[]): DrawingPoint[] {
    if (pts.length === 0) return pts;
    const p = ctx.getSnapPoint(x, y);
    if (!validPt(p)) return pts;
    if (this.step === 1 || pts.length <= 2) {
      return [pts[0], p];
    }
    if (this.step === 2) {
      return [pts[0], p, pts[3] || p, pts[3] || p];
    }
    if (this.step === 3) {
      return [pts[0], pts[1], p, pts[3]];
    }
    return pts;
  }

  isComplete(pts: DrawingPoint[]): boolean {
    return this.step === 0 && pts.length >= 4;
  }
}

export const createPolylineTool = (): BaseTool => new PolylineTool('polyline', 'Polyline', 'pen-line');
export const createBrushTool = (): BaseTool => new FreehandBrushTool('brush', 'Brush', 'paintbrush');
export const createHighlighterTool = (): BaseTool => new FreehandBrushTool('highlighter', 'Highlighter', 'highlighter');
export const createPathTool = (): BaseTool => new PolylineTool('path', 'Path', 'waypoints');
export const createCurveTool = (): BaseTool => new CurveTool();
export const createDoubleCurveTool = (): BaseTool => new DoubleCurveTool();

// ─────────────────────────────────────────────────────────────────────
// TEXT & ANNOTATIONS
// ─────────────────────────────────────────────────────────────────────

export const createTextTool = (): BaseTool => make1Point('text', 'Text', 'type');
export const createAnchoredTextTool = (): BaseTool => make1Point('anchored-text', 'Anchored Text', 'type');
export const createNoteTool = (): BaseTool => make1Point('note', 'Note', 'sticky-note');
export const createAnchoredNoteTool = (): BaseTool => make1Point('anchored-note', 'Anchored Note', 'sticky-note');
export const createCalloutTool = (): BaseTool => make2Point('callout', 'Callout', 'message-square');
export const createBalloonTool = (): BaseTool => make2Point('balloon', 'Balloon', 'message-circle');
export const createPriceLabelTool = (): BaseTool => make1Point('price-label', 'Price Label', 'tag');

// ─── Position Tools ─────────────────────────────────────────────────
// Point layout:
//   [0] = { time: leftEdge,  price: entryPrice  }
//   [1] = { time: rightEdge, price: stopPrice   }
//   [2] = { time: rightEdge, price: targetPrice }
//
// CREATION — 1-click (TradingView standard):
//   Click 1 → drops Long/Short Position preset at click point with 1:2 R:R
//   User can then freely adjust TP or SL handles independently.

function makePositionTool(id: DrawingTypeId, label: string, icon: string, side: 'long' | 'short'): BaseTool {
  function createPreset(entryPt: DrawingPoint): DrawingPoint[] {
    const entry = entryPt.price;
    const sl = Math.max(entry * 0.01, 0.0001); // 1% SL default
    const stop   = side === 'long' ? entry - sl       : entry + sl;
    const target = side === 'long' ? entry + sl * 3   : entry - sl * 3; // 1:3 RR default
    const right  = entryPt.time + 86400; // 24h default width
    return [
      { time: entryPt.time, price: entry  },
      { time: right,        price: stop   },
      { time: right,        price: target },
    ];
  }

  return {
    id,
    label,
    icon,
    requiredPoints: 1,
    onPointerDown(ctx: ToolContext, x: number, y: number, pts: DrawingPoint[]): DrawingPoint[] {
      const p = ctx.getSnapPoint(x, y);
      if (!validPt(p)) return pts;
      return createPreset(p);
    },
    onPointerMove(_ctx: ToolContext, _x: number, _y: number, pts: DrawingPoint[]): DrawingPoint[] {
      return pts;
    },
    isComplete(pts: DrawingPoint[]): boolean {
      return pts.length >= 3;
    },
  };
}

export const createLongPositionTool  = (): BaseTool => makePositionTool('long-position',  'Long Position',  'trending-up',   'long');
export const createShortPositionTool = (): BaseTool => makePositionTool('short-position', 'Short Position', 'trending-down', 'short');
export const createForecastTool      = (): BaseTool => make2Point('forecast',      'Forecast',      'git-branch');
export const createBarsPatternTool   = (): BaseTool => make2Point('bars-pattern',  'Bars Pattern',  'bar-chart-2');


// ─────────────────────────────────────────────────────────────────────
// MEASUREMENTS
// ─────────────────────────────────────────────────────────────────────

export const createPriceRangeTool = (): BaseTool => make2Point('price-range', 'Price Range', 'ruler');
export const createDateRangeTool = (): BaseTool => make2Point('date-range', 'Date Range', 'calendar-range');
export const createDatePriceRangeTool = (): BaseTool => make2Point('date-price-range', 'Date & Price Range', 'scan');

// ─────────────────────────────────────────────────────────────────────
// FIBONACCI
// ─────────────────────────────────────────────────────────────────────

export const createFibRetracementTool = (): BaseTool => make2Point('fib-retracement', 'Fib Retracement', 'git-branch');
export const createFibExtensionTool = (): BaseTool => make3Point('fib-extension', 'Fib Extension', 'git-branch-plus');
export const createFibChannelTool = (): BaseTool => make3Point('fib-channel', 'Fib Channel', 'columns');
export const createFibTimeZoneTool = (id: DrawingTypeId = 'fib-timezone'): BaseTool => make2Point(id, 'Fib Time Zone', 'clock');
export const createFibFanTool = (): BaseTool => make2Point('fib-fan', 'Fib Fan', 'fan');

// ─────────────────────────────────────────────────────────────────────
// GANN & CHANNELS
// ─────────────────────────────────────────────────────────────────────

export const createGannBoxTool = (): BaseTool => make2Point('gann-box', 'Gann Box', 'grid');
export const createGannFanTool = (): BaseTool => make2Point('gann-fan', 'Gann Fan', 'grid-2x2');
export const createChannelTool = (): BaseTool => make3Point('channel', 'Channel', 'equal');
export const createPitchforkTool = (): BaseTool => make3Point('pitchfork', 'Pitchfork', 'trident');
export const createSchiffPitchforkTool = (): BaseTool => make3Point('schiff-pitchfork', 'Schiff Pitchfork', 'trident');
