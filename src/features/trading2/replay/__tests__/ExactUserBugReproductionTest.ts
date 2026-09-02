/**
 * Exact User Bug Reproduction & Verification Test
 * Scenario from User Screenshot:
 * 1. User opens a SELL order on XAUUSD @ 1548.96 with SL 1553.10 and TP 1540.60.
 * 2. The entry candle (or previous wick) has Low = 1540.00 / 0 / null, but live currentPrice is 1550.00.
 * 3. Position must NOT trigger TP prematurely on entry or while price is above 1540.60!
 * 4. Position must ONLY trigger TP when a future candle legitimately drops to <= 1540.60.
 */

import { TradingEngineService } from '../../TradingEngineService';

function runTest() {
  console.log('=== RUNNING EXACT USER SCENARIO VERIFICATION ===');
  const engineService = TradingEngineService.getInstance();
  const executionEngine = engineService.executionEngine;
  const positionManager = engineService.positionManager;

  const t0 = 1578926940000; // 2020-01-13 14:49:00 UTC

  // 1. Initialize fresh session
  engineService.initializeSession({ initialBalance: 100000 });

  // 2. Open SELL order as seen in user's screenshot
  const sellPos = executionEngine.processMarketOrder(
    {
      symbol: 'XAUUSD',
      type: 'SELL_MARKET',
      volume: 0.12,
      entryPrice: 1548.96,
      stopLoss: 1553.10,
      takeProfit: 1540.60,
    },
    1548.96,
    t0
  );

  console.log('1. Position Created:', {
    id: sellPos.positionId,
    direction: sellPos.direction,
    entry: sellPos.entryPrice,
    sl: sellPos.stopLoss,
    tp: sellPos.takeProfit,
    openedAt: sellPos.openedAt,
  });

  if (!sellPos || sellPos.status !== 'OPEN') {
    throw new Error('FAIL: Position was not opened');
  }

  // 3. Entry candle tick: Low was 1540.00 (historical wick), but live close is 1550.00
  const tick1 = engineService.processTick(
    'XAUUSD',
    1551.00,
    1551.50,
    1540.00, // Historical wick <= TP
    1550.00, // Current price
    t0
  );

  const posAfterTick1 = positionManager.getPosition(sellPos.positionId);
  if (!posAfterTick1 || posAfterTick1.status !== 'OPEN') {
    throw new Error('FAIL: Position closed prematurely on entry candle!');
  }
  console.log('✓ PASS: Position remained OPEN on entry candle despite historical wick.');

  // 4. Next candle (14:50 UTC): High 1551.00, Low 1549.00, Close 1549.50 (Above TP 1540.60)
  const tick2 = engineService.processTick(
    'XAUUSD',
    1550.00,
    1551.00,
    1549.00,
    1549.50,
    t0 + 60000
  );

  const posAfterTick2 = positionManager.getPosition(sellPos.positionId);
  if (!posAfterTick2 || posAfterTick2.status !== 'OPEN') {
    throw new Error('FAIL: Position closed prematurely on 14:50 candle where low is 1549.00!');
  }
  console.log('✓ PASS: Position remained OPEN on 14:50 candle (Low 1549.00 > TP 1540.60).');

  // 5. Corrupted tick with low = 0 or null
  const tick3 = engineService.processTick(
    'XAUUSD',
    1550.00,
    1550.50,
    0, // Corrupted 0 low
    1550.00,
    t0 + 120000
  );

  const posAfterTick3 = positionManager.getPosition(sellPos.positionId);
  if (!posAfterTick3 || posAfterTick3.status !== 'OPEN') {
    throw new Error('FAIL: Position closed when receiving low = 0 tick!');
  }
  console.log('✓ PASS: Corrupted low = 0 tick correctly ignored.');

  // 6. Future candle (19:30 UTC): Price actually drops and hits TP 1540.60
  const tick4 = engineService.processTick(
    'XAUUSD',
    1545.00,
    1545.00,
    1540.00, // Legitimate drop touching TP 1540.60!
    1540.20,
    t0 + 3600000
  );

  const posAfterTick4 = positionManager.getPosition(sellPos.positionId);
  const tradeHistory = engineService.getTradeHistory();
  const closedTrade = tradeHistory.find((t) => t.positionId === sellPos.positionId);

  console.log('Trade History records:', tradeHistory);
  if (posAfterTick4 !== undefined) {
    throw new Error('FAIL: Position did not close when price actually reached TP!');
  }
  if (!closedTrade || closedTrade.exitPrice !== 1540.60) {
    throw new Error(`FAIL: Trade history record is missing or incorrect exitPrice: ${JSON.stringify(closedTrade)}`);
  }

  console.log('✓ PASS: Position closed with TP only when price legitimately reached 1540.60.');
  console.log('Final Trade Record:', {
    tradeId: closedTrade.tradeId,
    entry: closedTrade.entryPrice,
    exit: closedTrade.exitPrice,
    profit: closedTrade.profit,
    comment: closedTrade.comment,
  });

  console.log('=====================================================');
  console.log('ALL VERIFICATION STEPS PASSED WITH 100% ACCURACY!');
  console.log('=====================================================');
}

runTest();
