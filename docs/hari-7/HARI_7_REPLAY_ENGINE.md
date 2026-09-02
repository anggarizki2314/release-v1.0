# HARI KE-7 — FONDASI REPLAY ENGINE

## RINGKASAN IMPLEMENTASI

Hari ke-7 berhasil membangun fondasi Replay Engine dengan struktur yang jelas dan terpisah dari chart/database logic.

### Struktur yang Dibangun

```
src/features/replay/
├── types.ts                    # ReplayState, ReplayStatus type definitions
├── engine.ts                   # Core ReplayEngine class logic
├── useReplayEngine.ts          # React hook untuk manage engine lifecycle
├── ReplayContext.tsx           # Global context provider
├── replayStartPoint.ts         # Utilities untuk menentukan start point
├── startPointHelpers.ts        # Helper untuk date/time parsing
├── useChartFilter.ts           # Hook untuk filter visible candles di chart
├── testUtils.ts                # Test utilities untuk validation
└── index.ts                    # Export semua module
```

---

## 1. REPLAY STATE MANAGEMENT

### ReplayState Interface
```typescript
ReplayState {
  isReplayMode: boolean
  status: 'idle' | 'ready' | 'playing' | 'paused' | 'finished'
  symbol: string | null
  symbolId: number | null
  timeframe: Timeframe | null
  replayStartTime: number | null
  currentReplayTime: number | null
  currentReplayIndex: number | null
  replayEndTime: number | null
  totalCandlesInReplay: number
}
```

### State Transitions
```
idle
  ↓
ready (setelah initialize dengan candles)
  ↓
playing (user click play)
  ↓
paused (user click pause)
  ↓
playing (user click play lagi)
  ↓
finished (reach end of data)
```

---

## 2. REPLAY ENGINE CORE (`engine.ts`)

### Fitur Utama

**Initialize:**
- Terima full dataset (`allCandles`) dan start index
- Validate bahwa start index valid (0 sampai length-1)
- Transition dari idle → ready

**Data Filtering:**
- `getDataView()` returns:
  - `historicalCandles`: candles 0 sampai current index
  - `visibleCandle`: candle pada current index
  - `futureCandles`: candles setelah current index
  
**State Control:**
- `play()`: ready/paused → playing
- `pause()`: playing → paused
- `setCurrentIndex()`: set posisi replay ke index tertentu
- `reset()`: kembali ke idle

**Progress Tracking:**
- `getProgressPercentage()`: 0-100% completion
- `isFinished()`: check apakah sudah di akhir

---

## 3. REACT INTEGRATION (`useReplayEngine.ts` + `ReplayContext.tsx`)

### Hook: `useReplayEngine`
- Manage engine instance lifecycle
- Auto-reset ketika symbol/timeframe/candles berubah
- Provide control methods ke UI

### Context: `ReplayProvider` + `useReplay`
- Global replay state untuk seluruh app
- Can wrap AppShell atau MainChartArea
- Provide: `replayState`, `play()`, `pause()`, `seekToIndex()`, `getDataView()`, etc.

---

## 4. MENENTUKAN REPLAY START POINT (`replayStartPoint.ts`)

### Strategies

1. **'first'** - Mulai dari candle pertama (index 0)
2. **'last'** - Mulai dari candle terakhir
3. **'midpoint'** - Mulai dari tengah dataset
4. **'timestamp'** - Mulai dari candle terdekat dengan timestamp target

### Utilities

**`findReplayStartPointIndex(candles, strategy)`**
- Tentukan index berdasarkan strategy

**`findNearestCandleIndex(candles, targetTime)`**
- Binary search untuk find candle terdekat dengan target time

**`separateDataset(candles, startIndex)`**
- Pisahkan dataset jadi:
  - Historical context (sebelum start)
  - Visible start candle
  - Future replay data (setelah start)

**`getDatasetTimeRange(candles)`**
- Return: first time, last time, duration (seconds)

---

## 5. HELPER UNTUK DATE/TIME (`startPointHelpers.ts`)

**`parseAndFindStartPoint(dateInput, candles)`**
- Parse date string atau unix seconds
- Find index terdekat

**Format yang di-support:**
- `"2023-01-15"` → 00:00 UTC
- `"2023-01-15 09:30"` → 09:30 UTC
- `"2023-01-15T09:30:00Z"` → ISO format
- Unix seconds (number)

**`unixSecondsToDateString(seconds, includeTime)`**
- Convert unix seconds ke readable format

**`getSignificantDates(candles, maxPoints)`**
- Get list tanggal-tanggal penting dalam dataset
- Smart interval selection (hourly/daily/weekly tergantung duration)
- Untuk populate date picker di TopBar

---

## 6. CHART FILTERING (`useChartFilter.ts`)

### Hook: `useChartFilteredCandles`
```typescript
useChartFilteredCandles(allCandles, isReplayMode, currentReplayIndex)
  → returns: Candle[] (filtered untuk display)
```

**Behavior:**
- Jika replay mode OFF: return semua candles (normal operation)
- Jika replay mode ON: return hanya candles 0 sampai currentIndex

**Penting:**
- Database tetap punya semua data
- Filtering pure di React (melalui useMemo)
- Future candles masih ada di memory, cuma tidak dirender

---

## 7. VALIDASI & TESTING

### Test Utils (`testUtils.ts`)

**Tersedia 7 test suites:**

1. **testStateTransitions()** ✓
   - Validate: idle → ready → playing → paused → playing → finished

2. **testStartPointDetection()** ✓
   - Validate: first, last, midpoint, timestamp strategies

3. **testDatasetSeparation()** ✓
   - Validate: historical vs future candles separation

4. **testDataViewFiltering()** ✓
   - Validate: getDataView() returns correct historical/future split

5. **testProgressCalculation()** ✓
   - Validate: progress percentage calculation (0-100%)

6. **testNearestCandleFinding()** ✓
   - Validate: binary search untuk find nearest candle

7. **testTimeRangeCalculation()** ✓
   - Validate: time range calculation

### Run Tests dari Dev Console

```typescript
import { runAllTests } from '@features/replay'

runAllTests()
// Output: passed/failed count
```

---

## 8. INTEGRASI DENGAN EXISTING FEATURES

### TIDAK Mengubah:
- ✓ CSV import
- ✓ Database (masih punya semua data)
- ✓ Chart rendering (tetap pakai Lightweight Charts)
- ✓ Pagination (tetap berfungsi normal)
- ✓ Timeframe aggregation
- ✓ Symbol/timeframe persistence
- ✓ FloatingReplayBar UI

### BARU Ditambahkan:
- ✗ Play/pause/next candle logic (ada di Hari 8)
- ✗ Replay timer/speed calculation (ada di Hari 8)
- ✗ Chart viewport auto-follow (ada di Hari 8)
- ✗ Date picker integration (ada di Hari 8)

---

## 9. ARSITEKTUR DATA FLOW

```
DATABASE (full data, unchanged)
     ↓
useCandles() hook (existing pagination)
     ↓
allCandles array (dalam React state)
     ↓
ReplayEngine.initialize(allCandles, startIndex)
     ↓
ReplayEngine.getDataView()
  ├── historicalCandles (0 → currentIndex)
  ├── visibleCandle (currentIndex)
  └── futureCandles (currentIndex+1 → end)
     ↓
useChartFilteredCandles() hook
     ↓
Filtered candles untuk chart display
     ↓
ChartContainer (render via Lightweight Charts)
```

---

## 10. PERSIAPAN UNTUK HARI 8+

Fondasi sudah siap untuk:

1. **Play/Pause Loop** (Hari 8)
   - Use `replayState.status` untuk determine rendering
   - Call `play()` / `pause()` dari FloatingReplayBar

2. **Candle Stepping** (Hari 8)
   - Use `setCurrentIndex()` untuk move forward
   - Trigger setiap interval (replay speed controlled)

3. **Viewport Following** (Hari 8)
   - Monitor `currentReplayTime` dari `replayState`
   - Call chart's `focusRange()` untuk auto-scroll

4. **Date Picker Integration** (Hari 8+)
   - Use `parseAndFindStartPoint()` untuk convert user date selection → start index
   - Use `getSignificantDates()` untuk populate date dropdown

5. **Trading Simulation** (Hari 9+)
   - Use `visibleCandle` dari `getDataView()` untuk order execution
   - Never access future candles untuk avoid lookahead bias

---

## PERFORMANCE NOTES

- **Memory**: tidak ada duplikasi data besar (filtering pure di React)
- **Computation**: binary search O(log n) untuk find start point
- **Re-renders**: memoized dengan useMemo untuk filter hook
- **Database**: unchanged, tetap punya semua data

---

## KETERBATASAN HARI KE-7

1. Replay start point selalu index 0 (first) — custom start point infrastructure ada, tapi belum terintegrasi ke UI
2. Play/pause buttons di FloatingReplayBar belum functional (state ada, logic ada, UI belum wired)
3. Chart belum filter candles otomatis (hook ada, tapi ChartContainer belum consume it)
4. No replay timer (akan ada di Hari 8)
5. No speed control (akan ada di Hari 8)

Ini BUKAN bugs — ini DESIGN, sesuai scope Hari 7 (fondasi saja).

---

## TYPE SAFETY

Semua file sudah TypeScript strict:
- ReplayState interface lengkap
- Engine methods typed dengan return types
- Hook returns typed
- No `any` type (kecuali test context)
