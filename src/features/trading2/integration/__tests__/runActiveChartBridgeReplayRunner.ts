import { runActiveChartBridgeReplayPriceTests } from './ActiveChartBridgeReplayPriceTest';

console.log('============================================================');
console.log('RUNNING ACTIVE CHART BRIDGE REPLAY PRICE TEST SUITE');
console.log('============================================================');

const result = runActiveChartBridgeReplayPriceTests();

result.logs.forEach((log) => console.log(log));
console.log('\nSummary: ' + result.passed + '/' + result.total + ' tests PASSED');
console.log('============================================================');
console.log('TEST SUITE RESULT: ' + (result.success ? 'PASSED (' + result.passed + '/' + result.total + ')' : 'FAILED'));
console.log('============================================================\n');

if (!result.success) {
  process.exit(1);
}
