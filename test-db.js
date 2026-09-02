const Database = require('better-sqlite3');
const db = new Database('./database.sqlite');
const rows = db.prepare(`SELECT time FROM candles WHERE timeframe = 'H6' ORDER BY time ASC LIMIT 10`).all();
console.log("H6 timestamps in DB:");
rows.forEach((r, i) => console.log(`${i}: ${r.time} -> ${new Date(r.time * 1000).toISOString()}`));
