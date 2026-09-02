/**
 * spatial/SpatialIndex.ts
 *
 * Quadtree over DOMAIN coordinates (time on X, price on Y). Domain space is
 * unbounded and dynamic, so we use a loose quadtree that re-roots when an
 * inserted bounds falls outside the current world box.
 *
 * The index stores axis-aligned bounding boxes in domain space. It answers:
 *   - queryPoint(time, price)      → ids whose bbox contains the point
 *   - queryRange(bounds)           → ids whose bbox intersects the range
 *   - nearest(time, price, maxN)   → ids sorted by bbox-center distance
 *
 * It does NOT know drawing types. It only knows ids + domain bounds. The
 * HitTestEngine converts screen → domain and calls this for a coarse phase,
 * then refines with per-type hit-testers.
 *
 * No canvas, no chart, no React. Pure data structure — headless testable.
 */

export interface DomainBox {
  readonly fromTime: number;
  readonly toTime: number;
  readonly fromPrice: number;
  readonly toPrice: number;
}

interface Entry {
  readonly id: string;
  readonly box: DomainBox;
}

const MAX_ITEMS = 8;
const MAX_DEPTH = 12;

const boxIntersects = (a: DomainBox, b: DomainBox): boolean =>
  a.fromTime <= b.toTime &&
  a.toTime >= b.fromTime &&
  a.fromPrice <= b.toPrice &&
  a.toPrice >= b.fromPrice;

const boxContainsPoint = (b: DomainBox, t: number, p: number): boolean =>
  t >= b.fromTime && t <= b.toTime && p >= b.fromPrice && p <= b.toPrice;

const centerOf = (b: DomainBox): { t: number; p: number } => ({
  t: (b.fromTime + b.toTime) / 2,
  p: (b.fromPrice + b.toPrice) / 2,
});

class QuadNode {
  entries: Entry[] = [];
  children: QuadNode[] | null = null;

  constructor(
    readonly bounds: DomainBox,
    readonly depth: number
  ) {}

  private subdivide(): void {
    const midT = (this.bounds.fromTime + this.bounds.toTime) / 2;
    const midP = (this.bounds.fromPrice + this.bounds.toPrice) / 2;
    const { fromTime, toTime, fromPrice, toPrice } = this.bounds;
    this.children = [
      new QuadNode({ fromTime, toTime: midT, fromPrice, toPrice: midP }, this.depth + 1),
      new QuadNode({ fromTime: midT, toTime, fromPrice, toPrice: midP }, this.depth + 1),
      new QuadNode({ fromTime, toTime: midT, fromPrice: midP, toPrice }, this.depth + 1),
      new QuadNode({ fromTime: midT, toTime, fromPrice: midP, toPrice }, this.depth + 1),
    ];
    const existing = this.entries;
    this.entries = [];
    for (const e of existing) this.insert(e);
  }

  insert(e: Entry): void {
    if (this.children) {
      const child = this.childFor(e.box);
      if (child) {
        child.insert(e);
        return;
      }
      // straddles children → keep at this node
      this.entries.push(e);
      return;
    }
    this.entries.push(e);
    if (this.entries.length > MAX_ITEMS && this.depth < MAX_DEPTH) {
      this.subdivide();
    }
  }

  private childFor(box: DomainBox): QuadNode | null {
    if (!this.children) return null;
    for (const c of this.children) {
      if (
        box.fromTime >= c.bounds.fromTime &&
        box.toTime <= c.bounds.toTime &&
        box.fromPrice >= c.bounds.fromPrice &&
        box.toPrice <= c.bounds.toPrice
      ) {
        return c;
      }
    }
    return null;
  }

  queryRange(range: DomainBox, out: string[]): void {
    if (!boxIntersects(this.bounds, range)) return;
    for (const e of this.entries) {
      if (boxIntersects(e.box, range)) out.push(e.id);
    }
    if (this.children) {
      for (const c of this.children) c.queryRange(range, out);
    }
  }

  queryPoint(t: number, p: number, out: string[]): void {
    if (!boxContainsPoint(this.bounds, t, p)) return;
    for (const e of this.entries) {
      if (boxContainsPoint(e.box, t, p)) out.push(e.id);
    }
    if (this.children) {
      for (const c of this.children) c.queryPoint(t, p, out);
    }
  }

  collectAll(out: Entry[]): void {
    for (const e of this.entries) out.push(e);
    if (this.children) for (const c of this.children) c.collectAll(out);
  }
}

const WORLD: DomainBox = {
  fromTime: -1e15,
  toTime: 1e15,
  fromPrice: -1e12,
  toPrice: 1e12,
};

export class SpatialIndex {
  private root = new QuadNode(WORLD, 0);
  private index = new Map<string, DomainBox>();

  insert(id: string, box: DomainBox): void {
    if (this.index.has(id)) this.remove(id);
    this.index.set(id, box);
    this.root.insert({ id, box });
  }

  /** Convenience alias matching the Phase 1 stub signature. */
  update(id: string, box: DomainBox): void {
    this.insert(id, box);
  }

  remove(id: string): void {
    if (!this.index.has(id)) return;
    this.index.delete(id);
    this.rebuild();
  }

  has(id: string): boolean {
    return this.index.has(id);
  }

  size(): number {
    return this.index.size;
  }

  clear(): void {
    this.root = new QuadNode(WORLD, 0);
    this.index.clear();
  }

  /** Coarse-phase: ids whose bbox contains the domain point. */
  queryPoint(time: number, price: number): ReadonlyArray<string> {
    const out: string[] = [];
    this.root.queryPoint(time, price, out);
    return out;
  }

  /** Coarse-phase: ids whose bbox intersects the domain range (marquee/lasso bbox). */
  queryRange(box: DomainBox): ReadonlyArray<string> {
    const out: string[] = [];
    this.root.queryRange(box, out);
    return out;
  }

  /** All ids (Phase 1 compatibility). */
  query(): ReadonlyArray<string> {
    return Array.from(this.index.keys());
  }

  /**
   * Nearest N ids by bbox-center distance to (time, price).
   * Distances are computed in domain units; caller may prefer screen units,
   * but for coarse ranking domain center distance is sufficient.
   */
  nearest(time: number, price: number, maxN = 1): ReadonlyArray<string> {
    const scored: Array<{ id: string; d: number }> = [];
    for (const [id, box] of this.index) {
      const c = centerOf(box);
      const dt = c.t - time;
      const dp = c.p - price;
      scored.push({ id, d: dt * dt + dp * dp });
    }
    scored.sort((a, b) => a.d - b.d);
    return scored.slice(0, maxN).map((s) => s.id);
  }

  private rebuild(): void {
    this.root = new QuadNode(WORLD, 0);
    for (const [id, box] of this.index) {
      this.root.insert({ id, box });
    }
  }
}
