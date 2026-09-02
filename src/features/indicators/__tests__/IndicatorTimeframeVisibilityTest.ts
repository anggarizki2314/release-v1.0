import { calculateBottomIndicatorsHeight } from '../useIndicatorStore';
import { isIndicatorVisibleOnTimeframe } from '../types';
import type {
  EmaIndicatorConfig,
  RsiIndicatorConfig,
  SessionsIndicatorConfig,
  QuartersIndicatorConfig,
  IndicatorVisibility,
} from '../types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`[FAIL] ${msg}`);
    process.exit(1);
  }
  console.log(`[PASS] ${msg}`);
}

console.log('--- RUNNING INDICATOR TIMEFRAME VISIBILITY TEST SUITE ---');

// Test 1: Default visibility (all true) is visible on all timeframes
const defaultVis: IndicatorVisibility = {
  seconds: true,
  minutes: true,
  hours: true,
  days: true,
  weeks: true,
  months: true,
};

assert(isIndicatorVisibleOnTimeframe(defaultVis, 'M1') === true, 'Default visibility is true on M1');
assert(isIndicatorVisibleOnTimeframe(defaultVis, 'M15') === true, 'Default visibility is true on M15');
assert(isIndicatorVisibleOnTimeframe(defaultVis, 'H1') === true, 'Default visibility is true on H1');
assert(isIndicatorVisibleOnTimeframe(defaultVis, 'H4') === true, 'Default visibility is true on H4');
assert(isIndicatorVisibleOnTimeframe(defaultVis, 'D1') === true, 'Default visibility is true on D1');
assert(isIndicatorVisibleOnTimeframe(defaultVis, 'W1') === true, 'Default visibility is true on W1');
assert(isIndicatorVisibleOnTimeframe(defaultVis, 'Monthly') === true, 'Default visibility is true on Monthly');

// Test 2: Indicator visible only on Minutes (e.g. M1, M5, M15)
const minutesOnlyVis: IndicatorVisibility = {
  seconds: false,
  minutes: true,
  hours: false,
  days: false,
  weeks: false,
  months: false,
};

assert(isIndicatorVisibleOnTimeframe(minutesOnlyVis, 'M1') === true, 'Minutes-only indicator is visible on M1');
assert(isIndicatorVisibleOnTimeframe(minutesOnlyVis, 'M5') === true, 'Minutes-only indicator is visible on M5');
assert(isIndicatorVisibleOnTimeframe(minutesOnlyVis, 'M15') === true, 'Minutes-only indicator is visible on M15');
assert(isIndicatorVisibleOnTimeframe(minutesOnlyVis, 'H1') === false, 'Minutes-only indicator is hidden on H1');
assert(isIndicatorVisibleOnTimeframe(minutesOnlyVis, 'H4') === false, 'Minutes-only indicator is hidden on H4');
assert(isIndicatorVisibleOnTimeframe(minutesOnlyVis, 'D1') === false, 'Minutes-only indicator is hidden on D1');

// Test 3: Indicator visible only on Hours & Days (e.g. H1, H4, D1)
const higherTfVis: IndicatorVisibility = {
  seconds: false,
  minutes: false,
  hours: true,
  days: true,
  weeks: false,
  months: false,
};

assert(isIndicatorVisibleOnTimeframe(higherTfVis, 'M15') === false, 'Higher-TF indicator is hidden on M15');
assert(isIndicatorVisibleOnTimeframe(higherTfVis, 'H1') === true, 'Higher-TF indicator is visible on H1');
assert(isIndicatorVisibleOnTimeframe(higherTfVis, 'H4') === true, 'Higher-TF indicator is visible on H4');
assert(isIndicatorVisibleOnTimeframe(higherTfVis, 'D1') === true, 'Higher-TF indicator is visible on D1');
assert(isIndicatorVisibleOnTimeframe(higherTfVis, 'W1') === false, 'Higher-TF indicator is hidden on W1');

// Test 4: Dynamic Bottom Indicators Height with Timeframe Visibility
const rsiOnMinutesOnly: RsiIndicatorConfig = {
  id: 'rsi-1',
  type: 'RSI',
  name: 'RSI 14',
  enabled: true,
  color: '#a855f7',
  period: 14,
  source: 'close',
  overbought: 70,
  oversold: 30,
  middle: 50,
  visibility: minutesOnlyVis,
};

const dayeOnHoursOnly: QuartersIndicatorConfig = {
  id: 'daye-1',
  type: 'QUARTERS',
  name: 'Daye Quarters',
  enabled: true,
  color: '#38bdf8',
  plotType: 'bottom_pane',
  showWeeklyQuarters: true,
  showDailyQuarters: true,
  show90minCycles: true,
  visibility: higherTfVis,
};

// On M15: RSI is visible (130px), Daye is hidden (0px) -> Total 130px
const hOnM15 = calculateBottomIndicatorsHeight([rsiOnMinutesOnly, dayeOnHoursOnly], 88, 130, 'M15');
assert(hOnM15 === 130, `Bottom height on M15 is 130px (got ${hOnM15})`);

// On H1: RSI is hidden (0px), Daye is visible (88px) -> Total 88px
const hOnH1 = calculateBottomIndicatorsHeight([rsiOnMinutesOnly, dayeOnHoursOnly], 88, 130, 'H1');
assert(hOnH1 === 88, `Bottom height on H1 is 88px (got ${hOnH1})`);

// On W1: Both RSI and Daye are hidden -> Total 0px
const hOnW1 = calculateBottomIndicatorsHeight([rsiOnMinutesOnly, dayeOnHoursOnly], 88, 130, 'W1');
assert(hOnW1 === 0, `Bottom height on W1 is 0px (got ${hOnW1})`);

console.log('\nAll Timeframe Visibility Tests Passed Successfully!');
