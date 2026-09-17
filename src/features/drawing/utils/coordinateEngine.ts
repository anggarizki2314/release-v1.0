import type { IChartApi } from 'lightweight-charts';

/**
 * Mengonversi logical index ke posisi piksel X canvas.
 * Memproyeksikan piksel X secara presisi tanpa terpaku oleh clamping bawaan LWC:
 *   deltaLogical = logicalIndex - lastIndex
 *   X = lastValidX + (deltaLogical * barSpacing)
 */
export function getXFromLogical(
  chart: any,
  logicalIndex: number,
  totalCandles: number
): number {
  if (!chart) return 0;

  try {
    const timeScale = chart.timeScale();

    // 1. Proyeksi presisi berbasis Visible Logical Range (mempertahankan rasio zoom & pan aktif)
    const visibleRange = timeScale.getVisibleLogicalRange();
    if (visibleRange) {
      const leftX = timeScale.logicalToCoordinate(visibleRange.from as any);
      const rightX = timeScale.logicalToCoordinate(visibleRange.to as any);
      if (leftX !== null && rightX !== null && (rightX as number) !== (leftX as number)) {
        const currentBarSpacing = ((rightX as number) - (leftX as number)) / (visibleRange.to - visibleRange.from);
        if (currentBarSpacing > 0) {
          const deltaLogical = logicalIndex - visibleRange.to;
          return (rightX as number) + (deltaLogical * currentBarSpacing);
        }
      }
    }

    // 2. Fallback: Proyeksi berbasis indeks data terakhir (lastValidX)
    const lastDataIndex = totalCandles > 0 ? totalCandles - 1 : 0;
    const lastValidX = timeScale.logicalToCoordinate(lastDataIndex as any);
    const barSpacing = (timeScale.options?.() as any)?.barSpacing || 6;

    if (lastValidX !== null && lastValidX !== undefined) {
      const deltaLogical = logicalIndex - lastDataIndex;
      return (lastValidX as number) + (deltaLogical * barSpacing);
    }

    return logicalIndex * barSpacing;
  } catch {
    return 0;
  }
}

/**
 * Mengonversi koordinat mouseX ke Logical Index.
 */
export function getLogicalFromX(
  chart: any,
  mouseX: number,
  totalCandles: number
): number {
  if (!chart) return 0;

  try {
    const timeScale = chart.timeScale();

    // 1. Proyeksi presisi berbasis Visible Logical Range
    const visibleRange = timeScale.getVisibleLogicalRange();
    if (visibleRange) {
      const leftX = timeScale.logicalToCoordinate(visibleRange.from as any);
      const rightX = timeScale.logicalToCoordinate(visibleRange.to as any);
      if (leftX !== null && rightX !== null && (rightX as number) !== (leftX as number)) {
        const currentBarSpacing = ((rightX as number) - (leftX as number)) / (visibleRange.to - visibleRange.from);
        if (currentBarSpacing > 0) {
          const deltaPixel = mouseX - (rightX as number);
          return Math.round(visibleRange.to + (deltaPixel / currentBarSpacing));
        }
      }
    }

    // 2. Native LWC coordinateToLogical
    const logical = timeScale.coordinateToLogical(mouseX as any);
    if (logical !== null && logical !== undefined && !isNaN(logical as number)) {
      return logical as number;
    }

    // 3. Fallback: Proyeksi berbasis indeks data terakhir
    const lastDataIndex = totalCandles > 0 ? totalCandles - 1 : 0;
    const lastValidX = timeScale.logicalToCoordinate(lastDataIndex as any);
    const barSpacing = (timeScale.options?.() as any)?.barSpacing || 6;

    if (lastValidX !== null && lastValidX !== undefined) {
      const deltaPixel = mouseX - (lastValidX as number);
      return lastDataIndex + Math.round(deltaPixel / barSpacing);
    }

    return 0;
  } catch {
    return 0;
  }
}

/**
 * Safe Price Conversion: SELALU mengembalikan angka valid (tidak pernah null/NaN).
 */
export function priceFromY(
  chart: any,
  series: any,
  mouseY: number
): number {
  if (!series || !chart) return 0;

  try {
    // 1. Coba ambil dari series bawaan LWC
    const price = series.coordinateToPrice(mouseY);
    if (price !== null && price !== undefined && !isNaN(price)) return price;

    // 2. Fallback manual jika series.coordinateToPrice me-return null saat di area kosong
    const param = typeof series.priceScale === 'function' ? series.priceScale() : null;
    if (param && typeof param.coordinateToPrice === 'function') {
      const scalePrice = param.coordinateToPrice(mouseY);
      if (scalePrice !== null && scalePrice !== undefined && !isNaN(scalePrice)) return scalePrice;
    }

    return 0;
  } catch {
    return 0;
  }
}

export function mouseToLogical(
  chart: IChartApi,
  mouseX: number,
  totalCandles: number
): number {
  return getLogicalFromX(chart, mouseX, totalCandles);
}

export function logicalToPixel(
  chart: IChartApi,
  logical: number,
  totalCandles: number
): number {
  return getXFromLogical(chart, logical, totalCandles);
}

export function getUnboundedLogicalIndex(
  chart: IChartApi,
  mouseX: number,
  totalCandles: number
): number {
  return getLogicalFromX(chart, mouseX, totalCandles);
}

const getTimeSec = (t: number | string): number =>
  typeof t === 'number' ? t : Math.floor(new Date(t).getTime() / 1000);

/**
 * Mengonversi timestamp ke Logical Index secara presisi.
 * Mendukung cross-timeframe (misal drawing di M5 dibuka di M15) dan area masa depan tanpa distorsi akhir pekan.
 */
export function getLogicalFromTime(
  candles: Array<{ time: number | string }>,
  t: number
): number {
  const len = candles ? candles.length : 0;
  if (len === 0) return 0;
  if (len === 1) return 0;

  const firstTime = getTimeSec(candles[0].time);
  const lastTime = getTimeSec(candles[len - 1].time);

  // 1. Area masa depan (di kanan candle terakhir)
  if (t >= lastTime) {
    const prevTime = getTimeSec(candles[len - 2].time);
    const step = Math.max(lastTime - prevTime, 1);
    return (len - 1) + (t - lastTime) / step;
  }

  // 2. Area masa lalu (di kiri candle pertama)
  if (t <= firstTime) {
    const nextTime = getTimeSec(candles[1].time);
    const step = Math.max(nextTime - firstTime, 1);
    return (t - firstTime) / step;
  }

  // 3. Area historis (di antara candle pertama dan terakhir): Binary Search O(log N)
  let low = 0;
  let high = len - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const midTime = getTimeSec(candles[mid].time);
    if (midTime === t) {
      return mid;
    } else if (midTime < t) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // high adalah indeks candle terakhir dengan time <= t
  const i = Math.max(0, Math.min(len - 2, high));
  const t0 = getTimeSec(candles[i].time);
  const t1 = getTimeSec(candles[i + 1].time);
  const span = t1 - t0;
  if (span <= 0) return i;

  const fraction = (t - t0) / span;
  return i + fraction;
}

/**
 * Mengonversi Logical Index ke Timestamp secara presisi.
 */
export function getTimeFromLogical(
  candles: Array<{ time: number | string }>,
  logical: number
): number {
  const len = candles ? candles.length : 0;
  if (len === 0) return 0;
  if (len === 1) {
    return getTimeSec(candles[0].time);
  }

  const lastTime = getTimeSec(candles[len - 1].time);

  // 1. Masa depan
  if (logical >= len - 1) {
    const prevTime = getTimeSec(candles[len - 2].time);
    const step = Math.max(lastTime - prevTime, 1);
    return Math.round(lastTime + (logical - (len - 1)) * step);
  }

  // 2. Masa lalu
  if (logical <= 0) {
    const firstTime = getTimeSec(candles[0].time);
    const nextTime = getTimeSec(candles[1].time);
    const step = Math.max(nextTime - firstTime, 1);
    return Math.round(firstTime + logical * step);
  }

  // 3. Historis
  const i = Math.floor(logical);
  const fraction = logical - i;
  const t0 = getTimeSec(candles[i].time);
  const t1 = getTimeSec(candles[Math.min(len - 1, i + 1)].time);
  return Math.round(t0 + fraction * (t1 - t0));
}

/**
 * Safely and accurately projects any timestamp to pixel coordinate X on the chart canvas.
 * - Exact candle matches: native LWC timeToCoordinate.
 * - Cross-timeframe (e.g. M5 -> M3 / M15): linear interpolation between adjacent candle pixel coordinates.
 * - Off-screen / future / past: projected via visible candle anchor + barSpacing.
 * - Always returns a finite number (no NaN, no undefined).
 */
export function timeToCoordinateSafe(
  chart: any,
  t: number,
  candles?: Array<{ time: number | string }>
): number {
  if (!chart || !Number.isFinite(t) || t <= 0) return 0;

  const timeScale = chart.timeScale?.();
  if (!timeScale) return 0;

  // 1. Direct match with a candle in the series (fastest & most accurate when on-screen)
  try {
    const directX = timeScale.timeToCoordinate(t as any);
    if (directX !== null && directX !== undefined && Number.isFinite(directX as number)) {
      return directX as number;
    }
  } catch {}

  const len = candles ? candles.length : 0;
  if (len === 0) return 0;

  const firstTime = getTimeSec(candles![0].time);
  const lastTime = getTimeSec(candles![len - 1].time);

  // 2. Linear interpolation between two adjacent candles if both are on-screen
  if (t >= firstTime && t <= lastTime) {
    let low = 0;
    let high = len - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const mTime = getTimeSec(candles![mid].time);
      if (mTime === t) {
        try {
          const x = timeScale.timeToCoordinate(mTime as any) ?? timeScale.logicalToCoordinate(mid as any);
          if (x !== null && x !== undefined && Number.isFinite(x as number)) return x as number;
        } catch {}
        break;
      } else if (mTime < t) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const i = Math.max(0, Math.min(len - 2, high));
    const t0 = getTimeSec(candles![i].time);
    const t1 = getTimeSec(candles![i + 1].time);
    const span = t1 - t0;

    if (span > 0) {
      try {
        const x0 = timeScale.timeToCoordinate(t0 as any);
        const x1 = timeScale.timeToCoordinate(t1 as any);
        if (x0 !== null && x1 !== null && Number.isFinite(x0 as number) && Number.isFinite(x1 as number)) {
          const ratio = (t - t0) / span;
          return (x0 as number) + ratio * ((x1 as number) - (x0 as number));
        }
      } catch {}
    }
  }

  // 3. Robust Anchor + BarSpacing Projection (works off-screen, future, past, and across timeframes)
  let anchorIdx = Math.floor(len / 2);
  let anchorX: number | null = null;

  try {
    const visibleRange = timeScale.getVisibleLogicalRange();
    if (visibleRange) {
      const midVisible = Math.floor((visibleRange.from + visibleRange.to) / 2);
      anchorIdx = Math.max(0, Math.min(len - 1, midVisible));
    }
    anchorX = timeScale.timeToCoordinate(getTimeSec(candles![anchorIdx].time) as any) ?? timeScale.logicalToCoordinate(anchorIdx as any);
  } catch {}

  if (anchorX === null || !Number.isFinite(anchorX as number)) {
    try {
      anchorIdx = len - 1;
      anchorX = timeScale.timeToCoordinate(lastTime as any) ?? timeScale.logicalToCoordinate(anchorIdx as any);
    } catch {}
  }

  if (anchorX === null || !Number.isFinite(anchorX as number)) {
    try {
      anchorIdx = 0;
      anchorX = timeScale.timeToCoordinate(firstTime as any) ?? timeScale.logicalToCoordinate(0 as any);
    } catch {}
  }

  let barSpacing = 6;
  try {
    const bs = (timeScale.options?.() as any)?.barSpacing;
    if (typeof bs === 'number' && Number.isFinite(bs) && bs > 0) {
      barSpacing = bs;
    } else if (anchorIdx + 1 < len) {
      const nextX = timeScale.timeToCoordinate(getTimeSec(candles![anchorIdx + 1].time) as any) ?? timeScale.logicalToCoordinate((anchorIdx + 1) as any);
      if (nextX !== null && Number.isFinite(nextX as number) && (nextX as number) > (anchorX as number)) {
        barSpacing = (nextX as number) - (anchorX as number);
      }
    }
  } catch {}

  const L = getLogicalFromTime(candles!, t);

  if (anchorX !== null && Number.isFinite(anchorX as number)) {
    return (anchorX as number) + (L - anchorIdx) * barSpacing;
  }

  return L * barSpacing;
}

/**
 * Safely and accurately converts pixel coordinate X to timestamp.
 */
export function coordinateToTimeSafe(
  chart: any,
  x: number,
  candles?: Array<{ time: number | string }>
): number {
  if (!chart || !Number.isFinite(x)) return NaN;

  const timeScale = chart.timeScale?.();
  if (!timeScale) return NaN;

  const len = candles ? candles.length : 0;
  if (len === 0) return NaN;

  // 1. Native LWC time API (for on-screen historical candles)
  try {
    const t = timeScale.coordinateToTime(x as any);
    if (t !== null && t !== undefined && typeof t === 'number' && Number.isFinite(t) && t > 0) {
      return t;
    }
  } catch {}

  // 2. Find visible anchor candle
  let anchorIdx = Math.floor(len / 2);
  let anchorX: number | null = null;

  try {
    const visibleRange = timeScale.getVisibleLogicalRange();
    if (visibleRange) {
      const midVisible = Math.floor((visibleRange.from + visibleRange.to) / 2);
      anchorIdx = Math.max(0, Math.min(len - 1, midVisible));
    }
    anchorX = timeScale.timeToCoordinate(getTimeSec(candles![anchorIdx].time) as any) ?? timeScale.logicalToCoordinate(anchorIdx as any);
  } catch {}

  if (anchorX === null || !Number.isFinite(anchorX as number)) {
    try {
      anchorIdx = len - 1;
      anchorX = timeScale.timeToCoordinate(getTimeSec(candles![len - 1].time) as any) ?? timeScale.logicalToCoordinate(anchorIdx as any);
    } catch {}
  }

  let barSpacing = 6;
  try {
    const bs = (timeScale.options?.() as any)?.barSpacing;
    if (typeof bs === 'number' && Number.isFinite(bs) && bs > 0) {
      barSpacing = bs;
    }
  } catch {}

  let logical = anchorIdx;
  if (anchorX !== null && Number.isFinite(anchorX as number) && barSpacing > 0) {
    logical = anchorIdx + (x - (anchorX as number)) / barSpacing;
  } else {
    logical = x / Math.max(barSpacing, 1);
  }

  return getTimeFromLogical(candles!, logical);
}
