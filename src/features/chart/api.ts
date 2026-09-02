import type { Candle } from '@/types';

// Thin IPC wrapper — actual query + validation lives in
// electron/database/db.ts (getCandles/getCandlesBefore). `time` on
// every returned candle is already unix SECONDS (converted once, at
// CSV-import time — see csvParser.ts). Never divide it again here.
export async function getCandles(
  symbolId: number,
  timeframe: string,
  limit?: number
): Promise<Candle[]> {
  console.log('[DATA FORENSIC 2] Before window.forexReplay.getCandles IPC call:', { symbolId, timeframe, limit });
  try {
    const res = await window.forexReplay.getCandles(symbolId, timeframe, limit);
    console.log('[DATA FORENSIC 6] Promise resolved from window.forexReplay.getCandles:', {
      resultType: Array.isArray(res) ? 'Array' : typeof res,
      rowCount: Array.isArray(res) ? res.length : 0,
    });
    return res as Candle[];
  } catch (err) {
    console.error('[DATA FORENSIC 6] Promise rejected from window.forexReplay.getCandles:', err);
    throw err;
  }
}

/** Day 5: older candles than `beforeTime`, for backward pagination. */
export function getCandlesBefore(
  symbolId: number,
  timeframe: string,
  beforeTime: number,
  limit?: number
): Promise<Candle[]> {
  return window.forexReplay.getCandlesBefore(symbolId, timeframe, beforeTime, limit);
}

/** Candles starting from `fromTime` (inclusive) for replay session loading. */
export function getCandlesFrom(
  symbolId: number,
  timeframe: string,
  fromTime: number,
  limit?: number
): Promise<Candle[]> {
  return window.forexReplay.getCandlesFrom(symbolId, timeframe, fromTime, limit);
}

/** Candles in exact UTC timestamp range [fromTime, toTime] without arbitrary LIMIT cutoffs. */
export function getCandlesRange(
  symbolId: number,
  timeframe: string,
  fromTime: number,
  toTime?: number | null
): Promise<Candle[]> {
  return window.forexReplay.getCandlesRange(symbolId, timeframe, fromTime, toTime);
}


