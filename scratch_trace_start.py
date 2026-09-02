import sqlite3, os, datetime

p = os.path.expanduser('~/AppData/Roaming/Electron/forex-replay.db')
conn = sqlite3.connect(p)
cur = conn.cursor()

# Get EURUSD M1 candles in the first 7 days
start_utc = int(datetime.datetime.strptime("2024-01-01 00:00:00+0000", "%Y-%m-%d %H:%M:%S%z").timestamp())
end_utc = start_utc + 7 * 86400 # 2024-01-08 00:00:00 UTC

cur.execute("SELECT time, open, high, low, close, volume FROM candles WHERE symbol_id=95 AND timeframe='M1' AND time >= ? AND time <= ? ORDER BY time ASC", (start_utc, end_utc))
candles = cur.fetchall()

print(f"Total candles in initial 7-day prefetch: {len(candles)}")
if candles:
    print(f"First candle: {candles[0][0]} ({datetime.datetime.fromtimestamp(candles[0][0], datetime.timezone.utc).isoformat()})")
    print(f"Last candle: {candles[-1][0]} ({datetime.datetime.fromtimestamp(candles[-1][0], datetime.timezone.utc).isoformat()})")

    # In ReplaySetupModal:
    defaultStartIdx = min(100, int(len(candles) * 0.25))
    defaultStartSec = candles[defaultStartIdx][0]
    print(f"\nReplaySetupModal defaultStartIdx: {defaultStartIdx}")
    print(f"ReplaySetupModal defaultStartSec: {defaultStartSec} ({datetime.datetime.fromtimestamp(defaultStartSec, datetime.timezone.utc).isoformat()})")

# Let's check what happens if user chooses 2024-01-01
selected_date = "2024-01-01"
selected_utc_sec = int(datetime.datetime.strptime("2024-01-01 00:00:00+0000", "%Y-%m-%d %H:%M:%S%z").timestamp())
print(f"\nUser selected date: {selected_date} -> timestamp: {selected_utc_sec}")

# findFirstCandleIndexOnOrAfter in candles:
found_idx = -1
for i, c in enumerate(candles):
    if c[0] >= selected_utc_sec:
        found_idx = i
        break
print(f"findFirstCandleIndexOnOrAfter index: {found_idx}")
if found_idx >= 0:
    print(f"Candle at index {found_idx}: {candles[found_idx][0]} ({datetime.datetime.fromtimestamp(candles[found_idx][0], datetime.timezone.utc).isoformat()})")

# Now check what candles exist in SQLite starting from 2024-01-01 up to 10,000 candles
cur.execute("SELECT time FROM candles WHERE symbol_id=95 AND timeframe='M1' AND time >= ? ORDER BY time ASC LIMIT 10000", (selected_utc_sec,))
all_10k = cur.fetchall()
print(f"\n10,000 candles query:")
print(f"Total returned: {len(all_10k)}")
print(f"First: {all_10k[0][0]} ({datetime.datetime.fromtimestamp(all_10k[0][0], datetime.timezone.utc).isoformat()})")
print(f"Last: {all_10k[-1][0]} ({datetime.datetime.fromtimestamp(all_10k[-1][0], datetime.timezone.utc).isoformat()})")

# Check index 6064 (from SQLite session row):
if len(all_10k) > 6064:
    c6064 = all_10k[6064][0]
    print(f"\nCandle at index 6064 in 10k dataset: {c6064} ({datetime.datetime.fromtimestamp(c6064, datetime.timezone.utc).isoformat()})")
