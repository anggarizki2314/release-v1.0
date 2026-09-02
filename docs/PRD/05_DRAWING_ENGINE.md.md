# PHASE 05 — WORLD SPACE RENDERING ENGINE

ROLE

Kamu adalah Senior Graphics Engineer dan Senior Frontend Engineer.

Project ini adalah aplikasi Forex Replay berbasis Electron + React + TypeScript + Lightweight Charts.

Kamu sedang melanjutkan implementasi Drawing Engine V2.

Phase 01–04 sudah selesai.

Pada phase ini fokusnya hanya membuat sistem rendering World Space.

JANGAN mengubah fitur replay.
JANGAN mengubah database.
JANGAN mengubah trading engine.
JANGAN mengubah buy/sell drawing logic.
JANGAN melakukan commit.

--------------------------------------------------

TUJUAN

Saat ini semua drawing masih dirender berdasarkan candle yang sedang tampil.

Itu salah.

Yang benar adalah:

Drawing harus hidup pada World Coordinate.

Artinya:

Drawing tidak tergantung jumlah candle yang sedang dirender.

Drawing tetap eksis walaupun:

- chart di zoom out
- chart di zoom in
- chart dipan
- timeframe berubah
- replay berjalan
- viewport berubah
- candle di kiri belum diload
- candle di kanan belum ada

Drawing hanya dipotong saat proses rendering.

Data drawing tidak pernah berubah.

--------------------------------------------------

KONSEP BARU

Pisahkan proses menjadi:

World Drawing

↓

Visible Drawing

↓

Canvas Render

JANGAN render langsung dari WorldDrawing.

--------------------------------------------------

PIPELINE BARU

WorldDrawingStore

↓

WorldRenderer

↓

VisibleRenderer

↓

CanvasRenderer

--------------------------------------------------

WORLD RENDERER

Buat module baru:

src/features/drawing/rendering/WorldRenderer.ts

Tugasnya:

Menerima seluruh drawing.

Menghasilkan WorldRenderObject.

JANGAN clipping.

JANGAN filtering.

JANGAN transform.

Output hanya object siap dirender.

--------------------------------------------------

VISIBLE RENDERER

Buat module:

VisibleRenderer.ts

Input:

WorldRenderObject

+

Viewport

Output:

VisibleDrawing

Di sinilah:

clipping

cropping

visibility

dihitung.

--------------------------------------------------

CANVAS RENDERER

CanvasRenderer hanya boleh:

drawLine()

drawPolygon()

drawRectangle()

drawCircle()

drawText()

Tidak boleh:

menghitung visibility

mengubah data

mengubah koordinat world

--------------------------------------------------

VISIBLE CHECK

Setiap drawing memiliki:

boundingBox

Viewport juga memiliki:

boundingBox

VisibleRenderer melakukan:

boundingBox intersection

Jika overlap

↓

render

Jika tidak

↓

skip

--------------------------------------------------

INFINITE OBJECT

Support:

Horizontal Line

Vertical Line

Ray

Extended Ray

Trend Line

Regression Line

Projection

Semuanya tidak boleh mempunyai endpoint tetap saat rendering.

Canvas hanya menggambar bagian yang masuk viewport.

--------------------------------------------------

POLYLINE

Support:

Polyline

Polygon

Rectangle

Brush

Path

Semuanya memakai World Point.

Canvas hanya menerima hasil clipping.

--------------------------------------------------

TEXT

Text memakai World Coordinate.

Text tidak boleh berubah posisi saat zoom.

--------------------------------------------------

CACHE

Tambahkan cache:

WorldRenderCache

VisibleRenderCache

Cache invalid hanya saat:

drawing berubah

viewport berubah

--------------------------------------------------

JANGAN

Jangan mengubah:

Replay

Engine

Database

Toolbar

Drawing Tool

Selection

Undo Redo

--------------------------------------------------

FILE BARU

Buat:

rendering/

    WorldRenderer.ts

    VisibleRenderer.ts

    CanvasRenderer.ts

    RenderTypes.ts

--------------------------------------------------

FILE YANG BOLEH DIUBAH

DrawingLayer

Renderer

DrawingCanvas

--------------------------------------------------

EXPECTED RESULT

Setelah selesai:

✓ WorldDrawing tidak pernah berubah.

✓ VisibleDrawing berubah mengikuti viewport.

✓ Canvas hanya menggambar VisibleDrawing.

✓ Semua drawing tetap eksis walaupun candle belum tampil.

✓ Semua drawing siap mendukung infinite object.

✓ Tidak ada perubahan perilaku replay.

--------------------------------------------------

CARA TEST

TEST 1

Buat rectangle.

Zoom in.

Rectangle tetap utuh.

--------------------------------------------------

TEST 2

Pan jauh.

Rectangle hilang dari viewport.

Pan kembali.

Rectangle muncul lagi.

--------------------------------------------------

TEST 3

Buat horizontal line.

Harus selalu memanjang mengikuti viewport.

--------------------------------------------------

TEST 4

Buat vertical line.

Harus selalu memanjang penuh.

--------------------------------------------------

TEST 5

Buat trendline panjang.

Zoom 500%.

Trendline tetap lurus.

--------------------------------------------------

TEST 6

Replay berjalan.

Drawing tetap berada pada posisi world yang sama.

--------------------------------------------------

TEST 7

Ganti timeframe.

Drawing tetap berada di lokasi yang benar.

--------------------------------------------------

CHECKLIST

☐ WorldRenderer selesai

☐ VisibleRenderer selesai

☐ CanvasRenderer selesai

☐ BoundingBox clipping selesai

☐ Infinite object support selesai

☐ Replay tidak berubah

☐ Tidak ada regression

--------------------------------------------------

JANGAN COMMIT.

Setelah implementasi selesai, tampilkan:

WORLD RENDERING ENGINE COMPLETE

beserta daftar file yang dibuat dan file yang diubah.