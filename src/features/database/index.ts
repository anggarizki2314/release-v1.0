// Feature: database
// Renderer-side data-access helpers that call into the main-process SQLite layer via IPC.
//
// Day 4 (bugfix): first real content — a generic settings key/value
// wrapper (api.ts) and useLastSelection(), which AppShell uses to
// restore the last selected symbol/timeframe across app restarts.
//
// Day 20: Database maintenance, statistics, and health check APIs.
export * from './api';
export * from './useLastSelection';
export * from './useDatabaseInfo';
