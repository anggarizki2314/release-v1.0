/**
 * Phase 9 Test Runner Script
 */
import { runPhase9Tests } from './Phase9GeneratedTimeframeIntegrationTest';
import { runAutoFollowTests } from './AutoFollowTimeframeTest';
import { runTimezoneDisplayTests } from '../../../timezone/__tests__/TimezoneDisplayVerificationTest';
import { runMasterDataGeneratorTests } from '../../../data/__tests__/MasterDataGeneratorTest';
import { runSessionPairDataIsolationTests } from './SessionPairDataIsolationTest';

import { runTimeframeHandoffSurgicalTests } from './TimeframeHandoffSurgicalTest';
import { runReplayPrefetchReconnectionTests } from './ReplayPrefetchReconnectionTest';

console.log('=== RUNNING PHASE 9 INTEGRATION TEST SUITE ===');
const result = runPhase9Tests();
for (const l of result.logs) {
  console.log(l);
}

console.log('=== RUNNING SURGICAL TIMEFRAME HANDOFF TEST SUITE ===');
const handoffResult = runTimeframeHandoffSurgicalTests();
for (const l of handoffResult.logs) {
  console.log(l);
}

console.log('=== RUNNING REPLAY PREFETCH RECONNECTION TEST SUITE ===');
const prefetchResult = runReplayPrefetchReconnectionTests();
for (const l of prefetchResult.logs) {
  console.log(l);
}

console.log('=== RUNNING AUTO FOLLOW TIMEFRAME TEST SUITE ===');
const autoFollowResult = runAutoFollowTests();
for (const l of autoFollowResult.logs) {
  console.log(l);
}

console.log('=== RUNNING TIMEZONE DISPLAY VERIFICATION TEST SUITE ===');
const tzResult = runTimezoneDisplayTests();
for (const l of tzResult.logs) {
  console.log(l);
}

console.log('=== RUNNING MASTER DATA GENERATOR TEST SUITE ===');
const generatorResult = runMasterDataGeneratorTests();
for (const l of generatorResult.logs) {
  console.log(l);
}

import { runViewportAutoFollowTests } from './ViewportAutoFollowTest';

console.log('=== RUNNING SESSION PAIR DATA ISOLATION TEST SUITE ===');
const isolationResult = runSessionPairDataIsolationTests();
for (const l of isolationResult.logs) {
  console.log(l);
}

runViewportAutoFollowTests();

if (!result.success || !handoffResult.success || !prefetchResult.success || !autoFollowResult.success || !tzResult.success || !generatorResult.success || !isolationResult.success) {
  process.exit(1);
}
