/**
 * Trading Engine 2.0 — ChallengeEngine Verification Test Suite
 * Executes all 6 prompt verification tests for ChallengeEngine & Independent Validators.
 */

import { createTradingStore } from '../../store/TradingStoreFactory';
import { PositionManager } from '../../position/PositionManager';
import { ClosedPositionRepository } from '../../repository/ClosedPositionRepository';
import { AccountEngine } from '../../account/AccountEngine';
import { ChallengeEngine } from '../ChallengeEngine';
import type { OrderModel } from '../../order/OrderTypes';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

export function runChallengeEngineTests() {
  console.log('=====================================================');
  console.log('RUNNING CHALLENGE ENGINE STEP 5 VERIFICATION SUITE');
  console.log('=====================================================\n');

  // Setup Fresh Engine Stack
  const initialBalance = 100_000;
  const leverage = 100;
  const store = createTradingStore({ initialBalance, leverage });

  const dummyAccountManager: any = { getAccount: () => ({ balance: initialBalance }) };
  const dummyOrderManager: any = { cancelOrder: () => {} };

  const positionManager = new PositionManager(store, dummyAccountManager, dummyOrderManager);
  const closedRepo = new ClosedPositionRepository(positionManager);
  const accountEngine = new AccountEngine(positionManager, closedRepo, { initialBalance, leverage });
  const challengeEngine = new ChallengeEngine(accountEngine, closedRepo, {
    initialBalance,
    profitTargetPercent: 10.0,
    maxDailyLossPercent: 5.0,
    maxTotalLossPercent: 10.0,
    minimumTradingDays: 2,
  }, 'NORMAL');

  // Helper order
  const createBuyOrder = (id: string, price: number = 1.1000): OrderModel => ({
    orderId: id,
    symbol: 'EURUSD',
    type: 'BUY_MARKET',
    direction: 'BUY',
    volume: 1.0,
    entryPrice: price,
    stopLoss: null,
    takeProfit: null,
    riskPercent: 1,
    riskDollar: 1000,
    rewardDollar: 2000,
    rrRatio: 2,
    comment: 'Test Order',
    magicNumber: 999,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    status: 'FILLED',
  });

  // -----------------------------------------------------------------
  // TEST 1: MODE NORMAL (Validators Disabled, Status = NORMAL MODE)
  // -----------------------------------------------------------------
  console.log('--- TEST 1: MODE NORMAL ---');
  challengeEngine.initializeSession('NORMAL', { initialBalance });

  // Open position with huge loss (-$15,000 / 15% drawdown)
  const pos1 = positionManager.openPosition({ order: createBuyOrder('ORD-NORM-1'), fillPrice: 1.1000, openedAt: Date.now() });
  positionManager.updatePosition(pos1.positionId, { currentPrice: 0.9500, floatingPnL: -15000 });

  let state = challengeEngine.getState();
  console.log(`Mode: ${state.mode}, Status: ${state.status}, DailyLossViolated: ${state.dailyLossViolated}, MaxLossViolated: ${state.maximumLossViolated}`);

  assert(state.mode === 'NORMAL', `TEST 1 FAILED: Mode must be NORMAL!`);
  assert(state.status === 'NORMAL MODE', `TEST 1 FAILED: Status must be 'NORMAL MODE', got '${state.status}'`);
  assert(!state.dailyLossViolated, `TEST 1 FAILED: Daily loss validation must be disabled in NORMAL mode!`);
  assert(!state.maximumLossViolated, `TEST 1 FAILED: Max loss validation must be disabled in NORMAL mode!`);
  console.log('✓ TEST 1 PASSED: NORMAL Mode disables all challenge validators and hides challenge rules.\n');

  // -----------------------------------------------------------------
  // TEST 2: MODE CHALLENGE — PROFIT 9% (Target 10%, Status = RUNNING)
  // -----------------------------------------------------------------
  console.log('--- TEST 2: MODE CHALLENGE — PROFIT 9% ---');
  positionManager.reset();
  challengeEngine.initializeSession('CHALLENGE', {
    initialBalance,
    profitTargetPercent: 10.0,
    maxDailyLossPercent: 5.0,
    maxTotalLossPercent: 10.0,
    minimumTradingDays: 2,
  });

  // Generate 9% Profit ($9,000)
  const pos2 = positionManager.openPosition({ order: createBuyOrder('ORD-CHALL-1'), fillPrice: 1.1000, openedAt: Date.now() });
  positionManager.updatePosition(pos2.positionId, { currentPrice: 1.1900, floatingPnL: 9000 });

  state = challengeEngine.getState();
  console.log(`Profit %: ${state.profitPercent}%, Target %: ${state.targetPercent}%, Status: ${state.status}, RemTarget: $${state.remainingTarget}`);

  assert(state.mode === 'CHALLENGE', `TEST 2 FAILED: Mode must be CHALLENGE!`);
  assert(state.profitPercent === 9.0, `TEST 2 FAILED: Expected profit percent 9%, got ${state.profitPercent}%`);
  assert(state.status === 'RUNNING', `TEST 2 FAILED: Expected status RUNNING, got ${state.status}`);
  assert(!state.targetReached, `TEST 2 FAILED: Target reached should be false at 9%!`);
  console.log('✓ TEST 2 PASSED: 9% profit yields status RUNNING.\n');

  // -----------------------------------------------------------------
  // TEST 3: PROFIT TARGET 10% REACHED & PASSED
  // -----------------------------------------------------------------
  console.log('--- TEST 3: PROFIT TARGET 10% REACHED & PASSED ---');
  // Close position 1 on Day 1
  const day1Ms = new Date('2026-08-01T10:00:00Z').getTime();
  positionManager.closePosition(pos2.positionId, 1.1900, day1Ms); // +$9,000 closed

  // Trade on Day 2 to meet minimum 2 trading days
  const day2Ms = new Date('2026-08-02T10:00:00Z').getTime();
  const pos3 = positionManager.openPosition({ order: createBuyOrder('ORD-CHALL-2'), fillPrice: 1.1000, openedAt: day2Ms }, day2Ms);
  positionManager.closePosition(pos3.positionId, 1.1100, day2Ms); // +$1,000 closed on Day 2 (Total profit = $10,000 / 10%)

  state = challengeEngine.getState();
  console.log(`Profit %: ${state.profitPercent}%, TradingDays: ${state.currentTradingDays}/${state.minimumTradingDays}, Status: ${state.status}`);

  assert(state.profitPercent === 10.0, `TEST 3 FAILED: Expected profit percent 10%, got ${state.profitPercent}%`);
  assert(state.targetReached, `TEST 3 FAILED: Target reached should be true!`);
  assert(state.currentTradingDays >= 2, `TEST 3 FAILED: Expected >= 2 trading days, got ${state.currentTradingDays}`);
  assert(state.status === 'PASSED', `TEST 3 FAILED: Expected status PASSED, got ${state.status}`);
  console.log('✓ TEST 3 PASSED: Profit target (10%) & Minimum Trading Days met -> Status PASSED.\n');

  // -----------------------------------------------------------------
  // TEST 4: DAILY LOSS EXCEEDED -> FAILED
  // -----------------------------------------------------------------
  console.log('--- TEST 4: DAILY LOSS EXCEEDED ---');
  positionManager.reset();
  challengeEngine.initializeSession('CHALLENGE', {
    initialBalance,
    profitTargetPercent: 10.0,
    maxDailyLossPercent: 5.0, // $5,000 limit
    maxTotalLossPercent: 10.0,
    minimumTradingDays: 1,
  });

  const nowMs = Date.now();
  const posLossDay = positionManager.openPosition({ order: createBuyOrder('ORD-FAIL-DL'), fillPrice: 1.1000, openedAt: nowMs }, nowMs);
  // Update price down by 6% ($6,000 floating loss in 1 day)
  positionManager.updatePosition(posLossDay.positionId, { currentPrice: 1.0400, floatingPnL: -6000 });
  challengeEngine.recalculate(nowMs);

  state = challengeEngine.getState();
  console.log(`DailyDrawdown: $${state.dailyDrawdown}, DailyLossViolated: ${state.dailyLossViolated}, Status: ${state.status}`);

  assert(state.dailyLossViolated, `TEST 4 FAILED: Daily loss should be violated!`);
  assert(state.status === 'FAILED', `TEST 4 FAILED: Expected status FAILED, got ${state.status}`);
  assert(Boolean(state.violationReason?.includes('Daily Loss')), `TEST 4 FAILED: Violation reason expected Daily Loss, got '${state.violationReason}'`);
  console.log('✓ TEST 4 PASSED: Daily loss limit exceeded -> Status FAILED.\n');

  // -----------------------------------------------------------------
  // TEST 5: MAXIMUM DRAWDOWN EXCEEDED -> FAILED
  // -----------------------------------------------------------------
  console.log('--- TEST 5: MAXIMUM DRAWDOWN EXCEEDED ---');
  positionManager.reset();
  challengeEngine.initializeSession('CHALLENGE', {
    initialBalance,
    profitTargetPercent: 10.0,
    maxDailyLossPercent: 20.0,
    maxTotalLossPercent: 10.0, // $10,000 max overall loss limit
    minimumTradingDays: 1,
  });

  const posMaxLoss = positionManager.openPosition({ order: createBuyOrder('ORD-FAIL-ML'), fillPrice: 1.1000, openedAt: nowMs }, nowMs);
  // Update price down by 12% ($12,000 floating loss)
  positionManager.updatePosition(posMaxLoss.positionId, { currentPrice: 0.9800, floatingPnL: -12000 });

  state = challengeEngine.getState();
  console.log(`MaxDrawdown: $${state.maximumDrawdown}, MaxLossViolated: ${state.maximumLossViolated}, Status: ${state.status}`);

  assert(state.maximumLossViolated, `TEST 5 FAILED: Maximum total loss should be violated!`);
  assert(state.status === 'FAILED', `TEST 5 FAILED: Expected status FAILED, got ${state.status}`);
  assert(Boolean(state.violationReason?.includes('Total Drawdown')), `TEST 5 FAILED: Violation reason expected Total Drawdown, got '${state.violationReason}'`);

  console.log('✓ TEST 5 PASSED: Maximum total loss limit exceeded -> Status FAILED.\n');

  // -----------------------------------------------------------------
  // TEST 6: TRADING DAYS VALIDATOR
  // -----------------------------------------------------------------
  console.log('--- TEST 6: TRADING DAYS VALIDATOR ---');
  positionManager.reset();
  challengeEngine.initializeSession('CHALLENGE', {
    initialBalance,
    profitTargetPercent: 10.0,
    maxDailyLossPercent: 5.0,
    maxTotalLossPercent: 10.0,
    minimumTradingDays: 3, // Requires 3 trading days
  });

  // Day 1 trade (+10% profit)
  const d1 = new Date('2026-08-01T12:00:00Z').getTime();
  const pDay1 = positionManager.openPosition({ order: createBuyOrder('ORD-DAY-1'), fillPrice: 1.1000, openedAt: d1 }, d1);
  positionManager.closePosition(pDay1.positionId, 1.2000, d1); // +$10,000 profit

  state = challengeEngine.getState();
  console.log(`TradingDays: ${state.currentTradingDays}/3, TargetReached: ${state.targetReached}, Status: ${state.status}`);
  assert(state.targetReached, `TEST 6 FAILED: Target should be reached!`);
  assert(state.status === 'RUNNING', `TEST 6 FAILED: Status must remain RUNNING until 3 trading days are met! Got ${state.status}`);

  // Day 2 trade
  const d2 = new Date('2026-08-02T12:00:00Z').getTime();
  const pDay2 = positionManager.openPosition({ order: createBuyOrder('ORD-DAY-2'), fillPrice: 1.1000, openedAt: d2 }, d2);
  positionManager.closePosition(pDay2.positionId, 1.1010, d2);

  state = challengeEngine.getState();
  console.log(`TradingDays: ${state.currentTradingDays}/3, Status: ${state.status}`);
  assert(state.status === 'RUNNING', `TEST 6 FAILED: Status must remain RUNNING at 2 days!`);

  // Day 3 trade
  const d3 = new Date('2026-08-03T12:00:00Z').getTime();
  const pDay3 = positionManager.openPosition({ order: createBuyOrder('ORD-DAY-3'), fillPrice: 1.1000, openedAt: d3 }, d3);
  positionManager.closePosition(pDay3.positionId, 1.1010, d3);

  state = challengeEngine.getState();
  console.log(`TradingDays: ${state.currentTradingDays}/3, Status: ${state.status}`);
  assert(state.currentTradingDays === 3, `TEST 6 FAILED: Expected 3 trading days, got ${state.currentTradingDays}`);
  assert(state.status === 'PASSED', `TEST 6 FAILED: Status should transition to PASSED once 3 days met! Got ${state.status}`);
  console.log('✓ TEST 6 PASSED: Status remains RUNNING until Minimum Trading Days are met.\n');

  console.log('=====================================================');
  console.log('ALL 6 CHALLENGE ENGINE VERIFICATION TESTS PASSED!');
  console.log('=====================================================\n');
}

// Execute test suite
runChallengeEngineTests();
