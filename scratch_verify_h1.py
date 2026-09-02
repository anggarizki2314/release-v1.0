import sqlite3, os, datetime

p = os.path.expanduser('~/AppData/Roaming/Electron/forex-replay.db')
conn = sqlite3.connect(p)
cur = conn.cursor()

start_t = int(datetime.datetime.strptime("2024-01-02 00:00:00+0000", "%Y-%m-%d %H:%M:%S%z").timestamp())
end_t = int(datetime.datetime.strptime("2024-01-08 23:59:59+0000", "%Y-%m-%d %H:%M:%S%z").timestamp())

cur.execute("SELECT time, open, high, low, close FROM candles WHERE symbol_id=95 AND timeframe='M1' AND time >= ? AND time <= ? ORDER BY time ASC", (start_t, end_t))
m1_rows = cur.fetchall()

# Resample to H1
h1_bars = {}
for r in m1_rows:
    t, o, h, l, c = r
    h1_t = (t // 3600) * 3600
    if h1_t not in h1_bars:
        h1_bars[h1_t] = {'open': o, 'high': h, 'low': l, 'close': c}
    else:
        h1_bars[h1_t]['high'] = max(h1_bars[h1_t]['high'], h)
        h1_bars[h1_t]['low'] = min(h1_bars[h1_t]['low'], l)
        h1_bars[h1_t]['close'] = c

print("=== VERIFIKASI EURUSD H1 DI SQLITE UNTUK JANUARI 2 - 8, 2024 ===")
for h1_t in sorted(h1_bars.keys()):
    dt = datetime.datetime.fromtimestamp(h1_t, datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    b = h1_bars[h1_t]
    # Highlight significant price action
    if "00:00" in dt or "13:00" in dt or "14:00" in dt or "15:00" in dt or "07:00" in dt or "2024-01-05" in dt:
        print(f"[{dt}] Open: {b['open']:.5f} | High: {b['high']:.5f} | Low: {b['low']:.5f} | Close: {b['close']:.5f}")
