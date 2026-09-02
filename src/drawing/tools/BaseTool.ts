/**
 * tools/BaseTool.ts
 *
 * Abstract base for tools. Tools DO NOT mutate state. They only:
 *  - report which drawing type they create (typeId)
 *  - accumulate points during creation
 *  - signal completion to the engine via the InteractionController
 *
 * The engine translates signals into Commands.
 *
 * Phase 3: adds a shared, opt-in lifecycle so every tool follows the SAME
 * lifecycle (Idle → Begin → Preview → Update → Complete / Cancel). Concrete
 * tools (Phase 4) inherit this and never invent their own lifecycle. The
 * lifecycle hooks are OPTIONAL and default to no-ops so existing tools keep
 * working unchanged.
 */

import type { ICoordinateConverter } from '../core/api';
import type { DrawingPoint } from '../core/types';

export interface IToolContext {
  readonly cc: ICoordinateConverter;
  readonly currentToolId: string | null;
}

export interface IToolCallbacks {
  onPreview(points: ReadonlyArray<DrawingPoint>): void;
  onCommit(points: ReadonlyArray<DrawingPoint>): void;
  onCancel(): void;
}

/**
 * Shared tool lifecycle phases. Every tool moves through these; none define
 * their own. The InteractionController + engine drive the transitions.
 */
export type ToolPhase =
  | 'idle'      // tool selected, no points yet
  | 'begin'     // first point placed
  | 'preview'   // moving before next click
  | 'update'    // subsequent point placed (multi-point tools)
  | 'complete'  // required points reached; engine will commit
  | 'cancelled';

export abstract class BaseTool {
  abstract readonly id: string;
  /** typeId of the drawing this tool creates. */
  abstract readonly createsTypeId: string;

  /** Number of points required to complete (e.g. 2 for trendline, 1 for h-line). */
  abstract readonly requiredPoints: number;

  abstract onPointerDown(ctx: IToolContext, point: DrawingPoint, current: ReadonlyArray<DrawingPoint>): ReadonlyArray<DrawingPoint>;
  abstract onPointerMove(ctx: IToolContext, point: DrawingPoint, current: ReadonlyArray<DrawingPoint>): ReadonlyArray<DrawingPoint>;
  abstract isComplete(points: ReadonlyArray<DrawingPoint>): boolean;
  abstract reset(): void;

  // ── Phase 3: shared lifecycle (optional hooks, default no-op) ──

  private _phase: ToolPhase = 'idle';

  /** Current lifecycle phase. Managed by the runtime, not by concrete tools. */
  get phase(): ToolPhase { return this._phase; }

  /**
   * Runtime-only phase setter. The InteractionController/engine call this to
   * keep the shared lifecycle consistent across every tool. Concrete tools
   * should not call this directly.
   */
  setPhase(next: ToolPhase): void {
    this._phase = next;
    this.onPhaseChange?.(next);
  }

  /** Optional: react to lifecycle changes (e.g. UI hint). Default no-op. */
  onPhaseChange?(phase: ToolPhase): void;

  /** Reset lifecycle to idle. Called alongside reset(). */
  resetLifecycle(): void { this._phase = 'idle'; }
}
