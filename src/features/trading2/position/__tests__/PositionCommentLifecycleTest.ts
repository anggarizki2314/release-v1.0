/**
 * Test: Position & History Comment Lifecycle with Clean CloseReason Separation
 */

import { tradingEngine } from '../../TradingEngineService';

async function runTest() {
  console.log('=== Test: Position & History Comment Lifecycle ===');

  await tradingEngine.initializeSession({
    id: 'test-comment-session',
    initialBalance: 100000,
  } as any);

  // 1. Place order with initial comment
  const initialComment = 'Break of Structure M15';
  const orderRes = tradingEngine.placeOrder({
    symbol: 'EURUSD',
    type: 'BUY_MARKET',
    volume: 1.0,
    entryPrice: 1.1000,
    stopLoss: 1.0950,
    takeProfit: 1.1150,
    comment: initialComment,
  });

  const posId = orderRes.position!.positionId;
  const pos = tradingEngine.getOpenPositions().find((p) => p.positionId === posId);
  if (!pos || pos.comment !== initialComment) {
    throw new Error(`Expected pos.comment to be "${initialComment}", got "${pos?.comment}"`);
  }
  console.log('✓ Step 1: Position opened with comment:', pos.comment);

  // 2. Modify position comment
  const updatedComment = 'Adjusted: Swept Asian Low';
  tradingEngine.updatePositionComment(posId, updatedComment);
  const posModified = tradingEngine.getOpenPositions().find((p) => p.positionId === posId);
  if (!posModified || posModified.comment !== updatedComment) {
    throw new Error(`Expected pos.comment to be "${updatedComment}", got "${posModified?.comment}"`);
  }
  console.log('✓ Step 2: Position comment modified to:', posModified.comment);

  // 3. Close position manually and check history
  const closed = tradingEngine.closePosition(posId, 1.1050);
  if (!closed) {
    throw new Error('Failed to close position');
  }

  const history = tradingEngine.getTradeHistory();
  const tradeRecord = history.find((h) => h.positionId === posId);
  if (!tradeRecord || tradeRecord.comment !== updatedComment) {
    throw new Error(`Expected history comment to be "${updatedComment}", got "${tradeRecord?.comment}"`);
  }
  if (tradeRecord.closeReason !== 'MANUAL') {
    throw new Error(`Expected closeReason to be "MANUAL", got "${tradeRecord.closeReason}"`);
  }
  console.log('✓ Step 3: Closed position carried clean comment & closeReason:', {
    comment: tradeRecord.comment,
    closeReason: tradeRecord.closeReason,
  });

  // 4. Update comment directly on history
  const postReviewComment = 'Post-trade review: Good R:R execution';
  tradingEngine.updateHistoryComment(tradeRecord.tradeId, postReviewComment);
  const reviewedTrade = tradingEngine.getTradeHistory().find((h) => h.tradeId === tradeRecord.tradeId);
  if (!reviewedTrade || reviewedTrade.comment !== postReviewComment) {
    throw new Error(`Expected trade comment to be "${postReviewComment}", got "${reviewedTrade?.comment}"`);
  }
  if (reviewedTrade.closeReason !== 'MANUAL') {
    throw new Error(`Expected closeReason to remain "MANUAL", got "${reviewedTrade.closeReason}"`);
  }
  console.log('✓ Step 4: History trade comment successfully updated to:', reviewedTrade.comment);

  // 5. Test TP Trigger: comment remains pure user note, closeReason is 'TP'
  const tpOrderRes = tradingEngine.placeOrder({
    symbol: 'EURUSD',
    type: 'BUY_MARKET',
    volume: 1.0,
    entryPrice: 1.1000,
    stopLoss: 1.0900,
    takeProfit: 1.1020,
    comment: 'Setup targeting Asian High',
  });

  const tpPosId = tpOrderRes.position!.positionId;
  // Trigger TP via tick
  tradingEngine.processTick('EURUSD', 1.1010, 1.1030, 1.1005, 1.1025, Date.now() + 1000);

  const tpTrade = tradingEngine.getTradeHistory().find((h) => h.positionId === tpPosId);
  if (!tpTrade) {
    throw new Error('Expected TP trade to be archived in history');
  }
  if (tpTrade.comment !== 'Setup targeting Asian High') {
    throw new Error(`Expected clean comment without "(TP Hit)" text, got: "${tpTrade.comment}"`);
  }
  if (tpTrade.closeReason !== 'TP') {
    throw new Error(`Expected closeReason to be "TP", got: "${tpTrade.closeReason}"`);
  }
  console.log('✓ Step 5: TP Hit trade has pure user note & separate closeReason:', {
    comment: tpTrade.comment,
    closeReason: tpTrade.closeReason,
  });

  // 6. User edits note on TP trade — closeReason remains TP!
  tradingEngine.updateHistoryComment(tpTrade.tradeId, 'Reflected: Target reached smoothly');
  const tpTradeEdited = tradingEngine.getTradeHistory().find((h) => h.tradeId === tpTrade.tradeId);
  if (tpTradeEdited?.comment !== 'Reflected: Target reached smoothly' || tpTradeEdited?.closeReason !== 'TP') {
    throw new Error('Editing note should not affect closeReason');
  }
  console.log('✓ Step 6: Edited note preserved closeReason TP:', {
    comment: tpTradeEdited.comment,
    closeReason: tpTradeEdited.closeReason,
  });

  console.log('=== All Comment & CloseReason Tests Passed Successfully! ===');
}

runTest().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
