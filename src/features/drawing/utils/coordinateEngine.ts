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
