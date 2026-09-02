/**
 * interaction/BoxSelection.ts
 *
 * Marquee (rectangular) selection runtime. Tracks an in-progress selection
 * rectangle in SCREEN space. The HitTestEngine.boxSelect converts to domain
 * and returns intersecting ids.
 *
 * Lasso-ready: the shape is abstracted behind ISelectionShape. Marquee is
 * the rectangular implementation; a future LassoSelection implements the same
 * interface (polygon containment) without changing the controller wiring.
 *
 * Pure: no DOM, no canvas. Screen coordinates arrive as plain numbers.
 */

export interface SelectionRect {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/**
 * Abstraction over selection region so marquee/lasso are interchangeable.
 * `contains` is in screen space; the controller supplies candidate screen
 * points (control-point projections) for testing.
 */
export interface ISelectionShape {
  readonly kind: string;
  /** Screen-space point-in-shape test. */
  contains(x: number, y: number): boolean;
  /** Screen-space axis-aligned bounds of the shape (for coarse pruning). */
  bounds(): SelectionRect;
  /** Whether the shape is large enough to be a deliberate selection (vs a click). */
  isSignificant(minSizePx: number): boolean;
}

/** Rectangular marquee shape. */
export class MarqueeShape implements ISelectionShape {
  readonly kind = 'marquee';
  constructor(private readonly rect: SelectionRect) {}

  contains(x: number, y: number): boolean {
    const { minX, maxX, minY, maxY } = normalize(this.rect);
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  }

  bounds(): SelectionRect {
    const { minX, maxX, minY, maxY } = normalize(this.rect);
    return { x1: minX, y1: minY, x2: maxX, y2: maxY };
  }

  isSignificant(minSizePx: number): boolean {
    const { minX, maxX, minY, maxY } = normalize(this.rect);
    return (maxX - minX) >= minSizePx || (maxY - minY) >= minSizePx;
  }
}

const normalize = (r: SelectionRect) => ({
  minX: Math.min(r.x1, r.x2),
  maxX: Math.max(r.x1, r.x2),
  minY: Math.min(r.y1, r.y2),
  maxY: Math.max(r.y1, r.y2),
});

/**
 * Tracks a marquee drag from start to end. The controller calls begin/update
 * /end and reads the current shape to feed HitTestEngine.
 */
export class BoxSelection {
  private startX = 0;
  private startY = 0;
  private curX = 0;
  private curY = 0;
  private active = false;

  isActive(): boolean { return this.active; }

  begin(x: number, y: number): void {
    this.startX = x; this.startY = y;
    this.curX = x; this.curY = y;
    this.active = true;
  }

  update(x: number, y: number): void {
    if (!this.active) return;
    this.curX = x; this.curY = y;
  }

  /** Current rectangle in screen space. */
  rect(): SelectionRect {
    return { x1: this.startX, y1: this.startY, x2: this.curX, y2: this.curY };
  }

  /** Current shape (marquee). Swap to lasso later by returning a LassoShape. */
  shape(): ISelectionShape {
    return new MarqueeShape(this.rect());
  }

  end(): SelectionRect {
    const r = this.rect();
    this.active = false;
    return r;
  }

  cancel(): void {
    this.active = false;
  }
}
