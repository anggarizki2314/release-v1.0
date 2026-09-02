import { activeChartBridge } from '../ActiveChartBridge';
import { findLastIdx } from '../../../chart/candleResolver';
import { TradingEngineService } from '../../TradingEngineService';
import { createDefaultPopupState } from '../../ui/OrderPopupState';
import type { Candle } from '@/types';

export function runActiveChartBridgeReplayPriceTests() {
  const logs: string[] = [];
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, description: string) {
    total++;
    if (condition) {
      passed++;
      logs.push(`  [PASS] ${description}`);
    } else {
      logs.push(`  [FAIL] ${description}`);
    }
  }

  // Generate test dataset: M15 bars from 2024-01-01 00:00:00 UTC (1704067200)
  const baseTime = 1704067200;
  const mockM15Candles: Candle[] = [];
  for (let i = 0; i < 201; i++) {
    const time = baseTime + i * 900;
    // Bar 0: 1.16767
    // Bar 200 (2024-01-03 02:00 UTC): 1.17184
    let close = 1.16767 + (i / 200) * (1.17184 - 1.16767);
    close = Number(close.toFixed(5));
    mockM15Candles.push({
      time,
      open: close - 0.0001,
      high: close + 0.0002,
      low: close - 0.0002,
      close,
      volume: 1000,
    });
  }

  // -----------------------------------------------------------------
  // TEST 1: BUY MARKET DURING REPLAY
  // -----------------------------------------------------------------
  const currentReplayTime = 1704247200; // 2024-01-03 02:00:00 UTC (Index 200)
  const idx = findLastIdx(mockM15Candles, currentReplayTime);
  const currentCandle = idx >= 0 ? mockM15Candles[idx] : null;
  const currentReplayPrice = currentCandle ? currentCandle.close : 0;

  activeChartBridge.registerChartState({
    paneId: 'pane-0',
    symbol: 'EURUSD',
    timeframe: 'M15',
    currentReplayPrice,
    currentReplayTime,
  });

  const chartState = activeChartBridge.getChartState('pane-0');
  assert(
    chartState?.currentReplayPrice === 1.17184,
    `TEST 1A — ActiveChartBridge registers exact replay price 1.17184 (not stale 1.16767)`
  );

  // Form state created by OrderPopup
  const popupState = createDefaultPopupState('BUY_MARKET', 'EURUSD', chartState!.currentReplayPrice, 100_000);
  assert(
    popupState.entryPrice === 1.17184 &&
    popupState.stopLoss === '1.16984' &&
    popupState.takeProfit === '1.17584',
    `TEST 1B — OrderPopup receives 1.17184 and computes SL=1.16984, TP=1.17584`
  );

  // Trading engine execution
  const engine = new TradingEngineService();
  engine.initializeSession({
    id: 'test-session-1',
    initialBalance: 100_000,
    currency: 'USD',
    leverage: 100,
    mode: 'NORMAL',
  });

  const result = engine.placeOrder({
    symbol: 'EURUSD',
    type: 'BUY_MARKET',
    volume: 1.0,
    entryPrice: chartState!.currentReplayPrice,
    stopLoss: Number(popupState.stopLoss),
    takeProfit: Number(popupState.takeProfit),
  });

  assert(
    result.position?.entryPrice === 1.17184 &&
    result.position.stopLoss === 1.16984 &&
    result.position.takeProfit === 1.17584,
    `TEST 1C — Executed Position has entryPrice=1.17184, SL=1.16984, TP=1.17584`
  );

  // -----------------------------------------------------------------
  // TEST 2: MULTI-TIMEFRAME RESOLUTION (M15 vs H1)
  // -----------------------------------------------------------------
  // Generate H1 bars (4x M15 bars per H1)
  const mockH1Candles: Candle[] = [];
  for (let i = 0; i <= 50; i++) {
    const time = baseTime + i * 3600;
    const close = Number((1.16767 + (i / 50) * (1.17150 - 1.16767)).toFixed(5));
    mockH1Candles.push({
      time,
      open: close,
      high: close + 0.0005,
      low: close - 0.0005,
      close,
      volume: 4000,
    });
  }

  const h1Idx = findLastIdx(mockH1Candles, currentReplayTime);
  const h1Candle = h1Idx >= 0 ? mockH1Candles[h1Idx] : null;

  activeChartBridge.registerChartState({
    paneId: 'pane-1',
    symbol: 'EURUSD',
    timeframe: 'H1',
    currentReplayPrice: h1Candle!.close,
    currentReplayTime,
  });

  const h1ChartState = activeChartBridge.getChartState('pane-1');
  assert(
    h1ChartState?.currentReplayPrice === 1.17150 && h1ChartState.timeframe === 'H1',
    `TEST 2 — H1 pane correctly resolves its own candle price (1.17150) without index-mismatch error`
  );

  // -----------------------------------------------------------------
  // TEST 3: SECOND BUY AFTER STOP LOSS (Zero Carry-Over)
  // -----------------------------------------------------------------
  // Position 1 hit SL and closed
  engine.closePosition(result.position!.positionId, 1.16984, Date.now());

  // Replay moves forward to 1.17250 (next bar)
  const nextReplayTime = currentReplayTime + 900;
  const nextPrice = 1.17250;

  activeChartBridge.registerChartState({
    paneId: 'pane-0',
    symbol: 'EURUSD',
    timeframe: 'M15',
    currentReplayPrice: nextPrice,
    currentReplayTime: nextReplayTime,
  });

  const secondState = activeChartBridge.getChartState('pane-0');
  const secondResult = engine.placeOrder({
    symbol: 'EURUSD',
    type: 'BUY_MARKET',
    volume: 1.0,
    entryPrice: secondState!.currentReplayPrice,
  });

  assert(
    secondResult.position?.positionId !== result.position?.positionId &&
    secondResult.position?.entryPrice === 1.17250,
    `TEST 3 — Second BUY after SL opens clean Position with new entryPrice=1.17250 (zero carry-over)`
  );

  // -----------------------------------------------------------------
  // TEST 4: REPLAY ADVANCES DYNAMICALLY
  // -----------------------------------------------------------------
  const stepPrices = [1.17184, 1.17220, 1.17090];
  let dynamicOk = true;

  stepPrices.forEach((p, idx) => {
    activeChartBridge.registerChartState({
      paneId: 'pane-0',
      symbol: 'EURUSD',
      timeframe: 'M15',
      currentReplayPrice: p,
      currentReplayTime: currentReplayTime + idx * 900,
    });
    const s = activeChartBridge.getChartState('pane-0');
    if (s?.currentReplayPrice !== p) dynamicOk = false;
  });

  assert(
    dynamicOk,
    `TEST 4 — Replay step advancement continuously updates ActiveChartBridge price (1.17184 -> 1.17220 -> 1.17090)`
  );

  // -----------------------------------------------------------------
  // TEST 5: NON-REPLAY REGRESSION
  // -----------------------------------------------------------------
  const liveTailPrice = mockM15Candles[mockM15Candles.length - 1].close;
  activeChartBridge.registerChartState({
    paneId: 'pane-0',
    symbol: 'EURUSD',
    timeframe: 'M15',
    currentReplayPrice: liveTailPrice,
    currentReplayTime: mockM15Candles[mockM15Candles.length - 1].time,
  });

  const liveState = activeChartBridge.getChartState('pane-0');
  assert(
    liveState?.currentReplayPrice === liveTailPrice,
    `TEST 5 — Outside Replay mode, dataset tail price is safely registered`
  );

  return {
    success: passed === total,
    passed,
    total,
    logs,
  };
}
