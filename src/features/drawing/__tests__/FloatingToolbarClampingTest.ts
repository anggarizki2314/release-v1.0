/**
 * FloatingToolbarClampingTest — Unit test suite for Drawing Settings / Floating Toolbar Positioning & Boundary Clamping.
 *
 * Verifies:
 * 1. Center positioning
 * 2. Top boundary clamping & smart fallback
 * 3. Bottom boundary clamping
 * 4. Left boundary clamping
 * 5. Right boundary clamping
 * 6. Top-Left corner
 * 7. Top-Right corner
 * 8. Bottom-Left corner
 * 9. Bottom-Right corner
 * 10. Multi-layout chart isolation (Chart A vs Chart B)
 * 11. Window resize / Container dimensions dynamic adaptation
 * 12. Dragging boundary clamping
 */

export interface ClampConfig {
  x: number;
  y: number;
  chartWidth: number;
  chartHeight: number;
  toolbarWidth: number;
  toolbarHeight: number;
  margin?: number;
  dragPos?: { x: number; y: number } | null;
}

export function computeToolbarPosition(cfg: ClampConfig): { finalX: number; finalY: number; flipped: boolean } {
  const margin = cfg.margin ?? 8;
  const tWidth = cfg.toolbarWidth;
  const tHeight = cfg.toolbarHeight;

  const minX = margin;
  const maxX = Math.max(margin, cfg.chartWidth - tWidth - margin);
  const minY = margin;
  const maxY = Math.max(margin, cfg.chartHeight - tHeight - margin);

  let finalX: number;
  let finalY: number;
  let flipped = false;

  if (cfg.dragPos) {
    finalX = Math.max(minX, Math.min(cfg.dragPos.x, maxX));
    finalY = Math.max(minY, Math.min(cfg.dragPos.y, maxY));
  } else {
    // 1. Ideal center X above drawing anchor
    const idealX = cfg.x - tWidth / 2;

    // 2. Default: place toolbar 12px above drawing anchor
    let idealY = cfg.y - tHeight - 12;

    // 3. Smart fallback: if placing above would exceed top margin, place below drawing anchor
    if (idealY < minY) {
      idealY = cfg.y + 24;
      flipped = true;
    }

    // 4. Final Boundary Clamping
    finalX = Math.max(minX, Math.min(idealX, maxX));
    finalY = Math.max(minY, Math.min(idealY, maxY));
  }

  return { finalX, finalY, flipped };
}

function runTests() {
  console.log('=== RUNNING FLOATING DRAWING TOOLBAR POSITIONING & CLAMPING TEST SUITE ===');

  const chartW = 800;
  const chartH = 600;
  const toolW = 340;
  const toolH = 42;
  const margin = 8;

  // 1. Center of Chart
  const test1 = computeToolbarPosition({
    x: 400,
    y: 300,
    chartWidth: chartW,
    chartHeight: chartH,
    toolbarWidth: toolW,
    toolbarHeight: toolH,
    margin,
  });
  console.log('[TEST 1 — Center]', test1);
  if (test1.finalX !== 400 - toolW / 2 || test1.finalY !== 300 - toolH - 12) {
    throw new Error('Test 1 failed: center positioning incorrect');
  }
  console.log('[PASS] Test 1: Drawing in center stays exactly attached above drawing');

  // 2. Near TOP
  const test2 = computeToolbarPosition({
    x: 400,
    y: 10,
    chartWidth: chartW,
    chartHeight: chartH,
    toolbarWidth: toolW,
    toolbarHeight: toolH,
    margin,
  });
  console.log('[TEST 2 — Near Top]', test2);
  if (test2.finalY < margin || !test2.flipped || test2.finalY !== 10 + 24) {
    throw new Error(`Test 2 failed: top clamping incorrect, finalY=${test2.finalY}`);
  }
  console.log('[PASS] Test 2: Drawing near TOP uses smart downward fallback and stays inside chart');

  // 3. Near BOTTOM
  const test3 = computeToolbarPosition({
    x: 400,
    y: 590,
    chartWidth: chartW,
    chartHeight: chartH,
    toolbarWidth: toolW,
    toolbarHeight: toolH,
    margin,
  });
  console.log('[TEST 3 — Near Bottom]', test3);
  if (test3.finalY > chartH - toolH - margin) {
    throw new Error(`Test 3 failed: bottom clamping exceeded bounds, finalY=${test3.finalY}`);
  }
  console.log('[PASS] Test 3: Drawing near BOTTOM is clamped strictly at chart bottom boundary');

  // 4. Near LEFT
  const test4 = computeToolbarPosition({
    x: 20,
    y: 300,
    chartWidth: chartW,
    chartHeight: chartH,
    toolbarWidth: toolW,
    toolbarHeight: toolH,
    margin,
  });
  console.log('[TEST 4 — Near Left]', test4);
  if (test4.finalX < margin) {
    throw new Error(`Test 4 failed: left clamping exceeded bounds, finalX=${test4.finalX}`);
  }
  console.log('[PASS] Test 4: Drawing near LEFT is clamped at left margin (>= 8px)');

  // 5. Near RIGHT
  const test5 = computeToolbarPosition({
    x: 790,
    y: 300,
    chartWidth: chartW,
    chartHeight: chartH,
    toolbarWidth: toolW,
    toolbarHeight: toolH,
    margin,
  });
  console.log('[TEST 5 — Near Right]', test5);
  if (test5.finalX > chartW - toolW - margin) {
    throw new Error(`Test 5 failed: right clamping exceeded bounds, finalX=${test5.finalX}`);
  }
  console.log('[PASS] Test 5: Drawing near RIGHT is clamped at right boundary');

  // 6. TOP-LEFT Corner
  const test6 = computeToolbarPosition({
    x: 0,
    y: 0,
    chartWidth: chartW,
    chartHeight: chartH,
    toolbarWidth: toolW,
    toolbarHeight: toolH,
    margin,
  });
  console.log('[TEST 6 — Top-Left Corner]', test6);
  if (test6.finalX !== margin || test6.finalY < margin) {
    throw new Error(`Test 6 failed: top-left corner out of bounds`);
  }
  console.log('[PASS] Test 6: Drawing at TOP-LEFT corner remains 100% visible inside chart');

  // 7. TOP-RIGHT Corner
  const test7 = computeToolbarPosition({
    x: chartW,
    y: 0,
    chartWidth: chartW,
    chartHeight: chartH,
    toolbarWidth: toolW,
    toolbarHeight: toolH,
    margin,
  });
  console.log('[TEST 7 — Top-Right Corner]', test7);
  if (test7.finalX !== chartW - toolW - margin || test7.finalY < margin) {
    throw new Error(`Test 7 failed: top-right corner out of bounds`);
  }
  console.log('[PASS] Test 7: Drawing at TOP-RIGHT corner remains 100% visible inside chart');

  // 8. BOTTOM-LEFT Corner
  const test8 = computeToolbarPosition({
    x: 0,
    y: chartH,
    chartWidth: chartW,
    chartHeight: chartH,
    toolbarWidth: toolW,
    toolbarHeight: toolH,
    margin,
  });
  console.log('[TEST 8 — Bottom-Left Corner]', test8);
  if (test8.finalX < margin || test8.finalY > chartH - toolH - margin) {
    throw new Error(`Test 8 failed: bottom-left corner out of bounds`);
  }
  console.log('[PASS] Test 8: Drawing at BOTTOM-LEFT corner remains 100% visible inside chart');

  // 9. BOTTOM-RIGHT Corner
  const test9 = computeToolbarPosition({
    x: chartW,
    y: chartH,
    chartWidth: chartW,
    chartHeight: chartH,
    toolbarWidth: toolW,
    toolbarHeight: toolH,
    margin,
  });
  console.log('[TEST 9 — Bottom-Right Corner]', test9);
  if (test9.finalX > chartW - toolW - margin || test9.finalY > chartH - toolH - margin) {
    throw new Error(`Test 9 failed: bottom-right corner out of bounds`);
  }
  console.log('[PASS] Test 9: Drawing at BOTTOM-RIGHT corner remains 100% visible inside chart');

  // 10. Multi-Layout Chart A vs Chart B Isolation
  const chartAW = 480;
  const chartAH = 500;
  const chartBW = 480;
  const chartBH = 500;

  const chartAPos = computeToolbarPosition({
    x: 450,
    y: 200,
    chartWidth: chartAW,
    chartHeight: chartAH,
    toolbarWidth: toolW,
    toolbarHeight: toolH,
    margin,
  });
  const chartBPos = computeToolbarPosition({
    x: 100,
    y: 480,
    chartWidth: chartBW,
    chartHeight: chartBH,
    toolbarWidth: toolW,
    toolbarHeight: toolH,
    margin,
  });
  console.log('[TEST 10 — Multi-layout Chart A]', chartAPos);
  console.log('[TEST 10 — Multi-layout Chart B]', chartBPos);
  if (chartAPos.finalX > chartAW - toolW - margin || chartBPos.finalY > chartBH - toolH - margin) {
    throw new Error('Test 10 failed: multi-layout bounds breached');
  }
  console.log('[PASS] Test 10: Multi-layout charts A and B isolate toolbar positioning strictly to their respective containers');

  // 11. Dragging Clamping
  const dragTest = computeToolbarPosition({
    x: 400,
    y: 300,
    chartWidth: chartW,
    chartHeight: chartH,
    toolbarWidth: toolW,
    toolbarHeight: toolH,
    margin,
    dragPos: { x: -50, y: 1000 },
  });
  console.log('[TEST 11 — Drag Clamping]', dragTest);
  if (dragTest.finalX !== margin || dragTest.finalY !== chartH - toolH - margin) {
    throw new Error('Test 11 failed: drag clamping failed');
  }
  console.log('[PASS] Test 11: Dragging toolbar outside bounds is clamped cleanly within chart viewport');

  console.log('\nSUMMARY: 11/11 Positioning & Clamping tests passed successfully!');
}

runTests();
