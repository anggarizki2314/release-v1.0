import sqlite3, os, datetime

p = os.path.expanduser('~/AppData/Roaming/Electron/forex-replay.db')
conn = sqlite3.connect(p)
cur = conn.cursor()

print("=== AUDIT SUMMARY DATA FOR EURUSD ===")
cur.execute("SELECT MIN(time), MAX(time), COUNT(*) FROM candles WHERE symbol_id=95 AND timeframe='M1'")
min_t, max_t, count = cur.fetchone()
print(f"Total M1 Candles in SQLite: {count}")
print(f"Earliest Candle (min_t): {min_t} -> {datetime.datetime.fromtimestamp(min_t, datetime.timezone.utc).isoformat()}")
print(f"Latest Candle (max_t):   {max_t} -> {datetime.datetime.fromtimestamp(max_t, datetime.timezone.utc).isoformat()}")

print("\n--- Hour by hour breakdown on 2024-01-01 (UTC) ---")
for h in range(24):
    h_start = int(datetime.datetime.strptime(f"2024-01-01 {h:02d}:00:00+0000", "%Y-%m-%d %H:%M:%S%z").timestamp())
    h_end = h_start + 3599
    cur.execute("SELECT COUNT(*) FROM candles WHERE symbol_id=95 AND timeframe='M1' AND time >= ? AND time <= ?", (h_start, h_end))
    c_count = cur.fetchone()[0]
    if c_count > 0:
        print(f"2024-01-01 {h:02d}:00 UTC -> {c_count} candles")

print("\n--- Hour by hour breakdown on 2024-01-07 (UTC) (Sunday open) ---")
for h in range(24):
    h_start = int(datetime.datetime.strptime(f"2024-01-07 {h:02d}:00:00+0000", "%Y-%m-%d %H:%M:%S%z").timestamp())
    h_end = h_start + 3599
    cur.execute("SELECT COUNT(*) FROM candles WHERE symbol_id=95 AND timeframe='M1' AND time >= ? AND time <= ?", (h_start, h_end))
    c_count = cur.fetchone()[0]
    if c_count > 0:
        print(f"2024-01-07 {h:02d}:00 UTC -> {c_count} candles")

print("\n--- Daily Totals for Week 1 (2024-01-01 to 2024-01-08) ---")
for d in range(1, 9):
    d_str = f"2024-01-{d:02d}"
    d_start = int(datetime.datetime.strptime(f"{d_str} 00:00:00+0000", "%Y-%m-%d %H:%M:%S%z").timestamp())
    d_end = int(datetime.datetime.strptime(f"{d_str} 23:59:59+0000", "%Y-%m-%d %H:%M:%S%z").timestamp())
    cur.execute("SELECT COUNT(*), MIN(time), MAX(time) FROM candles WHERE symbol_id=95 AND timeframe='M1' AND time >= ? AND time <= ?", (d_start, d_end))
    cnt, m_min, m_max = cur.fetchone()
    dt_min = datetime.datetime.fromtimestamp(m_min, datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC") if m_min else "None"
    dt_max = datetime.datetime.fromtimestamp(m_max, datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC") if m_max else "None"
    weekday = datetime.datetime.strptime(d_str, "%Y-%m-%d").strftime("%A")
    print(f"{d_str} ({weekday:<9}): {cnt:>5} candles | Range: {dt_min} -> {dt_max}")
