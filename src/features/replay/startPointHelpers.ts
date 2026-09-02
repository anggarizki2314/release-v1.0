import type { Candle } from '@/types';

/**
 * Helper untuk convert date string atau timestamp menjadi replay start point.
 * Digunakan ketika user memilih tanggal/waktu untuk mulai replay.
 */

/**
 * Parse date input dan cari index terdekat dalam candles.
 *
 * @param dateInput bisa format: "2023-01-15" atau "2023-01-15 09:30" atau unix seconds
 * @param allCandles sorted by time ASC
 * @returns index dalam array, atau null jika invalid
 */
export function parseAndFindStartPoint(
  dateInput: string | number,
  allCandles: Candle[]
): number | null {
  if (allCandles.length === 0) return null;

  let targetTime: number | null;

  if (typeof dateInput === 'number') {
    targetTime = dateInput;
  } else {
    targetTime = parseDateStringToUnixSeconds(dateInput);
    if (targetTime === null) return null;
  }

  return findNearestCandleIndexByTime(allCandles, targetTime);
}

/**
 * Parse date string ke unix seconds.
 * Support formats:
 * - "2023-01-15" (00:00 UTC)
 * - "2023-01-15 09:30" (09:30 UTC)
 * - "2023-01-15T09:30:00Z" (ISO format)
 */
function parseDateStringToUnixSeconds(dateStr: string): number | null {
  try {
    // Remove timezone indicator if present
    const normalized = dateStr.replace('Z', '').trim();

    const date = new Date(normalized + (normalized.includes('T') ? 'Z' : ' UTC'));
    if (isNaN(date.getTime())) return null;

    return Math.floor(date.getTime() / 1000);
  } catch {
    return null;
  }
}

/**
 * Find nearest candle index by timestamp (using binary search).
 */
function findNearestCandleIndexByTime(allCandles: Candle[], targetTime: number): number {
  if (allCandles.length === 0) {
    throw new Error('Cannot find nearest candle in empty array');
  }

  // Edge cases
  if (targetTime <= allCandles[0].time) {
    return 0;
  }

  if (targetTime >= allCandles[allCandles.length - 1].time) {
    return allCandles.length - 1;
  }

  // Binary search
  let left = 0;
  let right = allCandles.length - 1;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (allCandles[mid].time < targetTime) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  // Compare dengan previous candle untuk find nearest
  if (left > 0 && Math.abs(allCandles[left - 1].time - targetTime) < Math.abs(allCandles[left].time - targetTime)) {
    return left - 1;
  }

  return left;
}

/**
 * Convert unix seconds ke readable date string.
 */
export function unixSecondsToDateString(seconds: number, includeTime: boolean = true): string {
  const date = new Date(seconds * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  if (!includeTime) {
    return `${year}-${month}-${day}`;
  }

  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Get list of significant dates dalam dataset untuk quick select.
 * Misalnya: setiap hari, setiap minggu, setiap bulan tergantung dataset size.
 */
export interface SignificantDate {
  label: string;
  unixSeconds: number;
  candleIndex: number;
}

export function getSignificantDates(allCandles: Candle[], maxPoints: number = 10): SignificantDate[] {
  if (allCandles.length === 0) return [];

  const firstTime = allCandles[0].time;
  const lastTime = allCandles[allCandles.length - 1].time;
  const duration = lastTime - firstTime;

  // Tentukan interval: coba setiap hari, minggu, atau bulan tergantung duration
  let interval: number;
  let dateFormat: (time: number) => string;

  if (duration < 7 * 86400) {
    // Less than 1 week: show hourly
    interval = 3600; // 1 hour
    dateFormat = (t) => unixSecondsToDateString(t, true);
  } else if (duration < 90 * 86400) {
    // Less than 3 months: show daily
    interval = 86400; // 1 day
    dateFormat = (t) => unixSecondsToDateString(t, false);
  } else {
    // More: show weekly or monthly
    interval = 7 * 86400; // 1 week
    dateFormat = (t) => unixSecondsToDateString(t, false);
  }

  const result: SignificantDate[] = [];
  let currentTime = Math.ceil(firstTime / interval) * interval;

  while (currentTime <= lastTime && result.length < maxPoints) {
    const candleIndex = findNearestCandleIndexByTime(allCandles, currentTime);
    const actualTime = allCandles[candleIndex].time;

    // Avoid duplicates
    if (result.length === 0 || result[result.length - 1].unixSeconds !== actualTime) {
      result.push({
        label: dateFormat(actualTime),
        unixSeconds: actualTime,
        candleIndex,
      });
    }

    currentTime += interval;
  }

  return result;
}
