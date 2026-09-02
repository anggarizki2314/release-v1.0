import { useCallback, useEffect, useState } from 'react';
import type { DatabaseStats, DatabaseInfo, DatabaseHealth } from '@/types';
import { getDbStats, getDbInfo, getDbHealth, vacuumDb, analyzeDb } from './api';

export interface UseDatabaseInfoResult {
  stats: DatabaseStats | null;
  info: DatabaseInfo | null;
  health: DatabaseHealth | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  runVacuum: () => Promise<boolean>;
  runAnalyze: () => Promise<boolean>;
}

export function useDatabaseInfo(): UseDatabaseInfoResult {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [info, setInfo] = useState<DatabaseInfo | null>(null);
  const [health, setHealth] = useState<DatabaseHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, i, h] = await Promise.all([getDbStats(), getDbInfo(), getDbHealth()]);
      setStats(s);
      setInfo(i);
      setHealth(h);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runVacuum = useCallback(async () => {
    const ok = await vacuumDb();
    if (ok) await refresh();
    return ok;
  }, [refresh]);

  const runAnalyze = useCallback(async () => {
    const ok = await analyzeDb();
    if (ok) await refresh();
    return ok;
  }, [refresh]);

  return { stats, info, health, loading, refreshing, refresh, runVacuum, runAnalyze };
}
