/**
 * core/events.ts
 *
 * Typed event taxonomy. EventBus is pure dispatch — no logic.
 * Subscribers may contain logic; the bus itself never does.
 */

import type { BaseDrawingData, DrawingStyle, TransformOp } from './types';

export interface DrawingEvents {
  'drawing:added':   { drawing: Readonly<BaseDrawingData> };
  'drawing:updated': { prev: Readonly<BaseDrawingData>; next: Readonly<BaseDrawingData>; reason: UpdateReason };
  'drawing:deleted': { id: string; snapshot: Readonly<BaseDrawingData> };

  'selection:changed': { ids: ReadonlyArray<string> };
  'hover:changed':     { id: string | null };

  'tool:changed': { tool: string | null; prev: string | null };

  'history:changed': { canUndo: boolean; canRedo: boolean };

  'viewport:changed': Record<string, never>;

  'group:created': { groupId: string; childIds: ReadonlyArray<string> };
  'group:disbanded': { groupId: string; childIds: ReadonlyArray<string> };

  // ── Phase 3: interaction runtime events ──
  // Renderer and UI chrome listen to these; no business logic in the bus.
  'drag:started':  { id: string };
  'drag:ended':    { id: string };
  'resize:started': { id: string; handleId: string };
  'resize:ended':   { id: string; handleId: string };
  'tool:activated':   { tool: string; prev: string | null };
  'tool:deactivated': { tool: string };
  'snap:changed': { active: boolean; snapType: SnapType | null };
  'interaction:state-changed': { from: string; to: string };
  'boxselect:changed': { rect: BoxSelectRect | null };
  'cursor:changed': { cursor: CursorType };
}

/** Snap categories emitted with 'snap:changed'. */
export type SnapType =
  | 'open' | 'high' | 'low' | 'close'
  | 'endpoint' | 'control-point'
  | 'grid' | 'angle';

/** Marquee rectangle in screen pixels. */
export interface BoxSelectRect {
  readonly x1: number; readonly y1: number;
  readonly x2: number; readonly y2: number;
}

/** Centralized cursor vocabulary (mirrors CursorManager). */
export type CursorType =
  | 'default' | 'pointer' | 'crosshair'
  | 'move' | 'resize' | 'rotate' | 'text';

export type UpdateReason =
  | { kind: 'create' }
  | { kind: 'update' }
  | { kind: 'transform'; op: TransformOp }
  | { kind: 'style'; patch: Partial<DrawingStyle> }
  | { kind: 'lock'; locked: boolean }
  | { kind: 'visibility'; visible: boolean }
  | { kind: 'group-attach'; groupId: string }
  | { kind: 'group-detach' };

export type DrawingEventName = keyof DrawingEvents;
export type DrawingEventPayload<K extends DrawingEventName> = DrawingEvents[K];
