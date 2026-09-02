import { runColdResumeReplayRestorationTests } from './ColdResumeReplayRestorationTest';

console.log('============================================================');
console.log('RUNNING COLD RESUME REPLAY RESTORATION GATE TEST SUITE');
console.log('============================================================');

const result = runColdResumeReplayRestorationTests();

result.logs.forEach((log) => console.log(log));
console.log('\nSummary: ' + result.passed + '/' + result.total + ' tests PASSED');
console.log('============================================================');
console.log('TEST SUITE RESULT: ' + (result.success ? 'PASSED (' + result.passed + '/' + result.total + ')' : 'FAILED'));
console.log('============================================================\n');

if (!result.success) {
  process.exit(1);
}
