import { useCallback, useEffect, useRef, useState } from 'react';
import { TIMEFRAME_OPTIONS, type Timeframe } from '@/types';
import { getSetting, setSetting } from './api';

const LAST_SELECTION_KEY = 'chart:lastSelection';

export interface LastSelection {
  symbolName: string;
  timeframe: Timeframe;
}

const VALID_TIMEFRAMES = new Set<string>(TIMEFRAME_OPTIONS.map((o) => o.value));

function isTimeframe(value: unknown): value is Timeframe {
  return typeof value === 'string' && VALID_TIMEFRAMES.has(value);
}

/** Parses the persisted JSON blob defensively — a corrupted or
 * outdated value must never crash the app, just be treated as "no
 * saved selection yet". */
function parseLastSelection(raw: string | null): LastSelection | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LastSelection>;
    if (
      parsed &&
      typeof parsed.symbolName === 'string' &&
      parsed.symbolName.length > 0 &&
      isTimeframe(parsed.timeframe)
    ) {
      return { symbolName: parsed.symbolName, timeframe: parsed.timeframe };
    }
  } catch {
    // Ignore malformed JSON — treated as "nothing saved".
  }
  return null;
}

/**
 * Loads the last selected symbol+timeframe once on mount (bugfix,
 * day 4), and exposes `save()` so AppShell can persist it again
 * every time the user changes symbol or timeframe — not only on
 * app close, since the app can also be closed forcefully/crash.
 *
 * Symbol is identified by **name**, not id: ids are stable only
 * within one database lifetime, but a symbol re-imported after
 * being deleted would get a new id while keeping the same name, and
 * matching by name is exactly what "is this symbol still available"
 * needs at restore time.
 */
export function useLastSelection() {
  const [lastSelection, setLastSelection] = useState<LastSelection | null>(null);
  const [loading, setLoading] = useState(true);
  // Guards against writing back a stale "loading" value before the
  // initial read has completed.
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getSetting(LAST_SELECTION_KEY)
      .then((raw) => {
        if (cancelled) return;
        setLastSelection(parseLastSelection(raw));
      })
      .finally(() => {
        if (cancelled) return;
        loadedRef.current = true;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback((symbolName: string, timeframe: Timeframe) => {
    if (!loadedRef.current) return; // don't persist before initial load resolves
    void setSetting(LAST_SELECTION_KEY, JSON.stringify({ symbolName, timeframe }));
  }, []);

  return { lastSelection, loading, save };
}
