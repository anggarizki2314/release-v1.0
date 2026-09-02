/**
 * Trading Engine 2.0 — AccountEngine Verification Test Suite
 * Executes all 6 prompt verification tests for AccountEngine & ClosedPositionRepository.
 */

import { createTradingStore } from '../../store/TradingStoreFactory';
import { PositionManager } from '../../position/PositionManager';
import { ClosedPositionRepository } from '../../repository/ClosedPositionRepository';
import { AccountEngine } from '../AccountEngine';
import { InstrumentMetadata } from '../../instrument/InstrumentMetadata';
import { LotCalculator } from '../../risk/LotCalculator';
import { createDefaultPopupState } from '../../ui/OrderPopupState';
import type { OrderModel } from '../../order/OrderTypes';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

export function runAccountEngineTests() {
  console.log('=====================================================');
  console.log('RUNNING ACCOUNT ENGINE STEP 4 VERIFICATION SUITE');
  console.log('=====================================================\n');

  // Setup Fresh Engine Stack
  const initialBalance = 100_000;
  const leverage = 100;
  const store = createTradingStore({ initialBalance, leverage });

  // Dummy mocks for AccountManager & OrderManager to initialize PositionManager
  const dummyAccountManager: any = { getAccount: () => ({ balance: initialBalance }) };
  const dummyOrderManager: any = { cancelOrder: () => {} };

  const positionManager = new PositionManager(store, dummyAccountManager, dummyOrderManager);
  const closedRepo = new ClosedPositionRepository(positionManager);
  const accountEngine = new AccountEngine(positionManager, closedRepo, { initialBalance, leverage });

  // -----------------------------------------------------------------
  // TEST 1: BUY OPEN (Floating +, Equity up, Balance constant)
  // -----------------------------------------------------------------
  console.log('--- TEST 1: BUY OPEN ---');
  const buyOrder: OrderModel = {
    orderId: 'ORD-BUY-1',
    symbol: 'EURUSD',
    type: 'BUY_MARKET',
    direction: 'BUY',
    volume: 1.0,
    entryPrice: 1.1000,
    stopLoss: null,
    takeProfit: null,
    riskPercent: 1,
    riskDollar: 1000,
    rewardDollar: 2000,
    rrRatio: 2,
    comment: 'Test 1 Buy',
    magicNumber: 1001,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    status: 'FILLED',
  };

  const buyPos = positionManager.openPosition({ order: buyOrder, fillPrice: 1.1000, openedAt: Date.now() });
  positionManager.updatePosition(buyPos.positionId, { currentPrice: 1.1100, floatingPnL: 1000 }); // Price up by 100 pips ($1,000)

  let state = accountEngine.getState();
  console.log(`Balance: $${state.balance}, FloatingPnL: $${state.floatingPnL}, Equity: $${state.equity}`);

  assert(state.balance === initialBalance, `TEST 1 FAILED: Balance changed! Expected ${initialBalance}, got ${state.balance}`);
  assert(state.floatingPnL === 1000, `TEST 1 FAILED: FloatingPnL expected 1000, got ${state.floatingPnL}`);
  assert(state.equity === initialBalance + 1000, `TEST 1 FAILED: Equity expected 101000, got ${state.equity}`);
  console.log('✓ TEST 1 PASSED: Equity rose, Balance remained constant.\n');

  // -----------------------------------------------------------------
  // TEST 2: BUY CLOSE PROFIT (Balance up, Floating 0, Equity = Balance)
  // -----------------------------------------------------------------
  console.log('--- TEST 2: BUY CLOSE PROFIT ---');
  positionManager.closePosition(buyPos.positionId, 1.1100);

  state = accountEngine.getState();
  console.log(`Balance: $${state.balance}, FloatingPnL: $${state.floatingPnL}, Equity: $${state.equity}, ClosedTrades: ${state.closedPositions}`);

  assert(state.balance === initialBalance + 1000, `TEST 2 FAILED: Balance expected 101000, got ${state.balance}`);
  assert(state.floatingPnL === 0, `TEST 2 FAILED: FloatingPnL expected 0, got ${state.floatingPnL}`);
  assert(state.equity === state.balance, `TEST 2 FAILED: Equity must equal Balance upon closure!`);
  assert(state.closedPositions === 1, `TEST 2 FAILED: Closed positions expected 1, got ${state.closedPositions}`);
  assert(state.winTrades === 1, `TEST 2 FAILED: Win trades expected 1, got ${state.winTrades}`);
  console.log('✓ TEST 2 PASSED: Balance increased, Floating reset to 0, Equity equals Balance.\n');

  // -----------------------------------------------------------------
  // TEST 3: SELL LOSS (Floating negative, Equity down, Balance constant)
  // -----------------------------------------------------------------
  console.log('--- TEST 3: SELL LOSS ---');
  const currentBalanceAfterTest2 = state.balance;

  const sellOrder: OrderModel = {
    orderId: 'ORD-SELL-1',
    symbol: 'EURUSD',
    type: 'SELL_MARKET',
    direction: 'SELL',
    volume: 1.0,
    entryPrice: 1.1100,
    stopLoss: null,
    takeProfit: null,
    riskPercent: 1,
    riskDollar: 1000,
    rewardDollar: 2000,
    rrRatio: 2,
    comment: 'Test 3 Sell',
    magicNumber: 1002,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    status: 'FILLED',
  };

  const sellPos = positionManager.openPosition({ order: sellOrder, fillPrice: 1.1100, openedAt: Date.now() });
  positionManager.updatePosition(sellPos.positionId, { currentPrice: 1.1150, floatingPnL: -500 }); // Price rose against SELL (-$500)

  state = accountEngine.getState();
  console.log(`Balance: $${state.balance}, FloatingPnL: $${state.floatingPnL}, Equity: $${state.equity}`);

  assert(state.balance === currentBalanceAfterTest2, `TEST 3 FAILED: Balance changed! Expected ${currentBalanceAfterTest2}, got ${state.balance}`);
  assert(state.floatingPnL === -500, `TEST 3 FAILED: FloatingPnL expected -500, got ${state.floatingPnL}`);
  assert(state.equity === currentBalanceAfterTest2 - 500, `TEST 3 FAILED: Equity expected ${currentBalanceAfterTest2 - 500}, got ${state.equity}`);
  console.log('✓ TEST 3 PASSED: Equity fell, Balance remained constant.\n');

  // -----------------------------------------------------------------
  // TEST 4: SELL CLOSE LOSS (Balance down, Floating 0)
  // -----------------------------------------------------------------
  console.log('--- TEST 4: SELL CLOSE LOSS ---');
  positionManager.closePosition(sellPos.positionId, 1.1150);

  state = accountEngine.getState();
  console.log(`Balance: $${state.balance}, FloatingPnL: $${state.floatingPnL}, Equity: $${state.equity}`);

  assert(state.balance === currentBalanceAfterTest2 - 500, `TEST 4 FAILED: Balance expected ${currentBalanceAfterTest2 - 500}, got ${state.balance}`);
  assert(state.floatingPnL === 0, `TEST 4 FAILED: FloatingPnL expected 0, got ${state.floatingPnL}`);
  assert(state.lossTrades === 1, `TEST 4 FAILED: Loss trades expected 1, got ${state.lossTrades}`);
  console.log('✓ TEST 4 PASSED: Balance decreased, Floating reset to 0.\n');

  // -----------------------------------------------------------------
  // TEST 5: MULTI POSITION (5 BUY + 3 SELL floating PnL aggregation)
  // -----------------------------------------------------------------
  console.log('--- TEST 5: MULTI POSITION ---');
  positionManager.reset();
  accountEngine.reset(100_000, 100);

  const openPositions: any[] = [];
  // 5 BUY positions with +$100 floating each
  for (let i = 0; i < 5; i++) {
    const o: OrderModel = { ...buyOrder, orderId: `BUY-MULTI-${i}` };
    const p = positionManager.openPosition({ order: o, fillPrice: 1.1000, openedAt: Date.now() });
    positionManager.updatePosition(p.positionId, { currentPrice: 1.1010, floatingPnL: 100 });
    openPositions.push(p);
  }
  // 3 SELL positions with -$50 floating each
  for (let i = 0; i < 3; i++) {
    const o: OrderModel = { ...sellOrder, orderId: `SELL-MULTI-${i}` };
    const p = positionManager.openPosition({ order: o, fillPrice: 1.1000, openedAt: Date.now() });
    positionManager.updatePosition(p.positionId, { currentPrice: 1.1005, floatingPnL: -50 });
    openPositions.push(p);
  }

  state = accountEngine.getState();
  const expectedFloating = (5 * 100) + (3 * -50); // 500 - 150 = 350
  console.log(`Open Positions: ${state.openPositions}, FloatingPnL: $${state.floatingPnL}, Equity: $${state.equity}`);

  assert(state.openPositions === 8, `TEST 5 FAILED: Expected 8 open positions, got ${state.openPositions}`);
  assert(state.floatingPnL === expectedFloating, `TEST 5 FAILED: Expected floatingPnL ${expectedFloating}, got ${state.floatingPnL}`);
  assert(state.equity === 100_000 + expectedFloating, `TEST 5 FAILED: Expected equity ${100_000 + expectedFloating}, got ${state.equity}`);
  console.log('✓ TEST 5 PASSED: Multi-position FloatingPnL and Equity aggregated correctly.\n');

  // -----------------------------------------------------------------
  // TEST 6: USED MARGIN & DYNAMIC INSTRUMENT METADATA
  // -----------------------------------------------------------------
  console.log('--- TEST 6: USED MARGIN & DYNAMIC METADATA ---');
  assert(InstrumentMetadata.getContractSize('XAUUSD') === 100, 'XAUUSD contract size must be 100');
  assert(InstrumentMetadata.getContractSize('XAGUSD') === 5000, 'XAGUSD contract size must be 5000');
  assert(InstrumentMetadata.getContractSize('EURUSD') === 100000, 'EURUSD contract size must be 100000');

  positionManager.reset();
  accountEngine.reset(100_000, 100);

  // Open XAUUSD 1.0 lot @ $2,000. ContractSize = 100. Leverage = 100.
  // Expected Margin = (100 * 1.0 * 2000) / 100 = $2,000
  const goldOrder: OrderModel = {
    ...buyOrder,
    orderId: 'GOLD-ORD-1',
    symbol: 'XAUUSD',
    volume: 1.0,
    entryPrice: 2000.00,
  };

  const goldPos = positionManager.openPosition({ order: goldOrder, fillPrice: 2000.00, openedAt: Date.now() });
  positionManager.updatePosition(goldPos.positionId, { currentPrice: 2000.00, floatingPnL: 0 });

  state = accountEngine.getState();
  console.log(`Symbol: XAUUSD, Lot: 1.0, Price: $2000, ContractSize: ${InstrumentMetadata.getContractSize('XAUUSD')}, Leverage: 100`);
  console.log(`Used Margin: $${state.usedMargin}, Free Margin: $${state.freeMargin}, Margin Level: ${state.marginLevel}%`);

  assert(state.usedMargin === 2000, `TEST 6 FAILED: Expected usedMargin 2000, got ${state.usedMargin}`);
  assert(state.freeMargin === 98000, `TEST 6 FAILED: Expected freeMargin 98000, got ${state.freeMargin}`);
  assert(state.marginLevel === (100000 / 2000) * 100, `TEST 6 FAILED: Expected marginLevel 5000%, got ${state.marginLevel}`);

  console.log('✓ TEST 6 PASSED: Used Margin calculated dynamically using InstrumentMetadata.\n');

  // -----------------------------------------------------------------
  // TEST 7: DYNAMIC SESSION DEPOSIT INITIALIZATION ($10, $1,000, $25,000)
  // -----------------------------------------------------------------
  console.log('--- TEST 7: DYNAMIC SESSION DEPOSIT INITIALIZATION ---');

  // Case 1: Deposit $10
  accountEngine.initializeSession(10);
  state = accountEngine.getState();
  console.log(`Initialized Session Deposit: $10 -> Balance: $${state.balance}`);
  assert(state.balance === 10, `TEST 7 FAILED: Expected balance $10, got $${state.balance}`);

  // Case 2: Deposit $1,000
  accountEngine.initializeSession(1000);
  state = accountEngine.getState();
  console.log(`Initialized Session Deposit: $1,000 -> Balance: $${state.balance}`);
  assert(state.balance === 1000, `TEST 7 FAILED: Expected balance $1000, got $${state.balance}`);

  // Case 3: Deposit $25,000
  accountEngine.initializeSession(25000);
  state = accountEngine.getState();
  console.log(`Initialized Session Deposit: $25,000 -> Balance: $${state.balance}`);
  assert(state.balance === 25000, `TEST 7 FAILED: Expected balance $25000, got $${state.balance}`);

  // -----------------------------------------------------------------
  // TEST 8: USDJPY PAIR VALUATION & MARGIN (Quote = JPY, Base = USD)
  // -----------------------------------------------------------------
  console.log('--- TEST 8: USDJPY PAIR VALUATION & MARGIN ---');
  positionManager.reset();
  accountEngine.reset(100_000, 100);

  // 1 lot USDJPY @ 150.00.
  // Move 100 pips (1.00) to 151.00.
  // PnL in JPY = 1.00 * 1.0 * 100,000 = 100,000 JPY.
  // Converted to USD @ 151.00 = 100,000 / 151.00 = $662.25 USD.
  const usdjpyOrder: OrderModel = {
    orderId: 'USDJPY-ORD-1',
    symbol: 'USDJPY',
    type: 'BUY_MARKET',
    direction: 'BUY',
    volume: 1.0,
    entryPrice: 150.00,
    stopLoss: 149.00,
    takeProfit: 152.00,
    riskPercent: 1,
    riskDollar: 1000,
    rewardDollar: 2000,
    rrRatio: 2,
    comment: 'Test USDJPY',
    magicNumber: 1008,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    status: 'FILLED',
  };

  const usdjpyPos = positionManager.openPosition({ order: usdjpyOrder, fillPrice: 150.00, openedAt: Date.now() });
  const pnlUsdjpy = InstrumentMetadata.calculatePnl('USDJPY', 'BUY', 150.00, 151.00, 1.0);
  console.log(`USDJPY 1.0 Lot Buy @ 150.00 -> 151.00 PnL: $${pnlUsdjpy} USD (Expected ~$662.25)`);
  assert(Math.abs(pnlUsdjpy - 662.25) < 0.1, `TEST 8 FAILED: USDJPY PnL expected ~662.25, got ${pnlUsdjpy}`);

  positionManager.updatePosition(usdjpyPos.positionId, { currentPrice: 150.00, floatingPnL: 0 });
  state = accountEngine.getState();
  // Margin for USDJPY 1.0 lot @ 1:100 leverage with 100,000 USD base = 100,000 / 100 = $1,000 USD
  console.log(`USDJPY Used Margin: $${state.usedMargin} (Expected $1000)`);
  assert(state.usedMargin === 1000, `TEST 8 FAILED: USDJPY Used Margin expected 1000, got ${state.usedMargin}`);
  console.log('✓ TEST 8 PASSED: USDJPY PnL and Margin accurately evaluated in USD account currency.\n');

  // -----------------------------------------------------------------
  // TEST 9: AUTO LOT SIZING ACROSS DIVERSE INSTRUMENT PAIRS
  // -----------------------------------------------------------------
  console.log('--- TEST 9: AUTO LOT SIZING ACROSS PAIRS ---');
  // For $100 risk:
  // EURUSD (20 pips / 0.0020 SL): 100 / (0.0020 * 100,000) = 0.50 lot
  const lotEur = LotCalculator.calculateAutoLot(100, 0.0020, 100000, 'EURUSD', 1.1000);
  assert(lotEur === 0.50, `TEST 9 FAILED: EURUSD lot expected 0.50, got ${lotEur}`);

  // USDJPY (20 pips / 0.20 SL @ 150.00): Risk per lot = (0.20 * 100,000) / 150.00 = $133.33 USD -> 100 / 133.33 = 0.75 lot
  const lotJpy = LotCalculator.calculateAutoLot(100, 0.20, 100000, 'USDJPY', 150.00);
  assert(lotJpy === 0.75, `TEST 9 FAILED: USDJPY lot expected 0.75, got ${lotJpy}`);

  // XAUUSD (20 pips / $2.00 SL): 100 / (2.00 * 100) = 0.50 lot
  const lotGold = LotCalculator.calculateAutoLot(100, 2.00, 100, 'XAUUSD', 2000.00);
  assert(lotGold === 0.50, `TEST 9 FAILED: XAUUSD lot expected 0.50, got ${lotGold}`);

  // BTCUSD ($500 SL): 100 / (500 * 1) = 0.20 lot
  const lotBtc = LotCalculator.calculateAutoLot(100, 500, 1, 'BTCUSD', 60000);
  assert(lotBtc === 0.20, `TEST 9 FAILED: BTCUSD lot expected 0.20, got ${lotBtc}`);

  console.log('✓ TEST 9 PASSED: Auto lot calculation accurate for EURUSD, USDJPY, XAUUSD, BTCUSD.\n');

  // -----------------------------------------------------------------
  // TEST 10: POPUP DEFAULT SL/TP OFFSETS ACCURACY (1:3 RR DEFAULT)
  // -----------------------------------------------------------------
  console.log('--- TEST 10: POPUP DEFAULT SL/TP OFFSETS (1:3 RR) ---');
  const goldPopup = createDefaultPopupState('BUY_MARKET', 'XAUUSD', 2500.00, 10000);
  console.log(`XAUUSD @ 2500.00 -> Default SL: ${goldPopup.stopLoss}, TP: ${goldPopup.takeProfit}, RR: ${goldPopup.rrPreset}`);
  // 20 pips Gold SL (pipSize 0.1) = $2.00 offset (2498.00), 60 pips TP = $6.00 offset (2506.00) -> 1:3 RR
  assert(goldPopup.stopLoss === '2498.00', `TEST 10 FAILED: Gold SL expected 2498.00, got ${goldPopup.stopLoss}`);
  assert(goldPopup.takeProfit === '2506.00', `TEST 10 FAILED: Gold TP expected 2506.00, got ${goldPopup.takeProfit}`);
  assert(goldPopup.rrPreset === '1:3', `TEST 10 FAILED: RR preset expected 1:3, got ${goldPopup.rrPreset}`);

  const btcPopup = createDefaultPopupState('BUY_MARKET', 'BTCUSD', 60000.00, 10000);
  // 20 pips BTC SL = $20 offset (59980.00), 60 pips BTC TP = $60 offset (60060.00) -> 1:3 RR
  assert(btcPopup.stopLoss === '59980.00', `TEST 10 FAILED: BTC SL expected 59980.00, got ${btcPopup.stopLoss}`);
  assert(btcPopup.takeProfit === '60060.00', `TEST 10 FAILED: BTC TP expected 60060.00, got ${btcPopup.takeProfit}`);
  console.log('✓ TEST 10 PASSED: Popup defaults 1:3 RR dynamically derived from InstrumentMetadata.\n');

  console.log('=====================================================');
  console.log('ALL 10 VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('=====================================================\n');
}

// Execute tests automatically if imported/run
runAccountEngineTests();
