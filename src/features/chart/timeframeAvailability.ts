import { TIMEFRAME_OPTIONS, type SymbolInfo, type Timeframe } from '@/types';

// Renderer-side mirror of electron/data/aggregate.ts's timeframe
// ordering — duplicated rather than shared across the process
// boundary (same reasoning as csvParser.ts's types not being shared
// with the renderer since Day 2: main and renderer are separate
// TypeScript compilation roots). Only the ORDERING matters here, not
// the exact second counts, so this stays a short, easy-to-eyeball list
// instead of importing electron code into the renderer bundle.
const TF_ORDER: Timeframe[] = TIMEFRAME_OPTIONS.map((o) => o.value);

/**
 * True if `timeframe` can actually be displayed for `symbol` — either
 * because it was imported natively, or (day 6) because a finer native
 * timeframe exists that can be aggregated up to it. Mirrors
 * electron/database/db.ts's resolveSourceTimeframe() logic: a
 * timeframe is only displayable if some native timeframe at or finer
 * than it exists — you can't manufacture finer resolution than what
 * was actually imported.
 */
export function canDisplayTimeframe(symbol: SymbolInfo | null, timeframe: Timeframe): boolean {
  if (!symbol) return false;
  if (symbol.timeframes.includes(timeframe)) return true;

  const targetIdx = TF_ORDER.indexOf(timeframe);
  if (targetIdx === -1) return false;

  return symbol.timeframes.some((tf) => {
    const idx = TF_ORDER.indexOf(tf);
    return idx !== -1 && idx < targetIdx;
  });
}
