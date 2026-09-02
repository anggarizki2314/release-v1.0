import { useState, useEffect, useCallback } from 'react';
import type { IndicatorConfig, IndicatorType } from './types';
import { isIndicatorVisibleOnTimeframe } from './types';
import { INDICATOR_CATALOG } from './indicatorCatalog';

let currentSessionId: string | null = null;

function getIndicatorStorageKey(sessionId?: string | null): string {
  if (!sessionId) return 'tradepro_active_indicators_global';
  return `tradepro_indicators_session_${sessionId}`;
}

function getDayeHeightStorageKey(sessionId?: string | null): string {
  if (!sessionId) return 'tradepro_daye_quarters_height_global';
  return `tradepro_daye_quarters_height_session_${sessionId}`;
}

function getRsiHeightStorageKey(sessionId?: string | null): string {
  if (!sessionId) return 'tradepro_rsi_pane_height_global';
  return `tradepro_rsi_pane_height_session_${sessionId}`;
}

export function loadSessionIndicators(sessionId?: string | null): IndicatorConfig[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(getIndicatorStorageKey(sessionId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const ind of parsed) {
            if (ind.type === 'SESSION_OPENS' && Array.isArray(ind.opens)) {
              for (const op of ind.opens) {
                if (op.id === 'forex_daily_open' && (op.name.includes('Forex') || op.name.includes('5 PM'))) {
                  op.name = 'Daily Open';
                }
              }
            }
          }
          return parsed;
        }
      }
    }
  } catch (err) {
    console.error('Failed to parse saved indicators:', err);
  }
  return [];
}

export function saveSessionIndicators(indicators: IndicatorConfig[], sessionId?: string | null) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(getIndicatorStorageKey(sessionId), JSON.stringify(indicators));
    }
  } catch {}
}

export function loadSessionDayeHeight(sessionId?: string | null): number {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(getDayeHeightStorageKey(sessionId));
      const parsed = saved ? parseInt(saved, 10) : 88;
      return isNaN(parsed) ? 88 : Math.min(350, Math.max(55, parsed));
    }
  } catch {}
  return 88;
}

export function loadSessionRsiHeight(sessionId?: string | null): number {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(getRsiHeightStorageKey(sessionId));
      const parsed = saved ? parseInt(saved, 10) : 130;
      return isNaN(parsed) ? 130 : Math.min(500, Math.max(70, parsed));
    }
  } catch {}
  return 130;
}

export function switchSessionIndicators(sessionId: string | null, isNew: boolean) {
  currentSessionId = sessionId;
  if (isNew) {
    globalIndicators = [];
    globalDayeHeight = 88;
    globalRsiHeight = 130;
    saveSessionIndicators([], sessionId);
  } else {
    globalIndicators = loadSessionIndicators(sessionId);
    globalDayeHeight = loadSessionDayeHeight(sessionId);
    globalRsiHeight = loadSessionRsiHeight(sessionId);
  }
  for (const listener of listeners) {
    listener();
  }
}

let globalIndicators: IndicatorConfig[] = loadSessionIndicators(null);
let globalDayeHeight: number = loadSessionDayeHeight(null);
let globalRsiHeight: number = loadSessionRsiHeight(null);
const listeners = new Set<() => void>();

function notify() {
  saveSessionIndicators(globalIndicators, currentSessionId);
  for (const listener of listeners) {
    listener();
  }
}

export function calculateBottomIndicatorsHeight(
  indicators: IndicatorConfig[],
  dayeHeight: number,
  rsiHeight: number,
  timeframe?: string
): number {
  const hasDaye = indicators.some(
    (i) =>
      i.type === 'QUARTERS' &&
      i.enabled &&
      (i as any).plotType !== 'overlay' &&
      isIndicatorVisibleOnTimeframe(i.visibility, timeframe)
  );
  const activeRsis = indicators.filter(
    (i) =>
      i.type === 'RSI' &&
      i.enabled &&
      isIndicatorVisibleOnTimeframe(i.visibility, timeframe)
  );
  const dayePart = hasDaye ? dayeHeight : 0;
  const rsiPart = activeRsis.length * rsiHeight + (activeRsis.length > 1 ? (activeRsis.length - 1) * 2 : 0);
  return dayePart + rsiPart;
}

export function useIndicatorStore() {
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(globalIndicators);
  const [dayeQuartersHeight, setLocalDayeHeight] = useState<number>(globalDayeHeight);
  const [rsiHeight, setLocalRsiHeight] = useState<number>(globalRsiHeight);

  useEffect(() => {
    const listener = () => {
      setIndicators([...globalIndicators]);
      setLocalDayeHeight(globalDayeHeight);
      setLocalRsiHeight(globalRsiHeight);
    };
    listeners.add(listener);
    // Initial sync
    setIndicators([...globalIndicators]);
    setLocalDayeHeight(globalDayeHeight);
    setLocalRsiHeight(globalRsiHeight);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const addIndicator = useCallback((type: IndicatorType, customPeriod?: number) => {
    const item = INDICATOR_CATALOG.find((c) => c.type === type);
    if (!item) return;

    let newConf: IndicatorConfig = JSON.parse(JSON.stringify(item.defaultConfig));
    const uniqueId = `${type.toLowerCase()}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    newConf.id = uniqueId;

    if (type === 'EMA') {
      if (customPeriod) {
        (newConf as any).period = customPeriod;
        (newConf as any).name = `EMA ${customPeriod}`;
        if (customPeriod === 9) newConf.color = '#8b5cf6';
        if (customPeriod === 20) newConf.color = '#3b82f6';
        if (customPeriod === 50) newConf.color = '#f59e0b';
        if (customPeriod === 100) newConf.color = '#10b981';
        if (customPeriod === 200) newConf.color = '#ef4444';
        if ((newConf as any).emas?.[0]) {
          (newConf as any).emas[0].period = customPeriod;
          (newConf as any).emas[0].color = newConf.color;
        }
      }
    }

    if (type === 'RSI' && customPeriod) {
      (newConf as any).period = customPeriod;
      (newConf as any).name = `RSI ${customPeriod}`;
      if (customPeriod === 7) newConf.color = '#ec4899'; // Pink
      if (customPeriod === 14) newConf.color = '#a855f7'; // Purple
      if (customPeriod === 21) newConf.color = '#6366f1'; // Indigo
      if (customPeriod === 28) newConf.color = '#3b82f6'; // Blue
    }

    globalIndicators = [...globalIndicators, newConf];
    notify();
  }, []);

  const removeIndicator = useCallback((id: string) => {
    globalIndicators = globalIndicators.filter((i) => i.id !== id);
    notify();
  }, []);

  const toggleIndicator = useCallback((id: string) => {
    globalIndicators = globalIndicators.map((i) =>
      i.id === id ? { ...i, enabled: !i.enabled } : i
    );
    notify();
  }, []);

  const updateIndicator = useCallback((id: string, updates: Partial<IndicatorConfig>) => {
    globalIndicators = globalIndicators.map((i) =>
      i.id === id ? ({ ...i, ...updates } as IndicatorConfig) : i
    );
    notify();
  }, []);

  const setDayeQuartersHeight = useCallback((height: number) => {
    const clamped = Math.min(350, Math.max(55, height));
    globalDayeHeight = clamped;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(getDayeHeightStorageKey(currentSessionId), String(clamped));
      }
    } catch {}
    notify();
  }, []);

  const setRsiHeight = useCallback((height: number) => {
    const clamped = Math.min(500, Math.max(70, height));
    globalRsiHeight = clamped;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(getRsiHeightStorageKey(currentSessionId), String(clamped));
      }
    } catch {}
    notify();
  }, []);

  const bottomIndicatorsHeight = calculateBottomIndicatorsHeight(
    indicators,
    dayeQuartersHeight,
    rsiHeight
  );

  return {
    indicators,
    dayeQuartersHeight,
    setDayeQuartersHeight,
    rsiHeight,
    setRsiHeight,
    bottomIndicatorsHeight,
    addIndicator,
    removeIndicator,
    toggleIndicator,
    updateIndicator,
  };
}
