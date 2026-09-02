/**
 * render/Renderer.ts
 *
 * Composite renderer. The ONLY component allowed to issue drawing commands
 * (AD: Renderer is the sole drawing-command issuer). It:
 *
 *   1. Subscribes to a DirtyTracker; repaints only when dirty (RAF-driven).
 *   2. Walks RenderLayerStack in paint order.
 *   3. For the 'drawing' layer, walks DrawingManager.list() in z-order,
 *      looks up each drawing's per-type IDrawingRenderer from the registry,
 *      and collects its IRenderCommand stream. It NEVER branches on type.
 *   4. Feeds every command to a RenderTarget (canvas today).
 *
 * Hard rules:
 *   - No type branching (AD-04): dispatch is purely registry lookup.
 *   - No hit-testing here (AD-06).
 *   - No geometry math here (AD-05): per-type renderers use geometry/.
 *   - No mutation of drawings (renderer only reads).
 *   - Canvas usage is delegated to RenderTarget; this file has no ctx calls.
 *
 * Layer content sources are pluggable: callers register a "layer painter"
 * for chrome layers (selection handles, hover highlight, overlay, cursor).
 * The 'drawing' layer painter is built in and uses the registry.
 */

import type { BaseDrawingData, DrawingStyle } from '../core/types';
import type { ICoordinateConverter } from '../core/api';
import type { DrawingRegistry } from '../drawing/DrawingRegistry';
import type { IRenderCommand } from '../drawing/IDrawingRenderer';
import type { RenderTarget } from './RenderTarget';
import type { LayerId } from './RenderLayers';
import { RenderLayerStack, DEFAULT_LAYER_ORDER } from './RenderLayers';
import { DirtyTracker, type DirtyReason, type DirtyTrackerOptions } from './DirtyTracker';

/**
 * A layer painter emits render commands for a single layer. Chrome layers
 * (selection/hover/overlay/cursor) register painters. The 'drawing' layer
 * has a built-in painter driven by the registry.
 */
export type LayerPainter = (cc: ICoordinateConverter) => ReadonlyArray<IRenderCommand>;

export interface RendererDeps {
  readonly registry: DrawingRegistry;
  readonly target: RenderTarget;
  /** Source of drawings in z-order. Usually DrawingManager.list. */
  readonly getDrawings: () => ReadonlyArray<Readonly<BaseDrawingData>>;
  /** Coordinate converter (screen mapping). */
  readonly cc: ICoordinateConverter;
  readonly layerOrder?: ReadonlyArray<LayerId>;
  readonly dirty?: DirtyTrackerOptions;
}

export class Renderer {
  readonly layers: RenderLayerStack;
  readonly dirty: DirtyTracker;

  private readonly registry: DrawingRegistry;
  private readonly target: RenderTarget;
  private readonly getDrawings: () => ReadonlyArray<Readonly<BaseDrawingData>>;
  private cc: ICoordinateConverter;
  private painters = new Map<LayerId, LayerPainter>();
  private unsubCc: (() => void) | null = null;
  private destroyed = false;
  private lastReasons: ReadonlySet<DirtyReason> = new Set();
  private frameCount = 0;

  constructor(deps: RendererDeps) {
    this.registry = deps.registry;
    this.target = deps.target;
    this.getDrawings = deps.getDrawings;
    this.cc = deps.cc;
    this.layers = new RenderLayerStack(deps.layerOrder ?? DEFAULT_LAYER_ORDER);
    this.dirty = new DirtyTracker(deps.dirty ?? {});

    // Built-in drawing-layer painter: registry-driven, no type branching.
    this.painters.set('drawing', (cc) => this.paintDrawings(cc));

    this.dirty.onFlush((reasons) => this.repaint(reasons));

    // Any viewport change → mark viewport dirty (schedules a frame).
    this.unsubCc = this.cc.subscribe(() => this.dirty.mark('viewport'));
  }

  /** Register a painter for a chrome layer (selection/hover/overlay/cursor). */
  setLayerPainter(id: LayerId, painter: LayerPainter | null): void {
    if (painter) this.painters.set(id, painter);
    else this.painters.delete(id);
    this.dirty.mark('layer');
  }

  /** Swap the coordinate converter (e.g. on chart re-attach). */
  setCoordinateConverter(cc: ICoordinateConverter): void {
    this.unsubCc?.();
    this.cc = cc;
    this.unsubCc = this.cc.subscribe(() => this.dirty.mark('viewport'));
    this.dirty.mark('full');
  }

  /** Public invalidation entry — callers map their event to a reason. */
  invalidate(reason: DirtyReason = 'full'): void {
    this.dirty.mark(reason);
  }

  /** Force a synchronous repaint (used by resize / tests). */
  renderNow(): void {
    this.dirty.mark('full');
    this.dirty.flushNow();
  }

  /** Diagnostics. */
  frames(): number { return this.frameCount; }
  lastFrameReasons(): ReadonlySet<DirtyReason> { return this.lastReasons; }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubCc?.();
    this.unsubCc = null;
    this.dirty.destroy();
    this.painters.clear();
  }

  // ── Frame ──
  private repaint(reasons: ReadonlySet<DirtyReason>): void {
    if (this.destroyed) return;
    this.lastReasons = reasons;
    this.frameCount++;

    const width = this.cc.width();
    const height = this.cc.height();
    const dpr = (globalThis as { devicePixelRatio?: number }).devicePixelRatio ?? 1;

    this.target.begin(width, height, dpr);
    // Walk layers low → high (painter's algorithm).
    for (const layer of this.layers.ordered()) {
      if (!layer.visible) continue;
      const painter = this.painters.get(layer.id);
      if (!painter) continue;
      const commands = painter(this.cc);
      for (const cmd of commands) this.target.execute(cmd);
    }
    this.target.end();
  }

  // ── Built-in drawing layer painter (registry-driven, type-agnostic) ──
  private paintDrawings(cc: ICoordinateConverter): ReadonlyArray<IRenderCommand> {
    const out: IRenderCommand[] = [];
    for (const d of this.getDrawings()) {
      if (!d.visible) continue;
      const bundle = this.registry.get(d.type);
      if (!bundle) continue;
      const style: DrawingStyle = d.style;
      const commands = bundle.renderer.render(d, cc, style);
      for (const c of commands) out.push(c);
    }
    return out;
  }
}
