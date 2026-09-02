import { getBucketStart } from '@/features/chart/candleResolver';

export interface ResampleWorkerPayload {
  readonly id: string;
  readonly candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>;
  readonly timeframe: string;
  readonly limitMaxCandles?: number;
  readonly anchorOffset?: number;
}

export interface ResampleWorkerResponse {
  readonly id: string;
  readonly timeframe: string;
  readonly resampled: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>;
}

function timeframeToSeconds(tf: string): number {
  const norm = String(tf).trim().toUpperCase();
  switch (norm) {
    case 'M1':
    case '1M':
    case '1':
      return 60;
    case 'M3':
    case '3M':
    case '3':
      return 180;
    case 'M5':
    case '5M':
    case '5':
      return 300;
    case 'M15':
    case '15M':
    case '15':
      return 900;
    case 'M30':
    case '30M':
    case '30':
      return 1800;
    case 'H1':
    case '1H':
    case '60':
      return 3600;
    case 'H4':
    case '4H':
    case '240':
      return 14400;
    case 'H7':
    case '7H':
    case '420':
      return 25200;
    case 'D1':
    case '1D':
    case 'D':
    case '1440':
      return 86400;
    case 'W1':
    case '1W':
    case 'W':
      return 604800;
    case 'MN1':
    case 'MN':
    case '1MN':
    case 'M1N':
    case 'MONTHLY':
      return 2592000;
    default: {
      const matchPrefix = norm.match(/^([MHDW])(\d+)$/);
      if (matchPrefix) {
        const unit = matchPrefix[1];
        const val = parseInt(matchPrefix[2], 10);
        if (unit === 'M') return val * 60;
        if (unit === 'H') return val * 3600;
        if (unit === 'D') return val * 86400;
        if (unit === 'W') return val * 604800;
      }
      const matchSuffix = norm.match(/^(\d+)([MHDW])$/);
      if (matchSuffix) {
        const val = parseInt(matchSuffix[1], 10);
        const unit = matchSuffix[2];
        if (unit === 'M') return val * 60;
        if (unit === 'H') return val * 3600;
        if (unit === 'D') return val * 86400;
        if (unit === 'W') return val * 604800;
      }
      return 60;
    }
  }
}

self.onmessage = (event: MessageEvent<ResampleWorkerPayload>) => {
  const { id, candles, timeframe, limitMaxCandles, anchorOffset = 0 } = event.data;
  if (!candles || candles.length === 0) {
    self.postMessage({ id, timeframe, resampled: [] } satisfies ResampleWorkerResponse);
    return;
  }

  const intervalSec = timeframeToSeconds(timeframe);

  if (intervalSec <= 60) {
    let result = candles;
    if (limitMaxCandles && result.length > limitMaxCandles) {
      result = result.slice(result.length - limitMaxCandles);
    }
    self.postMessage({ id, timeframe, resampled: result } satisfies ResampleWorkerResponse);
    return;
  }

  const resampled: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }> = [];
  let currentBucket: { time: number; open: number; high: number; low: number; close: number; volume?: number } | null = null;
  let bucketStartTime = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const bTime = getBucketStart(c.time, timeframe, anchorOffset);

    if (!currentBucket || bTime !== bucketStartTime) {
      if (currentBucket) {
        resampled.push(currentBucket);
      }
      bucketStartTime = bTime;
      currentBucket = {
        time: bTime,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume ?? 0,
      };
    } else {
      if (c.high > currentBucket.high) currentBucket.high = c.high;
      if (c.low < currentBucket.low) currentBucket.low = c.low;
      currentBucket.close = c.close;
      if (c.volume !== undefined) {
        currentBucket.volume = (currentBucket.volume ?? 0) + c.volume;
      }
    }
  }

  if (currentBucket) {
    resampled.push(currentBucket);
  }

  let finalResult = resampled;
  if (limitMaxCandles && finalResult.length > limitMaxCandles) {
    finalResult = finalResult.slice(finalResult.length - limitMaxCandles);
  }

  self.postMessage({ id, timeframe, resampled: finalResult } satisfies ResampleWorkerResponse);
};
