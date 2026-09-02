import { useCallback, useState } from 'react';
import type { ImportFileResult } from '@/types';
import { importFiles, importFolder, selectCsvFiles, selectCsvFolder } from './api';
import { clearResampleCache } from '@/utils/dataResampler';

export type ImportState =
  | { status: 'idle' }
  | { status: 'importing' }
  | { status: 'done'; results: ImportFileResult[] }
  | { status: 'error'; message: string };

/**
 * Drives the "Import File(s)" / "Import Folder" actions: opens the
 * native dialog, runs the import, and reports a summary. Never holds
 * parsed candle data — only the small per-file result summaries
 * (symbol, timeframe, row counts) that the main process returns.
 */
export function useImportData(onComplete?: () => void) {
  const [state, setState] = useState<ImportState>({ status: 'idle' });

  const runImportFiles = useCallback(async () => {
    const paths = await selectCsvFiles();
    if (paths.length === 0) return;
    setState({ status: 'importing' });
    try {
      const results = await importFiles(paths);
      clearResampleCache();
      setState({ status: 'done', results });
      onComplete?.();
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [onComplete]);

  const runImportFolder = useCallback(async () => {
    const folder = await selectCsvFolder();
    if (!folder) return;
    setState({ status: 'importing' });
    try {
      const results = await importFolder(folder);
      clearResampleCache();
      setState({ status: 'done', results });
      onComplete?.();
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [onComplete]);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, runImportFiles, runImportFolder, reset };
}
