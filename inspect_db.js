const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const appData = process.env.APPDATA || '';
console.log('APPDATA:', appData);

const possiblePaths = [
  path.join(appData, 'tradepro', 'forex-replay.db'),
  path.join(appData, 'forex-replay', 'forex-replay.db'),
  path.join(appData, 'Electron', 'forex-replay.db'),
  path.join(process.cwd(), 'forex-replay.db'),
];

for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    console.log('FOUND DB AT:', p);
    try {
      const db = new Database(p);
      const symbols = db.prepare('SELECT * FROM symbols').all();
      console.log('SYMBOLS:', symbols);

      const sessions = db.prepare('SELECT * FROM backtest_sessions').all();
      console.log('SESSIONS:', JSON.stringify(sessions, null, 2));

      for (const s of symbols) {
        const stats = db.prepare(`
          SELECT 
            timeframe, 
            COUNT(*) as count, 
            MIN(time) as min_time, 
            MAX(time) as max_time 
          FROM candles 
          WHERE symbol_id = ? 
          GROUP BY timeframe
        `).all(s.id);
        console.log(`CANDLE STATS FOR SYMBOL ${s.name} (${s.id}):`, stats.map((st) => ({
          ...st,
          min_iso: new Date(st.min_time * 1000).toISOString(),
          max_iso: new Date(st.max_time * 1000).toISOString(),
        })));
      }
    } catch (e) {
      console.error('Error reading db at', p, e);
    }
  }
}
