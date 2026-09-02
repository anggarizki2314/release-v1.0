/**
 * core/types.ts
 *
 * Pure type definitions. ZERO runtime code.
 * No dependencies on any other module (geometry, drawing, etc).
 */

export type Timestamp = number;
export type Price = number;
export type LogicalIndex = number;
export type ZIndex = number;

/**
 * Canonical point in domain coordinates.
 * Renderer is the ONLY component allowed to convert this to screen pixels.
 */
export interface DrawingPoint {
  readonly time: Timestamp;
  readonly price: Price;
  readonly meta?: Readonly<Record<string, unknown>>;
}

/**
 * Drawing visual + interactive state.
 * 'creating' is transient — never persisted.
 */
export type DrawingState =
  | 'normal'
  | 'creating'
  | 'selected'
  | 'hovered'
  | 'locked'
  | 'hidden';

export type LineStyle = 'solid' | 'dashed' | 'dotted';
export type ArrowHead = 'none' | 'arrow' | 'circle' | 'square';

/**
 * Text layout is extensible. New modes can be added without engine changes.
 */
export type TextLayoutMode = 'anchored' | 'bounded';

/**
 * Style is extensible via `meta` bag. Engine must not introspect meta.
 */
export interface DrawingStyle {
  readonly color: string;
  readonly lineWidth: number;
  readonly opacity: number;
  readonly lineStyle: LineStyle;
  readonly fill?: string;
  readonly fillOpacity?: number;
  readonly strokeColor?: string;
  readonly strokeWidth?: number;
  readonly fillEnabled?: boolean;
  readonly fillColor?: string;
  readonly fontSize?: number;
  readonly fontFamily?: string;
  readonly arrowHead?: ArrowHead;
  /**
   * Type-specific style bag. E.g. fib ratios, brush pressure, text bounds.
   * Engine treats this as opaque. Geometry/Renderer may interpret.
   */
  readonly meta?: Readonly<Record<string, unknown>>;
}

export interface BaseDrawingData {
  readonly id: string;
  readonly type: string;            // typeId registered in DrawingRegistry
  readonly points: ReadonlyArray<DrawingPoint>;
  readonly style: DrawingStyle;
  readonly state: DrawingState;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly zIndex: ZIndex;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly groupId?: string;        // present when this drawing is a member of an IDrawingContainer
}

/**
 * Discriminated union for all transform operations.
 * Unified TransformCommand wraps this internally.
 */
export type TransformOp =
  | { readonly kind: 'move'; readonly dTime: number; readonly dPrice: number }
  | { readonly kind: 'resize'; readonly anchorIndex: number; readonly target: DrawingPoint }
  | { readonly kind: 'rotate'; readonly pivot: DrawingPoint; readonly angleRad: number }
  | { readonly kind: 'scale'; readonly pivot: DrawingPoint; readonly factor: number }
  | { readonly kind: 'mirror'; readonly axis: 'horizontal' | 'vertical' }
  | { readonly kind: 'flip' };
