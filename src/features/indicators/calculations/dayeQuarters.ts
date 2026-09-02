import type { Candle } from '@/types';

export interface DayeQuarterBlock {
  cycleType: 'yearly' | 'monthly' | 'weekly' | 'daily' | '90m' | 'micro';
  quarterIndex: 0 | 1 | 2 | 3; // 0=Q1, 1=Q2, 2=Q3, 3=Q4
  quarterName: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  label: string;
  startTime: number;
  endTime: number;
  color: string;
  phaseName: 'Accumulation' | 'Manipulation' | 'Distribution' | 'Reversal';
}

export const DAYE_COLORS = {
  q1: '#1b202e', // Charcoal / Slate (Accumulation)
  q2: '#381318', // Deep Maroon / Wine Red (Manipulation)
  q3: '#0e3325', // Forest Green / Emerald (Distribution)
  q4: '#131e38', // Deep Navy (Reversal)
  border: 'rgba(255, 255, 255, 0.18)',
};

/**
 * Calculates Daye Quarterly Theory Time Cycles:
 * 1. Yearly Quarters (Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec)
 * 2. Monthly Quarters (4 quarters per month)
 * 3. Weekly Quarters (4 quarters per trading week: 30h each)
 * 4. Daily Quarters (4 quarters per 24 hours: 6h each: Asia, London, NY, Close)
 * 5. 90-Minute Cycles (4 quarters per 6-hour session: 90m each)
 * 6. Micro Cycles (4 quarters per 90m cycle: 22.5m each)
 */
export function calculateDayeQuarters(
  candles: Candle[],
  options: {
    showYearly?: boolean;
    showMonthly?: boolean;
    showWeekly?: boolean;
    showDaily?: boolean;
    show90min?: boolean;
    showMicro?: boolean;
    historicalCycles?: boolean;
    q1Color?: string;
    q2Color?: string;
    q3Color?: string;
    q4Color?: string;
  },
  fromTime?: number | null,
  toTime?: number | null
): DayeQuarterBlock[] {
  if (!candles || candles.length === 0) return [];

  const datasetFirst = candles[0].time;
  const datasetLast = candles[candles.length - 1].time;

  const defaultStart = Math.max(datasetFirst, datasetLast - 86400 * 2);
  // Only calculate for visible range + minimal buffer (1 day) to maximize 60 FPS performance
  const firstTime = options.historicalCycles
    ? Math.max(datasetFirst, datasetLast - 86400 * 30) // cap historical to 30 days max
    : Math.max(datasetFirst, (fromTime ?? defaultStart) - 86400);
  const lastTime = options.historicalCycles
    ? datasetLast
    : Math.min(datasetLast, (toTime ?? datasetLast) + 86400);

  const blocks: DayeQuarterBlock[] = [];

  const SECONDS_MICRO = 22.5 * 60; // 1350s
  const SECONDS_90M = 90 * 60; // 5400s
  const SECONDS_6H = 6 * 3600; // 21600s
  const SECONDS_24H = 24 * 3600; // 86400s
  const SECONDS_30H = 30 * 3600; // 108000s

  const q1C = options.q1Color || DAYE_COLORS.q1;
  const q2C = options.q2Color || DAYE_COLORS.q2;
  const q3C = options.q3Color || DAYE_COLORS.q3;
  const q4C = options.q4Color || DAYE_COLORS.q4;

  const getColor = (qIdx: number) => (qIdx === 0 ? q1C : qIdx === 1 ? q2C : qIdx === 2 ? q3C : q4C);
  const getPhase = (qIdx: number): 'Accumulation' | 'Manipulation' | 'Distribution' | 'Reversal' =>
    qIdx === 0 ? 'Accumulation' : qIdx === 1 ? 'Manipulation' : qIdx === 2 ? 'Distribution' : 'Reversal';

  // ── 1. 90-Minute Cycles ──
  if (options.show90min !== false) {
    const baseStart = Math.floor(firstTime / SECONDS_6H) * SECONDS_6H;
    for (let t = baseStart; t <= lastTime; t += SECONDS_90M) {
      const qInSession = Math.floor((((t % SECONDS_6H) + SECONDS_6H) % SECONDS_6H) / SECONDS_90M) as 0 | 1 | 2 | 3;
      const qName = (`Q${qInSession + 1}` as 'Q1' | 'Q2' | 'Q3' | 'Q4');

      blocks.push({
        cycleType: '90m',
        quarterIndex: qInSession,
        quarterName: qName,
        label: `90m ${qName}`,
        startTime: t,
        endTime: t + SECONDS_90M,
        color: getColor(qInSession),
        phaseName: getPhase(qInSession),
      });
    }
  }

  // ── 2. Daily Quarters (6-Hour Sessions) ──
  if (options.showDaily !== false) {
    const baseStart = Math.floor(firstTime / SECONDS_24H) * SECONDS_24H;
    for (let t = baseStart; t <= lastTime; t += SECONDS_6H) {
      const qInDay = Math.floor((((t % SECONDS_24H) + SECONDS_24H) % SECONDS_24H) / SECONDS_6H) as 0 | 1 | 2 | 3;
      const qName = (`Q${qInDay + 1}` as 'Q1' | 'Q2' | 'Q3' | 'Q4');
      const dailyNames = ['Asia (Q1)', 'London (Q2)', 'New York (Q3)', 'Close (Q4)'];

      blocks.push({
        cycleType: 'daily',
        quarterIndex: qInDay,
        quarterName: qName,
        label: `Day ${dailyNames[qInDay]}`,
        startTime: t,
        endTime: t + SECONDS_6H,
        color: getColor(qInDay),
        phaseName: getPhase(qInDay),
      });
    }
  }

  // ── 3. Weekly Quarters (30-Hour Quarters) ──
  if (options.showWeekly !== false) {
    const startWeek = Math.floor((firstTime - 4 * SECONDS_24H) / (7 * SECONDS_24H)) * (7 * SECONDS_24H) + 4 * SECONDS_24H;
    for (let t = startWeek; t <= lastTime; t += SECONDS_30H) {
      const qInWeek = (Math.floor((t - startWeek) / SECONDS_30H) % 4) as 0 | 1 | 2 | 3;
      const qName = (`Q${qInWeek + 1}` as 'Q1' | 'Q2' | 'Q3' | 'Q4');

      blocks.push({
        cycleType: 'weekly',
        quarterIndex: qInWeek,
        quarterName: qName,
        label: `Week ${qName}`,
        startTime: t,
        endTime: t + SECONDS_30H,
        color: getColor(qInWeek),
        phaseName: getPhase(qInWeek),
      });
    }
  }

  // ── 4. Micro Cycles (22.5-Minute Quarters) ──
  if (options.showMicro) {
    const baseStart = Math.floor(firstTime / SECONDS_90M) * SECONDS_90M;
    for (let t = baseStart; t <= lastTime; t += SECONDS_MICRO) {
      const qIn90m = Math.floor((((t % SECONDS_90M) + SECONDS_90M) % SECONDS_90M) / SECONDS_MICRO) as 0 | 1 | 2 | 3;
      const qName = (`Q${qIn90m + 1}` as 'Q1' | 'Q2' | 'Q3' | 'Q4');

      blocks.push({
        cycleType: 'micro',
        quarterIndex: qIn90m,
        quarterName: qName,
        label: `Micro ${qName}`,
        startTime: t,
        endTime: t + SECONDS_MICRO,
        color: getColor(qIn90m),
        phaseName: getPhase(qIn90m),
      });
    }
  }

  // ── 5. Monthly Quarters (~7.5 days each) ──
  if (options.showMonthly) {
    const SECONDS_MONTH = 30 * SECONDS_24H;
    const SECONDS_MONTH_Q = 7.5 * SECONDS_24H;
    const baseStart = Math.floor(firstTime / SECONDS_MONTH) * SECONDS_MONTH;
    for (let t = baseStart; t <= lastTime; t += SECONDS_MONTH_Q) {
      const qInMonth = Math.floor((((t % SECONDS_MONTH) + SECONDS_MONTH) % SECONDS_MONTH) / SECONDS_MONTH_Q) as 0 | 1 | 2 | 3;
      const qName = (`Q${qInMonth + 1}` as 'Q1' | 'Q2' | 'Q3' | 'Q4');

      blocks.push({
        cycleType: 'monthly',
        quarterIndex: qInMonth,
        quarterName: qName,
        label: `Month ${qName}`,
        startTime: t,
        endTime: t + SECONDS_MONTH_Q,
        color: getColor(qInMonth),
        phaseName: getPhase(qInMonth),
      });
    }
  }

  // ── 6. Yearly Quarters (3 Months each) ──
  if (options.showYearly) {
    const SECONDS_YEAR = 365 * SECONDS_24H;
    const SECONDS_YEAR_Q = (365 / 4) * SECONDS_24H;
    const baseStart = Math.floor(firstTime / SECONDS_YEAR) * SECONDS_YEAR;
    for (let t = baseStart; t <= lastTime; t += SECONDS_YEAR_Q) {
      const qInYear = Math.floor((((t % SECONDS_YEAR) + SECONDS_YEAR) % SECONDS_YEAR) / SECONDS_YEAR_Q) as 0 | 1 | 2 | 3;
      const qName = (`Q${qInYear + 1}` as 'Q1' | 'Q2' | 'Q3' | 'Q4');

      blocks.push({
        cycleType: 'yearly',
        quarterIndex: qInYear,
        quarterName: qName,
        label: `Year ${qName}`,
        startTime: t,
        endTime: t + SECONDS_YEAR_Q,
        color: getColor(qInYear),
        phaseName: getPhase(qInYear),
      });
    }
  }

  return blocks;
}
