import type { DatasetInfo, ImportFileResult, SymbolInfo } from '@/types';

// Thin wrapper around the IPC bridge exposed in electron/preload.ts.
// All actual file reading/parsing/DB work happens in the main process
// (electron/data/*) — this file just gives the renderer typed,
// promise-based functions to call.

export function selectCsvFiles(): Promise<string[]> {
  return window.forexReplay.selectCsvFiles();
}

export function selectCsvFolder(): Promise<string | null> {
  return window.forexReplay.selectCsvFolder();
}

export function importFiles(filePaths: string[]): Promise<ImportFileResult[]> {
  return window.forexReplay.importFiles(filePaths);
}

export function importFolder(folderPath: string): Promise<ImportFileResult[]> {
  return window.forexReplay.importFolder(folderPath);
}

export function listSymbols(): Promise<SymbolInfo[]> {
  return window.forexReplay.listSymbols();
}

export function listDatasets(symbolId: number): Promise<DatasetInfo[]> {
  return window.forexReplay.listDatasets(symbolId);
}

export function deleteSymbol(symbolId: number): Promise<boolean> {
  return window.forexReplay.deleteSymbol(symbolId);
}

export function deleteTimeframe(symbolId: number, timeframe: string): Promise<boolean> {
  return window.forexReplay.deleteTimeframe(symbolId, timeframe);
}

/** Day 19: Delete a single dataset (import history metadata only). */
export function deleteDataset(datasetId: number): Promise<boolean> {
  return window.forexReplay.deleteDataset(datasetId);
}
