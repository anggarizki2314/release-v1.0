/**
 * Replay Engine V3 — Candle Validation Layer
 * Storage ➔ Validation Layer ➔ CandleRepository ➔ Replay Engine
 * Architecture Frozen v1.0
 */

import type { Candle } from '@/types';

export interface ValidationReport {
  readonly isValid: boolean;
  readonly originalCount: number;
  readonly validCount: number;
  readonly duplicateCount: number;
  readonly invalidCount: number;
  readonly errors: readonly string[];
}

export class CandleValidationLayer {
  /**
   * Sanitizes and validates a candle dataset:
   * 1. Filters invalid OHLC values (non-finite, <= 0, high < low)
   * 2. Sorts candles ascending by timestamp
   * 3. Deduplicates duplicate timestamps (keeps first occurrence)
   */
  public static validateAndSanitize(rawCandles: Candle[]): {
    sanitizedCandles: Candle[];
    report: ValidationReport;
  } {
    const errors: string[] = [];
    if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
      return {
        sanitizedCandles: [],
        report: {
          isValid: false,
          originalCount: rawCandles?.length ?? 0,
          validCount: 0,
          duplicateCount: 0,
          invalidCount: 0,
          errors: ['Empty or non-array candles provided'],
        },
      };
    }

    let invalidCount = 0;
    const validCandles: Candle[] = [];

    for (let i = 0; i < rawCandles.length; i++) {
      const c = rawCandles[i];
      if (!c || !Number.isFinite(c.time) || c.time <= 0) {
        invalidCount++;
        continue;
      }
      if (
        !Number.isFinite(c.open) || c.open <= 0 ||
        !Number.isFinite(c.high) || c.high <= 0 ||
        !Number.isFinite(c.low) || c.low <= 0 ||
        !Number.isFinite(c.close) || c.close <= 0 ||
        c.high < c.low ||
        c.high < c.open ||
        c.high < c.close ||
        c.low > c.open ||
        c.low > c.close
      ) {
        invalidCount++;
        continue;
      }

      validCandles.push(c);
    }

    // Sort ascending by time
    validCandles.sort((a, b) => a.time - b.time);

    // Deduplicate timestamps
    const sanitizedCandles: Candle[] = [];
    let duplicateCount = 0;
    let lastTime: number | null = null;

    for (const candle of validCandles) {
      if (lastTime !== null && candle.time === lastTime) {
        duplicateCount++;
        continue;
      }
      sanitizedCandles.push(candle);
      lastTime = candle.time;
    }

    if (sanitizedCandles.length === 0) {
      errors.push('Zero valid candles remained after validation sanitization');
    }

    return {
      sanitizedCandles,
      report: {
        isValid: sanitizedCandles.length > 0,
        originalCount: rawCandles.length,
        validCount: sanitizedCandles.length,
        duplicateCount,
        invalidCount,
        errors,
      },
    };
  }
}
