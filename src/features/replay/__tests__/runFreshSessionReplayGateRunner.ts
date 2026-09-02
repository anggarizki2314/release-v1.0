import { runFreshSessionReplayGateTests } from './FreshSessionReplayGateTest';

console.log('============================================================');
console.log('RUNNING FRESH SESSION REPLAY START GATE TEST SUITE');
console.log('============================================================');

const result = runFreshSessionReplayGateTests();

result.logs.forEach((log) => console.log(log));
console.log('\nSummary: ' + result.passed + '/' + result.total + ' tests PASSED');
console.log('============================================================');
console.log('TEST SUITE RESULT: ' + (result.success ? 'PASSED (' + result.passed + '/' + result.total + ')' : 'FAILED'));
console.log('============================================================\n');

if (!result.success) {
  process.exit(1);
}
