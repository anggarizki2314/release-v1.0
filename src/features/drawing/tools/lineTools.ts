/**
 * Line Tools — All 7 basic line drawing tools.
 *
 * Key rule: onPointerDown must REPLACE the last (preview) point,
 * never append. This prevents tempPoints from growing unbounded.
 * Guard checks ensure points are valid finite coordinates.
 */

import type { DrawingPoint, DrawingTypeId } from '../engine/types';
import type { BaseTool, ToolContext } from './BaseTool';

const isValidPoint = (p: DrawingPoint | null | undefined): boolean => {
  if (!p) return false;
  return Number.isFinite(p.time) && Number.isFinite(p.price) && p.time >= 0;
};

// ─── Trend Line ────────────────────────────────────────────────────

export class TrendLineTool implements BaseTool {
  readonly id: DrawingTypeId = 'trendline';
  readonly label = 'Trend Line';
  readonly icon = 'trending-up';
  readonly requiredPoints = 2;

  onPointerDown(ctx: ToolContext, x: number, y: number, points: DrawingPoint[]): DrawingPoint[] {
    const p = ctx.getSnapPoint(x, y);
    if (!isValidPoint(p)) return points;
    if (points.length === 0) return [p];           // First click: add point
    return [points[0], p];                          // Second click: replace preview
  }

  onPointerMove(ctx: ToolContext, x: number, y: number, points: DrawingPoint[]): DrawingPoint[] {
    if (points.length === 0) return points;
    const p = ctx.getSnapPoint(x, y);
    if (!isValidPoint(p)) return points;
    return [points[0], p];                          // Always: [first, mousePos]
  }

  isComplete(points: DrawingPoint[]): boolean {
    return points.length >= 2;
  }
}

// ─── Ray ───────────────────────────────────────────────────────────

export class RayTool implements BaseTool {
  readonly id: DrawingTypeId = 'ray';
  readonly label = 'Ray';
  readonly icon = 'move-right';
  readonly requiredPoints = 2;

  onPointerDown(ctx: ToolContext, x: number, y: number, points: DrawingPoint[]): DrawingPoint[] {
    const p = ctx.getSnapPoint(x, y);
    if (!isValidPoint(p)) return points;
    if (points.length === 0) return [p];
    return [points[0], p];
  }

  onPointerMove(ctx: ToolContext, x: number, y: number, points: DrawingPoint[]): DrawingPoint[] {
    if (points.length === 0) return points;
    const p = ctx.getSnapPoint(x, y);
    if (!isValidPoint(p)) return points;
    return [points[0], p];
  }

  isComplete(points: DrawingPoint[]): boolean {
    return points.length >= 2;
  }
}

// ─── Extended Line ─────────────────────────────────────────────────

export class ExtendedLineTool implements BaseTool {
  readonly id: DrawingTypeId = 'extended-line';
  readonly label = 'Extended Line';
  readonly icon = 'move-horizontal';
  readonly requiredPoints = 2;

  onPointerDown(ctx: ToolContext, x: number, y: number, points: DrawingPoint[]): DrawingPoint[] {
    const p = ctx.getSnapPoint(x, y);
    if (!isValidPoint(p)) return points;
    if (points.length === 0) return [p];
    return [points[0], p];
  }

  onPointerMove(ctx: ToolContext, x: number, y: number, points: DrawingPoint[]): DrawingPoint[] {
    if (points.length === 0) return points;
    const p = ctx.getSnapPoint(x, y);
    if (!isValidPoint(p)) return points;
    return [points[0], p];
  }

  isComplete(points: DrawingPoint[]): boolean {
    return points.length >= 2;
  }
}

// ─── Horizontal Line ───────────────────────────────────────────────

export class HorizontalLineTool implements BaseTool {
  readonly id: DrawingTypeId = 'horizontal-line';
  readonly label = 'Horizontal Line';
  readonly icon = 'minus';
  readonly requiredPoints = 1;

  onPointerDown(ctx: ToolContext, x: number, y: number, points: DrawingPoint[]): DrawingPoint[] {
    const p = ctx.getSnapPoint(x, y);
    if (!p || !Number.isFinite(p.price)) return points;
    return [{ time: 0, price: p.price }];
  }

  onPointerMove(_ctx: ToolContext, _x: number, _y: number, points: DrawingPoint[]): DrawingPoint[] {
    return points;
  }

  isComplete(points: DrawingPoint[]): boolean {
    return points.length >= 1;
  }
}

// ─── Horizontal Ray ────────────────────────────────────────────────

export class HorizontalRayTool implements BaseTool {
  readonly id: DrawingTypeId = 'horizontal-ray';
  readonly label = 'Horizontal Ray';
  readonly icon = 'arrow-right';
  readonly requiredPoints = 1;

  onPointerDown(ctx: ToolContext, x: number, y: number, points: DrawingPoint[]): DrawingPoint[] {
    const p = ctx.getSnapPoint(x, y);
    if (!isValidPoint(p)) return points;
    return [{ time: p.time, price: p.price }];
  }

  onPointerMove(_ctx: ToolContext, _x: number, _y: number, points: DrawingPoint[]): DrawingPoint[] {
    return points;
  }

  isComplete(points: DrawingPoint[]): boolean {
    return points.length >= 1;
  }
}

// ─── Vertical Line ─────────────────────────────────────────────────

export class VerticalLineTool implements BaseTool {
  readonly id: DrawingTypeId = 'vertical-line';
  readonly label = 'Vertical Line';
  readonly icon = 'grip-vertical';
  readonly requiredPoints = 1;

  onPointerDown(ctx: ToolContext, x: number, y: number, points: DrawingPoint[]): DrawingPoint[] {
    const p = ctx.getSnapPoint(x, y);
    if (!isValidPoint(p)) return points;
    return [{ time: p.time, price: 0 }];
  }

  onPointerMove(_ctx: ToolContext, _x: number, _y: number, points: DrawingPoint[]): DrawingPoint[] {
    return points;
  }

  isComplete(points: DrawingPoint[]): boolean {
    return points.length >= 1;
  }
}

// ─── Cross Line ────────────────────────────────────────────────────

export class CrossLineTool implements BaseTool {
  readonly id: DrawingTypeId = 'cross-line';
  readonly label = 'Cross Line';
  readonly icon = 'plus';
  readonly requiredPoints = 1;

  onPointerDown(ctx: ToolContext, x: number, y: number, points: DrawingPoint[]): DrawingPoint[] {
    const p = ctx.getSnapPoint(x, y);
    if (!isValidPoint(p)) return points;
    return [{ time: p.time, price: p.price }];
  }

  onPointerMove(_ctx: ToolContext, _x: number, _y: number, points: DrawingPoint[]): DrawingPoint[] {
    return points;
  }

  isComplete(points: DrawingPoint[]): boolean {
    return points.length >= 1;
  }
}

// ─── Arrow ─────────────────────────────────────────────────────────

export class ArrowTool implements BaseTool {
  readonly id: DrawingTypeId = 'arrow';
  readonly label = 'Arrow';
  readonly icon = 'move-right';
  readonly requiredPoints = 2;

  onPointerDown(ctx: ToolContext, x: number, y: number, points: DrawingPoint[]): DrawingPoint[] {
    const p = ctx.getSnapPoint(x, y);
    if (!isValidPoint(p)) return points;
    if (points.length === 0) return [p];
    return [points[0], p];
  }

  onPointerMove(ctx: ToolContext, x: number, y: number, points: DrawingPoint[]): DrawingPoint[] {
    if (points.length === 0) return points;
    const p = ctx.getSnapPoint(x, y);
    if (!isValidPoint(p)) return points;
    return [points[0], p];
  }

  isComplete(points: DrawingPoint[]): boolean {
    return points.length >= 2;
  }
}

// ─── Arrow Marker ──────────────────────────────────────────────────

export class ArrowMarkerTool implements BaseTool {
  readonly id: DrawingTypeId = 'arrow-marker';
  readonly label = 'Arrow Marker';
  readonly icon = 'navigation';
  readonly requiredPoints = 2;

  onPointerDown(ctx: ToolContext, x: number, y: number, points: DrawingPoint[]): DrawingPoint[] {
    const p = ctx.getSnapPoint(x, y);
    if (!isValidPoint(p)) return points;
    if (points.length === 0) return [p];
    return [points[0], p];
  }

  onPointerMove(ctx: ToolContext, x: number, y: number, points: DrawingPoint[]): DrawingPoint[] {
    if (points.length === 0) return points;
    const p = ctx.getSnapPoint(x, y);
    if (!isValidPoint(p)) return points;
    return [points[0], p];
  }

  isComplete(points: DrawingPoint[]): boolean {
    return points.length >= 2;
  }
}

// ─── Arrow Up ──────────────────────────────────────────────────────

export class ArrowUpTool implements BaseTool {
  readonly id: DrawingTypeId = 'arrow-up';
  readonly label = 'Arrow Up';
  readonly icon = 'arrow-up';
  readonly requiredPoints = 1;

  onPointerDown(ctx: ToolContext, x: number, y: number, points: DrawingPoint[]): DrawingPoint[] {
    const p = ctx.getSnapPoint(x, y);
    if (!isValidPoint(p)) return points;
    return [{ time: p.time, price: p.price }];
  }

  onPointerMove(_ctx: ToolContext, _x: number, _y: number, points: DrawingPoint[]): DrawingPoint[] {
    return points;
  }

  isComplete(points: DrawingPoint[]): boolean {
    return points.length >= 1;
  }
}

// ─── Arrow Down ────────────────────────────────────────────────────

export class ArrowDownTool implements BaseTool {
  readonly id: DrawingTypeId = 'arrow-down';
  readonly label = 'Arrow Down';
  readonly icon = 'arrow-down';
  readonly requiredPoints = 1;

  onPointerDown(ctx: ToolContext, x: number, y: number, points: DrawingPoint[]): DrawingPoint[] {
    const p = ctx.getSnapPoint(x, y);
    if (!isValidPoint(p)) return points;
    return [{ time: p.time, price: p.price }];
  }

  onPointerMove(_ctx: ToolContext, _x: number, _y: number, points: DrawingPoint[]): DrawingPoint[] {
    return points;
  }

  isComplete(points: DrawingPoint[]): boolean {
    return points.length >= 1;
  }
}
