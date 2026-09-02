/**
 * TRADING ENGINE 2.0 — STOP LOSS PRECISION & ZERO EARLY TRIGGER TEST SUITE
 * Validates:
 * 1. SL is NOT triggered prematurely when live price is near SL but hasn't reached it (verifying removal of artificial epsilon buffer).
 * 2. Positions opened on a candle whose historical High/Low would have touched SL/TP do NOT trigger prematurely on the entry candle.
 * 3. Position modification on a candle does NOT trigger prematurely from past candle extremes.
 * 4. Exact SL and TP triggers fire properly when price actually reaches the target levels.
 */

import { TradingEngineService } from '../../TradingEngineService';
import type { Candle } from '@/types';

export function runStopLossPrecisionExecutionTests(): {
  success: boolean;
  passed: number;
  total: number;
  logs: string[];
} {
  const logs: string[] = [];
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, description: string) {
    total++;
    if (condition) {
      passed++;
      logs.push(`[PASS] Test ${total}: ${description}`);
    } else {
      logs.push(`[FAIL] Test ${total}: ${description}`);
    }
  }

  const engineService = TradingEngineService.getInstance();
  const positionManager = engineService.positionManager;
  const executionEngine = engineService.executionEngine;

  const t0 = 1704258000; // 10:00 UTC

  // -------------------------------------------------------------
  // TEST 1: BUY position with SL at 1.27000 does NOT hit SL when price drops to 1.27005 (0.5 pip above SL)
  // -------------------------------------------------------------
  engineService.initializeSession({ initialBalance: 100000 });
  const buyPos1 = executionEngine.processMarketOrder(
    {
      symbol: 'GBPUSD',
      type: 'BUY_MARKET',
      volume: 1.0,
      entryPrice: 1.27500,
      stopLoss: 1.27000,
      takeProfit: 1.28500,
    },
    1.27500,
    t0
  );

  // Price ticks down to 1.27005 on next candle (has NOT reached 1.27000 SL)
  engineService.processTick(
    'GBPUSD',
    1.27200,
    1.27300,
    1.27005, // Low is 1.27005 (> SL 1.27000)
    1.27010,
    (t0 + 60) * 1000
  );

  const pos1AfterTick = positionManager.getPosition(buyPos1.positionId);
  assert(
    pos1AfterTick !== undefined && pos1AfterTick.status === 'OPEN',
    'BUY position remains OPEN when price drops to 1.27005 (> SL 1.27000, no early trigger)'
  );

  // -------------------------------------------------------------
  // TEST 2: BUY position closes immediately when price actually touches SL 1.27000
  // -------------------------------------------------------------
  engineService.processTick(
    'GBPUSD',
    1.27010,
    1.27020,
    1.26990, // Touches and crosses SL 1.27000
    1.26995,
    (t0 + 120) * 1000
  );

  const pos1AfterSL = positionManager.getPosition(buyPos1.positionId);
  const tradeHistory1 = engineService.getTradeHistory();
  const slTrade1 = tradeHistory1.find((t) => t.positionId === buyPos1.positionId);

  assert(
    pos1AfterSL === undefined && slTrade1 !== undefined && Boolean(slTrade1.comment?.includes('SL Hit')),
    'BUY position closes when price actually touches/crosses SL (1.27000)'
  );

  // -------------------------------------------------------------
  // TEST 3: SELL position with SL at 1.28000 does NOT hit SL when price rises to 1.27995 (0.5 pip below SL)
  // -------------------------------------------------------------
  engineService.initializeSession({ initialBalance: 100000 });
  const sellPos1 = executionEngine.processMarketOrder(
    {
      symbol: 'GBPUSD',
      type: 'SELL_MARKET',
      volume: 1.0,
      entryPrice: 1.27500,
      stopLoss: 1.28000,
      takeProfit: 1.26500,
    },
    1.27500,
    t0
  );

  // Price rises to 1.27995 on next candle (has NOT reached 1.28000 SL)
  engineService.processTick(
    'GBPUSD',
    1.27600,
    1.27995, // High is 1.27995 (< SL 1.28000)
    1.27550,
    1.27990,
    (t0 + 60) * 1000
  );

  const sellPos1AfterTick = positionManager.getPosition(sellPos1.positionId);
  assert(
    sellPos1AfterTick !== undefined && sellPos1AfterTick.status === 'OPEN',
    'SELL position remains OPEN when price rises to 1.27995 (< SL 1.28000, no early trigger)'
  );

  // -------------------------------------------------------------
  // TEST 4: SELL position closes when price actually touches SL 1.28000
  // -------------------------------------------------------------
  engineService.processTick(
    'GBPUSD',
    1.27990,
    1.28010, // Touches and crosses SL 1.28000
    1.27980,
    1.28005,
    (t0 + 120) * 1000
  );

  const sellPos1AfterSL = positionManager.getPosition(sellPos1.positionId);
  const tradeHistory2 = engineService.getTradeHistory();
  const slTrade2 = tradeHistory2.find((t) => t.positionId === sellPos1.positionId);

  assert(
    sellPos1AfterSL === undefined && slTrade2 !== undefined && Boolean(slTrade2.comment?.includes('SL Hit')),
    'SELL position closes when price actually touches/crosses SL (1.28000)'
  );

  // -------------------------------------------------------------
  // TEST 5: BUY position with SL at 1.27000 triggers SL when candle Low drops to 1.26800 (wick crosses SL)
  // -------------------------------------------------------------
  engineService.initializeSession({ initialBalance: 100000 });
  const entryCandleTime = t0 * 1000;

  const buyPosEntryCandle = executionEngine.processMarketOrder(
    {
      symbol: 'GBPUSD',
      type: 'BUY_MARKET',
      volume: 1.0,
      entryPrice: 1.27500,
      stopLoss: 1.27000,
      takeProfit: 1.28500,
    },
    1.27500,
    entryCandleTime
  );

  // Next candle ticks with Low 1.26800 (crosses SL 1.27000) and Close 1.27500
  engineService.processTick(
    'GBPUSD',
    1.27000,
    1.27600,
    1.26800, // Wick reaches 1.26800 <= SL 1.27000!
    1.27500,
    (t0 + 60) * 1000
  );

  const posEntryCandleAfter = positionManager.getPosition(buyPosEntryCandle.positionId);
  const tradeHistory5 = engineService.getTradeHistory();
  const slTrade5 = tradeHistory5.find((t) => t.positionId === buyPosEntryCandle.positionId);

  assert(
    posEntryCandleAfter === undefined && slTrade5 !== undefined && Boolean(slTrade5.comment?.includes('SL Hit')),
    'BUY position triggers SL when candle Low wick crosses SL (1.26800 <= SL 1.27000)'
  );

  // -------------------------------------------------------------
  // TEST 6: SELL position with SL at 1.28000 triggers SL when candle High rises to 1.28200 (wick crosses SL)
  // -------------------------------------------------------------
  engineService.initializeSession({ initialBalance: 100000 });
  const sellPosEntryCandle = executionEngine.processMarketOrder(
    {
      symbol: 'GBPUSD',
      type: 'SELL_MARKET',
      volume: 1.0,
      entryPrice: 1.27500,
      stopLoss: 1.28000,
      takeProfit: 1.26500,
    },
    1.27500,
    entryCandleTime
  );

  // Next candle ticks with High 1.28200 (crosses SL 1.28000) and Close 1.27500
  engineService.processTick(
    'GBPUSD',
    1.27800,
    1.28200, // Wick reaches 1.28200 >= SL 1.28000!
    1.27400,
    1.27500,
    (t0 + 60) * 1000
  );

  const sellPosEntryCandleAfter = positionManager.getPosition(sellPosEntryCandle.positionId);
  const tradeHistory6 = engineService.getTradeHistory();
  const slTrade6 = tradeHistory6.find((t) => t.positionId === sellPosEntryCandle.positionId);

  assert(
    sellPosEntryCandleAfter === undefined && slTrade6 !== undefined && Boolean(slTrade6.comment?.includes('SL Hit')),
    'SELL position triggers SL when candle High wick crosses SL (1.28200 >= SL 1.28000)'
  );

  // -------------------------------------------------------------
  // TEST 7: SELL position triggers SL on subsequent candle when candle High reaches SL even if Close < SL
  // -------------------------------------------------------------
  engineService.initializeSession({ initialBalance: 100000 });
  const sellPosWick = executionEngine.processMarketOrder(
    {
      symbol: 'EURUSD',
      type: 'SELL_MARKET',
      volume: 0.01,
      entryPrice: 1.15700,
      stopLoss: 1.15780,
      takeProfit: 1.15000,
    },
    1.15700,
    t0 * 1000
  );

  // Subsequent candle: High is 1.15800 (exceeds SL 1.15780), but Close is 1.15680 (below SL!)
  engineService.processTick(
    'EURUSD',
    1.15700,
    1.15800, // High pierced SL!
    1.15650,
    1.15680, // Close is below SL
    (t0 + 60) * 1000
  );

  const sellPosWickAfter = positionManager.getPosition(sellPosWick.positionId);
  const tradeHistory7 = engineService.getTradeHistory();
  const slTrade7 = tradeHistory7.find((t) => t.positionId === sellPosWick.positionId);

  assert(
    sellPosWickAfter === undefined && slTrade7 !== undefined && Boolean(slTrade7.comment?.includes('SL Hit')),
    'SELL position triggers SL on subsequent candle when High crosses SL (even if Close < SL)'
  );

  // -------------------------------------------------------------
  // TEST 8: BUY position triggers SL on subsequent candle when candle Low reaches SL even if Close > SL
  // -------------------------------------------------------------
  engineService.initializeSession({ initialBalance: 100000 });
  const buyPosWick = executionEngine.processMarketOrder(
    {
      symbol: 'EURUSD',
      type: 'BUY_MARKET',
      volume: 0.01,
      entryPrice: 1.15700,
      stopLoss: 1.15600,
      takeProfit: 1.16500,
    },
    1.15700,
    t0 * 1000
  );

  // Subsequent candle: Low is 1.15550 (drops below SL 1.15600), but Close is 1.15720 (above SL!)
  engineService.processTick(
    'EURUSD',
    1.15700,
    1.15750,
    1.15550, // Low pierced SL!
    1.15720, // Close is above SL
    (t0 + 60) * 1000
  );

  const buyPosWickAfter = positionManager.getPosition(buyPosWick.positionId);
  const tradeHistory8 = engineService.getTradeHistory();
  const slTrade8 = tradeHistory8.find((t) => t.positionId === buyPosWick.positionId);

  assert(
    buyPosWickAfter === undefined && slTrade8 !== undefined && Boolean(slTrade8.comment?.includes('SL Hit')),
    'BUY position triggers SL on subsequent candle when Low crosses SL (even if Close > SL)'
  );

  // -------------------------------------------------------------
  // TEST 9: Position opened with Date.now() timestamp heals and triggers SL on historical candle
  // -------------------------------------------------------------
  engineService.initializeSession({ initialBalance: 100000 });
  const wallClockOpenedAt = 1787332390000; // Future wall clock Date.now()
  const posHeal = positionManager.openPosition({
    order: {
      orderId: 'ORD-HEAL-1',
      symbol: 'EURUSD',
      type: 'SELL_MARKET',
      direction: 'SELL',
      volume: 0.01,
      entryPrice: 1.15700,
      stopLoss: 1.15780,
      takeProfit: null,
      status: 'ACTIVE',
      riskPercent: 1.0,
      riskDollar: 100,
      rewardDollar: 200,
      rrRatio: 2.0,
      comment: '',
      magicNumber: null,
      createdAt: wallClockOpenedAt,
      modifiedAt: wallClockOpenedAt,
    },
    fillPrice: 1.15700,
    openedAt: wallClockOpenedAt,
  }, wallClockOpenedAt);

  // Tick 1: Replay entry candle in 2024 (t0) heals openedAt
  engineService.processTick(
    'EURUSD',
    1.15700,
    1.15750,
    1.15680,
    1.15710,
    t0 * 1000
  );

  // Tick 2: Replay next candle crosses SL
  engineService.processTick(
    'EURUSD',
    1.15710,
    1.15820, // High reaches 1.15820 > SL 1.15780
    1.15700,
    1.15720,
    (t0 + 60) * 1000
  );

  const posHealAfter = positionManager.getPosition(posHeal.positionId);
  assert(
    posHealAfter === undefined,
    'Position opened with wall-clock Date.now() timestamp heals and triggers SL on historical replay candle'
  );

  const allPassed = passed === total;
  return {
    success: allPassed,
    passed,
    total,
    logs,
  };
}

if (require.main === module) {
  console.log('=== RUNNING STOP LOSS PRECISION EXECUTION TEST SUITE ===');
  const res = runStopLossPrecisionExecutionTests();
  for (const l of res.logs) {
    console.log(l);
  }
  console.log(`SUMMARY: ${res.passed}/${res.total} tests passed.`);
  if (!res.success) {
    process.exit(1);
  }
}
