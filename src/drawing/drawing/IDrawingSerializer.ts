/**
 * drawing/IDrawingSerializer.ts
 *
 * Per-type serialization with explicit version + upgrade path.
 * The composite Serializer in serializer/ enforces schema versioning.
 */

import type { BaseDrawingData } from '../core/types';

export interface IDrawingSerializer<TData extends BaseDrawingData = BaseDrawingData> {
  readonly typeId: string;
  /** Current schema version. */
  readonly version: number;
  serialize(drawing: TData): unknown;
  deserialize(raw: unknown): TData | null;
  /**
   * Migrate an old-version payload (version !== this.version) to the
   * current version. Return null if unrecoverable.
   */
  upgrade(fromVersion: number, raw: unknown): unknown;
}
