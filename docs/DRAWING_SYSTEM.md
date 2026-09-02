# Drawing System Architecture — Day 21 Foundation

## Overview

Drawing System adalah fondasi untuk semua visual annotations di chart.
Dimulai dari Day 21 (foundation) hingga Day 25+ (implementasi lengkap).

## Arsitektur

```
src/features/drawing/
├── types.ts              # Semua tipe: Drawing, Style, Events, Registry
├── DrawingManager.ts     # Central hub: CRUD, Selection, Events, Layer
├── DrawingLayer.tsx       # SVG overlay rendering drawings di chart
├── DrawingLayer.css       # Styles untuk drawing layer
├── useDrawings.ts        # React hook menghubungkan Manager ↔ UI
├── ColorPicker.tsx        # Full color picker (HEX/RGB)
├── ColorPicker.css        # Styles untuk color picker
├── stylePersistence.ts   # IPC wrapper untuk DB persistence
└── index.ts              # Feature exports
```

## Core Concepts

### 1. Drawing Model (Base)
```
BaseDrawing {
  id, type, points, style,
  visible, locked, selected,
  layer { z }, createdAt, updatedAt
}
```

Setiap drawing type extends BaseDrawing:
- `HorizontalLineDrawing` — 1 point (price only)
- `VerticalLineDrawing` — 1 point (time only)
- `TrendlineDrawing` — 2 points
- `RayDrawing` — 2 points (extended line)
- `RectangleDrawing` — 2 points (corners)
- `FibonacciDrawing` — 2 points + levels
- `TextDrawing` — 1 point + text
- `ArrowDrawing` — 2 points
- `PolygonDrawing` — 3+ points

### 2. Coordinate System
Semua drawing menggunakan **time/price** (bukan pixel).

```
DrawingPoint { time: number (unix seconds), price: number }
```

Ketika zoom, pan, atau timeframe berubah, drawings otomatis
di-reposition menggunakan chart's coordinate conversion:
- `timeToX()` — convert time → pixel X
- `priceToY()` — convert price → pixel Y

### 3. Style System (Reusable, Global)
```typescript
DrawingStyle {
  color, lineWidth, lineStyle, opacity,
  fill, fillOpacity,
  border, borderColor, borderWidth, borderStyle,
  fontSize, fontFamily, bold, italic
}
```

Style defaults per drawing type ditentukan di `TYPE_DEFAULT_STYLES`.
User bisa override per-drawing via `updateDrawingStyle()`.

### 4. Layer System
Setiap drawing punya `layer.z` — higher = on top.
API: `bringForward()`, `sendBackward()`, `bringToFront()`, `sendToBack()`

### 5. Event System
```
onCreate | onUpdate | onDelete | onSelect | onDeselect
onMove | onLayerChange | onVisibilityChange | onLockChange | onStyleChange
```

`onAny()` — listen ke semua event types.

### 6. Persistence
- **Per (symbol, timeframe)** — drawings disimpan di SQLite
- **Style defaults** — per drawing type, global
- **Templates** — user-named presets
- **Auto-save** — debounced 500ms on change

### 7. DrawingManager API

| Method | Description |
|--------|-------------|
| `createDrawing(params)` | Create new drawing |
| `updateDrawing({id, points, style})` | Update existing |
| `deleteDrawing(id)` | Remove drawing |
| `getDrawing(id)` | Get by ID |
| `getAllDrawings()` | Get all, sorted by layer |
| `selectDrawing(id)` | Select (deselects previous) |
| `clearSelection()` | Deselect all |
| `updateDrawingStyle(id, style)` | Update style only |
| `getDrawingStyle(id)` | Get current style |
| `duplicateDrawing(id)` | Clone drawing |
| `showDrawing(id)` / `hideDrawing(id)` | Toggle visibility |
| `lockDrawing(id)` / `unlockDrawing(id)` | Toggle lock |
| `bringForward(id)` / `sendBackward(id)` | Layer reorder |
| `bringToFront(id)` / `sendToBack(id)` | Layer reorder |
| `serialize()` / `deserialize(data)` | Save/load |
| `clearAll()` | Remove all drawings |
| `on(event, handler)` | Subscribe to event type |
| `onAny(handler)` | Subscribe to all events |

### 8. useDrawings Hook API

Same as DrawingManager, plus:
- `drawings` — reactive array
- `selectedId` — reactive selection
- `activeTool` / `setActiveTool` — current drawing tool
- `loading` — DB load state
- `saveToDb()` — manual save trigger
- `onEvent(handler)` — subscribe to events

### 9. DrawingLayer

SVG overlay di atas chart. Convert time/price → pixel via chart refs.
Handles:
- Rendering all drawings (sorted by layer)
- Click to select
- Two-click drawing creation (preview while drawing)
- Cursor change based on active tool

## Rencana Hari-hari Berikutnya

### Day 22: Horizontal Line + Vertical Line
- Implementasi rendering lengkap
- Klik pada chart → langsung buat garis
- Select → ubah warna/ketebalan

### Day 23: Trend Line, Ray, Arrow
- Two-click creation
- Drag untuk resize
- Style panel untuk editing

### Day 24: Rectangle, Fibonacci
- Rectangle dengan fill
- Fibonacci dengan customizable levels
- Label rendering

### Day 25: Text, Polygon, Advanced
- Text input dialog
- Multi-point polygon
- Snap to OHLC
- Undo/Redo
- Export drawings

## Data Flow

```
User clicks chart
    ↓
DrawingLayer.handleSvgClick
    ↓
useDrawings.createDrawing
    ↓
DrawingManager.createDrawing
    ↓
emit('create') → React re-render + auto-save to DB
    ↓
DrawingLayer.renderDrawing → SVG rendered
```
