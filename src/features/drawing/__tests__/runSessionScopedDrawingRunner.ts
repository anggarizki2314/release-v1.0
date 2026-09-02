import { runSessionScopedDrawingPersistenceTests } from './SessionScopedDrawingPersistenceTest';

console.log('============================================================');
console.log('RUNNING SESSION-SCOPED DRAWING PERSISTENCE TEST SUITE');
console.log('============================================================');

const result = runSessionScopedDrawingPersistenceTests();

result.logs.forEach((log) => console.log(log));
console.log('\nSummary: ' + result.passed + '/' + result.total + ' tests PASSED');
console.log('============================================================');
console.log('TEST SUITE RESULT: ' + (result.success ? 'PASSED (' + result.passed + '/' + result.total + ')' : 'FAILED'));
console.log('============================================================\n');

if (!result.success) {
  process.exit(1);
}
