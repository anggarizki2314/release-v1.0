/**
 * style/StyleRegistry.ts
 *
 * Phase 1 stub. Phase 2 implements style inheritance: drawing.style →
 * preset → default. Lookup chain.
 */

import type { DrawingStyle } from '../core/types';

export class StyleRegistry {
  private presets = new Map<string, DrawingStyle>();

  registerPreset(name: string, style: DrawingStyle): void {
    this.presets.set(name, style);
  }

  getPreset(name: string): DrawingStyle | undefined {
    return this.presets.get(name);
  }

  listPresets(): ReadonlyArray<string> { return Array.from(this.presets.keys()); }
}
