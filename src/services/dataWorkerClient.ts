/**
 * Client interface for communicating with dataWorker Web Worker.
 */

import type { Candle, Timeframe } from '@/types';
import { resampleCandles as syncResampleCandles } from '@/utils/dataResampler';
import type { ResampleWorkerPayload, ResampleWorkerResponse } from '@/workers/dataWorker';

let workerInstance: Worker | null = null;
const pendingRequests = new Map<string, (resampled: Candle[]) => void>();

function getWorker(): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  if (!workerInstance) {
    try {
      workerInstance = new Worker(new URL('../workers/dataWorker.ts', import.meta.url), { type: 'module' });
      workerInstance.onmessage = (e: MessageEvent<ResampleWorkerResponse>) => {
        const { id, resampled } = e.data;
        const resolve = pendingRequests.get(id);
        if (resolve) {
          pendingRequests.delete(id);
          resolve(resampled as Candle[]);
        }
      };
    } catch {
      workerInstance = null;
    }
  }
  return workerInstance;
}

/**
 * Async Web Worker Resampler with synchronous fallback.
 */
export async function resampleCandlesWorker(
  candles: Candle[],
  timeframe: string | Timeframe,
  limitMaxCandles?: number,
  anchorOffset: number = 0
): Promise<Candle[]> {
  const worker = getWorker();
  if (!worker || candles.length === 0) {
    return syncResampleCandles(candles, timeframe, anchorOffset, limitMaxCandles);
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const payload: ResampleWorkerPayload = {
    id,
    candles,
    timeframe: String(timeframe),
    limitMaxCandles,
    anchorOffset,
  };

  return new Promise((resolve) => {
    pendingRequests.set(id, resolve);
    worker.postMessage(payload);
  });
}
