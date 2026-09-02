/**
 * drawing/IDrawingFactory.ts
 *
 * Per-type factory. Produces a fully-populated BaseDrawingData from a
 * partial input. Registered in DrawingRegistry.
 */

import type { BaseDrawingData } from '../core/types';

export interface IDrawingFactory<TData extends BaseDrawingData = BaseDrawingData> {
  readonly typeId: string;
  create(initial: Partial<TData> & { readonly id: string }): TData;
}
