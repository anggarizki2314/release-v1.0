import {
  switchSessionIndicators,
  loadSessionIndicators,
  saveSessionIndicators,
} from '../useIndicatorStore';
import type { EmaIndicatorConfig } from '../types';

// Mock localStorage for Node test environment
const store: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`[FAIL] ${msg}`);
    process.exit(1);
  }
  console.log(`[PASS] ${msg}`);
}

console.log('--- RUNNING INDICATOR SESSION ISOLATION TEST SUITE ---');

const sampleEma: EmaIndicatorConfig = {
  id: 'ema-1',
  type: 'EMA',
  name: 'EMA 20',
  enabled: true,
  color: '#3b82f6',
  period: 20,
  source: 'close',
  lineWidth: 2,
};

// 1. Session A created (new session -> clean slate)
switchSessionIndicators('session-A', true);
let indicatorsA = loadSessionIndicators('session-A');
assert(indicatorsA.length === 0, 'New session A starts with 0 indicators');

// 2. User adds EMA to Session A
saveSessionIndicators([sampleEma], 'session-A');
indicatorsA = loadSessionIndicators('session-A');
assert(indicatorsA.length === 1, 'Session A now has 1 indicator (EMA)');

// 3. User creates a brand new Session B (new session -> clean slate)
switchSessionIndicators('session-B', true);
let indicatorsB = loadSessionIndicators('session-B');
assert(indicatorsB.length === 0, 'New session B starts clean with 0 indicators (does not inherit Session A)');

// 4. User resumes Session A (existing session -> restores saved indicators)
switchSessionIndicators('session-A', false);
indicatorsA = loadSessionIndicators('session-A');
assert(indicatorsA.length === 1 && indicatorsA[0].id === 'ema-1', 'Resuming session A restores its 1 indicator');

// 5. User resumes Session B (existing session -> remains empty)
switchSessionIndicators('session-B', false);
indicatorsB = loadSessionIndicators('session-B');
assert(indicatorsB.length === 0, 'Resuming session B remains empty');

console.log('\nAll Indicator Session Isolation Tests Passed Successfully!');
