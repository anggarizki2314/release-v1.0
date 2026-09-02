/**
 * BaseTool — Interface and base class for all drawing tools.
 *
 * Every tool implements this interface.
 * New tools = new class, no engine changes needed.
 */

import type { DrawingPoint, DrawingStyle, DrawingTypeId } from '../engine/types';

export interface ToolContext {
  getSnapPoint(x: number, y: number): DrawingPoint;
}

export interface BaseTool {
  readonly id: DrawingTypeId;
  readonly label: string;
  readonly icon: string;
  readonly requiredPoints: number; // 0 = freeform (double-click to finish)

  /** Called when tool is activated */
  onActivate?(): void;

  /** Called when tool is deactivated */
  onDeactivate?(): void;

  /** Handle pointer down — return true if tool consumed the event */
  onPointerDown(ctx: ToolContext, x: number, y: number, points: DrawingPoint[]): DrawingPoint[];

  /** Handle pointer move — return updated points for preview */
  onPointerMove(ctx: ToolContext, x: number, y: number, points: DrawingPoint[]): DrawingPoint[];

  /** Handle pointer up */
  onPointerUp?(ctx: ToolContext, x: number, y: number, points: DrawingPoint[]): DrawingPoint[];

  /** Check if drawing is complete after this action */
  isComplete(points: DrawingPoint[]): boolean;
}
