import type { DrawingTypeBundle } from './drawing/DrawingRegistry';
import type { IDrawingFactory } from './drawing/IDrawingFactory';
import type { IDrawingRenderer } from './drawing/IDrawingRenderer';
import type { IDrawingHitTester, HitResult } from './drawing/IDrawingHitTester';
import type { IDrawingSerializer } from './drawing/IDrawingSerializer';
import type { ICoordinateConverter } from './core/api';
import type { BaseDrawingData, DrawingPoint, DrawingStyle } from './core/types';
import { distancePointToLine, distancePointToSegment, lineEndpointsScreen, lineKindFromType } from './geometry/line';
import { RenderCommandBuffer } from './render/commands';
import { anchorControlPoints, type ControlPoint } from './interaction/ControlPoint';
import { BaseTool, type IToolContext } from './tools/BaseTool';

export type LineToolType =
  | 'trendline'
  | 'ray'
  | 'extended-line'
  | 'horizontal-line'
  | 'horizontal-ray'
  | 'vertical-line';

const DEFAULT_STYLE: DrawingStyle = {
  color: '#4f86f7',
  lineWidth: 1,
  opacity: 100,
  lineStyle: 'solid',
};

const dashFor = (style: DrawingStyle): ReadonlyArray<number> | undefined => {
  if (style.lineStyle === 'dashed') return [8, 6];
  if (style.lineStyle === 'dotted') return [2, 5];
  return undefined;
};

const isFinitePoint = (p: DrawingPoint): boolean => Number.isFinite(p.time) && Number.isFinite(p.price);

const normalizePoints = (type: string, points: ReadonlyArray<DrawingPoint>): ReadonlyArray<DrawingPoint> => {
  const valid = points.filter(isFinitePoint);
  if (type === 'horizontal-line' || type === 'horizontal-ray' || type === 'vertical-line') return valid.slice(0, 1);
  return valid.slice(0, 2);
};

const hitDistance = (type: string, p: { x: number; y: number }, e: { x1: number; y1: number; x2: number; y2: number }): number => {
  const kind = lineKindFromType(type);
  if (kind === 'infinite' || kind === 'horizontal' || kind === 'vertical') {
    return distancePointToLine(p, { x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 });
  }
  if (kind === 'ray' || kind === 'horizontal-ray') {
    const dx = e.x2 - e.x1;
    const dy = e.y2 - e.y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p.x - e.x1, p.y - e.y1);
    const t = ((p.x - e.x1) * dx + (p.y - e.y1) * dy) / len2;
    if (t < 0) return Math.hypot(p.x - e.x1, p.y - e.y1);
    return distancePointToLine(p, { x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 });
  }
  return distancePointToSegment(p, { x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 });
};

class LineFactory implements IDrawingFactory<BaseDrawingData> {
  constructor(readonly typeId: LineToolType) {}
  create(initial: Partial<BaseDrawingData> & { readonly id: string }): BaseDrawingData {
    const now = Date.now();
    return {
      id: initial.id,
      type: this.typeId,
      points: normalizePoints(this.typeId, initial.points ?? []),
      style: { ...DEFAULT_STYLE, ...(initial.style ?? {}) },
      state: initial.state ?? 'normal',
      visible: initial.visible ?? true,
      locked: initial.locked ?? false,
      zIndex: initial.zIndex ?? 0,
      createdAt: initial.createdAt ?? now,
      updatedAt: initial.updatedAt ?? now,
      groupId: initial.groupId,
    };
  }
}

class LineRenderer implements IDrawingRenderer<BaseDrawingData> {
  constructor(readonly typeId: LineToolType) {}
  render(drawing: BaseDrawingData, cc: ICoordinateConverter, style: DrawingStyle) {
    const e = lineEndpointsScreen(drawing.type, drawing.points, cc);
    if (!e || !drawing.visible) return [];
    return new RenderCommandBuffer()
      .save()
      .setOpacity(Math.max(0, Math.min(1, style.opacity / 100)))
      .setStroke({ color: style.color, width: style.lineWidth, dash: dashFor(style), cap: 'round', join: 'round' })
      .beginPath()
      .moveTo(e.x1, e.y1)
      .lineTo(e.x2, e.y2)
      .stroke()
      .restore()
      .commands();
  }
}

class LineHitTester implements IDrawingHitTester<BaseDrawingData> {
  constructor(readonly typeId: LineToolType) {}
  hitTest(drawing: BaseDrawingData, x: number, y: number, cc: ICoordinateConverter, threshold: number): HitResult | null {
    const cpHit = anchorControlPoints(drawing.points).find((cp) => {
      const sx = cc.timeToX(cp.point.time);
      const sy = cc.priceToY(cp.point.price);
      return sx !== null && sy !== null && Math.hypot(sx - x, sy - y) <= threshold + 2;
    });
    if (cpHit?.anchorIndex !== undefined) return { priority: 'anchor', index: cpHit.anchorIndex };
    const e = lineEndpointsScreen(drawing.type, drawing.points, cc);
    if (!e) return null;
    return hitDistance(drawing.type, { x, y }, e) <= threshold + drawing.style.lineWidth / 2 ? { priority: 'body' } : null;
  }
  getAnchors(drawing: BaseDrawingData): ReadonlyArray<DrawingPoint> { return drawing.points; }
}

class LineSerializer implements IDrawingSerializer<BaseDrawingData> {
  readonly version = 1;
  constructor(readonly typeId: LineToolType) {}
  serialize(drawing: BaseDrawingData): unknown { return { v: 1, ...drawing }; }
  deserialize(raw: unknown): BaseDrawingData | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as BaseDrawingData & { v?: number };
    if (!r.id || !Array.isArray(r.points)) return null;
    return { ...r, type: this.typeId, points: normalizePoints(this.typeId, r.points), style: { ...DEFAULT_STYLE, ...(r.style ?? {}) } };
  }
  upgrade(_fromVersion: number, raw: unknown): unknown { return raw; }
}

class TwoPointLineTool extends BaseTool {
  readonly requiredPoints = 2;
  private points: ReadonlyArray<DrawingPoint> = [];
  constructor(readonly id: LineToolType, readonly createsTypeId: LineToolType) { super(); }
  onPointerDown(_ctx: IToolContext, point: DrawingPoint, _current: ReadonlyArray<DrawingPoint>): ReadonlyArray<DrawingPoint> {
    this.points = this.points.length === 0 ? [point] : [this.points[0], point];
    return this.points;
  }
  onPointerMove(_ctx: IToolContext, point: DrawingPoint, _current: ReadonlyArray<DrawingPoint>): ReadonlyArray<DrawingPoint> {
    return this.points.length === 0 ? this.points : [this.points[0], point];
  }
  isComplete(points: ReadonlyArray<DrawingPoint>): boolean { return points.length >= 2; }
  reset(): void { this.points = []; this.resetLifecycle(); }
}

class OnePointLineTool extends BaseTool {
  readonly requiredPoints = 1;
  constructor(readonly id: LineToolType, readonly createsTypeId: LineToolType) { super(); }
  onPointerDown(_ctx: IToolContext, point: DrawingPoint, _current: ReadonlyArray<DrawingPoint>): ReadonlyArray<DrawingPoint> { return [point]; }
  onPointerMove(_ctx: IToolContext, _point: DrawingPoint, current: ReadonlyArray<DrawingPoint>): ReadonlyArray<DrawingPoint> { return current; }
  isComplete(points: ReadonlyArray<DrawingPoint>): boolean { return points.length >= 1; }
  reset(): void { this.resetLifecycle(); }
}

export const createLineBundle = (typeId: LineToolType): DrawingTypeBundle<BaseDrawingData> => ({
  typeId,
  factory: new LineFactory(typeId),
  renderer: new LineRenderer(typeId),
  hitTester: new LineHitTester(typeId),
  serializer: new LineSerializer(typeId),
});

export const lineToolTypes: ReadonlyArray<LineToolType> = [
  'trendline',
  'ray',
  'extended-line',
  'horizontal-line',
  'horizontal-ray',
  'vertical-line',
];

export const createLineTool = (typeId: LineToolType): BaseTool => {
  if (typeId === 'horizontal-line' || typeId === 'horizontal-ray' || typeId === 'vertical-line') return new OnePointLineTool(typeId, typeId);
  return new TwoPointLineTool(typeId, typeId);
};

export const lineControlPoints = (drawing: BaseDrawingData): ReadonlyArray<ControlPoint> =>
  anchorControlPoints(drawing.points);
