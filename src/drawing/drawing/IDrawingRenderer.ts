/**
 * drawing/IDrawingRenderer.ts
 *
 * Visual contract. Implemented per drawing type in registry/&lt;type&gt;/renderer.ts.
 * The composite Renderer only knows this interface — it does not branch on type.
 *
 * NO mutation. NO geometry math (use geometry/*). NO canvas-API imports
 * in this file (the implementation in render/ is allowed to use canvas).
 */

import type { BaseDrawingData, DrawingStyle } from '../core/types';
import type { ICoordinateConverter } from '../core/api';

export interface IRenderCommand {
  /** Opaque token — renderer must not introspect. */
  readonly op: string;
  readonly payload: unknown;
}

export interface IDrawingRenderer<TData extends BaseDrawingData = BaseDrawingData> {
  readonly typeId: string;

  /**
   * Produce a stream of draw commands. The composite renderer is
   * responsible for translating these to canvas calls. This keeps
   * per-type renderers testable (no canvas required) and
   * swappable (could target WebGL, SVG, server-side, etc).
   */
  render(drawing: TData, cc: ICoordinateConverter, style: DrawingStyle): ReadonlyArray<IRenderCommand>;
}
