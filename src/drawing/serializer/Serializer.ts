/**
 * serializer/Serializer.ts
 *
 * Phase 1 stub. Phase 3 implements version-aware (de)serialization with
 * per-type IDrawingSerializer upgrade paths.
 */

export class Serializer {
  version = 1;
  serialize(_data: unknown): string { return '{}'; }
  deserialize(_raw: string): unknown { return null; }
}
