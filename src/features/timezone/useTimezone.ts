import { useCallback, useEffect, useState } from 'react';
import { getSetting, setSetting } from '@features/database';
import { DEFAULT_TIMEZONE, TIMEZONE_STORAGE_KEY, isValidTimezone } from './utils';

/**
 * Hook to manage the selected timezone preference.
 * Loads from persistence on mount, saves on change.
 */
export function useTimezone() {
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSetting(TIMEZONE_STORAGE_KEY).then((saved) => {
      if (cancelled) return;
      if (saved && isValidTimezone(saved)) {
        setTimezone(saved);
      }
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  const selectTimezone = useCallback((tz: string) => {
    if (isValidTimezone(tz)) {
      setTimezone(tz);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void setSetting(TIMEZONE_STORAGE_KEY, timezone);
  }, [loaded, timezone]);

  return { timezone, selectTimezone, loaded };
}
