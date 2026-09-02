/**
 * render/index.ts — barrel.
 *
 * Phase 2 render foundation. Note: the LightweightChartsAdapter is NOT
 * re-exported here because it imports 'lightweight-charts'. Consumers that
 * need it import it directly from './adapters/LightweightChartsAdapter' so
 * the headless surface (this barrel) stays library-free.
 */

export * from './commands';
export * from './RenderLayers';
export * from './DirtyTracker';
export * from './CoordinateCache';
export * from './CoordinateConverter';
export * from './IChartCoordinateSource';
export * from './RenderTarget';
export * from './Renderer';
export * from './TextMetricsProviderImpl';
