import { calculateBottomIndicatorsHeight } from '../useIndicatorStore';
import type { IndicatorConfig, QuartersIndicatorConfig, RsiIndicatorConfig } from '../types';

function computeScaleMargins(bottomPanesHeight: number, totalHeight: number) {
  const timeScaleHeight = 26;
  if (bottomPanesHeight <= 0 || totalHeight <= 0) {
    return { top: 0.08, bottom: 0.10 };
  }
  const usableHeight = Math.max(80, totalHeight - bottomPanesHeight - timeScaleHeight);
  const bottomOccupiedPx = bottomPanesHeight + timeScaleHeight + Math.round(usableHeight * 0.08);
  const bottomFraction = Math.min(0.85, Math.max(0.10, bottomOccupiedPx / totalHeight));
  return {
    top: 0.08,
    bottom: bottomFraction,
  };
}

console.log('--- RUNNING INDICATOR SCALE MARGINS & BOTTOM HEIGHT TEST SUITE ---');

let passed = 0;
let total = 0;

function assert(name: string, condition: boolean, details?: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`[PASS] Test ${total}: ${name}`);
  } else {
    console.error(`[FAIL] Test ${total}: ${name} -> ${details || ''}`);
  }
}

// 1. Zero indicators test
const emptyIndicators: IndicatorConfig[] = [];
const h0 = calculateBottomIndicatorsHeight(emptyIndicators, 88, 130);
assert('No bottom indicators yields 0px bottom height', h0 === 0);

const m0 = computeScaleMargins(h0, 600);
assert('No bottom indicators yields standard 10% bottom margin', m0.bottom === 0.10 && m0.top === 0.08);

// 2. Daye Quarters bottom_pane active
const dayeBottomConfig: QuartersIndicatorConfig = {
  id: 'daye-1',
  type: 'QUARTERS',
  name: 'Daye Quarters',
  enabled: true,
  color: '#38bdf8',
  plotType: 'bottom_pane',
  showWeeklyQuarters: true,
  showDailyQuarters: true,
  show90minCycles: true,
};

const hDaye = calculateBottomIndicatorsHeight([dayeBottomConfig], 88, 130);
assert('Daye Quarters bottom_pane produces 88px bottom height', hDaye === 88);

const mDaye = computeScaleMargins(hDaye, 600);
// Occupied px = 88 + 26 + 0.08 * (600 - 114) = 114 + 38.88 = ~153px => 153/600 ~ 0.255
assert(
  'Daye Quarters 88px reserves ~25.5% bottom scale margin preventing candle collision',
  mDaye.bottom >= 0.25 && mDaye.bottom <= 0.26
);

// 3. Daye Quarters overlay mode (should occupy 0px at bottom)
const dayeOverlayConfig: QuartersIndicatorConfig = {
  ...dayeBottomConfig,
  plotType: 'overlay',
};
const hOverlay = calculateBottomIndicatorsHeight([dayeOverlayConfig], 88, 130);
assert('Daye Quarters in overlay mode produces 0px bottom height', hOverlay === 0);

// 4. Single RSI active
const rsiConfig: RsiIndicatorConfig = {
  id: 'rsi-1',
  type: 'RSI',
  name: 'RSI 14',
  enabled: true,
  period: 14,
  source: 'close',
  overbought: 70,
  oversold: 30,
  middle: 50,
  color: '#a855f7',
};

const hRsi = calculateBottomIndicatorsHeight([rsiConfig], 88, 130);
assert('Single active RSI produces 130px bottom height', hRsi === 130);

const mRsi = computeScaleMargins(hRsi, 600);
// Occupied px = 130 + 26 + 0.08 * (600 - 156) = 156 + 35.52 = ~192px => 192/600 ~ 0.319
assert(
  'Single RSI 130px reserves ~32% bottom scale margin',
  mRsi.bottom >= 0.31 && mRsi.bottom <= 0.33
);

// 5. Both Daye Quarters + RSI active
const hBoth = calculateBottomIndicatorsHeight([dayeBottomConfig, rsiConfig], 88, 130);
assert('Daye Quarters (88px) + RSI (130px) produces 218px bottom height', hBoth === 218);

const mBoth = computeScaleMargins(hBoth, 600);
// Occupied px = 218 + 26 + 0.08 * (600 - 244) = 244 + 28.48 = ~272px => 272/600 ~ 0.454
assert(
  'Daye + RSI combined reserves ~45.4% bottom margin',
  mBoth.bottom >= 0.45 && mBoth.bottom <= 0.46
);

// 6. Two active RSIs + Daye Quarters
const rsiConfig2: RsiIndicatorConfig = {
  ...rsiConfig,
  id: 'rsi-2',
  name: 'RSI 7',
};
const hMulti = calculateBottomIndicatorsHeight([dayeBottomConfig, rsiConfig, rsiConfig2], 88, 130);
// 88 + 2 * 130 + 2 = 350
assert('Daye Quarters + 2x RSIs produces 350px bottom height', hMulti === 350);

// 7. Dynamic resize of Daye Quarters (e.g. user dragged height to 120px)
const hResized = calculateBottomIndicatorsHeight([dayeBottomConfig], 120, 130);
assert('Resizing Daye Quarters to 120px updates bottom height to 120px', hResized === 120);

// 8. Toggling indicator disabled removes its bottom height
const disabledDaye: QuartersIndicatorConfig = { ...dayeBottomConfig, enabled: false };
const hDisabled = calculateBottomIndicatorsHeight([disabledDaye], 88, 130);
assert('Disabling Daye Quarters immediately resets bottom height to 0px', hDisabled === 0);

console.log(`\nResult: ${passed}/${total} passed. Success: ${passed === total}`);
if (passed !== total) process.exit(1);
