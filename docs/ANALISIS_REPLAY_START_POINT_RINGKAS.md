# RINGKASAN ANALISIS REPLAY START POINT

## JAWABAN SINGKAT UNTUK 8 PERTANYAAN

| # | Pertanyaan | Jawaban | Status |
|---|-----------|--------|--------|
| 1 | Apakah `replayStartTime` sudah ada? | ✅ YA | `ReplayState.replayStartTime: number \| null` |
| 2 | Apakah `currentReplayTime` sudah ada? | ✅ YA | `ReplayState.currentReplayTime: number \| null` |
| 3 | Apakah engine memiliki konsep start point? | ✅ YA | Via `ReplayEngineConfig.replayStartIndex` |
| 4 | Apakah ada fungsi untuk memilih/mengatur? | ✅ YA | 4 fungsi: find, nearest, parse, significant-dates |
| 5 | Apakah FloatingReplayBar punya kontrol tanggal/waktu? | ❌ TIDAK | Hanya play/pause/speed/timeframe |
| 6 | Apakah tanggal sengaja dihapus dari UI? | ✅ YA | Dihapus untuk fokus pada scope Hari 7 |
| 7 | File mana yang mengatur start point? | Lihat dibawah | Logic ada, UI belum |
| 8 | Apa yang masih harus dibuat? | Lihat dibawah | UI integration untuk Hari 8+ |

---

## QUICK FACTS

### ✅ Yang Sudah Ada (Logic Layer)

```typescript
// 1. ReplayState memiliki:
replayStartTime: number | null    // Timestamp dimulainya replay
currentReplayTime: number | null  // Timestamp candle saat ini

// 2. ReplayEngine menerima:
interface ReplayEngineConfig {
  replayStartIndex: number  // Index (0-based) dimulai dari candle mana
}

// 3. Start point utilities siap pakai:
findReplayStartPointIndex()       // Strategy: first/last/midpoint/timestamp
findNearestCandleIndex()          // Binary search O(log n)
parseAndFindStartPoint()          // Parse date string → index
getSignificantDates()             // Generate dates untuk dropdown
```

### ❌ Yang Belum Ada (UI Layer)

```typescript
// 1. TopBar date picker:
// Saat ini: hardcoded "2024-01-02", tidak interactive
// Dibutuhkan: connect ke parseAndFindStartPoint()

// 2. FloatingReplayBar:
// Saat ini: hanya play/pause/speed/timeframe
// Dibutuhkan: maybe show current vs start time

// 3. AppShell:
// Saat ini: no replay integration
// Dibutuhkan: wrap dengan ReplayProvider

// 4. useReplayEngine:
// Saat ini: hardcoded replayStartIndex: 0
// Dibutuhkan: accept dynamic start index parameter
```

---

## FILE LOCATIONS

### Logic (✅ READY):

**`src/features/replay/types.ts`**
- Line 11: `replayStartTime: number | null`
- Line 12: `currentReplayTime: number | null`

**`src/features/replay/engine.ts`**
- Line 4-10: `ReplayEngineConfig` with `replayStartIndex`
- Line 91: Compute `replayStartTime` from candle
- Line 102: Track `currentReplayTime`

**`src/features/replay/replayStartPoint.ts`**
- Line 34: `findReplayStartPointIndex()` - 4 strategies
- Line 72: `findNearestCandleIndex()` - binary search

**`src/features/replay/startPointHelpers.ts`**
- Line 15: `parseAndFindStartPoint()` - date parsing
- Line 106: `getSignificantDates()` - date list

**`src/features/replay/ReplayContext.tsx`**
- Line 60: `setReplayStartPoint()` - placeholder (console.log only)

### UI (❌ NOT INTEGRATED):

**`src/components/layout/TopBar.tsx`**
- Line 131-134: Date button hardcoded "2024-01-02"
- No onClick, no integration

**`src/components/layout/FloatingReplayBar.tsx`**
- Lines 38-80: No date/time state or UI

**`src/features/replay/useReplayEngine.ts`**
- Line 44: `replayStartIndex: 0` hardcoded

---

## CURRENT BEHAVIOR

**Saat aplikasi dijalankan:**

1. Engine initialize dengan `replayStartIndex: 0`
2. `replayStartTime` diset ke timestamp candle pertama
3. `currentReplayTime` diset ke timestamp candle pertama (saat initialization)
4. User melihat replay mulai dari candle pertama
5. **User TIDAK bisa memilih start point berbeda**

**Topbar date button:**
- Visual only (placeholder)
- Shows "2024-01-02" (hardcoded)
- Tidak ada functionality

---

## IMPLEMENTASI UNTUK HARI 8+

### Priority 1: Wire TopBar Date Picker

```typescript
// Pseudo-code untuk implementasi:

function TopBar() {
  const { setReplayStartPoint } = useReplay()
  const [selectedDate, setSelectedDate] = useState('')

  const handleDateSelect = (dateStr: string) => {
    const index = parseAndFindStartPoint(dateStr, allCandles)
    if (index !== null) {
      setReplayStartPoint('timestamp', allCandles[index].time)
    }
  }

  return (
    <input 
      type="date" 
      onChange={(e) => handleDateSelect(e.target.value)}
    />
  )
}
```

### Priority 2: Implement setReplayStartPoint()

```typescript
// Current (placeholder):
const setReplayStartPoint = useCallback(
  (strategy: 'first' | 'last' | 'midpoint' | 'timestamp', timestamp?: number) => {
    console.log('setReplayStartPoint:', { strategy, timestamp });
  },
  []
);

// Should be (pseudocode):
const setReplayStartPoint = useCallback(
  (strategy: 'first' | 'last' | 'midpoint' | 'timestamp', timestamp?: number) => {
    const index = findReplayStartPointIndex(allCandles, {
      strategy,
      targetTimestamp: timestamp
    })
    
    // Re-initialize engine dengan new start index
    engine.reset()
    engine.initialize({
      symbolId,
      symbol,
      timeframe,
      allCandles,
      replayStartIndex: index  // ← NEW
    })
    
    setReplayState(engine.getReplayState())
  },
  [allCandles, symbolId, symbol, timeframe]
);
```

### Priority 3: Enhance useReplayEngine

```typescript
// Should accept optional startIndex parameter:
export function useReplayEngine(
  symbolId: number | null,
  symbol: string | null,
  timeframe: Timeframe | null,
  allCandles: Candle[],
  replayStartIndex?: number  // ← ADD THIS
) {
  // Then use it:
  engine.initialize({
    ...
    replayStartIndex: replayStartIndex ?? 0,  // Default to 0
  })
}
```

---

## KESIMPULAN

### Current State (Hari 7):
- ✅ Replay Start Point logic 100% complete
- ✅ All helper functions ready
- ✅ ReplayState has timestamps
- ✅ Engine accepts start index
- ❌ UI picker not wired
- ❌ Always starts from index 0

### What's Needed (Hari 8+):
1. Wire TopBar date picker → `parseAndFindStartPoint()`
2. Implement `setReplayStartPoint()` in ReplayContext
3. Enhance `useReplayEngine` to accept dynamic start index
4. Re-initialize engine when start point changes
5. Maybe show "Replay from: [date]" indicator in UI

### Effort to Complete:
- **UI Integration:** ~2-3 hours
- **Testing:** ~1-2 hours
- **Total:** ~3-5 hours (Hari 8 morning)

### Status:
**"Infrastructure complete. Just need to plug UI into engine logic."**

---

**Analysis Complete — No files modified.**

Generated: 19 July 2026, 14:52 UTC
