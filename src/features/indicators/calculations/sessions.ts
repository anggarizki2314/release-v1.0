import type { Candle } from '@/types';
import type { SessionItemConfig } from '../types';

export interface SessionBox {
  sessionId: string;
  sessionName: string;
  startTime: number;
  endTime: number;
  highPrice: number;
  lowPrice: number;
  bgColor: string;
  fillEnabled: boolean;
  opacity: number;
  showHighLow: boolean;
  highLowColor: string;
  borderOpacity: number;
}

/**
 * Binary search to find the index of the first candle with time >= timestamp.
 */
function findFirstCandleAtOrAfter(candles: Candle[], timestamp: number): number {
  let low = 0;
  let high = candles.length - 1;
  let result = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (candles[mid].time >= timestamp) {
      result = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return result;
}

/**
 * Calculates trading session time boundaries and session high/lows for visible candles.
 */
export function calculateTradingSessions(
  candles: Candle[],
  sessionsConfig: SessionItemConfig[],
  fromTime?: number | null,
  toTime?: number | null
): SessionBox[] {
  if (!candles || candles.length === 0 || !sessionsConfig || sessionsConfig.length === 0) {
    return [];
  }

  const enabledConfigs = sessionsConfig.filter((s) => s.enabled);
  if (enabledConfigs.length === 0) return [];

  const datasetFirst = candles[0].time;
  const datasetLast = candles[candles.length - 1].time;

  // Viewport Culling: only loop across visible days + 2 days buffer (default to last 7 days if fromTime is null)
  const defaultStart = Math.max(datasetFirst, datasetLast - 86400 * 7);
  const firstTime = Math.max(datasetFirst, (fromTime ?? defaultStart) - 86400 * 2);
  const lastTime = Math.min(datasetLast, (toTime ?? datasetLast) + 86400 * 2);

  // Day boundaries in UTC
  const startDate = new Date(firstTime * 1000);
  startDate.setUTCHours(0, 0, 0, 0);

  const endDate = new Date(lastTime * 1000);
  endDate.setUTCHours(23, 59, 59, 999);

  const boxes: SessionBox[] = [];

  // Iterate only visible days in the dataset range
  const currentDay = new Date(startDate);
  while (currentDay <= endDate) {
    const y = currentDay.getUTCFullYear();
    const m = currentDay.getUTCMonth();
    const d = currentDay.getUTCDate();

    for (const conf of enabledConfigs) {
      const [startH, startM] = conf.startUtc.split(':').map(Number);
      const [endH, endM] = conf.endUtc.split(':').map(Number);

      const sessionStartUtc = Math.floor(Date.UTC(y, m, d, startH || 0, startM || 0, 0) / 1000);
      let sessionEndUtc = Math.floor(Date.UTC(y, m, d, endH || 0, endM || 0, 0) / 1000);

      // Handle overnight session crossover (e.g. 22:00 to 07:00)
      if (sessionEndUtc <= sessionStartUtc) {
        sessionEndUtc += 86400;
      }

      // Check if session intersects visible range
      if (sessionEndUtc < firstTime || sessionStartUtc > lastTime) {
        continue;
      }

      // Find candles within this session to calculate high and low using binary search + early break
      let high = -Infinity;
      let low = Infinity;
      let count = 0;
      let firstCandleTime: number | null = null;
      let lastCandleTime: number | null = null;

      const startIdx = findFirstCandleAtOrAfter(candles, sessionStartUtc);
      if (startIdx !== -1) {
        for (let i = startIdx; i < candles.length; i++) {
          const c = candles[i];
          if (c.time >= sessionEndUtc) break;
          if (firstCandleTime === null) firstCandleTime = c.time;
          lastCandleTime = c.time;
          if (c.high > high) high = c.high;
          if (c.low < low) low = c.low;
          count++;
        }
      }

      if (count > 0 && high > -Infinity && low < Infinity && firstCandleTime !== null && lastCandleTime !== null) {
        boxes.push({
          sessionId: `${conf.id}-${firstCandleTime}`,
          sessionName: conf.name,
          startTime: firstCandleTime,
          endTime: lastCandleTime,
          highPrice: high,
          lowPrice: low,
          bgColor: conf.bgColor,
          fillEnabled: conf.fillEnabled !== false,
          opacity: conf.opacity !== undefined ? conf.opacity : 0.15,
          showHighLow: conf.showHighLow,
          highLowColor: conf.highLowColor,
          borderOpacity: conf.borderOpacity !== undefined ? conf.borderOpacity : 0.85,
        });
      }
    }

    currentDay.setUTCDate(currentDay.getUTCDate() + 1);
  }

  return boxes;
}
