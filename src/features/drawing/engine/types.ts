/**
 * Drawing Engine — Type Definitions
 *
 * All drawing types, tool types, and engine interfaces.
 */

// ─── Drawing Type IDs ──────────────────────────────────────────────

export type DrawingTypeId =
  // Lines & Rays
  | 'trendline' | 'ray' | 'info-line' | 'extended-line'
  | 'horizontal-line' | 'horizontal-ray' | 'vertical-line' | 'cross-line'
  // Arrows & Markers
  | 'arrow' | 'arrow-marker' | 'arrow-up' | 'arrow-down'
  // Brush & Shapes
  | 'brush' | 'highlighter' | 'path'
  | 'rectangle' | 'rotated-rectangle' | 'circle' | 'ellipse'
  | 'triangle' | 'polyline' | 'arc' | 'curve' | 'double-curve'
  // Text & Annotations
  | 'text' | 'anchored-text' | 'callout' | 'balloon' | 'note' | 'anchored-note' | 'label' | 'price-label'
  // Fibonacci & Gann
  | 'fibonacci' | 'fib-retracement' | 'fib-extension' | 'fib-channel' | 'fib-time-zone' | 'fib-timezone'
  | 'fib-fan' | 'fib-time' | 'pitchfork' | 'schiff-pitchfork'
  | 'gann-box' | 'gann-fan'
  // Channels
  | 'channel'
  // Pattern & Positions
  | 'long-position' | 'short-position' | 'forecast' | 'bars-pattern'
  // Measurements
  | 'price-range' | 'date-range' | 'date-price-range';

// ─── Tool IDs (for ToolManager) ───────────────────────────────────

export type ToolId = DrawingTypeId | 'pointer' | 'crosshair' | 'magnet';

// ─── Drawing Point ─────────────────────────────────────────────────

export interface DrawingPoint {
  time: number;   // unix seconds
  price: number;
}

// ─── Style ─────────────────────────────────────────────────────────

export type LineStyle = 'solid' | 'dashed' | 'dotted';

export interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: LineStyle;
  opacity: number;
  fill?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  fillEnabled?: boolean;
  fillColor?: string;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  textValign?: 'above' | 'center' | 'below';
  textOffset?: number;
  extend?: 'none' | 'left' | 'right' | 'both';
  showMidpoint?: boolean;
  showPriceLabel?: boolean;
  leftEndpoint?: 'none' | 'circle' | 'arrow';
  rightEndpoint?: 'none' | 'circle' | 'arrow';
  statsVisibility?: 'hidden' | 'always' | 'hover';
  statsPosition?: 'left' | 'center' | 'right';
  alwaysShowStats?: boolean;
  // Position tool
  entryPrice?: number;
  stopPrice?: number;
  targetPrice?: number;
  // Position tool custom colors
  tpColor?: string; // Take Profit zone color (default teal)
  slColor?: string; // Stop Loss zone color (default teal-dark)
  // Fib levels
  levels?: number[];
  // Text
  text?: string;
  labelAlign?: 'left' | 'center' | 'right';
}

// ─── Bounding Box ──────────────────────────────────────────────────

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ─── Drawing Object ────────────────────────────────────────────────

export interface DrawingObject {
  id: string;
  type: DrawingTypeId;
  points: DrawingPoint[];
  style: DrawingStyle;
  text?: string;
  rotation: number;
  selected: boolean;
  locked: boolean;
  hidden: boolean;
  visible: boolean;
  zIndex: number;
  createdAt: number;
  updatedAt: number;
}

// ─── Drawing Factory Input ─────────────────────────────────────────

export interface CreateDrawingInput {
  type: DrawingTypeId;
  points: DrawingPoint[];
  style?: Partial<DrawingStyle>;
  text?: string;
}

export interface UpdateDrawingInput {
  points?: DrawingPoint[];
  style?: Partial<DrawingStyle>;
  text?: string;
  rotation?: number;
  locked?: boolean;
  hidden?: boolean;
  zIndex?: number;
}

// ─── Tool Category ─────────────────────────────────────────────────

export type ToolCategory = 'cursor' | 'trend' | 'horizontal' | 'shape' | 'fibonacci' | 'text' | 'pattern';

// ─── Hit Test Result ───────────────────────────────────────────────

export interface HitTestResult {
  drawing: DrawingObject;
  distance: number;
  hitPoint?: DrawingPoint;
  hitZone: 'body' | 'point-0' | 'point-1' | 'point-2' | 'edge';
}

// ─── Snap Result ───────────────────────────────────────────────────

export interface SnapResult {
  time: number;
  price: number;
  snapped: boolean;
  snapType?: 'ohlc' | 'grid' | 'candle-center';
}

// ─── History Entry ─────────────────────────────────────────────────

export type HistoryActionType =
  | 'create' | 'update' | 'delete' | 'duplicate'
  | 'move' | 'resize' | 'rotate'
  | 'lock' | 'hide' | 'visibility' | 'layer'
  | 'paste' | 'property-change';

export interface HistoryEntry {
  id: string;
  type: HistoryActionType;
  drawingIds: string[];
  before: Record<string, Partial<DrawingObject>>;
  after: Record<string, Partial<DrawingObject>>;
  timestamp: number;
}

// ─── Serialized Drawing ────────────────────────────────────────────

export interface SerializedDrawing {
  v: number;
  id: string;
  type: DrawingTypeId;
  points: Array<{ t: number; p: number }>;
  style: DrawingStyle;
  text?: string;
  rotation: number;
  locked: boolean;
  hidden: boolean;
  zIndex: number;
  ts: number;
}

// ─── Engine Events ─────────────────────────────────────────────────

export interface DrawingEngineEvents {
  'drawing:created': { drawing: DrawingObject };
  'drawing:updated': { drawing: DrawingObject; changes: Partial<DrawingObject> };
  'drawing:deleted': { drawingId: string };
  'drawing:batch-deleted': { drawingIds: string[] };
  'selection:changed': { selectedIds: string[] };
  'tool:changed': { tool: ToolId; previous: ToolId };
  'history:changed': { canUndo: boolean; canRedo: boolean };
  'drawings:loaded': { drawings: DrawingObject[] };
  'drawings:cleared': {};
  'snap:matched': { snap: SnapResult };
}

export type EventKey = keyof DrawingEngineEvents;
export type EventHandler<K extends EventKey = EventKey> = (data: DrawingEngineEvents[K]) => void;
