import sqlite3, os, datetime

p = os.path.expanduser('~/AppData/Roaming/Electron/forex-replay.db')
conn = sqlite3.connect(p)
cur = conn.cursor()

start_t = int(datetime.datetime.strptime("2024-01-02 00:00:00+0000", "%Y-%m-%d %H:%M:%S%z").timestamp())
end_t = int(datetime.datetime.strptime("2024-01-09 04:00:00+0000", "%Y-%m-%d %H:%M:%S%z").timestamp())

cur.execute("SELECT time, open, high, low, close FROM candles WHERE symbol_id=95 AND timeframe='M1' AND time >= ? AND time <= ? ORDER BY time ASC", (start_t, end_t))
m1_rows = cur.fetchall()

# Resample to H1
h1_bars = []
by_hour = {}
for r in m1_rows:
    t, o, h, l, c = r
    h1_t = (t // 3600) * 3600
    if h1_t not in by_hour:
        by_hour[h1_t] = {'time': h1_t, 'open': o, 'high': h, 'low': l, 'close': c}
        h1_bars.append(by_hour[h1_t])
    else:
        by_hour[h1_t]['high'] = max(by_hour[h1_t]['high'], h)
        by_hour[h1_t]['low'] = min(by_hour[h1_t]['low'], l)
        by_hour[h1_t]['close'] = c

# Chart dimensions
width = 1200
height = 650
padding_top = 50
padding_bottom = 60
padding_left = 60
padding_right = 90

chart_w = width - padding_left - padding_right
chart_h = height - padding_top - padding_bottom

min_price = min(b['low'] for b in h1_bars) - 0.0010
max_price = max(b['high'] for b in h1_bars) + 0.0010
price_range = max_price - min_price

def price_to_y(price):
    return padding_top + chart_h - ((price - min_price) / price_range) * chart_h

bar_w = max(4, chart_w / len(h1_bars) * 0.7)
step_x = chart_w / len(h1_bars)

svg_parts = []
svg_parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" style="background-color: #131722; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;">')

# Background grid
svg_parts.append(f'<rect width="{width}" height="{height}" fill="#131722" />')

# Grid lines (horizontal price lines)
for p_level in [1.0860, 1.0880, 1.0900, 1.0920, 1.0940, 1.0960, 1.0980, 1.1000, 1.1020, 1.1040, 1.1060]:
    if min_price <= p_level <= max_price:
        y = price_to_y(p_level)
        svg_parts.append(f'<line x1="{padding_left}" y1="{y:.1f}" x2="{width - padding_right}" y2="{y:.1f}" stroke="#2a2e39" stroke-dasharray="2,2" stroke-width="1" />')
        svg_parts.append(f'<text x="{width - padding_right + 8}" y="{y + 4:.1f}" fill="#787b86" font-size="11" font-family="monospace">{p_level:.4f}</text>')

# Title Header
svg_parts.append(f'<text x="60" y="32" fill="#d1d4dc" font-size="16" font-weight="bold">EURUSD · 1H · HISTORICAL REAL MARKET DATA</text>')
svg_parts.append(f'<text x="480" y="32" fill="#787b86" font-size="13">Jan 02, 2024 – Jan 09, 2024 (Including Jan 5 NFP Event)</text>')

# Draw Candles
last_date_str = ""
for i, b in enumerate(h1_bars):
    cx = padding_left + i * step_x + step_x / 2
    y_open = price_to_y(b['open'])
    y_close = price_to_y(b['close'])
    y_high = price_to_y(b['high'])
    y_low = price_to_y(b['low'])

    is_bull = b['close'] >= b['open']
    color = "#089981" if is_bull else "#f23645"

    # Wick
    svg_parts.append(f'<line x1="{cx:.1f}" y1="{y_high:.1f}" x2="{cx:.1f}" y2="{y_low:.1f}" stroke="{color}" stroke-width="1.2" />')

    # Body
    body_top = min(y_open, y_close)
    body_h = max(2, abs(y_close - y_open))
    body_x = cx - bar_w / 2
    svg_parts.append(f'<rect x="{body_x:.1f}" y="{body_top:.1f}" width="{bar_w:.1f}" height="{body_h:.1f}" fill="{color}" />')

    # Date markers on X axis
    dt = datetime.datetime.fromtimestamp(b['time'], datetime.timezone.utc)
    cur_date_str = dt.strftime("%m-%d")
    hour = dt.hour
    if cur_date_str != last_date_str:
        last_date_str = cur_date_str
        svg_parts.append(f'<line x1="{cx:.1f}" y1="{padding_top}" x2="{cx:.1f}" y2="{height - padding_bottom}" stroke="#2a2e39" stroke-width="1" />')
        svg_parts.append(f'<text x="{cx:.1f}" y="{height - padding_bottom + 20}" fill="#d1d4dc" font-size="12" font-weight="600" text-anchor="middle">{cur_date_str}</text>')
    elif hour == 12:
        svg_parts.append(f'<text x="{cx:.1f}" y="{height - padding_bottom + 16}" fill="#787b86" font-size="10" text-anchor="middle">12:00</text>')

# Annotation on Jan 5 NFP Spike
# Find Jan 5 13:00 / 15:00
for i, b in enumerate(h1_bars):
    dt = datetime.datetime.fromtimestamp(b['time'], datetime.timezone.utc)
    if dt.day == 5 and dt.hour == 15:
        cx = padding_left + i * step_x + step_x / 2
        y_high = price_to_y(b['high'])
        svg_parts.append(f'<rect x="{cx - 75}" y="{y_high - 30}" width="150" height="22" rx="4" fill="#2962ff" opacity="0.9" />')
        svg_parts.append(f'<text x="{cx}" y="{y_high - 15}" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle">5 Jan NFP Spike: 1.0998</text>')
    if dt.day == 5 and dt.hour == 13:
        cx = padding_left + i * step_x + step_x / 2
        y_low = price_to_y(b['low'])
        svg_parts.append(f'<rect x="{cx - 65}" y="{y_low + 12}" width="130" height="22" rx="4" fill="#f23645" opacity="0.9" />')
        svg_parts.append(f'<text x="{cx}" y="{y_low + 27}" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle">NFP Low: 1.0876</text>')

svg_parts.append('</svg>')

svg_content = "\n".join(svg_parts)

out_path = r"C:\Users\AnggaR\.gemini\antigravity-ide\brain\556c3dfc-a580-416a-b258-5cf4d2c598ae\eurusd_h1_jan2024_chart.svg"
with open(out_path, "w", encoding="utf-8") as f:
    f.write(svg_content)

print("SVG generated successfully at:", out_path)
