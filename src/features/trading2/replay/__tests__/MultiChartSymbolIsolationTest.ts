/**
 * Multi-Chart Symbol Isolation Test
 * Verifies that when 2 charts are active (e.g. XAUUSD @ 1551.00 and XAGUSD @ 17.78):
 * 1. An order placed on XAUUSD receives XAUUSD price (1551.00), NEVER XAGUSD price (17.78).
 * 2. Ticks on XAGUSD (price ~17.78) NEVER trigger SL/TP on XAUUSD positions.
 * 3. When XAUUSD rises and hits SL (1553.50 >= 1553.10), XAUUSD closes as SL Hit!
 */

import { activeChartBridge } from '../../integration/ActiveChartBridge';
import { TradingEngineService } from '../../TradingEngineService';

function runTest() {
  console.log('=== RUNNING MULTI-CHART SYMBOL ISOLATION TEST ===');
  const engineService = TradingEngineService.getInstance();
  const positionManager = engineService.positionManager;

  const t0 = 1578926940000;

  // 1. Initialize session
  engineService.initializeSession({ initialBalance: 100000 });

  // 2. Register 2 panes in ActiveChartBridge
  activeChartBridge.registerChartState({
    paneId: 'pane-0',
    symbol: 'XAUUSD',
    timeframe: 'M5',
    currentReplayPrice: 1551.00,
    currentReplayTime: t0 / 1000,
    currentReplayIndex: 50,
  });

  activeChartBridge.registerChartState({
    paneId: 'pane-1',
    symbol: 'XAGUSD',
    timeframe: 'H1',
    currentReplayPrice: 17.78,
    currentReplayTime: t0 / 1000,
    currentReplayIndex: 10,
  });

  // 3. User places a SELL_MARKET order on XAUUSD
  const orderRes = engineService.placeOrder({
    symbol: 'XAUUSD',
    type: 'SELL_MARKET',
    volume: 0.1,
    entryPrice: 0, // Auto-resolve from live chart
    stopLoss: 1553.10,
    takeProfit: 1544.50,
  }, t0);

  console.log('1. Created Order:', {
    symbol: orderRes.order.symbol,
    entryPrice: orderRes.order.entryPrice,
    sl: orderRes.order.stopLoss,
    tp: orderRes.order.takeProfit,
  });

  if (orderRes.order.entryPrice !== 1551.00) {
    throw new Error(`FAIL: XAUUSD order received incorrect entry price: ${orderRes.order.entryPrice} (Expected 1551.00, got ${orderRes.order.entryPrice})`);
  }
  console.log('✓ PASS: XAUUSD order resolved strictly to XAUUSD chart price (1551.00), not XAGUSD (17.78).');

  const openPos = positionManager.getPosition(orderRes.position!.positionId);
  if (!openPos || openPos.status !== 'OPEN') {
    throw new Error('FAIL: Position not open');
  }

  // 4. Tick on XAGUSD (low 17.40, close 17.75)
  engineService.processTick('XAGUSD', 17.78, 17.80, 17.40, 17.75, t0 + 60000);

  const posAfterXagTick = positionManager.getPosition(openPos.positionId);
  if (!posAfterXagTick || posAfterXagTick.status !== 'OPEN') {
    throw new Error('FAIL: XAUUSD position was falsely triggered by XAGUSD tick!');
  }
  console.log('✓ PASS: XAUUSD position completely unaffected by XAGUSD ticks.');

  // 5. Tick on XAUUSD where price rises to 1553.50 (High 1553.50 >= SL 1553.10)
  engineService.processTick('XAUUSD', 1551.00, 1553.50, 1550.00, 1553.20, t0 + 120000);

  const posAfterSl = positionManager.getPosition(openPos.positionId);
  const tradeHistory = engineService.getTradeHistory();
  const slTrade = tradeHistory.find((t) => t.positionId === openPos.positionId);

  if (posAfterSl !== undefined) {
    throw new Error('FAIL: XAUUSD position did not close when price touched SL!');
  }
  if (!slTrade || !slTrade.comment?.includes('SL Hit') || slTrade.exitPrice !== 1553.10) {
    throw new Error(`FAIL: Trade record is missing or incorrect SL exit: ${JSON.stringify(slTrade)}`);
  }

  console.log('✓ PASS: XAUUSD position closed cleanly as SL Hit when price rose to 1553.50.');
  console.log('Closed SL Trade:', {
    tradeId: slTrade.tradeId,
    entry: slTrade.entryPrice,
    exit: slTrade.exitPrice,
    comment: slTrade.comment,
  });

  console.log('=====================================================');
  console.log('MULTI-CHART SYMBOL ISOLATION TEST PASSED 100%!');
  console.log('=====================================================');
}

runTest();
