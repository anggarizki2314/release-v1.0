#!/bin/bash

# HARI KE-7 REPLAY ENGINE — TESTING GUIDE

## QUICK START

### 1. Type Check
```bash
npm run typecheck
```

Expected: 0 errors

### 2. Run Tests di Dev Console

Buka developer tools (F12) di aplikasi Electron, tab Console, jalankan:

```javascript
// Import test runner
import { runAllTests } from '@features/replay/testUtils'

// Run semua tests
runAllTests()

// Output akan show: "RESULTS: 7 passed, 0 failed"
```

### 3. Test Individual Features

#### Test State Transitions
```javascript
import { testStateTransitions } from '@features/replay/testUtils'
testStateTransitions()
```

#### Test Start Point Detection
```javascript
import { testStartPointDetection } from '@features/replay/testUtils'
testStartPointDetection()
```

#### Test Dataset Separation
```javascript
import { testDatasetSeparation } from '@features/replay/testUtils'
testDatasetSeparation()
```

#### Test Data View Filtering
```javascript
import { testDataViewFiltering } from '@features/replay/testUtils'
testDataViewFiltering()
```

#### Test Progress Calculation
```javascript
import { testProgressCalculation } from '@features/replay/testUtils'
testProgressCalculation()
```

#### Test Nearest Candle Finding
```javascript
import { testNearestCandleFinding } from '@features/replay/testUtils'
testNearestCandleFinding()
```

#### Test Time Range Calculation
```javascript
import { testTimeRangeCalculation } from '@features/replay/testUtils'
testTimeRangeCalculation()
```

---

## MANUAL TESTING

### Test 1: Symbol Switching dalam Replay Mode

1. Import data XAUUSD (atau symbol lain)
2. Buka console dan jalankan:
   ```javascript
   import { ReplayEngine } from '@features/replay'
   import { createMockCandles } from '@features/replay/testUtils'
   
   const candles = createMockCandles(100)
   const engine = new ReplayEngine()
   engine.initialize({
     symbolId: 1,
     symbol: 'XAUUSD',
     timeframe: 'M1',
     allCandles: candles,
     replayStartIndex: 0
   })
   
   console.log('Engine state:', engine.getReplayState())
   console.log('Status:', engine.getStatus()) // should be 'ready'
   ```

3. Switch to symbol lain dari UI (TopBar)
4. Engine harus automatically reset ketika symbol/timeframe berubah
5. Verify tidak ada data mixing

### Test 2: Timeframe Switching

1. Start dengan M1 chart
2. Setup replay engine dengan M1 candles
3. Switch to M5 (TopBar dropdown)
4. Engine harus reset dan siap re-initialize dengan M5 data
5. Verify state transition smooth tanpa errors

### Test 3: Historical vs Future Candles Separation

```javascript
import { separateDataset, createMockCandles } from '@features/replay/testUtils'

const candles = createMockCandles(10, 1000, 60)
const separated = separateDataset(candles, 3)

console.log('Historical:', separated.historicalContext.length)  // should be 3
console.log('Start candle:', separated.visibleStartCandle.time)
console.log('Future:', separated.futureReplayData.length)        // should be 6
```

### Test 4: Progress Tracking

```javascript
import { ReplayEngine, createMockCandles } from '@features/replay'

const candles = createMockCandles(100)
const engine = new ReplayEngine()
engine.initialize({
  symbolId: 1,
  symbol: 'TEST',
  timeframe: 'M1',
  allCandles: candles,
  replayStartIndex: 0
})

engine.setCurrentIndex(0)
console.log('At start:', engine.getProgressPercentage(), '%')  // ~1%

engine.setCurrentIndex(50)
console.log('At middle:', engine.getProgressPercentage(), '%') // ~51%

engine.setCurrentIndex(99)
console.log('At end:', engine.getProgressPercentage(), '%')    // 100%
```

### Test 5: Database Integrity After Replay

1. Setup replay dengan dataset tertentu
2. Initialize engine multiple times
3. Run typecheck: `npm run typecheck`
4. Import data lagi → should work fine
5. Chart normal mode → should work fine
6. Verify no data corruption

---

## TESTING CHECKLIST

- [ ] Type check: 0 errors (`npm run typecheck`)
- [ ] All 7 test suites pass (`runAllTests()`)
- [ ] State transitions work correctly
- [ ] Start point detection accurate
- [ ] Dataset separation correct (historical vs future)
- [ ] Data view filtering works
- [ ] Progress calculation accurate
- [ ] Nearest candle finding works with binary search
- [ ] Time range calculation correct
- [ ] Symbol switching doesn't mix data
- [ ] Timeframe switching resets engine safely
- [ ] Database still has all original data (unchanged)
- [ ] Import still works after replay engine active
- [ ] Chart normal mode still works
- [ ] No console errors or warnings
- [ ] Type definitions complete and exported

---

## EXPECTED TEST OUTPUT

```
╔═══════════════════════════════════════╗
║   REPLAY ENGINE - HARI 7 VALIDATION   ║
╚═══════════════════════════════════════╝

=== TEST 1: State Transitions ===
Initial status: idle
After initialize: ready
After play: playing
After pause: paused
After play again: playing
After move to end: finished
✓ State transitions test passed

=== TEST 2: Start Point Detection ===
First index: 0
Last index: 6
Midpoint index: 3
Timestamp index (exact match): 3
Timestamp index (nearest): 2
✓ Start point detection test passed

=== TEST 3: Dataset Separation ===
Historical candles: 3
Start candle time: 1180
Future candles: 3
Total candles: 7
✓ Dataset separation test passed

=== TEST 4: Data View Filtering ===
At index 0 - Historical: 1
At index 5 - Historical: 6
At index 5 - Future: 4
✓ Data view filtering test passed

=== TEST 5: Progress Calculation ===
Progress at start: 1 %
Progress at 50: 51 %
Progress at end: 100 %
✓ Progress calculation test passed

=== TEST 6: Nearest Candle Finding ===
Exact match (1060): 1
Between 1 and 2, closer to 2 (1090): 1
Before all (500): 0
After all (9999): 9
✓ Nearest candle finding test passed

=== TEST 7: Time Range Calculation ===
First time: 1000
Last time: 1540
Duration: 540 seconds
✓ Time range calculation test passed

╔═══════════════════════════════════════╗
║  RESULTS: 7 passed, 0 failed       ║
╚═══════════════════════════════════════╝
```

---

## TROUBLESHOOTING

### "ReplayEngine not initialized" error
- Engine harus di-initialize sebelum call methods
- Check apakah `allCandles` tidak kosong
- Check apakah `replayStartIndex` valid (0 sampai length-1)

### State tidak berubah setelah call play()/pause()
- Check engine status dengan `engine.getStatus()`
- Pastikan sudah initialize terlebih dahulu
- Verify tidak ada try-catch yang silent fail

### Test failed
- Run individual test untuk isolate issue
- Check console untuk error messages
- Verify mock data generation dengan `createMockCandles()`

### Type errors
- Run: `npm run typecheck`
- Fix semua type errors sebelum lanjut

---

## NEXT STEPS (HARI 8+)

Fondasi Hari 7 siap untuk:

1. **Implement Play Loop** (Hari 8)
   - Use `requestAnimationFrame` atau `setInterval`
   - Call `setCurrentIndex()` untuk step forward
   - Stop ketika `isFinished()` true

2. **Speed Control** (Hari 8)
   - Adjust step interval berdasarkan speed multiplier
   - 1x = normal speed, 2x = double speed, etc

3. **Chart Auto-Follow** (Hari 8)
   - Monitor `currentReplayTime` dari `replayState`
   - Call chart's `focusRange()` untuk viewport positioning

4. **UI Integration** (Hari 8+)
   - Wire FloatingReplayBar play/pause buttons
   - Implement date picker untuk start point selection
   - Show replay progress bar/slider

5. **Trading Simulation** (Hari 9+)
   - Use `visibleCandle` dari `getDataView()`
   - Never look at future candles untuk avoid lookahead bias
