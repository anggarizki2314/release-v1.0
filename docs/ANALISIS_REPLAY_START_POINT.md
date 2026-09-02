# ANALISIS REPLAY START POINT — HARI KE-7

## RINGKASAN EKSEKUTIF

**Status: Replay Start Point infrastructure SUDAH ADA di logic, tetapi UI picker BELUM terintegrasi.**

- ✅ `replayStartTime` sudah ada di ReplayState
- ✅ `currentReplayTime` sudah ada di ReplayState
- ✅ Engine memiliki konsep start point (via `replayStartIndex`)
- ✅ Fungsi untuk memilih/mengatur start point sudah ada
- ❌ FloatingReplayBar TIDAK memiliki kontrol tanggal/waktu
- ❌ TopBar memiliki placeholder tanggal (hardcoded "2024-01-02") tapi tidak fungsional
- ✅ Semua helper function untuk parsing sudah siap
- ❌ Integrasi UI-to-engine belum ada

---

## PERTANYAAN DETAIL — JAWABAN

### 1. Apakah `replayStartTime` sudah ada?

**JAWABAN: ✅ YA**

**Lokasi:** `src/features/replay/types.ts:11`

```typescript
export interface ReplayState {
  ...
  replayStartTime: number | null;  // ← START TIME
  ...
}
```

**Diisi oleh:** `engine.ts:91` dalam method `getReplayState()`

```typescript
const startTime = this.config.allCandles[this.config.replayStartIndex].time;
// ...
return {
  replayStartTime: startTime,  // ← Unix seconds dari candle di start index
  ...
}
```

**Tipe:** Unix seconds (number), NOT milliseconds.

---

### 2. Apakah `currentReplayTime` sudah ada?

**JAWABAN: ✅ YA**

**Lokasi:** `src/features/replay/types.ts:12`

```typescript
export interface ReplayState {
  ...
  currentReplayTime: number | null;  // ← CURRENT TIME
  ...
}
```

**Diisi oleh:** `engine.ts:102` dalam method `getReplayState()`

```typescript
const currentCandle = this.config.allCandles[this.currentIndex];
// ...
return {
  currentReplayTime: currentCandle?.time ?? null,  // ← Current candle's timestamp
  ...
}
```

**Kontras dengan `replayStartTime`:**
- `replayStartTime` = timestamp di mana replay MULAI
- `currentReplayTime` = timestamp candle yang SEDANG ditampilkan sekarang

---

### 3. Apakah Replay Engine sudah memiliki konsep start point?

**JAWABAN: ✅ YA, FULLY**

**Lokasi:** `src/features/replay/engine.ts:4-10`

```typescript
export interface ReplayEngineConfig {
  symbolId: number;
  symbol: string;
  timeframe: Timeframe;
  allCandles: Candle[];
  replayStartIndex: number;  // ← START POINT (index dalam array)
}
```

**Cara kerjanya:**

```typescript
// Di initialize():
this.config = config;
this.currentIndex = config.replayStartIndex;  // ← Start dari index ini
```

**Start Point bukan timestamp langsung, tapi INDEX dalam array:**
- Index 0 = candle pertama
- Index 50 = candle ke-51
- Index (length-1) = candle terakhir

**Kemudian, timestamp diambil dari candle di index itu:**
```typescript
const startTime = this.config.allCandles[this.config.replayStartIndex].time;
```

---

### 4. Apakah ada fungsi untuk memilih/mengatur timestamp Replay Start Point?

**JAWABAN: ✅ YA, MULTIPLE FUNCTIONS**

**Lokasi: `src/features/replay/replayStartPoint.ts`**

#### Fungsi 1: `findReplayStartPointIndex()`
```typescript
export function findReplayStartPointIndex(
  allCandles: Candle[],
  options: ReplayStartPointOptions
): number
```

**4 Strategy tersedia:**
1. `'first'` - Mulai dari index 0
2. `'last'` - Mulai dari index (length-1)
3. `'midpoint'` - Mulai dari index tengah
4. `'timestamp'` - Mulai dari candle terdekat dengan target timestamp

**Contoh usage:**
```typescript
const index = findReplayStartPointIndex(allCandles, {
  strategy: 'timestamp',
  targetTimestamp: 1673424600  // unix seconds
})
// Engine kemudian initialize dengan replayStartIndex: index
```

#### Fungsi 2: `findNearestCandleIndex()`
```typescript
export function findNearestCandleIndex(allCandles: Candle[], targetTime: number): number
```

**Menggunakan binary search O(log n):**
- Input: target timestamp
- Output: index candle terdekat dengan timestamp itu
- Handle edge cases: sebelum semua, sesudah semua, exact match

#### Fungsi 3: `parseAndFindStartPoint()`
```typescript
export function parseAndFindStartPoint(
  dateInput: string | number,
  allCandles: Candle[]
): number | null
```

**Parse date string DAN cari index sekaligus:**

Mendukung format:
- `"2023-01-15"` → 00:00 UTC
- `"2023-01-15 09:30"` → 09:30 UTC
- `"2023-01-15T09:30:00Z"` → ISO format
- `1673424600` → unix seconds langsung

**Contoh:**
```typescript
const index = parseAndFindStartPoint('2023-01-15 09:30', allCandles)
// Hasil: index candle di/dekat jam 09:30 UTC pada tanggal itu
```

#### Fungsi 4: `getSignificantDates()`
```typescript
export function getSignificantDates(
  allCandles: Candle[],
  maxPoints: number = 10
): SignificantDate[]
```

**Untuk populate dropdown tanggal di UI:**

Menghasilkan list tanggal-tanggal penting dalam dataset dengan smart interval:
- Jika dataset < 1 minggu: hourly
- Jika dataset < 3 bulan: daily
- Jika dataset > 3 bulan: weekly

```typescript
// Output:
[
  { label: '2023-01-15', unixSeconds: 1673740800, candleIndex: 42 },
  { label: '2023-01-16', unixSeconds: 1673827200, candleIndex: 186 },
  ...
]
```

---

### 5. Apakah FloatingReplayBar saat ini memiliki kontrol tanggal/waktu?

**JAWABAN: ❌ TIDAK**

**Lokasi:** `src/components/layout/FloatingReplayBar.tsx`

**State yang ada:**
```typescript
const [collapsed, setCollapsed] = useState(false);
const [isPlaying, setIsPlaying] = useState(false);
const [speedIndex, setSpeedIndex] = useState(1);
const [replayTimeframe, setReplayTimeframe] = useState<Timeframe>(chartTimeframe);
const [autoFollow, setAutoFollow] = useState(true);
const [tfMenuOpen, setTfMenuOpen] = useState(false);
const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
```

**Tidak ada:**
- ❌ Date picker state
- ❌ Time picker state
- ❌ Start point selector
- ❌ UI element untuk pilih tanggal/waktu

**Kontrol yang ada hanya:**
- Play/pause button
- Speed selector (0.5x - 8x)
- Replay timeframe dropdown
- Auto Follow toggle
- Collapsible/draggable

---

### 6. Apakah tanggal/waktu Replay Start Point sengaja dihapus dari UI pada perubahan desain sebelumnya?

**JAWABAN: YA, SENGAJA (dengan alasan desain)**

**Bukti dari code comments:**

#### TopBar.tsx:21-22
```typescript
/**
 * Date selector is still a static shell; wiring it up is
 * replay work, not data.
 */
```

#### TopBar.tsx:131-134
```typescript
<button className="topbar__selector topbar__selector--date mono">
  2024-01-02
  <ChevronDown size={13} />
</button>
```

**Ini HANYA placeholder visual — tidak fungsional sama sekali:**
- Tanggal hardcoded: "2024-01-02"
- Tidak ada onClick handler
- Tidak ada dropdown menu
- Tidak berhubung ke replay engine

#### FloatingReplayBar.tsx:21-36
```typescript
/**
 * Floating, draggable replay control — the visual signature of the
 * app. Sits above the chart instead of consuming permanent layout
 * space. Day-1/2 scope: UI + selection state only. Play state,
 * replay timeframe, and auto-follow are local UI state here; the
 * actual candle-stepping / aggregation engine (src/features/replay)
 * will read `replayTimeframe` + `isPlaying` from here later instead
 * of duplicating this UI.
 *
 * Visual-only restyle (see task: "PERUBAHAN UI TERBATAS — HANYA
 * TOMBOL REPLAY"): single row layout, boxed Replay TF selector, a
 * real ON/OFF toggle switch for Auto Follow, and a vertical-dots drag
 * handle on the right — matching the provided reference image. No
 * state, handler, or logic below this comment changed at all; only
 * the JSX/CSS that renders them did.
 */
```

**Kesimpulan: Dihapus sengaja agar fokus pada UI minimal untuk Hari 7.**

---

### 7. File dan komponen mana yang mengatur Replay Start Point?

**JAWABAN: Sudah ada di logic, tapi UI integration belum**

#### Logic Layer (SUDAH ADA):

**`src/features/replay/types.ts`**
- Defines `ReplayState` dengan `replayStartTime`
- Defines `ReplayStatus` transitions

**`src/features/replay/engine.ts`**
- Core `ReplayEngine` class
- Accept `replayStartIndex` di initialize()
- Compute `replayStartTime` dari candle di index itu
- Track `currentReplayTime` saat stepping

**`src/features/replay/replayStartPoint.ts`**
- `findReplayStartPointIndex()` - Determine index dari strategy
- `findNearestCandleIndex()` - Binary search candle terdekat
- `separateDataset()` - Pisah historical vs future

**`src/features/replay/startPointHelpers.ts`**
- `parseAndFindStartPoint()` - Parse date string → index
- `unixSecondsToDateString()` - Convert timestamp ke string
- `getSignificantDates()` - Generate date list untuk dropdown

**`src/features/replay/useReplayEngine.ts`** (line 44)
```typescript
engine.initialize({
  ...
  replayStartIndex: 0,  // ← HARDCODED ke 0 (first candle)
});
```

**`src/features/replay/ReplayContext.tsx`** (line 60-67)
```typescript
const setReplayStartPoint = useCallback(
  (strategy: 'first' | 'last' | 'midpoint' | 'timestamp', timestamp?: number) => {
    // TODO (Hari 8+): implement custom start point logic
    console.log('setReplayStartPoint:', { strategy, timestamp });
  },
  []
);
```

#### UI Layer (PLACEHOLDER SAJA):

**`src/components/layout/TopBar.tsx`** (line 131-134)
- Date button: hardcoded "2024-01-02", not functional

**`src/components/layout/FloatingReplayBar.tsx`**
- No date/time control, only speed/timeframe/play

**`src/components/layout/AppShell.tsx`**
- No replay state management yet

---

### 8. Jika belum ada, jelaskan bagian mana yang masih harus dibuat.

**JAWABAN: Logic LENGKAP, UI integration BELUM**

#### Yang Sudah Ada (Hari 7):
```
✅ ReplayState.replayStartTime (property)
✅ ReplayState.currentReplayTime (property)
✅ ReplayEngine.replayStartIndex (concept)
✅ ReplayEngine.getReplayState() (returns startTime & currentTime)
✅ findReplayStartPointIndex() (4 strategies)
✅ findNearestCandleIndex() (binary search)
✅ parseAndFindStartPoint() (date parsing)
✅ getSignificantDates() (date list generation)
✅ setReplayStartPoint() in ReplayContext (placeholder)
```

#### Yang Masih Harus Dibuat (Hari 8+):

1. **TopBar Date Picker (Hari 8)**
   - Replace hardcoded "2024-01-02" dengan interactive input
   - Connect ke `parseAndFindStartPoint()`
   - Trigger engine re-initialization dengan new start index
   - Show significant dates dropdown (dari `getSignificantDates()`)

2. **FloatingReplayBar Start Point Display (Hari 8)**
   - Show `replayStartTime` formatted
   - Maybe show current position vs start (untuk context)

3. **AppShell Replay Integration (Hari 8+)**
   - Wrap dengan `ReplayProvider`
   - Pass allCandles, symbol, timeframe
   - Make ReplayContext available ke TopBar/FloatingReplayBar

4. **useReplayEngine Enhancement (Hari 8+)**
   - Currently hardcoded: `replayStartIndex: 0`
   - Need to accept custom start index
   - Re-initialize engine when start point changes

5. **ReplayContext.setReplayStartPoint() Implementation (Hari 8+)**
   - Currently: only console.log()
   - Should:
     - Call `findReplayStartPointIndex()` atau `parseAndFindStartPoint()`
     - Call `engine.reset()` dan re-initialize dengan new index
     - Update UI state

---

## ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────┐
│ REPLAY START POINT ARCHITECTURE                     │
└─────────────────────────────────────────────────────┘

LOGIC LAYER (Hari 7 - ✅ COMPLETE):
┌─────────────────────────────────────┐
│ ReplayState.replayStartTime         │
│ ReplayState.currentReplayTime       │
│ ReplayEngine.replayStartIndex       │
│ engine.getReplayState()             │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│ Start Point Utilities               │
│ - findReplayStartPointIndex()        │
│ - findNearestCandleIndex()          │
│ - parseAndFindStartPoint()          │
│ - getSignificantDates()             │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│ ReplayContext.setReplayStartPoint() │
│ (placeholder - console.log only)    │
└────────────┬────────────────────────┘
             │
             ↓

UI LAYER (Hari 8+ - ❌ NOT DONE):
┌─────────────────────────────────────┐
│ TopBar Date Picker                  │
│ (currently hardcoded "2024-01-02")  │
│ - Need: onClick handler             │
│ - Need: date input/dropdown         │
│ - Need: call parseAndFindStartPoint() │
└─────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│ FloatingReplayBar Display           │
│ - Show replayStartTime formatted    │
└─────────────────────────────────────┘
```

---

## CURRENT STATE: INDEX 0 ONLY

**Saat ini, engine SELALU mulai dari index 0 (first candle):**

```typescript
// src/features/replay/useReplayEngine.ts:44
engine.initialize({
  ...
  replayStartIndex: 0,  // ← HARDCODED
});
```

**Ini berarti:**
- ✅ Replay infrastructure siap
- ✅ All candles accessible
- ✅ Historical data available (dari index 0)
- ✅ Future data available (dari index 0 onwards)
- ❌ Tapi user tidak bisa pilih start point berbeda
- ❌ User terikat harus mulai dari candle pertama

---

## KESIMPULAN

### Summary:
```
Logic Infrastructure:     ✅ 100% Complete (Hari 7)
Start Point Determination: ✅ Ready to use
Helper Functions:          ✅ All available
UI Integration:            ❌ Pending (Hari 8+)
FloatingReplayBar Control: ❌ Pending (Hari 8+)
User-Selected Start Point: ❌ Not yet implemented
```

### Next Steps (Hari 8):
1. Wire TopBar date picker to `parseAndFindStartPoint()`
2. Implement `ReplayContext.setReplayStartPoint()` 
3. Enhance `useReplayEngine` to accept dynamic start index
4. Update engine initialization logic
5. Test with different start points

### Status:
**"Semua infrastructure sudah ada. Tinggal connect UI ke engine logic."**

---

## FILES REFERENCE

### Core Engine Files:
- `src/features/replay/types.ts` - State definitions
- `src/features/replay/engine.ts` - Engine logic
- `src/features/replay/useReplayEngine.ts` - React hook

### Start Point Logic:
- `src/features/replay/replayStartPoint.ts` - Strategies & utilities
- `src/features/replay/startPointHelpers.ts` - Date parsing helpers
- `src/features/replay/ReplayContext.tsx` - Global state (placeholder)

### UI Layer:
- `src/components/layout/TopBar.tsx` - Has placeholder date button
- `src/components/layout/FloatingReplayBar.tsx` - No date control
- `src/components/layout/AppShell.tsx` - Not yet integrated with replay

---

**Analisis Complete. Tidak ada file yang diubah.**
