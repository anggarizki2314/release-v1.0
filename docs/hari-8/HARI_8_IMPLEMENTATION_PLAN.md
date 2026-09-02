# HARI KE-8 — CHART CURSOR REPLAY START POINT — RENCANA IMPLEMENTASI

## ANALISIS INFRASTRUCTURE YANG ADA

### 1. ChartContainer
- ✅ Chart instance dibuat sekali (line 120-184)
- ✅ Series candlestick sudah ada (line 153-160)
- ✅ Crosshair sudah dikonfigurasi (line 135-138)
- ✅ Event `subscribeVisibleLogicalRangeChange` sudah dipakai (line 176)
- ❌ Belum ada `subscribeCrosshairMove` handler
- ❌ Belum ada click handler untuk mouse

### 2. Lightweight Charts API
Lightweight Charts menyediakan:
- `chart.subscribeCrosshairMove(param)` - untuk tracking cursor position
- `chart.subscribeClick(param)` - untuk left click
- Parameter includes: `point` (pixel position) dan `time` (unix timestamp)

### 3. Data Flow Saat Ini
```
Database → useCandles() → candles array → ChartContainer.setData() → Chart
```

### 4. Replay Infrastructure (Hari 7)
- ✅ `findNearestCandleIndex(candles, targetTime)` - binary search
- ✅ `ReplayContext.setReplayStartPoint()` - placeholder
- ✅ `ReplayState.replayStartTime` - property
- ✅ `useReplay()` hook - global access

---

## IMPLEMENTASI STRATEGY

### Step 1: Create Cursor Tracker State
File baru: `src/features/chart/useCursorCandle.ts`

Track:
- Current cursor position timestamp
- Nearest candle index
- Preview candle data

### Step 2: Add Chart Events
Update: `src/components/chart/ChartContainer.tsx`

Add:
- `subscribeCrosshairMove()` handler
- `subscribeClick()` handler
- Reference ke nearest candle

### Step 3: Create UI Preview Component
File baru: `src/components/chart/CursorPreview.tsx`

Display:
- Timestamp dari cursor position
- Candle info (date, time)
- Visual indicator

### Step 4: Integrate with Replay Engine
Update: `src/features/replay/ReplayContext.tsx`

Implement:
- `setReplayStartPoint()` properly
- Re-initialize engine dengan new index
- Handle state updates

### Step 5: Wire Everything Together
Update: `src/components/chart/ChartContainer.tsx`

Connect:
- Cursor move → track nearest candle
- Click → call setReplayStartPoint()
- Hide future candles

---

## IMPLEMENTATION DETAIL

### Cursor Position to Timestamp

Lightweight Charts event param memberikan:
```typescript
{
  point?: SeriesPoint;
  time?: number;  // ← Unix seconds (UTC timestamp)
  logical?: number;  // ← Index dalam data array
}
```

Gunakan `time` langsung sebagai timestamp candle.

### Finding Nearest Candle

Use existing function:
```typescript
import { findNearestCandleIndex } from '@features/replay'

const index = findNearestCandleIndex(allCandles, cursorTimestamp)
const candleAtCursor = allCandles[index]
```

### Preview vs Commit

**Preview (mousemove):**
- Show timestamp preview
- Track nearest candle
- Don't change engine state

**Commit (click):**
- Call `setReplayStartPoint()`
- Re-initialize engine
- Hide future candles

### Future Data Hiding

Use existing mechanism:
```typescript
import { useChartFilteredCandles } from '@features/replay'

const filtered = useChartFilteredCandles(allCandles, isReplayMode, currentIndex)
series.setData(filtered)
```

---

## FILE STRUCTURE

### New Files:
1. `src/features/chart/useCursorCandle.ts` - Hook untuk track cursor
2. `src/components/chart/CursorPreview.tsx` - Preview UI component

### Modified Files:
1. `src/components/chart/ChartContainer.tsx` - Add event handlers
2. `src/features/replay/ReplayContext.tsx` - Implement setReplayStartPoint()
3. `src/components/layout/MainChartArea.tsx` - Maybe add UI wrapper

---

## EVENT HANDLING FLOW

```
User moves mouse over chart
    ↓
subscribeCrosshairMove() fires
    ↓
Get timestamp dari event.time
    ↓
findNearestCandleIndex(allCandles, timestamp)
    ↓
Get nearest candle + index
    ↓
Store dalam useCursorCandle state
    ↓
Show preview (date/time)
    ↓
User sees: "15 Jun 10:03"

User clicks left button
    ↓
subscribeClick() fires
    ↓
Get timestamp dari click event
    ↓
Call setReplayStartPoint('timestamp', timestamp)
    ↓
Engine re-initialize dengan new replayStartIndex
    ↓
replayState updated
    ↓
Chart filters candles (hide future)
    ↓
Replay ready dari candle tersebut
```

---

## VALIDATION TESTS

### TEST 1: Cursor Timestamp
- Move cursor ke berbagai candle
- Verify timestamp ditampilkan benar
- Check date/hour/minute format

### TEST 2: Click Sets Start Point
- Gerakkan cursor
- Klik kiri
- Verify replayStartTime updated
- Verify future candles hidden

### TEST 3: Timeframe Switching
- Set start point pada M1
- Switch ke M5
- Verify nearest candle dihitung untuk M5
- Verify tidak ada index mismatch

### TEST 4: Symbol Switching
- Set start point pada XAUUSD
- Switch ke EURUSD
- Verify clean state
- Verify tidak ada data tercampur

### TEST 5: Normal Chart Still Works
- Zoom/pan still works
- Reset Chart still works
- Mouse interaction tidak conflict
- Existing functionality not broken

---

## TIMELINE

### Phase 1: Setup (30 min)
- Create useCursorCandle hook
- Add event listeners ke chart

### Phase 2: Preview UI (30 min)
- Create CursorPreview component
- Display timestamp

### Phase 3: Integration (30 min)
- Wire click to setReplayStartPoint()
- Implement state changes

### Phase 4: Testing (60 min)
- Test all scenarios
- Fix edge cases
- Verify nothing broken

**Total: ~2.5 hours**

---

## ARCH NOTES

### Why Not Overlay?
- Lightweight Charts crosshair sudah ada
- Gunakan crosshair label untuk preview
- Minimal overhead, no duplication

### Why Not Date Picker?
- Per requirement: gunakan cursor
- Natural UI untuk chart interaction
- User dapat visualize data sambil memilih

### Why Store in Replay Context?
- Global access untuk AppShell
- Single source of truth
- Easy to persist later

---

**Status:** Ready untuk implementation. Mulai Phase 1.
