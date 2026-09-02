import { useCallback, useEffect, useState } from 'react';
import type { DatasetInfo } from '@/types';
import { listDatasets, deleteDataset } from './api';

/**
 * Import history (one row per file ever imported) for a single symbol.
 * Lazily fetched — only called when a symbol row is expanded in the
 * Data Management tab, not for every symbol up front.
 *
 * Day 19: Added removeDataset for per-dataset delete.
 */
export function useDatasets(symbolId: number | null) {
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (symbolId === null) {
      setDatasets([]);
      return;
    }
    setLoading(true);
    try {
      const result = await listDatasets(symbolId);
      setDatasets(result);
    } finally {
      setLoading(false);
    }
  }, [symbolId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Delete a single dataset (import history metadata only, candles preserved). */
  const removeDataset = useCallback(
    async (datasetId: number) => {
      await deleteDataset(datasetId);
      await refresh();
    },
    [refresh]
  );

  return { datasets, loading, refresh, removeDataset };
}
