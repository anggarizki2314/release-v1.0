# Walkthrough - AI Copilot Reliability & Clean Redesign

## 1. Penyebab Masalah Chat Manual (Root Cause)
1. **Gemini API Consecutive User Message (HTTP 400 Bad Request)**:
   - Ketika respons AI sebelumnya mengalami error (misal koneksi terputus atau rate limit), pesan balasan error difilter/dibersihkan dari riwayat chat.
   - Hal ini menyisakan 2 (atau lebih) pesan `role: 'user'` berturut-turut di dalam riwayat chat.
   - Google Gemini API memiliki aturan ketat: pesan giliran chat **harus selalu bergantian** (`user` -> `model` -> `user` -> `model`). Jika ada 2 pesan `user` berturut-turut, Gemini menolak dengan `HTTP Error 400: Please ensure that multiturn requests alternate between user and model`.
   - Hal ini membuat pengiriman pesan manual berikutnya terkunci/gagal terus menerus.

2. **Form Submission & Enter Key di Electron**:
   - Di [MiniAiCopilotBar.tsx](file:///c:/Users/AnggaR/Desktop/backup/OLD/OLD/src/features/ai/components/MiniAiCopilotBar.tsx), elemen input belum memiliki handler keyboard `onKeyDown` untuk tombol `Enter`, dan tombol Kirim bertipe `type="submit"` tanpa `onClick` langsung.
   - Jika event form submit tidak terpicu secara default oleh browser/Electron saat menekan Enter, input manual tidak terkirim.

3. **Overhead System Context di Live Copilot**:
   - `MiniAiCopilotBar` sebelumnya menyuntikkan prompt audit sesi analytics raksasa (~5.000 token) dengan larangan menjawab umum.
   - Hal ini menghabiskan kuota free tier Gemini secara cepat dan membuat AI enggan merespons obrolan/pertanyaan santai seputar chart.

4. **Isolasi State saat Tidak Ada Sesi Aktif**:
   - Jika pengguna belum membuat sesi di wizard (`activeSession` null), efek pembersihan chat mereset pesan ke array kosong `[]` pada setiap render.

---

## 2. Penyesuaian Desain (Clean & Balanced Styling)
- **Gelembung Chat (Chat Stream) Dikembalikan Sesuai Selera**:
  - **Pesan Pengguna (Anda)**: Kembali menggunakan gelembung ungu-indigo yang khas (`linear-gradient(135deg, rgba(124, 58, 237, 0.25), rgba(59, 130, 246, 0.2))` dengan border `rgba(139, 92, 246, 0.4)` dan label `👤 ANDA` berwarna `#a78bfa`).
  - **Balasan AI Coach**: Kembali menggunakan label cyan yang khas (`#22d3ee`) dan kotak balasan `#13151d`.
- **Struktur & Kontainer Tetap Bersih & Simple**:
  - Modal container tetap menggunakan border netral gelap dan bayangan halus (tanpa glow ungu menyala).
  - Header & Pill Model tetap bersih, tidak ramai dengan gradien menyala.
  - Footer & tombol aksi tetap rapi dan serasi.

---

## 3. Fitur Loading Pop-up Awal Startup (Splash Screen TradePro)
- **Penggantian Loading Animasi Berulang (Indeterminate Bar)**:
  - Di [electron/main.ts](file:///c:/Users/AnggaR/Desktop/backup/OLD/OLD/electron/main.ts), jendela splash pop-up yang muncul saat aplikasi pertama kali dibuka sebelumnya menggunakan animasi looping garis bolak-balik tanpa angka persentase.
  - Sekarang digantikan dengan **garis persenan (progress bar dinamis)** horizontal yang mengisi dari `0%` sampai `100%`.
- **Loading Penuh di Belakang Layar (Zero Dashboard Lag Fix)**:
  - Di [AppShell.tsx](file:///c:/Users/AnggaR/Desktop/backup/OLD/OLD/src/components/layout/AppShell.tsx), proses startup sekarang benar-benar di-`await` hingga database SQLite, symbols, sessions, dan perhitungan metrik dashboard selesai 100% sebelum memberi sinyal `app:ready`.
  - Jendela splash pop-up menahan dan mengawal proses tersebut dengan progress bar yang terus bergerak mulus.
  - Begitu dashboard sudah matang ter-render di background, progress bar meluncur ke 100% (*Aplikasi siap!*), dan jendela utama langsung dibuka seketika dalam keadaan **sudah siap pakai, mulus 60 FPS, dan bebas lag**.
- **Indikator Persentase & Milestone Tahapan Startup**:
  - `0% - 25%`: *Memulai TradePro Engine...*
  - `25% - 52%`: *Menghubungkan ke SQLite Database...*
  - `52% - 78%`: *Menyiapkan Market & Chart Datasets...*
  - `78% - 95%`: *Memuat Workspace & Analytics...*
  - `96% - 100%`: *Aplikasi siap!*
- **Versi Aplikasi**:
  - Label versi di bagian bawah splash screen dan metadata `package.json` diperbarui menjadi **`v4.0.0`**.

---

## 4. Perbaikan Header Tabel Tembus / Transparan (Sticky Header Solid Fix)
- **Penyebab**:
  - Di [TradingTables.css](file:///c:/Users/AnggaR/Desktop/backup/OLD/OLD/src/features/trading2/ui/TradingTables.css), elemen `th` memiliki properti `backdrop-filter: blur(4px)` dengan `z-index: 2`.
  - Ketika tabel di-scroll ke bawah, baris-baris trade (seperti badge BUY/SELL, SL HIT, harga, dan tombol sampah) bergerak di bawah header dan tampak tembus pandang (*translucent*) membayang di balik teks kolom header.
- **Solusi**:
  - Menghapus efek `backdrop-filter` pada `.te2-table th`.
  - Memberikan latar belakang solid `100% opaque` (`background-color: var(--bg-panel, #0f172a) !important`).
  - Menetapkan `z-index: 20` pada `.te2-table thead` dan `th` serta `box-shadow` batas bawah anti subpixel bleed, sehingga saat tabel di-scroll baris di bawahnya tertutup sempurna tanpa bocor sama sekali.

---

## 5. Visibilitas Indikator Kustom Ala TradingView (Timeframe Range Sliders)
- **Tampilan Sesuai Referensi Pengguna**:
  - Tab **Visibilitas** di modal pengaturan indikator ([IndicatorSettingsModal.tsx](file:///c:/Users/AnggaR/Desktop/backup/OLD/OLD/src/features/indicators/IndicatorSettingsModal.tsx)) kini menyajikan 8 baris kerangka waktu:
    1. `[x] Tick` (Checkbox)
    2. `[x] Detik` `[ 1 ]` `---o---` `[ 59 ]` (Range min/max: 1 s/d 59)
    3. `[x] Menit` `[ 1 ]` `---o---` `[ 59 ]` (Range min/max: 1 s/d 59)
    4. `[x] Jam` `[ 1 ]` `---o---` `[ 24 ]` (Range min/max: 1 s/d 24)
    5. `[x] Hari` `[ 1 ]` `---o---` `[ 366 ]` (Range min/max: 1 s/d 366)
    6. `[x] Minggu` `[ 1 ]` `---o---` `[ 52 ]` (Range min/max: 1 s/d 52)
    7. `[x] Bulan` `[ 1 ]` `---o---` `[ 12 ]` (Range min/max: 1 s/d 12)
    8. `[x] Ranges` (Checkbox)
- **Kontrol Dual Range Slider & Number Inputs**:
  - **Dua Thumb Handle**: Thumb kiri mengatur nilai `min`, thumb kanan mengatur nilai `max`.
  - **Highlight Bar**: Batang aktif putih mengisi jarak antara kedua thumb secara presisi.
  - **Interaksi Fleksibel**: Pengguna dapat menggeser thumb slider, mengklik posisi track, mengetik angka langsung di kotak input, atau memakai tombol panah atas/bawah (spinner).
  - **Kondisi Dinonaktifkan**: Jika checkbox satuan waktu tidak dicentang, input dan slider baris tersebut otomatis dimmed / dinonaktifkan.
- **Evaluasi Multi-Timeframe Presisi**:
  - Di [types.ts](file:///c:/Users/AnggaR/Desktop/backup/OLD/OLD/src/features/indicators/types.ts), fungsi `isIndicatorVisibleOnTimeframe(visibility, timeframe)` mem-parsing satuan (`minutes`, `hours`, `days`, dll.) sekaligus besaran angkanya (misal `M1` -> value 1, `M15` -> value 15, `H4` -> value 4, `D1` -> value 1).
  - Indikator hanya akan ditampilkan pada chart jika besaran kerangka waktu berada di dalam rentang `[min, max]` yang diizinkan pengguna.
  - Menjaga kompatibilitas mundur penuh (100% backward compatible) untuk data indikator lama.
- **Verifikasi**:
  - 29 unit tests pada `IndicatorTimeframeVisibilityTest.ts` lulus 100% (`npm run typecheck` 0 error).

---

## 6. Perbaikan Bug Auto-Straight Drawing (Shift Key Snap Fix)
- **Penyebab Bug**:
  1. **Konversi Round-Trip Koordinat ke Harga/Waktu**: Ketika menggambar garis dengan Shift, koordinat yang di-snap secara horizontal dikonversi ulang melalui `cs.yToPrice(pixelY)`. Karena resolusi floating point pixel di chart, harga titik kedua sedikit berbeda (misal selisih 0.00003), sehingga garis yang disimpan menjadi miring (tidak 100% lurus datar).
  2. **Interferensi Magnet Snapping**: Saat magnet aktif, titik ujung garis ditarik ke candle terdekat, merusak sudut horizontal/vertikal Shift.
  3. **Event Keyboard Shift Tidak Responsif**: Sebelumnya penekanan tombol Shift hanya dibaca saat mouse bergerak (`mousemove`). Jika pengguna menekan atau melepas Shift saat mouse diam, garis tidak langsung melakukan snap/un-snap.
  4. **Bug Fallback `priceToY` di `ChartInteractionBridge`**: Ketika series LWC me-return null coordinate, fungsi memanggil `priceFromY(chart, series, p)` yang mengembalikan harga (angka kecil ~1.08) sebagai koordinat piksel Y, menyebabkan garis meloncat ke tepi atas chart.
- **Solusi**:
  - Di [InteractionController.ts](file:///c:/Users/AnggaR/Desktop/backup/OLD/OLD/src/features/drawing/interaction/InteractionController.ts), fungsi `snapToShiftAngles` kini menandai orientasi `isHorizontal` dan `isVertical`.
  - Jika horizontal, titik kedua dipaksa **menggunakan harga yang 100% identik dengan titik pertama (`price = p1.price`)**, bebas dari distorsi piksel dan magnet candle.
  - Jika vertikal, titik kedua dipaksa **menggunakan timestamp yang 100% identik dengan titik pertama (`time = p1.time`)**.
  - Di [DrawingCanvas.tsx](file:///c:/Users/AnggaR/Desktop/backup/OLD/OLD/src/features/drawing/components/DrawingCanvas.tsx), menambahkan listener `keydown` dan `keyup` untuk tombol Shift (`controller.handleShiftState`), sehingga preview garis seketika me-snap atau meng-unsnap lurus secara real-time bahkan ketika mouse sedang diam.
  - Di [DragController.ts](file:///c:/Users/AnggaR/Desktop/backup/OLD/OLD/src/features/drawing/interaction/DragController.ts), proses resize garis saat menekan Shift kini juga mengunci harga/waktu anchor secara presisi pada saat di-commit (`commit()`).
  - Di [ChartInteractionBridge.ts](file:///c:/Users/AnggaR/Desktop/backup/OLD/OLD/src/features/drawing/interaction/ChartInteractionBridge.ts), memperbaiki fallback `priceToY`.

---

## 7. Hasil Verifikasi
- `npm run typecheck`: **0 errors**.
- `DrawingShiftSnapTest.ts`: Semua tes snap horizontal (0° & 180°), vertikal (90° & -90°), dan diagonal (45°) lulus 100%.
- `npm run build`: Berhasil mengompilasi bundel Vite & TypeScript Electron tanpa error (`tsc -p electron/tsconfig.json`).
