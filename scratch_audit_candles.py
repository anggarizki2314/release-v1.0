import sqlite3, os, datetime

p = os.path.expanduser('~/AppData/Roaming/Electron/forex-replay.db')
conn = sqlite3.connect(p)
cur = conn.cursor()

print("=== 1. DATASETS & METADATA FOR EURUSD (symbol_id=95) ===")
cur.execute("SELECT id, symbol_id, timeframe, first_time, last_time, rows_inserted FROM datasets WHERE symbol_id=95")
for row in cur.fetchall():
    st = datetime.datetime.fromtimestamp(row[3], datetime.timezone.utc).isoformat() if row[3] else 'None'
    et = datetime.datetime.fromtimestamp(row[4], datetime.timezone.utc).isoformat() if row[4] else 'None'
    print(f"Dataset id={row[0]}, tf={row[2]}, first_time={row[3]} ({st}), last_time={row[4]} ({et}), rows={row[5]}")

print("\n=== 2. EARLIEST 20 CANDLES FOR EURUSD (symbol_id=95, tf='M1') ===")
cur.execute("SELECT id, time, open, high, low, close, volume FROM candles WHERE symbol_id=95 AND timeframe='M1' ORDER BY time ASC LIMIT 20")
for c in cur.fetchall():
    dt = datetime.datetime.fromtimestamp(c[1], datetime.timezone.utc).isoformat()
    print(f"id: {c[0]} | time: {c[1]} ({dt}) | O:{c[2]} H:{c[3]} L:{c[4]} C:{c[5]} V:{c[6]}")

print("\n=== 3. CANDLE COUNT PER DAY 2024-01-01 to 2024-01-10 (EURUSD M1) ===")
for day in range(1, 11):
    day_str = f"2024-01-{day:02d}"
    t_start = int(datetime.datetime.strptime(f"{day_str} 00:00:00+0000", "%Y-%m-%d %H:%M:%S%z").timestamp())
    t_end = int(datetime.datetime.strptime(f"{day_str} 23:59:59+0000", "%Y-%m-%d %H:%M:%S%z").timestamp())
    cur.execute("SELECT COUNT(*), MIN(time), MAX(time) FROM candles WHERE symbol_id=95 AND timeframe='M1' AND time >= ? AND time <= ?", (t_start, t_end))
    cnt, min_t, max_t = cur.fetchone()
    min_dt = datetime.datetime.fromtimestamp(min_t, datetime.timezone.utc).isoformat() if min_t else 'NONE'
    max_dt = datetime.datetime.fromtimestamp(max_t, datetime.timezone.utc).isoformat() if max_t else 'NONE'
    weekday = datetime.datetime.strptime(day_str, "%Y-%m-%d").strftime("%A")
    print(f"Date {day_str} ({weekday}): {cnt} candles | First: {min_dt} | Last: {max_dt}")

print("\n=== 4. CHECK RECENT SESSIONS IN BACKTEST_SESSIONS ===")
cur.execute("SELECT id, session_name, symbol_name, symbols_json, start_time, end_time, current_replay_time, current_replay_index, created_at, updated_at FROM backtest_sessions ORDER BY updated_at DESC LIMIT 10")
for s in cur.fetchall():
    print(f"\nSession {s[0]} ({s[1]}): symbol={s[2]}, symbols_json={s[3]}")
    st = datetime.datetime.fromtimestamp(s[4], datetime.timezone.utc).isoformat() if s[4] else 'None'
    et = datetime.datetime.fromtimestamp(s[5], datetime.timezone.utc).isoformat() if s[5] else 'None'
    crt = datetime.datetime.fromtimestamp(s[6], datetime.timezone.utc).isoformat() if s[6] else 'None'
    print(f"  start_time (session window start): {s[4]} ({st})")
    print(f"  end_time (session window end):     {s[5]} ({et})")
    print(f"  current_replay_time:               {s[6]} ({crt})")
    print(f"  current_replay_index:              {s[7]}")
