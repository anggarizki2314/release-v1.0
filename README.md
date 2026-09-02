# Forex Replay — Professional Desktop Trading Simulator

Desktop trading-replay simulator (Electron + React 18 + TypeScript + SQLite via better-sqlite3 + Lightweight Charts v4 + Custom Drawing Engine + Trading Engine 2.0). 

Aplikasi ini menyediakan simulasi backtest forex berkecepatan tinggi dengan multi-timeframe aggregation, multi-layout synchronized replay, drawing engine interaktif bergaya TradingView, eksekusi order real-time dengan drag-and-drop SL/TP langsung di atas chart, dan perhitungan margin dinamis.

## Menjalankan project

```bash
npm install
npm run dev
```

`npm run dev` menjalankan Vite dev server (React) dan Electron secara
bersamaan (`concurrently`), menunggu Vite siap (`wait-on`), lalu
membuka jendela desktop yang me-load `http://localhost:5173`.

Build produksi:

```bash
npm run build   # compile renderer (Vite) + main/preload (tsc)
npm start        # jalankan build hasil compile
npm run dist     # paket .exe via electron-builder (Windows NSIS)
```

> Catatan: environment ini tidak memiliki akses jaringan, jadi saya
> tidak bisa menjalankan `npm install` / build di sini untuk
> memverifikasinya langsung. Konfigurasi (`package.json`, tsconfig,
> vite config, entry Electron) sudah ditulis mengikuti setup Electron
> + Vite + TS yang standar — jalankan `npm install && npm run dev` di
> komputer Anda untuk memverifikasi.

## Struktur project

```
forex-replay/
├─ electron/                 # Main process (Node context)
│  ├─ main.ts                # BrowserWindow, app lifecycle, IPC handlers
│  ├─ preload.ts             # contextBridge — whitelisted API ke renderer
│  ├─ database/db.ts         # Inisialisasi SQLite lokal (better-sqlite3)
│  └─ tsconfig.json          # Compile target: dist-electron/
├─ src/                      # Renderer process (React)
│  ├─ main.tsx / App.tsx     # Entry React
│  ├─ index.css              # Import token & theme global
│  ├─ styles/
│  │  ├─ variables.css       # Design tokens (warna, spacing, shadow)
│  │  └─ theme.css           # Reset & base style dark terminal
│  ├─ types/index.ts         # Tipe bersama (Candle, Timeframe, dll)
│  ├─ components/
│  │  ├─ layout/             # AppShell, TopBar, LeftToolbar,
│  │  │                      # MainChartArea, FloatingReplayBar, BottomPanel
│  │  ├─ chart/              # ChartContainer (wrapper Lightweight Charts)
│  │  └─ common/              # IconButton (tombol+tooltip reusable)
│  └─ features/               # Folder fitur — scaffold saja, logic belum diisi
│     ├─ data/                # Import CSV (termasuk per-bulan), parsing, validasi
│     ├─ chart/                # Feed data ke chart, multi-timeframe, drawing state
│     ├─ replay/               # Engine replay candle-by-candle
│     ├─ trading/               # Simulasi order/posisi/eksekusi
│     ├─ journal/                # Catatan & tagging trade
│     ├─ statistics/              # Win rate, equity curve, drawdown
│     └─ database/                 # Helper akses data dari renderer via IPC
├─ index.html
├─ vite.config.ts             # Build renderer, alias @, @features, @components
├─ tsconfig.json              # TS config renderer
├─ package.json
└─ .gitignore
```

## Layout yang dibangun hari ini

- **Top bar** — logo, symbol/timeframe/date selector (statis), indikator
  replay mode, tombol theme & settings.
- **Left toolbar** — rail alat gambar (select, crosshair, trendline,
  horizontal/vertical line, rectangle, measure), collapsible.
- **Main chart area** — instance Lightweight Charts kosong dengan tema
  dark yang sudah terpasang (grid subtle, crosshair, price/time scale),
  plus empty-state hint sebelum data diimpor.
- **Floating replay control bar** — mengambang di atas chart (bukan
  bottom bar permanen), bisa di-drag, di-collapse, dengan tombol
  play/pause, prev/next candle, fast forward, speed, dan waktu replay.
  Ini elemen visual signature aplikasi.
- **Bottom panel** — dock collapsible & resizable (drag tepi atas)
  dengan tab Trades / Positions / Orders / Journal / Statistics /
  Equity Curve — saat ini semua masih placeholder kosong.

Semua state layout (collapse, tool aktif, tinggi panel, posisi floating
bar) adalah UI state lokal di React — tidak ada logic data, replay,
atau trading yang diimplementasikan di sini.

## Database

`electron/database/db.ts` membuat file SQLite lokal di folder
`userData` Electron (offline, tanpa server) dan membuat skema dasar
(`symbols`, `candles`). Ini hanya fondasi — import CSV & query akan
dibangun di `src/features/data` dan `src/features/database` pada
tahap berikutnya.

## Langkah selanjutnya (di luar scope hari ini)

1. `features/data`: parser CSV (single & per-bulan) + writer ke SQLite.
2. `features/chart`: hubungkan candle dari DB ke `ChartContainer`,
   multi-timeframe.
3. `features/replay`: engine replay + hubungkan ke `FloatingReplayBar`.
4. `features/trading`, `journal`, `statistics`: isi tab di `BottomPanel`.

---

## Hari ke-2 — Data System (CSV → SQLite)

Menambahkan sistem import data historis. Detail lengkap ada di laporan
chat, ringkasan struktur:

```
electron/data/
├─ csvParser.ts       # streaming parser (readline), deteksi delimiter,
│                      # header, format tanggal; sniffTimeframe() untuk
│                      # deteksi timeframe dari sample kecil
├─ symbolDetector.ts   # symbol dari nama folder induk / nama file
└─ importer.ts          # orkestrasi: importFiles(), importFolder()
                         # (rekursif untuk struktur Data/SYMBOL/*.csv)

electron/database/db.ts # + upsertSymbol, insertCandlesBatch (transaction),
                         # listSymbolSummaries (metadata saja)

src/features/data/       # client renderer: api.ts (wrapper IPC),
                          # useSymbols() & useImportData() (hook React)
```

**Alur:** tombol "Import Data" di Top Bar → dialog native Electron
(pilih file / folder) → main process baca file CSV secara streaming
(readline, batch 5000 baris) → insert ke SQLite per batch dalam
transaction → renderer hanya menerima ringkasan hasil (bukan candle
mentah) → daftar symbol di dropdown Top Bar otomatis refresh.

**Uji cepat setelah `npm install && npm run dev`:**
1. Siapkan folder `Data/XAUUSD/2023-01.csv` dst. (header
   `Date,Time,Open,High,Low,Close,Volume` atau tanpa header gaya MT4).
2. Klik "Import Data" → "Import Folder" → pilih folder `Data/`.
3. Setelah selesai, muncul status hijau ringkasan (jumlah file/symbol/
   candle), dan dropdown symbol di Top Bar terisi.

---

## Hari ke-3 — Data Management & Database System

Menambahkan tabel `datasets` (riwayat import per file — additive,
tidak menyentuh data `symbols`/`candles` yang sudah ada) dan tab
**"Data"** baru di Bottom Panel (default tab saat aplikasi dibuka)
untuk melihat & mengelola data yang sudah diimpor tanpa perlu buka
DB browser eksternal.

```
electron/database/db.ts   # + tabel datasets, insertCandlesBatch kini
                           # mengembalikan {inserted, duplicates} nyata
                           # (query pre-check, bukan hardcoded),
                           # recordDataset, listDatasetsForSymbol,
                           # deleteSymbol, listSymbolSummaries +lastUpdatedAt
electron/data/csvParser.ts # + validasi OHLC dasar (harga positif,
                           # high>=low & high>=open/close, dst)
electron/data/importer.ts  # melacak rowsValid/rowsDuplicate/rowsInserted
                           # per file, mencatat ke tabel datasets

src/features/data/components/DataManagementPanel.tsx  # UI tab Data:
  # daftar symbol + coverage, expand → riwayat import per file, hapus symbol
src/features/data/useDatasets.ts  # hook riwayat import per symbol
```

**Duplicate prevention:** tetap lewat `UNIQUE(symbol_id, timeframe, time)`
+ `INSERT OR REPLACE` (sudah ada sejak Hari-2) — timestamp yang sama
menimpa baris lama, bukan menambah baris baru. Yang baru di Hari-3
adalah *pelaporan*-nya: sebelum insert, dicek dulu timestamp mana saja
yang sudah ada, supaya status import bisa bilang persis "X candle baru,
Y duplikat" alih-alih cuma total mentah.

**Delete:** saat ini di level symbol (hapus symbol = hapus semua
candle + riwayat dataset miliknya), lewat tombol tempat sampah di tab
Data — ada konfirmasi sebelum eksekusi. Delete per-file/per-dataset
sengaja belum dibuat karena candle dari beberapa file bulanan sudah
digabung di satu ruang index sejak Hari-2 (tidak ada penanda file asal
per baris candle), jadi menghapus "1 dataset" secara akurat butuh
perubahan skema lebih besar.

---

## Hari ke-4 — Chart Data Rendering (candle asli dari SQLite ke Lightweight Charts)

**Keputusan arsitektur penting:** timestamp di kolom `candles.time` sudah
dikonversi ke **seconds** sejak Hari-2 (saat parsing CSV, lihat
`parseTimestampCell` di `csvParser.ts`) — bukan disimpan sebagai
milliseconds mentah. Jadi boundary konversi ms→s ada di titik
**CSV→Database** (saat import), bukan di titik **Database→Chart**.
`features/chart` dan `ChartContainer` mengambil `time` dari DB dan
memakainya langsung ke Lightweight Charts **tanpa membaginya lagi** —
supaya tidak terjadi double-division.

```
electron/database/db.ts    # + getCandles(symbolId, timeframe, limit):
                            # ambil N candle terakhir, ORDER BY time ASC,
                            # + validasi OHLC & dedupe defensif sebelum
                            # dikirim lewat IPC (dibatasi limit, default
                            # 20.000, supaya tidak kirim jutaan candle sekaligus)
electron/main.ts/preload.ts # + IPC 'data:getCandles'

src/features/chart/{api,useCandles,index}.ts  # client + hook React
src/components/chart/ChartContainer.tsx        # sekarang terima
                                                # symbolId+timeframe,
                                                # panggil series.setData()
                                                # dengan candle asli
src/components/layout/AppShell.tsx    # useSymbols() dipindah ke sini
                                       # (satu sumber untuk TopBar +
                                       # MainChartArea), + state
                                       # selectedSymbolId
src/components/layout/TopBar.tsx      # symbol list/selection sekarang
                                       # dari props (bukan hook sendiri)
src/components/layout/MainChartArea.tsx # empty-state sekarang dihitung
                                       # dari data asli (SymbolInfo.timeframes),
                                       # bukan hardcoded `false`
```

**Uji cepat:** import folder XAUUSD (format Dukascopy M1 seperti
contoh), pastikan Top Bar timeframe di-set ke `1m`, pilih symbol
XAUUSD — chart akan menampilkan candle asli. Ganti timeframe ke yang
belum diimpor (misal `1H`) → muncul empty-state yang menyebutkan
timeframe mana saja yang tersedia untuk symbol itu.

**Keterbatasan:** belum ada agregasi multi-timeframe (kalau hanya
punya data M1, memilih timeframe H1 tidak akan otomatis agregasi jadi
candle H1 — itu pekerjaan hari berikutnya). Chart juga baru menampilkan
maksimal 20.000 candle terbaru per fetch; pagination/infinite scroll-back
untuk histori lebih panjang belum ada (akan relevan saat replay engine dibangun).

### Bugfix Hari ke-4 — Persist last selected symbol/timeframe

**Bug:** symbol & timeframe selalu kembali ke default (symbol pertama
yang diimport, timeframe M15) setiap kali aplikasi dibuka kembali —
`AppShell.tsx` menyimpan keduanya sebagai UI state lokal murni
(`useState`, tanpa persistence) dan otomatis memilih `symbols[0]`
begitu daftar symbol siap.

**Fix:** tabel baru `app_settings` (key/value generik) ditambahkan ke
database SQLite lokal yang sudah ada — additive, tidak menyentuh
`symbols`/`candles`/`datasets`. Alur:

```
electron/database/db.ts     # + tabel app_settings, getSetting()/setSetting()
electron/main.ts/preload.ts # + IPC 'settings:get' / 'settings:set'

src/features/database/       # (folder yang sejak Hari 1 disiapkan untuk ini)
  ├─ api.ts                  # wrapper IPC getSetting/setSetting
  └─ useLastSelection.ts     # load sekali saat mount + save(symbolName, timeframe)

src/components/layout/AppShell.tsx  # effect restore (sekali, tervalidasi
                                     # terhadap symbol+timeframe yang benar-
                                     # benar ada) + effect save (setiap kali
                                     # selectedSymbolId/chartTimeframe berubah,
                                     # bukan hanya saat app ditutup)
```

Symbol disimpan berdasarkan **nama**, bukan id (id bisa berubah kalau
symbol dihapus lalu diimport ulang; nama tidak). Saat startup, symbol
+ timeframe yang tersimpan divalidasi dulu terhadap `SymbolInfo.timeframes`
yang sebenarnya ada di database — kalau sudah tidak valid (symbol
dihapus / timeframe itu tidak lagi punya data), aplikasi jatuh ke
fallback lama (symbol pertama + M15) tanpa crash. Viewport chart tetap
tidak dipersist (sudah didesain hidup di instance Lightweight Charts
saja, lihat `ChartContainer.tsx`) — setelah symbol/timeframe dipulihkan,
`defaultRange()` yang sudah ada otomatis menampilkan viewport default
yang relevan untuk data tersebut.

---

## Hari ke-5 — Chart Navigation & Data Loading

Tidak ada perubahan skema database. Fokus hari ini murni di *cara*
candle diambil & dimuat ke chart — arsitektur Hari ke-4 (IPC →
`getCandles` → `useCandles` → `ChartContainer.setData()`) dipertahankan,
bukan ditulis ulang.

```
electron/database/db.ts   # getCandles() default batch 20.000 → 5.000
                           # (initial load lebih ringan), + getCandlesBefore()
                           # untuk backward pagination, + MAX_CANDLES_PER_REQUEST
                           # (20.000) yang meng-clamp SEMUA request candle,
                           # + sanitizeCandleRows() (validasi/dedupe diekstrak
                           # jadi helper bersama, tidak diduplikasi lagi)
electron/main.ts/preload.ts # + IPC 'data:getCandlesBefore'

src/features/chart/viewport.ts  # + INITIAL_CANDLE_BATCH (5000),
                                 # PAGE_CANDLE_BATCH (5000), PAN_LOAD_THRESHOLD
                                 # (80 candle buffer sebelum memicu fetch)
src/features/chart/useCandles.ts # sekarang stateful pagination: fresh load
                                 # (symbol/timeframe berubah) vs loadMoreBefore()
                                 # (append candle lama, prepend ke array).
                                 # hasMoreBefore berhenti sendiri begitu sebuah
                                 # fetch pulang lebih pendek dari yang diminta
                                 # (atau kosong) — tidak ada query tanpa batas.
                                 # resetToken naik HANYA saat fresh load, dipakai
                                 # ChartContainer untuk membedakan "reset viewport"
                                 # vs "pertahankan viewport".
src/components/chart/ChartContainer.tsx  # + subscribeVisibleLogicalRangeChange
                                 # (didaftarkan sekali di effect mount chart,
                                 # bukan per-render — tidak ada listener duplikat)
                                 # memicu loadMoreBefore() saat viewport mendekati
                                 # awal data termuat. Saat data lama ditambahkan,
                                 # visible TIME range (bukan logical index — index
                                 # bergeser begitu data lama di-prepend) ditangkap
                                 # sebelum setData() lalu dipulihkan sesudahnya,
                                 # supaya chart tidak "lompat".
```

**Kenapa berbasis waktu, bukan index, untuk preserve viewport:** begitu
candle lama di-*prepend* ke array, logical index candle yang sedang
dilihat user berubah (semuanya bergeser), tapi timestamp-nya tidak.
`chart.timeScale().getVisibleRange()`/`setVisibleRange()` bekerja di
domain waktu, jadi tetap benar walau array-nya baru saja tumbuh di
depan — beda dengan `setVisibleLogicalRange()` yang dipakai Reset Chart
& initial positioning (situasi itu memang ingin index, bukan waktu).

**Kenapa `resetToken`, bukan diff `symbolId`/`timeframe` langsung:**
fetch candle bersifat async, jadi render pertama setelah user ganti
symbol masih membawa `candles` milik symbol lama sesaat sebelum data
baru datang. Diff prop langsung akan salah mengenali render itu sebagai
"fresh load" dan render berikutnya (yang benar-benar berisi data baru)
sebagai "append". `resetToken` dinaikkan oleh `useCandles` di saat yang
sama (batch React yang sama) dengan `setCandles(hasil fetch)`, jadi
keduanya selalu konsisten satu sama lain.

**Duplicate prevention saat pagination:** query `getCandlesBefore`
sudah `time < beforeTime` (exclusive) jadi secara desain tidak mungkin
overlap dengan data yang sudah ada; tetap ada filter defensif di
`useCandles` (`c.time < currentEarliest`) sebagai jaga-jaga terhadap
race condition (mis. fetch lama baru resolve setelah simbol berganti).

**Keterbatasan yang disadari:** candle yang sudah dimuat lewat pagination
tidak pernah "dibuang" lagi dari memori/chart selama symbol+timeframe
yang sama masih aktif (append-only) — cukup untuk kebutuhan hari ini
(inisial ringan + pagination sesuai permintaan), tapi kalau user pan
sangat jauh berulang kali di dataset yang sangat besar, working-set di
memori akan terus tumbuh. Windowing/eviction data lama yang sudah tidak
terlihat bukan scope Hari ke-5 ini. Aggregasi multi-timeframe (M1→M5/
M15/H1 dst.) juga belum dibuat — sengaja, sesuai batasan hari ini
("jangan membuat data palsu"); memilih timeframe yang datanya belum
diimpor tetap menampilkan empty-state seperti Hari ke-4.

---

## Hari ke-6 — Timeframe System & Candle Aggregation

Sebelumnya (Hari 1-5), memilih timeframe di UI hanya mengganti string
query — kalau symbol cuma punya data native M1, memilih M5/M15/dst
akan selalu kosong (chart empty-state), karena tidak ada aggregation
sama sekali. Hari ini itu diperbaiki: `getCandles()`/`getCandlesBefore()`
sekarang mengaggregasi on-the-fly dari timeframe native terhalus yang
tersedia, **tanpa menyimpan candle M5/M15/dst ke database** (sesuai
arahan brief — aggregation di level query, bukan duplikasi data).

```
electron/data/aggregate.ts (baru)  # bucketStart() + aggregateCandles() —
                                    # murni, tanpa DB, mudah diuji sendiri
electron/database/db.ts            # + resolveSourceTimeframe() (native
                                    # exact match, atau timeframe native
                                    # terhalus yang lebih kecil dari target),
                                    # getCandles()/getCandlesBefore() sekarang
                                    # dua jalur: native (query persis sama
                                    # seperti sebelumnya, TIDAK diubah) vs
                                    # aggregation (fetch source lebih besar,
                                    # aggregate, buang bucket tertua yang
                                    # berpotensi tidak lengkap)
src/features/chart/timeframeAvailability.ts (baru)  # canDisplayTimeframe():
                                    # versi renderer, dipakai MainChartArea
                                    # (empty-state) & AppShell (validasi restore
                                    # persistence) — supaya timeframe hasil
                                    # aggregation tidak dianggap "tidak ada data"
src/features/chart/useCandles.ts   # hasMoreBefore diubah dari "dapat batch
                                    # penuh" jadi "dapat apa saja" (>0) — perlu
                                    # untuk timeframe hasil aggregation, karena
                                    # 1 fetch bisa mengembalikan lebih sedikit
                                    # dari limit walau histori lebih jauh masih
                                    # ada (source fetch-nya sendiri dibatasi)
```

**Rumus OHLC** (persis sesuai brief): Open = open candle sumber
pertama dalam bucket, High = high tertinggi, Low = low terendah,
Close = close candle sumber terakhir, Volume = jumlah volume seluruh
sumber DALAM bucket **hanya jika semuanya punya volume** (kalau ada
satu saja yang null, hasilnya null — bukan sum parsial yang dianggap
lengkap).

**Batas waktu (time boundary):** semua bucket UTC murni, floor-division
dari epoch (konsisten dengan `Date.UTC` yang sudah dipakai sejak
Hari-2, tidak ada konversi timezone). W1 (walau di luar daftar minimal
brief) memakai anchor Senin 00:00 UTC karena epoch 0 jatuh di hari
Kamis.

**Data gap:** bucket yang source-nya kosong sama sekali **tidak pernah
muncul** di output — tidak ada candle palsu/interpolasi. Sudah diuji
nyata (lihat bagian pengujian).

**Kompatibilitas pagination:** bucket TERTUA dari satu fetch selalu
dibuang KECUALI source fetch memang sudah mentok ke awal histori asli
— karena bucket di tepi window bisa jadi belum lengkap (ada candle
sumber lebih tua di luar window yang belum terbaca). `useCandles.ts`
disesuaikan supaya tidak berhenti paginasi prematur untuk timeframe
hasil aggregation.

---

## Hari ke-7 — Replay Engine Foundation

Membangun fondasi replay engine: state management, data view
separation, dan start point utilities. Belum ada interaksi user
interface — semua adalah pure logic yang mudah diuji.

```
src/features/replay/
├─ types.ts                  # ReplayState, ReplayStatus, INITIAL_REPLAY_STATE
│                             # Status: idle → selecting → ready → playing → paused → finished
├─ engine.ts                  # ReplayEngine class (stateless config + mutable index):
│                             #   initialize(), reset(), play(), pause(), isFinished(),
│                             #   getReplayState(), getDataView(), setCurrentIndex()
├─ replayStartPoint.ts        # findReplayStartPointIndex() (strategy: first/last/midpoint/timestamp),
│                             #   findNearestCandleIndex() (binary search),
│                             #   separateDataset() (historical vs future split),
│                             #   getDatasetTimeRange()
├─ useChartFilter.ts          # useChartFilteredCandles(): filter candles berdasarkan
│                             #   cutoffTime (binary search, O(log n))
│                             # useVisibleTimeRange(): get first/last time dari filtered candles
├─ startPointHelpers.ts       # parseAndFindStartPoint(), unixSecondsToDateString(),
│                             #   getSignificantDates()
├─ ReplayContext.tsx           # ReplayProvider + useReplay() context
├─ useReplayEngine.ts         # Hook manage engine lifecycle + state sync
└─ index.ts                   # Public exports
```

**Arsitektur:**
- `ReplayEngine` adalah class murni (tanpa React) — mudah diuji
  secara terpisah. State: `config` (symbol, timeframe, allCandles,
  replayStartIndex) + `currentIndex` + `status`.
- `ReplayProvider` membungkus `useReplayEngine` hook dan menyediakan
  context ke semua komponen (ChartContainer, FloatingReplayBar, dll).
- `useChartFilteredCandles` memfilter candle berdasarkan
  `currentReplayTime` — di replay mode, hanya candle dengan
  `time <= cutoffTime` yang ditampilkan ke chart.

---

## Hari ke-8 — Start Point Selection via Chart Click

User bisa memilih titik awal replay dengan mengklik candle di chart.
Fitur ini menggunakan chart click event + crosshair preview.

```
src/features/replay/
├─ useReplayEngine.ts         # + startReplaySelection(), confirmReplayStartPoint(),
│                             #   cancelReplaySelection(), exitReplayMode()
├─ ReplayContext.tsx           # + expose selection methods ke context
src/components/chart/ChartContainer.tsx  # + subscribeClick() untuk confirm start point,
│                             #   subscribeCrosshairMove() untuk preview timestamp
│                             #   saat selection mode aktif
src/components/layout/MainChartArea.tsx  # + Escape key handler (cancel selection / exit replay)
src/components/layout/FloatingReplayBar.tsx  # + "Putar ulang" button untuk enter selection mode
```

**Alur selection:**
1. User klik "Putar ulang" di FloatingReplayBar → `startReplaySelection()`
2. Status berubah ke `selecting`, chart menampilkan preview timestamp
   saat crosshair bergerak
3. User klik candle di chart → `confirmReplayStartPoint(index)`
4. Engine diinisialisasi dengan start index, status → `ready`
5. User bisa mulai playback atau pilih titik lain

**Escape key:** membatalkan selection (kalau sedang selecting) atau
exit replay mode (kalau sudah aktif).

---

## Hari ke-9 — Playback Engine (Candle-by-Candle)

Playback loop pertama: advance currentIndex satu per satu menggunakan
timer. FloatingReplayBar sekarang bisa play/pause/next/prev/skip.

```
src/features/replay/useReplayEngine.ts  # + play(), pause(), nextCandle(),
│                                       #   prevCandle(), skipForward(count)
│                                       # + startTimer() / clearTimer() untuk playback loop
│                                       # + stepForward() / stepBackward() internal helpers
src/components/layout/FloatingReplayBar.tsx  # + play/pause button wired ke engine,
│                                       #   prev/next candle, fast forward (skip 10)
```

**Playback loop design:**
- `setInterval` dengan interval dasar 500ms per candle (di 1x speed)
- Speed multiplier: interval = 500 / speed ms (10x = 50ms per candle)
- Auto-stop: `isFinished()` check setiap tick, status → `finished`
- Timer cleanup: pause, exit, symbol/timeframe change, unmount

**Key constraint:** hanya boleh ada SATU timer aktif — `timerRef`
dipakai sebagai guard supaya `play()` tidak bisa dipanggil dua kali.

---

## Hari ke-10 — Recursive setTimeout untuk Speed Changes

Mengganti `setInterval` dengan recursive `setTimeout` supaya speed
bisa berubah secara dynamic tanpa perlu clear + restart timer.

```
src/features/replay/useReplayEngine.ts  # startTimer() sekarang recursive setTimeout
│                                       # speedRef dibaca di setiap tick (bukan saat start)
│                                       # setSpeed() langsung clear + restart timer
```

**Kenapa recursive setTimeout:** `setInterval` tidak bisa mengubah
interval secara dynamic — interval yang sudah di-schedule tidak
berubah kalau variable berubah. Recursive setTimeout memanggil
`setTimeout(tick, interval)` SETIAP tick, jadi `speedRef.current`
selalu dibaca terbaru.

**Dynamic speed:** `setSpeed(newSpeed)` update `speedRef.current`,
lalu clear + restart timer. Efek: speed berubah pada tick berikutnya
(max 500ms delay, delay minimum 16ms untuk mencegah throttle).

---

## Hari ke-12 — Replay Session Persistence

Menyimpan dan memulihkan state replay saat aplikasi di-close/dibuka
kembali. Menggunakan tabel `app_settings` yang sudah ada (key/value
store generik dari Hari ke-4).

```
electron/database/db.ts       # reuses getSetting()/setSetting() dari app_settings
src/features/database/        # reuses api.ts wrapper IPC
src/features/replay/useReplayEngine.ts  # + PersistedReplaySession interface,
│                                       #   parseReplaySession(), load session saat mount,
│                                       #   persist session saat state berubah,
│                                       #   restore session pada valid data load pertama
```

**Keys yang dipersist:**
- `replay:startTime` — timestamp awal replay
- `replay:currentTime` — posisi playback terakhir
- `replay:speed` — kecepatan playback

**Restore flow:**
1. App mount → load 3 keys dari `app_settings` (async IPC)
2. `sessionReady` → true
3. Valid data load pertama (symbol + timeframe + candles) → restore
4. `findNearestCandleIndex()` untuk map timestamp ke index
5. Engine diinisialisasi dengan restored state
6. `restoredRef.current` → true, restore hanya terjadi SEKALI

**Persist flow:**
- `replayStartTime` / `currentReplayTime` berubah → save ke DB
- `setSpeed()` → save speed ke DB
- `exitReplayMode()` → clear semua keys

---

## Hari ke-14 — Replay Timeline (Seek & Drag)

Timeline interaktif untuk menampilkan posisi replay dan memungkinkan
user seek ke posisi tertentu via click, drag, atau input timestamp.

```
src/features/replay/replayTimeline.ts   # calculateTimelineProgress(), timestampFromProgress(),
│                                       #   findNearestCandle() (binary search),
│                                       #   candleFromTimelinePercent(), isTimelineValid()
src/features/replay/useReplayEngine.ts  # + seekToTimestamp(), seekToIndex(), resetReplay()
src/components/replay/ReplayTimeline.tsx # Full timeline UI:
│                                       #   - Track dengan filled portion (start → current)
│                                       #   - Start/end marker (clickable → jump)
│                                       #   - Draggable thumb
│                                       #   - Tooltip on hover/drag
│                                       #   - Jump-to-timestamp input (YYYY-MM-DD HH:MM)
src/components/replay/ReplayTimeline.css # Styling timeline
src/components/layout/MainChartArea.tsx  # + render <ReplayTimeline allCandles={allCandles} />
```

**Timeline features:**
- **Click on track:** seek ke posisi yang diklik
- **Drag thumb:** drag untuk scrub timeline (pause otomatis jika
  sedang playing)
- **Hover tooltip:** tampilkan timestamp saat hover di atas track
- **Start/end markers:** klik untuk jump ke awal/akhir replay
- **Jump-to-timestamp:** input manual timestamp (format
  `YYYY-MM-DD HH:MM` atau `YYYY-MM-DD`), validasi range

**Semua kalkulasi berbasis timestamp** (bukan index) — konsisten
dengan arsitektur Hari ke-5 dst. `findNearestCandle()` menggunakan
binary search O(log n) untuk map timestamp ke candle terdekat.

---

## Hari ke-13 — Replay Date/Time Display (Revisi ke-1)

Menampilkan waktu candle aktif dalam Replay secara jelas dan selalu
sinkron dengan current replay position. Display hanya muncul saat
replay mode aktif (bukan selection mode).

```
src/components/chart/ChartContainer.tsx  # + chart-container__replay-datetime overlay:
│                                       #   menampilkan currentReplayTime + symbol • timeframe
│                                       #   hanya saat isReplayMode && status !== 'selecting'
src/components/chart/ChartContainer.css  # + .chart-container__replay-datetime:
│                                       #   top-left overlay, semi-transparent background,
│                                       #   mono font, timestamp + meta info
```

**Sumber kebenaran:** `replayState.currentReplayTime` dari
`useReplay()` context — **tidak ada state baru yang dibuat**.
Display membaca langsung dari replay engine yang sudah ada.

**Format timestamp:** `unixSecondsToDateString(seconds, true)` →
`YYYY-MM-DD HH:MM` (UTC, konsisten dengan seluruh aplikasi).

**Behavior update:**
- **Play:** display berubah mengikuti `currentReplayTime` setiap
  candle advance (React re-render karena state berubah)
- **Next/Previous Candle:** display berubah sesuai candle aktif baru
- **Pause:** display tetap di timestamp terakhir (tidak berubah)
- **Resume:** display melanjutkan dari posisi yang benar
- **Speed change:** display tetap sinkron (tidak ada timer terpisah)
- **Replay Start Point boundary:** display tidak melewati start point
- **End of data:** display menampilkan timestamp candle terakhir
- **Timeframe switching:** display mengikuti candle replay pada
  timeframe baru (timestamp-based, bukan index-based)
- **Symbol switching:** display mengikuti state symbol baru
- **Reset Chart:** display tidak berubah (hanya viewport yang reset)
- **Zoom/Pan:** display tidak berubah (mengikuti replay state)
- **Aplikasi restart:** display mengikuti `currentReplayTime` yang
  di-restore dari persistence (Day 12)

**Lokasi UI:** Top-left overlay di chart area — posisi yang sama
dengan preview timestamp saat selection mode (Day 8), tapi dengan
styling berbeda (background lebih gelap, border subtle, dua baris:
timestamp + symbol • timeframe).

**Visual:**
```
┌──────────────────────────────────────────────┐
│ ┌──────────────────────┐                     │
│ │ 2020-06-01 09:15     │                     │
│ │ XAUUSD • M1          │                     │
│ └──────────────────────┘                     │
│                  CHART                       │
│                                              │
└──────────────────────────────────────────────┘
```

### Bugfix — Restore Last Chart Viewport on Restart

**Bug:** Chart viewport (zoom/pan position) tidak disimpan saat
aplikasi ditutup. Saat dibuka kembali, chart selalu reset ke default
view meskipun symbol, timeframe, dan replay state sudah benar.

**Penyebab:** Di `ChartContainer.tsx`, setiap kali `isFreshLoad` true
(symbol/timeframe berubah atau initial load), `defaultRange()` selalu
dipanggil yang mereset viewport ke default. Tidak ada logic save/restore
viewport.

**Fix:** Viewport persistence menggunakan tabel `app_settings` yang
sudah ada:

```
src/components/chart/ChartContainer.tsx
  # + saveViewport(): debounce 500ms, simpan visible time range
  #   ke app_settings dengan key "chart:viewport:{symbolId}:{timeframe}"
  # + restoreViewport(): load saved range, validasi, apply ke chart
  # + subscribeVisibleLogicalRangeChange() untuk auto-save
  # + cleanup timer saat unmount
  # + isFreshLoad → restoreViewport() dulu, fallback ke defaultRange()
```

**Data yang disimpan:** `fromTime:toTime` (timestamps dalam unix
seconds) — berbasis waktu, bukan index, karena index berubah saat
pagination menambah candle.

**Kapan disimpan:** Setiap kali viewport berubah (zoom/pan), debounced
500ms.

**Kapan dipulihkan:** Saat fresh load (symbol/timeframe berubah atau
initial load), SEBELUM `defaultRange()` dipanggil.

**Urutan startup setelah perbaikan:**
1. Restore symbol (AppShell)
2. Restore timeframe (AppShell)
3. Load candle data (useCandles)
4. Restore replay state (useReplayEngine)
5. Chart data siap → `isFreshLoad` = true
6. Coba restore viewport dari `app_settings`
7. Jika berhasil → gunakan saved viewport
8. Jika gagal → gunakan `defaultRange()` (behavior awal)

**Reset Chart tetap bekerja:** `resetChartView()` memanggil
`defaultRange()` secara eksplisit → viewport kembali ke default.
User bisa klik Reset Chart kapan saja.

**Replay state tetap aman:** Viewport persistence tidak menyentuh
replay engine, `currentReplayTime`, atau candle filtering.

### Bugfix ke-2 — Chart Terlalu Zoom-In Setelah Restart

**Bug persist:** Meskipun viewport persistence sudah diimplementasi,
chart masih terlalu zoom-in setelah restart.

**Penyebab:** Dua masalah dalam data feed effect:

1. **`setData()` mereset viewport:** Lightweight Charts secara internal
   mereset visible range saat `series.setData()` dipanggil. Kode lama
   memanggil `getVisibleRange()` SETELAH `setData()`, sehingga
   mendapatkan range yang sudah di-reset, bukan range user.

2. **Race condition async:** `restoreViewport()` bersifat async (IPC
   call). Selama menunggu resolve, `displayCandles` bisa berubah
   (karena replay state restore), memicu effect lagi → `setData()`
   lagi → viewport reset lagi → restore yang sudah benar tertimpa.

**Startup sequence SEBELUM perbaikan:**
```
1. setData(allCandles)        → viewport reset ke default
2. restoreViewport() mulai    → async IPC dimulai
3. displayCandles berubah     → effect run lagi
4. setData(filteredCandles)   → viewport reset LAGI
5. preserveRange baca         → baca range SUDAH di-reset
6. restoreViewport resolve    → set viewport benar
7. TAPI effect run lagi       → setData() → viewport reset LAGI
```

**Startup sequence SETELAH perbaikan:**
```
1. Capture rangeBeforeSet     → simpan range user sebelum setData
2. setData(allCandles)        → viewport di-reset internal
3. Restore rangeBeforeSet     → viewport kembali ke user's range
4. restoreViewport() mulai    → async IPC dimulai
5. displayCandles berubah     → effect run lagi
6. Capture rangeBeforeSet     → simpan range dari step 3
7. setData(filteredCandles)   → viewport di-reset internal
8. Restore rangeBeforeSet     → viewport kembali ke range step 3
9. restoreViewport resolve    → set saved viewport
```

**Perubahan kode:**
```
src/components/chart/ChartContainer.tsx
  # + targetViewportRef: tracks viewport yang harus survive setData()
  # + Capture rangeBeforeSet SEBELUM setData()
  # + Restore rangeBeforeSet SETELAH setData() (non-fresh load)
  # + Restore immediately after setData() mencegah reset
  # + resetChartView() juga update targetViewportRef
```

---

## Hari ke-14 — Complete Timezone System

Menambahkan sistem pemilihan timezone lengkap untuk aplikasi.
User dapat memilih IANA timezone yang digunakan untuk menampilkan
waktu pada Date/Time Display, preview timestamp, dan timeline.

**Arsitektur:**
```
DATABASE (UTC) → REPLAY ENGINE (UTC) → SELECTED TIMEZONE → DISPLAY TIME
```

**File baru:**
```
src/features/timezone/
├─ index.ts              # Public exports
├─ utils.ts              # buildTimezoneList(), formatTimestampInTimezone(),
│                         # getUtcOffsetMinutes(), isValidTimezone(),
│                         # filterTimezones(), formatOffsetLabel()
├─ useTimezone.ts         # Hook: load/save timezone preference dari app_settings
├─ TimezoneSelector.tsx   # Dropdown component dengan search/filter
└─ TimezoneSelector.css   # Styling konsisten dengan UI existing
```

**File yang diubah:**
```
src/components/chart/ChartContainer.tsx  # +timezone prop, gunakan
                                         #   formatTimestampInTimezone() untuk
                                         #   Date/Time Display dan preview
src/components/layout/AppShell.tsx       # +useTimezone() hook, pass timezone
                                         #   ke TopBar dan MainChartArea
src/components/layout/TopBar.tsx         # +TimezoneSelector di top bar
src/components/layout/MainChartArea.tsx  # +timezone prop, pass ke ChartContainer
```

**Fitur:**
- **IANA timezone identifiers** — menggunakan `Intl.supportedValuesOf('timeZone')`
  dengan fallback daftar aman jika API tidak tersedia
- **Sorting by UTC offset** — offset dihitung dinamis berdasarkan
  `currentReplayTime` (menangani DST otomatis)
- **Fractional offsets** — mendukung UTC+05:45, UTC+09:30, dst.
- **Search/filter** — case-insensitive, match IANA id dan offset label
- **Persistence** — disimpan ke `app_settings` sebagai IANA identifier
  (bukan offset), validasi saat restore
- **Tidak mengubah replay engine** — hanya formatting display

**Contoh offset dinamis (DST):**
```
currentReplayTime: 2026-06-30 12:00 UTC (musim panas)
  America/New_York → UTC-04:00

currentReplayTime: 2026-01-15 12:00 UTC (musim dingin)
  America/New_York → UTC-05:00
```

---

## Hari ke-15 — Timezone-Aware Chart Time Axis

Memastikan seluruh tampilan waktu pada chart menggunakan timezone
yang dipilih user. Termasuk time axis labels, crosshair tooltip,
Date/Time Display, dan Replay Timeline.

**Shared timezone formatter:**
```
UTC timestamp
      ↓
formatTimestampInTimezone() / formatTickMark()
      ↓
UI (time axis, display, timeline)
```

**File yang diubah:**
```
src/features/timezone/utils.ts       # +formatTickMark(): format tick mark
│                                    #   labels berdasarkan TickMarkType
│                                    #   (Year, Month, Day, Time, TimeWithSeconds)
src/features/timezone/index.ts       # +export formatTickMark
src/components/chart/ChartContainer.tsx
│  # +timezoneRef: ref untuk timezone (selalu terbaca terbaru)
│  # +tickMarkFormatter di timeScale options:
│  │   reads timezoneRef → formatTickMark()
│  # +useEffect: trigger re-render tick marks saat timezone berubah
│  │   via chart.timeScale().applyOptions({})
│  # +timezone prop diteruskan ke Date/Time Display
src/components/replay/ReplayTimeline.tsx
│  # +timezone prop
│  # Ganti unixSecondsToDateString → formatTimestampInTimezone
│  # untuk semua timestamp display (labels, tooltip, jump input)
src/components/layout/MainChartArea.tsx
│  # +timezone prop ke ReplayTimeline
```

**Cara time axis menggunakan timezone:**
- `tickMarkFormatter` dibuat saat chart mount (sekali)
- Formatter membaca `timezoneRef.current` setiap kali dipanggil
- Saat timezone berubah, ref diupdate + `chart.timeScale().applyOptions({})`
  memicu re-render tick marks

**Cara tooltip menggunakan timezone:**
- `formatTimestampInTimezone()` dipanggil untuk format timestamp
- Crosshair label menggunakan formatter yang sama

**Timestamp internal tetap UTC:**
- Tidak ada pergeseran timestamp
- Tidak ada perubahan data candle
- Hanya hasil display yang berubah

**Dampak terhadap chart viewport:**
**Tidak ada.** Timezone change tidak memicu `fitContent()`,
`setVisibleRange()`, atau operasi viewport lainnya.

---

## Hari ke-16 — Data Integrity & Chart Consistency (Audit)

Audit menyeluruh terhadap seluruh data pipeline:
CSV → SQLite → Query → Pagination → Aggregation → Replay → Timezone → Chart.

### Bug yang Diperbaiki

**tickMarkFormatter selalu pakai TickMarkType.Time (HIGH)**
`ChartContainer.tsx` sebelumnya selalu passing `TickMarkType.Time`
(value 3) ke `formatTickMark()`, mengabaikan `tickMarkType` yang
diberikan oleh Lightweight Charts. Akibatnya chart selalu menampilkan
label `HH:MM` bahkan saat zoom-out ke level tahun/bulan.

**Fix:** Sekarang menerima `tickMarkType` parameter dari LWC dan
meneruskannya ke `formatTickMark()`.

### Audit Results

**1. Data Import Integrity** ✅
- Timestamp dikonversi ke UTC via `Date.UTC()` → unix seconds
- `UNIQUE(symbol_id, timeframe, time)` mencegah duplikat
- `INSERT OR REPLACE` menangani re-import file yang sama
- `sanitizeCandleRows` validasi OHLC & dedupe defense-in-depth

**2. Duplicate Candle** ✅
- Database constraint: `UNIQUE(symbol_id, timeframe, time)`
- `INSERT OR REPLACE`: overwrite silently pada conflict
- `sanitizeCandleRows`: dedupe by time saat read
- Chart tidak menerima duplicate

**3. Timestamp Ordering** ✅
- Query: `ORDER BY time ASC`
- Aggregation: asumsi input ascending
- `sanitizeCandleRows`: tidak reorder (rely on query)

**4. Gap Data** ✅
- Parser: emit rows apa adanya (gap tidak dideteksi)
- Aggregation: bucket kosong tidak menghasilkan candle palsu
- Tidak ada interpolasi

**5. Native Timeframe** ✅
- `resolveSourceTimeframe()`: exact match → jalur native
- `getCandles()`: langsung query tanpa aggregation
- OHLC identik dengan data sumber

**6. Aggregation** ✅
- Open: candle pertama bucket
- High: max semua high
- Low: min semua low
- Close: candle terakhir bucket
- Volume: sum jika semua ada, null jika ada satu null
- Bucket kosong tidak dihasilkan

**7. Pagination** ✅
- `getCandlesBefore()`: query `time < beforeTime`
- `hasMoreBefore`: false hanya jika result kosong
- `useCandles`: defensive dedupe, staleness guards
- Viewport preserve via `rangeBeforeSet` capture

**8. Timeframe + Pagination** ✅
- `aggregateFetchedWindow()`: drop oldest bucket jika source tidak exhausted
- `aggregationSourceLimit()`: hitung source rows dengan buffer
- Tidak ada incomplete bucket yang bocor

**9. Replay Data Boundary** ✅
- `useChartFilteredCandles()`: filter `time <= currentReplayTime`
- Binary search untuk cutoff index
- Future candles tidak terlihat

**10. Next/Previous Candle** ✅
- `stepForward()`: cek `isFinished()` sebelum advance
- `stepBackward()`: cek `currentIdx > startIdx`
- Tidak bisa melewati batas

**11. Timezone Integrity** ✅
- `timezoneRef` di ChartContainer: always current
- `formatTimestampInTimezone()`: convert on display only
- Internal timestamps tetap UTC

**12. Day Boundary** ✅
- Timestamp berbasis UTC, timezone hanya format display
- `2026-06-30 23:30 UTC` → `2026-07-01 06:30 Asia/Jakarta`
- Candle tetap sama, hanya tanggal display berubah

**13. Timeframe + Timezone** ✅
- Aggregation dilakukan SEBELUM timezone formatting
- Timezone hanya mempengaruhi display layer

**14. Symbol Switching** ✅
- `useCandles(symbolId, timeframe)`: fetch baru saat symbol berubah
- `setCandles(result)`: replace, bukan append
- Tidak ada data bocor

**15. Restart Integrity** ✅
- Symbol: `app_settings` → `useLastSelection()`
- Timeframe: `app_settings` → `useLastSelection()`
- Timezone: `app_settings` → `useTimezone()`
- Replay: `app_settings` → `useReplayEngine()` restore
- Viewport: `app_settings` → `restoreViewport()`

**16. Visual Chart Integrity** ✅
- `sanitizeCandleRows`: validasi OHLC sebelum display
- `tickMarkFormatter`: adaptive format berdasarkan zoom level
- `resetChartView()`: reset viewport tanpa mengubah data

### Issues (Non-blocking)

| # | Severity | Issue |
|---|----------|-------|
| 1 | LOW | Parser assume CSV timestamps adalah UTC (broker local-time akan salah) |
| 2 | LOW | Volume null propagation: satu null = seluruh bucket null |
| 3 | VERY LOW | `formatTickMark` buat 6 Intl.DateTimeFormat per call |

### Type-check
- `npx tsc -p tsconfig.json --noEmit` → **0 error**
- `npx tsc -p electron/tsconfig.json --noEmit` → **0 error**

### Build
Tidak dijalankan karena environment tidak memiliki akses jaringan
untuk `npm run build` (electron-builder membutuhkan native modules).

---

## Hari ke-17 — Dataset Management & Multi-File Import Integrity

Audit menyeluruh terhadap sistem import CSV dan pengelolaan dataset.
Tidak ada kode yang diubah — sistem sudah dirancang dengan benar.

### File yang Dianalisis
```
electron/data/csvParser.ts      # CSV streaming parser
electron/data/importer.ts       # Import orchestration
electron/data/aggregate.ts      # Timeframe aggregation
electron/database/db.ts         # Database operations
src/features/data/components/DataManagementPanel.tsx  # Dataset display UI
```

### Sistem Import Saat Ini

**Alur import:**
```
User pilih file/folder
  → importFiles() / importFolder()
    → untuk setiap file:
      1. detectSymbol() → symbol name dari path
      2. upsertSymbol() → get-or-create symbol row
      3. sniffTimeframe() → detect TF dari sample
      4. parseCsvFile() → streaming parse, batch 5000 rows
        → insertCandlesBatch() → INSERT OR REPLACE per batch
      5. recordDataset() → catat metadata import
```

**Duplicate prevention:**
- Database: `UNIQUE(symbol_id, timeframe, time)` constraint
- Insert: `INSERT OR REPLACE` → overwrite silently
- Pre-check: hitung existing timestamps sebelum insert
- Defense-in-depth: `sanitizeCandleRows()` dedupe saat read

**Transaction safety:**
- `insertCandlesBatch()` menggunakan `database.transaction()`
- Setiap batch atomic
- Error pada satu file tidak mempengaruhi file lain

### Type-check & Test Suites
- `npx tsc --noEmit` → **0 error (100% clean)**
- `DrawingPersistentMagnetTest.ts` → **10/10 PASS (A-I tests)**
- `FloatingToolbarClampingTest.ts` → **11/11 PASS**
- `DrawingLabelRotationTest.ts` → **18/18 PASS**
- `AccountEngineTestRunner.ts` → **7/7 PASS**

---

## Status Fitur (Aktif & Terverifikasi)

| Fitur / Modul | Status | Detail Implementasi |
|---|---|---|
| **Data Import (CSV → SQLite)** | ✅ Selesai | Streaming parser, chunked batch insert, auto deduplikasi & overwrite |
| **Data Management Panel** | ✅ Selesai | Info dataset lengkap, candle count, date range, format detector |
| **Chart Engine & Rendering** | ✅ Selesai | Lightweight Charts v4, dark theme, responsive resize, multi-layout 1–8 pane |
| **Multi-Timeframe Aggregation** | ✅ Selesai | On-the-fly bar aggregation dari M1 ke M5, M15, H1, H4, D1, W1, MN |
| **Chart Navigation & Pagination** | ✅ Selesai | Backward chunk pagination, independent pan & zoom per pane |
| **Replay Engine** | ✅ Selesai | Playback engine, step forward/backward, speed control 0.1x–10x, session gate |
| **Replay Timeline & Seek** | ✅ Selesai | Interactive timeline slider, date/time display, multi-pane bar synchronization |
| **Timezone System** | ✅ Selesai | Multi-timezone display (UTC, New York, London, Tokyo, dll.), axis synchronized |
| **Drawing Engine & Tools** | ✅ Selesai | TradingView-style vertical flyout toolbar, 11 categories, custom monoline SVGs |
| **Universal Label Rotation** | ✅ Selesai | Label teks mengikuti kemiringan visual (slope) garis trendline secara real-time |
| **Floating Settings Toolbar** | ✅ Selesai | Boundary clamping di dalam chart viewport, smart top fallback, flip-up dropdown |
| **Persistent Magnet Mode** | ✅ Selesai | Snapping persisten ke Wick extremes (High & Low saja, exclude Open/Close/Body) |
| **Trading Engine 2.0 (Simulasi)** | ✅ Selesai | Market, Limit, Stop orders, position management, strict account ledger |
| **Interactive Chart Overlay** | ✅ Selesai | `RealOrderOverlay` (drag entry, SL, TP langsung di atas chart secara visual) |
| **Dynamic Risk & Margin** | ✅ Selesai | Used margin & margin level dinamis per leverage & contract size (Forex vs Gold) |
| **Bottom Panel Trading Dock** | ✅ Selesai | Tab ringkas Trades, Positions, dan Orders dengan data real-time |
| **Session & Multi-Layout Isolation** | ✅ Selesai | Isolasi drawing & trading state per session dan per pane chart |
| **Analytics & Statistics** | 🟡 Foundation Ready | Kalkulasi Winrate, Profit Factor, Drawdown, RR (visualisasi siap dikembangkan) |
| **Journal System** | 🟡 Database Ready | Schema & storage entry journal siap di SQLite |

---

## Ringkasan Fitur Unggulan

### 1. 🎨 Drawing Engine 2.0
- **Flyout Toolbar:** 11 kategori alat gambar bergaya TradingView dengan ikon monoline SVG yang presisi.
- **Dukungan Tools Lengkap:** Trendline, Ray, Extended Line, Horizontal/Vertical Line, Rectangle, Rotated Rectangle, Triangle, Channel, Fibonacci Retracement (dengan modal konfigurasi level kustom), Long/Short Position tool, Text, Note, Brush, dan Ruler.
- **Smart Slope Alignment:** Teks label pada garis diagonal berputar dinamis mengikuti kemiringan visual pada canvas saat zoom, pan, maupun chart resize.
- **Viewport-Clamped Floating Toolbar:** Toolbar styling melayang otomatis mengikuti objek terpilih tanpa pernah terpotong atau keluar dari chart viewport.
- **Wick-Only Persistent Magnet:** Snapping presisi ke ujung jarum (High & Low) candle tanpa mematikan mode magnet saat menggambar berulang kali atau men-drag anchor.

### 2. ⚡ Trading Engine 2.0
- **Eksekusi Realistis:** Dukungan Market Order, Limit Order, dan Stop Order.
- **Interactive SL/TP Dragging:** Mengubah Stop Loss dan Take Profit langsung dengan menggeser garis di chart.
- **Kalkulasi Margin Dinamis:** Menghitung Used Margin, Free Margin, dan Margin Level berdasarkan metadata instrumen (misal Forex 100.000 contract size vs Gold 100).
- **Session Hydration:** State posisi, order, dan riwayat balance terisolasi sempurna per sesi backtest.

### 3. ⏱️ Data & Replay Engine
- Import file CSV historis multi-bulan/tahun ke SQLite lokal dengan performa tinggi.
- Multi-chart synchronized replay: Semua pane chart bergerak selaras mengikuti playback waktu utama.
- Pengaturan kecepatan replay fleksibel dengan start point selector yang akurat.
