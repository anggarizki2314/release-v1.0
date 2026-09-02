/**
 * Phase 9A Test Runner Script
 */
import { runPhase9ATests } from './Phase9AStartDatePrefetchTest';

console.log('=== RUNNING PHASE 9A START-DATE PREFETCH & LAZY LOADING TEST SUITE ===');
const result = runPhase9ATests();
for (const l of result.logs) {
  console.log(l);
}

if (!result.success) {
  process.exit(1);
}
