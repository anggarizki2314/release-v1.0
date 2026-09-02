/**
 * core/api.ts
 *
 * DrawingEngineAPI — the public surface of the engine.
 * Defined HERE so other modules depend on this interface, not on the concrete DrawingEngine class.
 * This is the dependency-inversion boundary that prevents engine → tools cycle.
 *
 * Headless: zero React/Canvas/LWC imports. Verifiable by `grep` in CI.
 */

import type { BaseDrawingData, DrawingPoint, DrawingStyle, TransformOp } from './types';
import type { DrawingEventName, DrawingEventPayload } from './events';

/**
 * Read-only handle to the coordinate converter.
 * The renderer (only) calls cc.timeToX / cc.priceToY. Managers/tools never.
 */
export interface ICoordinateConverter {
  timeToX(time: number): number | null;
  priceToY(price: number): number | null;
  xToTime(x: number): number | null;
  yToPrice(y: number): number | null;
  width(): number;
  height(): number;
  subscribe(listener: () => void): () => void;
}

/**
 * Mutation API for tools and adapters.
 * Every method routes through Command → HistoryManager → state update.
 * No method on this interface mutates state directly.
 */
export interface DrawingEngineAPI {
  // ── CRUD (route via Commands) ──
  create(typeId: string, initial: Partial<BaseDrawingData>): string;
  update(id: string, patch: Partial<BaseDrawingData>): void;
  delete(id: string): void;

  // ── Transform ──
  transform(id: string, op: TransformOp): void;
  transformMany(ids: ReadonlyArray<string>, op: TransformOp): void;

  // ── Style ──
  setStyle(id: string, patch: Partial<DrawingStyle>): void;

  // ── Lock / Visibility ──
  setLocked(id: string, locked: boolean): void;
  setVisible(id: string, visible: boolean): void;

  // ── Group ──
  group(ids: ReadonlyArray<string>): string | null;
  ungroup(groupId: string): ReadonlyArray<string>;

  // ── Selection / Hover ──
  select(ids: ReadonlyArray<string>, opts?: { multi?: boolean; toggle?: boolean }): void;
  hover(id: string | null): void;

  // ── History ──
  undo(): void;
  redo(): void;

  // ── Clipboard ──
  copy(ids: ReadonlyArray<string>): void;
  paste(at?: DrawingPoint): void;
  duplicate(ids: ReadonlyArray<string>): void;

  // ── Tool ──
  setTool(toolId: string | null): void;
  getTool(): string | null;

  // ── Read ──
  get(id: string): Readonly<BaseDrawingData> | undefined;
  list(): ReadonlyArray<Readonly<BaseDrawingData>>;
  getSelectedIds(): ReadonlyArray<string>;
  getHoveredId(): string | null;

  // ── Coordinate ──
  cc(): ICoordinateConverter;

  // ── Subscribe ──
  on<K extends DrawingEventName>(
    event: K,
    handler: (payload: DrawingEventPayload<K>) => void
  ): () => void;

  // ── Lifecycle ──
  destroy(): void;
}
