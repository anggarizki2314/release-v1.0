/**
 * drawing/index.ts — top-level barrel.
 *
 * Phase 1 surface. Concrete types (TrendLine, Rectangle, ...) land in
 * Phase 4+ via registry bundles — no engine changes required.
 */

export * from './core';
export * from './geometry';
export * from './drawing';
export * from './history';
export * from './interaction';
export * from './tools';
export * from './engine';
export * from './render';
export * from './clipboard/ClipboardManager';
export * from './serializer/Serializer';
export * from './style/StyleRegistry';
export * from './spatial/SpatialIndex';
export * from './lineFamily';
