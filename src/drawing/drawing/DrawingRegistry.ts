/**
 * drawing/DrawingRegistry.ts
 *
 * Type registry. Lookup is by typeId. Engine never branches on type — it
 * queries the registry. Adding a new drawing type = register a bundle. No
 * engine code changes.
 *
 * Phase 1 ships the registry with zero concrete types. Concrete (TrendLine,
 * Rectangle, etc.) lands in Phase 4+.
 */

import type { IDrawingFactory } from './IDrawingFactory';
import type { IDrawingRenderer } from './IDrawingRenderer';
import type { IDrawingHitTester } from './IDrawingHitTester';
import type { IDrawingSnapper } from './IDrawingSnapper';
import type { IDrawingSerializer } from './IDrawingSerializer';
import type { IPointsEncoding } from './IPointsEncoding';
import type { BaseDrawingData } from '../core/types';

export interface DrawingTypeBundle<
  TData extends BaseDrawingData = BaseDrawingData
> {
  readonly typeId: string;
  readonly factory: IDrawingFactory<TData>;
  readonly renderer: IDrawingRenderer<TData>;
  readonly hitTester: IDrawingHitTester<TData>;
  readonly serializer: IDrawingSerializer<TData>;
  readonly snapper?: IDrawingSnapper<TData>;
  readonly pointsEncoding?: IPointsEncoding;
}

export class DrawingRegistry {
  private bundles = new Map<string, DrawingTypeBundle>();

  register<TData extends BaseDrawingData>(bundle: DrawingTypeBundle<TData>): void {
    if (this.bundles.has(bundle.typeId)) {
      throw new Error(`[DrawingRegistry] duplicate typeId: ${bundle.typeId}`);
    }
    this.bundles.set(bundle.typeId, bundle as DrawingTypeBundle);
  }

  unregister(typeId: string): void {
    this.bundles.delete(typeId);
  }

  has(typeId: string): boolean {
    return this.bundles.has(typeId);
  }

  get(typeId: string): DrawingTypeBundle | undefined {
    return this.bundles.get(typeId);
  }

  list(): ReadonlyArray<DrawingTypeBundle> {
    return Array.from(this.bundles.values());
  }

  clear(): void {
    this.bundles.clear();
  }
}
