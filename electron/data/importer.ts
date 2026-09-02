import fs from 'fs';
import path from 'path';
import { parseCsvFile, sniffTimeframe } from './csvParser';
import { detectSymbol } from './symbolDetector';
import { upsertSymbol, insertCandlesBatch, recordDataset, recordImportLog, getDatabase } from '../database/db';
import { rebuildDerivedTimeframes } from './derivedTimeframes';
import { bucketStart } from './aggregate';

export interface FileImportResult {
  filePath: string;
  fileName: string;
  symbol: string;
  timeframe: string;
  rowsRead: number; // total data lines encountered (valid + invalid)
  rowsValid: number; // successfully parsed & passed OHLC validation
  rowsSkipped: number; // malformed/invalid, safely dropped
  rowsDuplicate: number; // valid rows whose timestamp already existed
  rowsInserted: number; // net-new candles actually stored (rowsValid - rowsDuplicate)
  outOfOrderRows: number;
  firstTime: number | null;
  lastTime: number | null;
  error?: string;
}

/** Recursively collects .csv files, matching the Data/SYMBOL/*.csv convention. */
function collectCsvFiles(rootPath: string): string[] {
  const entries = fs.readdirSync(rootPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectCsvFiles(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) {
      files.push(full);
    }
  }
  return files;
}

async function importOneFile(filePath: string): Promise<FileImportResult> {
  const fileName = path.basename(filePath);
  const symbol = detectSymbol(filePath);

  try {
    const symbolId = upsertSymbol(symbol);

    // Two-pass, both streaming: (1) sniff the timeframe from a small
    // sample so we know it up front, (2) parse + insert immediately
    // per batch. At no point does the full file sit in memory — only
    // one ~5000-row batch at a time — so multi-million-row CSVs are
    // fine.
    const { key: timeframeKey } = await sniffTimeframe(filePath);

    let inserted = 0;
    let duplicates = 0;

    const result = await parseCsvFile(filePath, (batch) => {
      const batchResult = insertCandlesBatch(symbolId, timeframeKey, batch);
      inserted += batchResult.inserted;
      duplicates += batchResult.duplicates;
    });

    recordDataset({
      symbolId,
      timeframe: timeframeKey,
      fileName,
      filePath,
      rowsRead: result.totalRows + result.skippedRows,
      rowsValid: result.totalRows,
      rowsSkipped: result.skippedRows,
      rowsDuplicate: duplicates,
      rowsInserted: inserted,
      firstTime: result.firstTime,
      lastTime: result.lastTime,
    });

    // Determine import status
    const totalRows = result.totalRows + result.skippedRows;
    let status: 'SUCCESS' | 'FAILED' | 'PARTIAL' = 'SUCCESS';
    if (result.totalRows === 0 && result.skippedRows > 0) {
      status = 'FAILED';
    } else if (result.skippedRows > 0) {
      status = 'PARTIAL';
    }

    recordImportLog({
      symbol,
      timeframe: timeframeKey,
      fileName,
      rowsRead: totalRows,
      rowsValid: result.totalRows,
      rowsInserted: inserted,
      rowsDuplicate: duplicates,
      rowsSkipped: result.skippedRows,
      status,
    });

    return {
      filePath,
      fileName,
      symbol,
      timeframe: timeframeKey,
      rowsRead: result.totalRows + result.skippedRows,
      rowsValid: result.totalRows,
      rowsSkipped: result.skippedRows,
      rowsDuplicate: duplicates,
      rowsInserted: inserted,
      outOfOrderRows: result.outOfOrderRows,
      firstTime: result.firstTime,
      lastTime: result.lastTime,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    recordImportLog({
      symbol,
      timeframe: '',
      fileName,
      rowsRead: 0,
      rowsValid: 0,
      rowsInserted: 0,
      rowsDuplicate: 0,
      rowsSkipped: 0,
      status: 'FAILED',
      errorMessage: errorMsg,
    });
    return {
      filePath,
      fileName,
      symbol,
      timeframe: '',
      rowsRead: 0,
      rowsValid: 0,
      rowsSkipped: 0,
      rowsDuplicate: 0,
      rowsInserted: 0,
      outOfOrderRows: 0,
      firstTime: null,
      lastTime: null,
      error: errorMsg,
    };
  }
}

/** Import one or more explicitly-selected CSV files. */
export async function importFiles(filePaths: string[]): Promise<FileImportResult[]> {
  const results: FileImportResult[] = [];
  const affectedSymbols = new Map<string, { minTime: number; maxTime: number }>();

  for (const filePath of filePaths) {
    const res = await importOneFile(filePath);
    results.push(res);
    if (res.rowsInserted > 0 && res.timeframe === 'M1') {
      const existing = affectedSymbols.get(res.symbol);
      const first = res.firstTime ?? Infinity;
      const last = res.lastTime ?? -Infinity;
      if (existing) {
        existing.minTime = Math.min(existing.minTime, first);
        existing.maxTime = Math.max(existing.maxTime, last);
      } else {
        affectedSymbols.set(res.symbol, { minTime: first, maxTime: last });
      }
    }
  }

  // Auto-generate higher timeframes (M3..Monthly) for newly imported M1 data (incremental range only)
  for (const [sym, range] of affectedSymbols.entries()) {
    try {
      const symRow = getDatabase().prepare('SELECT id FROM symbols WHERE name = ?').get(sym) as { id: number } | undefined;
      if (symRow) {
        console.log(`[Importer] Auto-generating derived timeframes for imported symbol ${sym}...`);
        const fromExpanded = Number.isFinite(range.minTime) ? bucketStart(range.minTime, 'Monthly') : undefined;
        const toExpanded = Number.isFinite(range.maxTime) ? range.maxTime + 86400 : undefined;
        await rebuildDerivedTimeframes(symRow.id, fromExpanded, toExpanded);
      }
    } catch (err) {
      console.error(`[Importer] Failed to auto-generate derived timeframes for ${sym}:`, err);
    }
  }

  return results;
}

/**
 * Import an entire folder. Supports both:
 *  - Data/ containing SYMBOL subfolders, each with monthly CSVs
 *  - a single SYMBOL folder containing CSVs directly
 * (Folder name only matters for symbol detection when files sit
 * directly inside it — detectSymbol() already prefers the immediate
 * parent folder of each file, so this "just works" either way.)
 */
export async function importFolder(folderPath: string): Promise<FileImportResult[]> {
  const files = collectCsvFiles(folderPath);
  return importFiles(files);
}
