/**
 * Drawing Engine — Drawing Object Factory
 *
 * Creates and validates drawing objects.
 * Pure functions, no side effects.
 */

import type { DrawingObject, DrawingStyle, CreateDrawingInput, DrawingPoint } from './types';

let idCounter = 0;

export function generateId(): string {
  return `draw-${Date.now()}-${++idCounter}`;
}

export const DEFAULT_STYLE: DrawingStyle = {
  color: '#4f86f7',
  lineWidth: 2,
  lineStyle: 'solid',
  opacity: 100,
  fill: undefined,
  fillOpacity: 20,
  fontSize: 14,
  fontFamily: 'var(--font-ui)',
};

import { getFactoryDefaultStyle, getSavedToolDefaultStyle } from '../services/templateService';

export function createDrawing(input: CreateDrawingInput): DrawingObject {
  const now = Date.now();
  const factoryStyle = getFactoryDefaultStyle(input.type);
  const savedStyle = getSavedToolDefaultStyle(input.type);

  const finalStyle = {
    ...factoryStyle,
    ...(savedStyle || {}),
    ...input.style,
  };
  delete (finalStyle as any).text;

  const isDedicatedTextTool =
    input.type === 'text' ||
    input.type === 'anchored-text' ||
    input.type === 'note' ||
    input.type === 'anchored-note' ||
    input.type === 'callout' ||
    input.type === 'balloon';

  return {
    id: generateId(),
    type: input.type,
    points: input.points.map((p) => ({ ...p })),
    style: finalStyle,
    text: isDedicatedTextTool ? (input.text ?? '') : (input.text || undefined),
    rotation: 0,
    selected: false,
    locked: false,
    hidden: false,
    visible: true,
    zIndex: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function cloneDrawing(d: DrawingObject): DrawingObject {
  return {
    ...d,
    id: generateId(),
    points: d.points.map((p) => ({ ...p })),
    style: { ...d.style },
    selected: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function updateDrawing(d: DrawingObject, changes: Partial<DrawingObject>): DrawingObject {
  return { ...d, ...changes, updatedAt: Date.now() };
}

export function getBoundingBox(points: DrawingPoint[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (points.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.time < minX) minX = p.time;
    if (p.price < minY) minY = p.price;
    if (p.time > maxX) maxX = p.time;
    if (p.price > maxY) maxY = p.price;
  }
  return { minX, minY, maxX, maxY };
}

export function distancePointToSegment(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
