import { runSessionLifecyclePersistenceTests } from './SessionLifecyclePersistenceTest';

console.log('============================================================');
console.log('RUNNING PHASE 8 SESSION LIFECYCLE & PERSISTENCE TEST SUITE');
console.log('============================================================');

const result = runSessionLifecyclePersistenceTests();

result.logs.forEach((log) => console.log(log));

console.log('============================================================');
console.log(`TEST SUITE RESULT: ${result.success ? 'PASSED (20/20)' : 'FAILED'}`);
console.log('============================================================');

if (!result.success) {
  process.exit(1);
}
