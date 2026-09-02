// Thin wrapper around the settings IPC bridge exposed in
// electron/preload.ts. Actual storage is the generic app_settings
// key/value table in electron/database/db.ts — same local SQLite
// file used for symbols/candles/datasets, no separate database.
import type {
  DatabaseStats,
  DatabaseInfo,
  DatabaseHealth,
  DatasetStatsInfo,
  SymbolDetailStats,
  ImportLogRecord,
} from '@/types';

export function getSetting(key: string): Promise<string | null> {
  return window.forexReplay.getSetting(key);
}

export function setSetting(key: string, value: string): Promise<boolean> {
  return window.forexReplay.setSetting(key, value);
}

// ─── Day 20: Database Maintenance API ─────────────────────────────

export function openDataFolder(): Promise<boolean> {
  return window.forexReplay.openDataFolder();
}

export function getDbStats(): Promise<DatabaseStats> {
  return window.forexReplay.getDbStats();
}

export function getDbInfo(): Promise<DatabaseInfo> {
  return window.forexReplay.getDbInfo();
}

export function vacuumDb(): Promise<boolean> {
  return window.forexReplay.vacuumDb();
}

export function analyzeDb(): Promise<boolean> {
  return window.forexReplay.analyzeDb();
}

export function getDbHealth(): Promise<DatabaseHealth> {
  return window.forexReplay.getDbHealth();
}

export function listDatasetStats(): Promise<DatasetStatsInfo[]> {
  return window.forexReplay.listDatasetStats();
}

export function listSymbolStats(): Promise<SymbolDetailStats[]> {
  return window.forexReplay.listSymbolStats();
}

export function listImportLogs(limit?: number): Promise<ImportLogRecord[]> {
  return window.forexReplay.listImportLogs(limit);
}
