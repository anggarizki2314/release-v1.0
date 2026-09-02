import { useCallback, useEffect, useState } from 'react';
import type { SymbolInfo } from '@/types';
import { deleteSymbol, deleteTimeframe, listSymbols } from './api';
import { clearResampleCache } from '@/utils/dataResampler';

/**
 * Loads the list of symbols currently in the local database (metadata
 * only — id/name/timeframes/candleCount/date range, never candle rows)
 * and exposes a `refresh()` to call after an import completes, plus
 * `remove()` for the Day 3 Data Management delete action.
 */
export function useSymbols() {
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      clearResampleCache();
      const result = await listSymbols();
      setSymbols(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const remove = useCallback(
    async (symbolId: number) => {
      await deleteSymbol(symbolId);
      await refresh();
    },
    [refresh]
  );

  const removeTimeframe = useCallback(
    async (symbolId: number, timeframe: string) => {
      await deleteTimeframe(symbolId, timeframe);
      await refresh();
    },
    [refresh]
  );

  return { symbols, loading, refresh, remove, removeTimeframe };
}
