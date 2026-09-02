import assert from 'assert';
import { TradingEngineService } from '../../TradingEngineService';

async function runTest() {
  console.log('=== Test: Position & Order Volume Modification ===');
  const service = new TradingEngineService();
  await service.initializeSession({
    id: 'test-mod-session',
    initialBalance: 10000,
  } as any);

  // 1. Place a market order
  console.log('Step 1: Place Market Order 1.00 Lot');
  const pos = service.placeOrder({
    symbol: 'EURUSD',
    type: 'BUY_MARKET',
    volume: 1.0,
    entryPrice: 1.08500,
    stopLoss: 1.08000,
    takeProfit: 1.09500,
  });

  const openPositions = service.getOpenPositions();
  assert(openPositions.length === 1, 'Should have 1 open position');
  assert(openPositions[0].volume === 1.0, 'Initial volume should be 1.00 lot');
  console.log('✓ Position opened successfully with 1.00 lot');

  // 2. Modify Position Volume to 0.50 Lot
  console.log('Step 2: Modify Position Volume to 0.50 Lot');
  service.modifyPosition({
    positionId: openPositions[0].positionId,
    volume: 0.5,
    stopLoss: 1.08200,
    takeProfit: 1.09800,
  });

  const updatedPositions = service.getOpenPositions();
  assert(updatedPositions.length === 1, 'Should still have 1 open position');
  assert(updatedPositions[0].volume === 0.5, `Volume should be updated to 0.5 lot, got: ${updatedPositions[0].volume}`);
  assert(updatedPositions[0].stopLoss === 1.08200, 'Stop Loss should be updated');
  assert(updatedPositions[0].takeProfit === 1.09800, 'Take Profit should be updated');
  console.log('✓ Position volume and SL/TP modified successfully');

  // 3. Place a Pending Order
  console.log('Step 3: Place Pending Limit Order');
  service.placeOrder({
    symbol: 'EURUSD',
    type: 'BUY_LIMIT',
    volume: 2.0,
    entryPrice: 1.07500,
  });

  const pendingOrders = service.getPendingOrders();
  assert(pendingOrders.length === 1, 'Should have 1 pending order');
  assert(pendingOrders[0].volume === 2.0, 'Pending order initial volume should be 2.0');

  // 4. Modify Pending Order Volume to 3.50 Lot
  console.log('Step 4: Modify Pending Order Volume to 3.50 Lot');
  service.modifyOrder(pendingOrders[0].orderId, {
    volume: 3.5,
    entryPrice: 1.07600,
    stopLoss: 1.07200,
    takeProfit: 1.08500,
  });

  const updatedPending = service.getPendingOrders();
  assert(updatedPending.length === 1, 'Should still have 1 pending order');
  assert(updatedPending[0].volume === 3.5, `Pending volume should be 3.5 lot, got: ${updatedPending[0].volume}`);
  assert(updatedPending[0].entryPrice === 1.07600, 'Entry price should be updated');
  console.log('✓ Pending order volume and price modified successfully');

  console.log('=== All Volume Modification Tests Passed Successfully! ===');
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
