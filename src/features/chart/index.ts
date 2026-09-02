// Feature: chart
// Renderer-side client for reading candle data out of the local
// database for the chart. Query + validation logic lives in
// electron/database/db.ts (getCandles) — this module wraps the IPC
// call and exposes it as a React hook. Multi-timeframe aggregation,
// drawings, and annotation persistence are not implemented yet.
export * from './api';
export * from './useCandles';
export * from './viewport';
export * from './timeframeAvailability';
export * from './candleResolver';
