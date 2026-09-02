# HARI KE-8 — CHART CURSOR REPLAY START POINT — IMPLEMENTASI COMPLETE

## STATUS: ✅ IMPLEMENTATION DONE

Type-check: 0 errors ✅

---

## FASE YANG SELESAI

### Phase 1: Setup ✅
- Created `useCursorCandle.ts` hook
- Added event listeners ke chart
- Integrated cursor tracking

### Phase 2: Preview UI ✅
- Created `CursorPreview.tsx` component
- Added CSS styling
- Display timestamp preview

### Phase 3: Integration ✅
- Wire click to `setReplayStartPoint()`
- Implemented state changes in ReplayContext
- Connected engine re-initialization

### Phase 4: Testing (PENDING)
- Need to verify all scenarios work
- Test edge cases
- Ensure nothing broken

---

## FILE YANG DIBUAT

### New Files (3):
1. **`src/features/chart/useCursorCandle.ts`** (73 lines)
   - Hook untuk track cursor position
   - Find nearest candle index
   - Manage cursor state

2. **`src/components/chart/CursorPreview.tsx`** (40 lines)
   - Display timestamp preview
   - Date/time formatting
   - Visual preview component

3. **`src/components/chart/CursorPreview.css`** (37 lines)
   - Styling untuk preview overlay
   - Positioned near cursor
   - Dark theme matching

---

## FILE YANG DIUBAH

### Modified Files (3):

**1. `src/components/chart/ChartContainer.tsx`**
- Added import untuk `useCursorCandle` hook
- Added import untuk `useReplay` context
- Added import untuk `CursorPreview` component
- Added `useCursorCandle` hook usage
- Added `useReplay` hook usage
- Added `subscribeCrosshairMove` handler
- Added `subscribeClick` handler
- Render `<CursorPreview>` component
- Updated dependency array

**2. `src/features/replay/useReplayEngine.ts`**
- Added `setCustomReplayStartIndex` method
- Takes new start index as parameter
- Re-initializes engine dengan new start point
- Exports dari hook

**3. `src/features/replay/ReplayContext.tsx`**
- Imported `findNearestCandleIndex` utility
- Implemented `setReplayStartPoint()` properly
- Handles 4 strategies: first, last, midpoint, timestamp
- Calls `setCustomReplayStartIndex` pada engine
- Support untuk chart cursor click

---

## ALUR DATA - CHART CURSOR TO REPLAY START POINT

```
User moves mouse over chart
    ↓
Lightweight Charts fires subscribeCrosshairMove
    ↓
ChartContainer handleCrosshairMoveEvent called
    ↓
useCursorCandle.handleCrosshairMove(param)
    ↓
findNearestCandleIndex(allCandles, param.time)
    ↓
cursorState updated (timestamp, index, candle)
    ↓
CursorPreview renders timestamp

User clicks left button on chart
    ↓
Lightweight Charts fires subscribeClick
    ↓
ChartContainer handleClickEvent called
    ↓
setReplayStartPoint('timestamp', param.time) called
    ↓
ReplayContext.setReplayStartPoint implementation
    ↓
findNearestCandleIndex(allCandles, timestamp)
    ↓
Get newStartIndex
    ↓
setCustomReplayStartIndex(newStartIndex) called
    ↓
useReplayEngine re-initializes engine
    ↓
engine.reset()
    ↓
new ReplayEngine()
    ↓
engine.initialize({
    symbolId, symbol, timeframe, allCandles,
    replayStartIndex: newStartIndex  ← NEW
})
    ↓
engineRef updated
    ↓
setReplayState(engine.getReplayState())
    ↓
replayState updated
    ↓
replayStartTime = timestamp dari candle di newStartIndex
    ↓
Replay ready dari candle tersebut
```

---

## EVENT HANDLERS

### subscribeCrosshairMove
- Triggered: saat cursor bergerak di atas chart
- Data: `{ time?: number }` (unix seconds)
- Action: Update cursor state, show preview

### subscribeClick
- Triggered: saat user klik kiri pada chart
- Data: `{ time?: number }` (unix seconds)
- Action: Call setReplayStartPoint(), set engine start point

---

## CURSOR STATE STRUCTURE

```typescript
interface CursorCandleState {
  timestamp: number | null;     // Unix seconds dari cursor position
  candleIndex: number | null;   // Nearest candle index
  candle: Candle | null;        // Actual candle data
  isActive: boolean;            // Is cursor over chart
}
```

---

## REPLAY STATE AFTER CLICK

Saat user klik kiri pada candle tertentu:

**Before:**
```
replayStartTime: [timestamp candle pertama]
replayStartIndex: 0
currentReplayIndex: 0
```

**After (klik pada candle ke-50):**
```
replayStartTime: [timestamp candle ke-50]
replayStartIndex: 50
currentReplayIndex: 0 (offset dari start)
```

---

## INTEGRATION POINTS

### ChartContainer
- Uses `useCursorCandle` untuk track cursor
- Uses `useReplay` untuk set start point
- Renders `CursorPreview` untuk display

### ReplayContext
- Implements `setReplayStartPoint()` properly
- Calls `setCustomReplayStartIndex` pada engine
- Handles strategy logic (first/last/midpoint/timestamp)

### useReplayEngine
- New method: `setCustomReplayStartIndex(index)`
- Re-initializes engine dengan new start index
- Updates replay state

### useCursorCandle
- Tracks cursor position dari Lightweight Charts
- Finds nearest candle
- Provides state untuk UI

---

## TESTING CHECKLIST (TODO)

- [ ] TEST 1: Cursor Timestamp — Move cursor, verify timestamp displayed
- [ ] TEST 2: Left Click — Click, verify start point set
- [ ] TEST 3: Future Data Hidden — Click, verify future candles hidden
- [ ] TEST 4: Different Points — Select multiple points
- [ ] TEST 5: Timeframe Switching — Test M1, M5, M15, H1
- [ ] TEST 6: Symbol Switching — Change symbol, no data mixing
- [ ] TEST 7: Normal Chart — Zoom/pan/reset still work
- [ ] TEST 8: Exit Replay — All data available again
- [ ] TEST 9: Type Check — 0 errors

---

## KETERBATASAN HARI KE-8

TIDAK diimplementasikan (sesuai scope):
- ❌ Play loop (Hari 9)
- ❌ Pause functionality
- ❌ Next candle stepping
- ❌ Speed control
- ❌ Replay cursor/slider
- ❌ Buy/sell orders
- ❌ Trading simulation
- ❌ Position tracking
- ❌ Trading journal

---

## NOTES

### Cursor Preview Positioning
- CursorPreview menggunakan `fixed` positioning
- Akan follow cursor position dengan CSS
- Non-blocking (pointer-events: none)
- Minimal visual impact

### Binary Search
- `findNearestCandleIndex` sudah ada dari Hari 7
- O(log n) performance
- Handles edge cases (sebelum/sesudah semua candles)

### Replay Engine Re-initialization
- Engine reset sebelum init ulang
- Fresh instance untuk avoid state conflicts
- All data tetap di database (unchanged)

### Type Safety
- All imports properly typed
- useReplay hook has try-catch
- ReplayContext provides proper types

---

## NEXT PHASE (HARI 9+)

1. **Play Loop** — implement stepping through candles
2. **Speed Control** — multiply step interval by speed
3. **Auto-follow Viewport** — center on current candle
4. **UI Indicators** — show replay progress/status
5. **Trading Simulation** — order execution at current candle

---

## VERIFICATION

✅ Type-check: 0 errors
✅ All files created
✅ All modifications done
✅ Imports resolved
✅ Logic wired correctly

---

**Status: Ready for testing. Waiting for Hari 8 validation.**

Generated: 19 July 2026, 15:01 UTC
