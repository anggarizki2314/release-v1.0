/**
 * Interaction System — Public API
 */

export { InteractionController, type InteractionCallbacks } from './InteractionController';
export { InteractionStateMachine } from './InteractionStateMachine';
export { HitTestEngine } from './HitTestEngine';
export { ChartInteractionBridge } from './ChartInteractionBridge';
export { HoverController } from './HoverController';
export { SelectionController } from './SelectionController';
export { DragController } from './DragController';
export { CursorController } from './CursorController';
export type { InteractionState, InteractionEvent, HitResult, HitTestPriority, CoordinateSystem, DragContext } from './types';
