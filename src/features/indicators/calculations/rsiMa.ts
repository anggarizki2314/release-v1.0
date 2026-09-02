import type { RsiPoint } from './rsi';

export interface RsiMaPoint {
  time: number;
  value: number;
  upperBb?: number;
  lowerBb?: number;
}

/**
 * Calculates Smoothing Moving Average on RSI series (SMA, EMA, RMA/SMMA, WMA)
 * and optional Bollinger Bands on RSI (using bbStdDev).
 */
export function calculateRsiMa(
  rsiPoints: RsiPoint[],
  maType: 'SMA' | 'EMA' | 'RMA' | 'WMA' | 'None' = 'SMA',
  maLength: number = 14,
  bbStdDev: number = 2
): RsiMaPoint[] {
  if (!rsiPoints || rsiPoints.length < maLength || maLength < 1 || maType === 'None') {
    return [];
  }

  const result: RsiMaPoint[] = [];

  if (maType === 'SMA') {
    let sum = 0;
    for (let i = 0; i < rsiPoints.length; i++) {
      sum += rsiPoints[i].value;
      if (i >= maLength) {
        sum -= rsiPoints[i - maLength].value;
      }
      if (i >= maLength - 1) {
        const maVal = sum / maLength;
        let upperBb: number | undefined;
        let lowerBb: number | undefined;

        if (bbStdDev > 0) {
          let varSum = 0;
          for (let j = i - maLength + 1; j <= i; j++) {
            const diff = rsiPoints[j].value - maVal;
            varSum += diff * diff;
          }
          const stdDev = Math.sqrt(varSum / maLength);
          upperBb = Math.min(100, maVal + bbStdDev * stdDev);
          lowerBb = Math.max(0, maVal - bbStdDev * stdDev);
        }

        result.push({
          time: rsiPoints[i].time,
          value: Number(maVal.toFixed(2)),
          upperBb: upperBb !== undefined ? Number(upperBb.toFixed(2)) : undefined,
          lowerBb: lowerBb !== undefined ? Number(lowerBb.toFixed(2)) : undefined,
        });
      }
    }
  } else if (maType === 'EMA') {
    const k = 2 / (maLength + 1);
    let ema = 0;

    // Initial SMA for first EMA seed
    for (let i = 0; i < maLength; i++) {
      ema += rsiPoints[i].value;
    }
    ema /= maLength;
    result.push({ time: rsiPoints[maLength - 1].time, value: Number(ema.toFixed(2)) });

    for (let i = maLength; i < rsiPoints.length; i++) {
      ema = rsiPoints[i].value * k + ema * (1 - k);
      result.push({ time: rsiPoints[i].time, value: Number(ema.toFixed(2)) });
    }
  } else if (maType === 'RMA') {
    // Wilder's Smoothed Moving Average (RMA)
    const alpha = 1 / maLength;
    let rma = 0;

    for (let i = 0; i < maLength; i++) {
      rma += rsiPoints[i].value;
    }
    rma /= maLength;
    result.push({ time: rsiPoints[maLength - 1].time, value: Number(rma.toFixed(2)) });

    for (let i = maLength; i < rsiPoints.length; i++) {
      rma = alpha * rsiPoints[i].value + (1 - alpha) * rma;
      result.push({ time: rsiPoints[i].time, value: Number(rma.toFixed(2)) });
    }
  } else if (maType === 'WMA') {
    // Weighted Moving Average
    const weightSum = (maLength * (maLength + 1)) / 2;
    for (let i = maLength - 1; i < rsiPoints.length; i++) {
      let wSum = 0;
      for (let j = 0; j < maLength; j++) {
        wSum += rsiPoints[i - maLength + 1 + j].value * (j + 1);
      }
      const wma = wSum / weightSum;
      result.push({ time: rsiPoints[i].time, value: Number(wma.toFixed(2)) });
    }
  }

  return result;
}
