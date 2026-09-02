# Walkthrough - Timezone System Implementation

The timezone display system in Forex Replay has been updated to function like TradingView:
- Changing the timezone alters **only** display formatting (presentation layer).
- Timezone changes do **NOT** reload candles, recreate the chart, call `setData()`, or invalidate data caches.
- Internal database, replay engine, and candle timestamps remain 100% UTC unix seconds.

## Changes Made

### 1. [TimezoneSelector.tsx](file:///c:/Users/AnggaR/Desktop/forex-replay/src/features/timezone/TimezoneSelector.tsx)
- Converted `TimezoneSelector` into a controlled presentation component.
- Accepts `value: string` and `onChange: (timezone: string) => void`.
- Removed internal local state and direct database save/load effects so `TimezoneSelector` relies on parent state as the source of truth.

### 2. [TopBar.tsx](file:///c:/Users/AnggaR/Desktop/forex-replay/src/components/layout/TopBar.tsx)
- Updated `TopBar` to pass `value={timezone}` and `onChange={onTimezoneChange}` directly down to `<TimezoneSelector />`.

### 3. [AppShell.tsx](file:///c:/Users/AnggaR/Desktop/forex-replay/src/components/layout/AppShell.tsx)
- Connected `useTimezone()` loaded state with `WorkspaceContext` state (`updateChart({ timezone })`).
- Propagated active timezone down through `TopBar` and `MainChartArea`.

### 4. [ChartContainer.tsx](file:///c:/Users/AnggaR/Desktop/forex-replay/src/components/chart/ChartContainer.tsx)
- Added `localization.timeFormatter` to Lightweight Charts initialization so crosshair time tooltips format timestamps in the active timezone.
- Added `useEffect([timezone])` that updates `localization.timeFormatter` and `timeScale.tickMarkFormatter` via `chart.applyOptions(...)` and triggers a timeScale redraw on timezone changes.
- Ensures chart instance is **NOT** recreated and `setData()` is **NOT** called when timezone changes.

---

## Verification Results

### TypeScript & Production Build
- `npx tsc --noEmit` completed with **0 errors**.
- `npm run build` completed successfully:
  - Vite production bundle built in 9.53s.
