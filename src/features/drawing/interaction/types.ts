/**
 * Interaction System — Type Definitions
 *
 * State machine states, event types, and shared interfaces.
 */

// ─── FSM States ────────────────────────────────────────────────────

export type InteractionState =
  | 'idle'                // No interaction happening
  | 'hover-object'        // Mouse over a drawing (no click)
  | 'selected-object'     // Drawing is selected, showing toolbar
  | 'dragging-object'     // Moving a drawing
  | 'resizing-anchor'     // Dragging an anchor point
  | 'creating-drawing'    // In the process of creating a new drawing
  | 'box-selecting'       // Drawing selection rectangle
  | 'context-menu'        // Context menu open
  | 'disabled';           // Interactions disabled

// ─── Events that trigger state transitions ──────────────────────────

export type InteractionEvent =
  | { type: 'pointer-down'; x: number; y: number; ctrlKey: boolean; shiftKey?: boolean }
  | { type: 'pointer-move'; x: number; y: number }
  | { type: 'pointer-up'; x: number; y: number; ctrlKey?: boolean }
  | { type: 'wheel'; deltaX?: number; deltaY?: number }
  | { type: 'key-down'; key: string; ctrlKey: boolean; metaKey: boolean }
  | { type: 'escape' }
  | { type: 'tool-changed'; tool: string }
  | { type: 'drawing-completed' }
  | { type: 'selection-changed' }
  | { type: 'chart-click'; point: { x: number; y: number } | null };

// ─── Hit test result with priority ──────────────────────────────────

export type HitTestPriority = 'anchor' | 'drawing' | 'floating-toolbar' | 'chart';

export interface HitResult {
  priority: HitTestPriority;
  drawingId?: string;
  anchorIndex?: number;
  point?: { x: number; y: number };
}

// ─── Coordinate system ──────────────────────────────────────────────

export interface CoordinateSystem {
  timeToX: (time: number) => number;
  priceToY: (price: number) => number;
  xToTime: (x: number) => number;
  yToPrice: (y: number) => number;
  screenToChart: (clientX: number, clientY: number) => { x: number; y: number } | null;
}

// ─── Drag context ───────────────────────────────────────────────────

export interface DragContext {
  drawingId: string;
  anchorIndex: number; // -1 for move, 0+ for resize
  startMouseX: number;
  startMouseY: number;
  origPoints: Array<{ time: number; price: number }>;
}

// ─── State transition handler ───────────────────────────────────────

export type StateTransitionHandler = (
  from: InteractionState,
  to: InteractionState,
  event: InteractionEvent
) => void;
