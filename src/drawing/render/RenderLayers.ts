/**
 * render/RenderLayers.ts
 *
 * Configurable render layer ordering. Each layer is an ordered slot in the
 * paint pipeline. The Renderer walks layers low → high and paints each.
 *
 * Layers do NOT know drawing types. They are generic slots that hold a set
 * of render passes. Drawing objects contribute to the 'drawing' layer via
 * their per-type IDrawingRenderer; selection/hover chrome go to their own
 * layers. This keeps AD-04 (renderer type-agnostic) intact.
 */

export type LayerId =
  | 'background'
  | 'chart'
  | 'indicator'
  | 'drawing'
  | 'selection'
  | 'hover'
  | 'overlay'
  | 'cursor';

export const DEFAULT_LAYER_ORDER: ReadonlyArray<LayerId> = [
  'background',
  'chart',
  'indicator',
  'drawing',
  'selection',
  'hover',
  'overlay',
  'cursor',
];

export interface RenderLayer {
  readonly id: LayerId;
  /** Higher paints on top. Derived from order index. */
  readonly order: number;
  /** Layer can be toggled without removing it. */
  visible: boolean;
}

export class RenderLayerStack {
  private layers: RenderLayer[] = [];
  private byId = new Map<LayerId, RenderLayer>();

  constructor(order: ReadonlyArray<LayerId> = DEFAULT_LAYER_ORDER) {
    this.configure(order);
  }

  /** Replace the entire ordering. Order index = array position. */
  configure(order: ReadonlyArray<LayerId>): void {
    this.layers = order.map((id, i) => ({ id, order: i, visible: true }));
    this.byId = new Map(this.layers.map((l) => [l.id, l]));
  }

  /** Ordered low → high (paint order). */
  ordered(): ReadonlyArray<RenderLayer> {
    return this.layers;
  }

  get(id: LayerId): RenderLayer | undefined {
    return this.byId.get(id);
  }

  setVisible(id: LayerId, visible: boolean): void {
    const l = this.byId.get(id);
    if (l) l.visible = visible;
  }

  orderOf(id: LayerId): number {
    return this.byId.get(id)?.order ?? -1;
  }

  /** Move a layer to a new index, shifting the rest. Reindexes order. */
  move(id: LayerId, toIndex: number): void {
    const from = this.layers.findIndex((l) => l.id === id);
    if (from === -1) return;
    const clamped = Math.max(0, Math.min(toIndex, this.layers.length - 1));
    const [layer] = this.layers.splice(from, 1);
    this.layers.splice(clamped, 0, layer);
    this.layers.forEach((l, i) => {
      (l as { order: number }).order = i;
    });
  }
}
