import { useState, useEffect, useCallback, useMemo } from 'react';
import type { EconomicEvent } from './types';
import { getCurrenciesForSymbol, getEconomicNewsForRange } from './newsApi';

export function useEconomicNews(
  symbol: string,
  fromTime: number | null,
  toTime: number | null,
  enabled: boolean = true
) {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const currencies = useMemo(() => getCurrenciesForSymbol(symbol), [symbol]);

  const fetchNews = useCallback(async () => {
    if (!enabled || !symbol || fromTime == null || toTime == null) {
      setEvents([]);
      return;
    }

    setLoading(true);
    try {
      // Add generous margin (-3 days to +3 days) for smooth pan/zoom
      const marginSec = 86400 * 3;
      const start = Math.max(0, fromTime - marginSec);
      const end = toTime + marginSec;

      const data = await getEconomicNewsForRange(currencies, start, end, 'HIGH');
      setEvents(data);
    } catch (err) {
      console.error('[useEconomicNews] Failed to load news:', err);
    } finally {
      setLoading(false);
    }
  }, [enabled, symbol, currencies, fromTime, toTime]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return {
    events,
    currencies,
    loading,
    refetch: fetchNews,
  };
}
