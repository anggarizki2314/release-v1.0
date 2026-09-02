import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Electron', 'forex-replay.db');
console.log('Opening DB at:', dbPath);
const db = new Database(dbPath, { readonly: true });

// Check EURUSD symbol id
const symbol = db.prepare(`SELECT * FROM symbols WHERE name = 'EURUSD'`).get() as any;
console.log('Symbol info:', symbol);

if (symbol) {
  // Check earliest candles
  const earliestCandles = db.prepare(`SELECT * FROM candles WHERE symbol_id = ? ORDER BY open_time ASC LIMIT 20`).all(symbol.id) as any[];
  console.log('\n--- Earliest 20 Candles for EURUSD ---');
  earliestCandles.forEach(c => {
    console.log(`id: ${c.id}, open_time: ${c.open_time} (${new Date(c.open_time * 1000).toISOString()}), O:${c.open} H:${c.high} L:${c.low} C:${c.close}`);
  });

  // Query candles across 2024-01-01 to 2024-01-08 by day
  const start2024_01_01 = Math.floor(new Date('2024-01-01T00:00:00Z').getTime() / 1000);
  const end2024_01_08 = Math.floor(new Date('2024-01-08T23:59:59Z').getTime() / 1000);

  const candleCount = db.prepare(`SELECT COUNT(*) as count FROM candles WHERE symbol_id = ? AND open_time >= ? AND open_time <= ?`).get(symbol.id, start2024_01_01, end2024_01_08) as any;
  console.log(`\nTotal candles between 2024-01-01 00:00 UTC and 2024-01-08 23:59 UTC: ${candleCount.count}`);

  for (let day = 1; day <= 8; day++) {
    const dayStr = `2024-01-0${day}`;
    const dayStart = Math.floor(new Date(`${dayStr}T00:00:00Z`).getTime() / 1000);
    const dayEnd = Math.floor(new Date(`${dayStr}T23:59:59Z`).getTime() / 1000);
    const count = (db.prepare(`SELECT COUNT(*) as count FROM candles WHERE symbol_id = ? AND open_time >= ? AND open_time <= ?`).get(symbol.id, dayStart, dayEnd) as any).count;
    const firstInDay = db.prepare(`SELECT open_time FROM candles WHERE symbol_id = ? AND open_time >= ? AND open_time <= ? ORDER BY open_time ASC LIMIT 1`).get(symbol.id, dayStart, dayEnd) as any;
    const lastInDay = db.prepare(`SELECT open_time FROM candles WHERE symbol_id = ? AND open_time >= ? AND open_time <= ? ORDER BY open_time DESC LIMIT 1`).get(symbol.id, dayStart, dayEnd) as any;
    console.log(`Day ${dayStr}: ${count} candles | first: ${firstInDay ? new Date(firstInDay.open_time * 1000).toISOString() : 'NONE'} | last: ${lastInDay ? new Date(lastInDay.open_time * 1000).toISOString() : 'NONE'}`);
  }
}
