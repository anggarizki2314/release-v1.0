import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { resampleCandles } from '@/utils/dataResampler';

function getDbInstance() {
  const possiblePaths = [
    path.join(process.env.APPDATA || '', 'forex-replay', 'forex-replay.db'),
    path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming', 'forex-replay', 'forex-replay.db'),
    path.join(process.cwd(), 'forex-replay.db'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`[DB VERIFICATION] Found SQLite DB at: ${p}`);
      return new Database(p, { readonly: true });
    }
  }
  throw new Error(`SQLite database file not found in paths: ${possiblePaths.join(', ')}`);
}

export function runDataCoverageVerification() {
  const db = getDbInstance();

  console.log('============================================================');
  console.log('PHASE 7.2 UNCONSTRAINED RANGE DATA COVERAGE VERIFICATION');
  console.log('============================================================');

  // 1. Get Symbols List
  const symbols = db.prepare('SELECT id, name FROM symbols ORDER BY name').all() as { id: number; name: string }[];
  console.log('[DB symbols]', symbols);

  const xauSymbol = symbols.find((s) => s.name === 'XAUUSD') || symbols[0];
  if (!xauSymbol) {
    console.error('No symbols found in SQLite database');
    return;
  }

  // 2. Query total candles & date bounds for XAUUSD in SQLite
  const totalStats = db
    .prepare('SELECT COUNT(*) as cnt, MIN(time) as minT, MAX(time) as maxT FROM candles WHERE symbol_id = ?')
    .get(xauSymbol.id) as { cnt: number; minT: number | null; maxT: number | null };

  console.log('\n--- 1. MASTER DATABASE COVERAGE ---');
  console.log(`Symbol: ${xauSymbol.name} (id=${xauSymbol.id})`);
  console.log(`Total DB Candles (all timeframes): ${totalStats.cnt}`);
  console.log(`Earliest Timestamp: ${totalStats.minT} (${totalStats.minT ? new Date(totalStats.minT * 1000).toISOString() : 'N/A'})`);
  console.log(`Latest Timestamp:   ${totalStats.maxT} (${totalStats.maxT ? new Date(totalStats.maxT * 1000).toISOString() : 'N/A'})`);

  // Query M1 candles stats specifically
  const m1Stats = db
    .prepare("SELECT COUNT(*) as cnt, MIN(time) as minT, MAX(time) as maxT FROM candles WHERE symbol_id = ? AND timeframe = 'M1'")
    .get(xauSymbol.id) as { cnt: number; minT: number | null; maxT: number | null };

  console.log(`Total DB M1 Candles: ${m1Stats.cnt}`);
  console.log(`M1 Earliest: ${m1Stats.minT ? new Date(m1Stats.minT * 1000).toISOString() : 'N/A'}`);
  console.log(`M1 Latest:   ${m1Stats.maxT ? new Date(m1Stats.maxT * 1000).toISOString() : 'N/A'}`);

  // Range query: 2022-12-03 (1670025600) -> 2026-08-03 (1785791999)
  const reqStart = 1670025600; // 2022-12-03 00:00:00 UTC (30-day buffer before 2023-01-02)
  const reqEnd = 1785791999;   // 2026-08-03 23:59:59 UTC

  const rangeStats = db
    .prepare(
      "SELECT COUNT(*) as cnt, MIN(time) as minT, MAX(time) as maxT FROM candles WHERE symbol_id = ? AND timeframe = 'M1' AND time >= ? AND time <= ?"
    )
    .get(xauSymbol.id, reqStart, reqEnd) as { cnt: number; minT: number | null; maxT: number | null };

  console.log('\n--- 2. REQUESTED SESSION RANGE (2022-12-03 → 2026-08-03) ---');
  console.log(`M1 Candles in Range: ${rangeStats.cnt}`);
  console.log(`First Candle in Range: ${rangeStats.minT ? new Date(rangeStats.minT * 1000).toISOString() : 'N/A'}`);
  console.log(`Last Candle in Range:  ${rangeStats.maxT ? new Date(rangeStats.maxT * 1000).toISOString() : 'N/A'}`);

  // 3. Test getCandlesRange unconstrained range query
  console.log('\n--- 3. getCandlesRange(symbolId, "M1", 1670025600, 1785791999) EXECUTION ---');
  const m1Rows = db
    .prepare(
      "SELECT time, open, high, low, close, volume FROM candles WHERE symbol_id = ? AND timeframe = 'M1' AND time >= ? AND time <= ? ORDER BY time ASC"
    )
    .all(xauSymbol.id, reqStart, reqEnd) as any[];

  console.log(`Rows returned by getCandlesRange query: ${m1Rows.length}`);
  if (m1Rows.length > 0) {
    console.log(`First returned timestamp: ${m1Rows[0].time} (${new Date(m1Rows[0].time * 1000).toISOString()})`);
    console.log(`Last returned timestamp:  ${m1Rows[m1Rows.length - 1].time} (${new Date(m1Rows[m1Rows.length - 1].time * 1000).toISOString()})`);
  }

  // 4. Test Ordering & Duplicate Checks
  let orderingViolations = 0;
  let duplicates = 0;
  for (let i = 0; i < m1Rows.length - 1; i++) {
    if (m1Rows[i].time === m1Rows[i + 1].time) duplicates++;
    if (m1Rows[i].time >= m1Rows[i + 1].time) orderingViolations++;
  }

  console.log('\n--- 4. CANDLE ORDERING & DUPLICATE CHECKS ---');
  console.log(`Duplicate Timestamps: ${duplicates}`);
  console.log(`Ordering Violations: ${orderingViolations}`);

  // 5. Test Resampling to M15 & H1
  console.log('\n--- 5. RESAMPLING VERIFICATION ---');
  const m15Output = resampleCandles(m1Rows, 'M15');
  console.log(`M1 Input Count:  ${m1Rows.length}`);
  console.log(`M15 Output Count: ${m15Output.length}`);
  if (m15Output.length > 0) {
    console.log(`First M15 Candle: ${m15Output[0].time} (${new Date(m15Output[0].time * 1000).toISOString()})`);
    console.log(`Last M15 Candle:  ${m15Output[m15Output.length - 1].time} (${new Date(m15Output[m15Output.length - 1].time * 1000).toISOString()})`);
  }

  const h1Output = resampleCandles(m1Rows, 'H1');
  console.log(`H1 Output Count:  ${h1Output.length}`);
  if (h1Output.length > 0) {
    console.log(`First H1 Candle: ${h1Output[0].time} (${new Date(h1Output[0].time * 1000).toISOString()})`);
    console.log(`Last H1 Candle:  ${h1Output[h1Output.length - 1].time} (${new Date(h1Output[h1Output.length - 1].time * 1000).toISOString()})`);
  }

  // 6. Test Multi-Pair Range Loading
  console.log('\n--- 6. MULTI-PAIR COVERAGE ---');
  for (const s of symbols) {
    const pRows = db
      .prepare(
        "SELECT time, open, high, low, close, volume FROM candles WHERE symbol_id = ? AND time >= ? AND time <= ? ORDER BY time ASC"
      )
      .all(s.id, reqStart, reqEnd) as any[];
    const pM15 = resampleCandles(pRows, 'M15');
    console.log(`Symbol ${s.name}: Base M1=${pRows.length}, M15=${pM15.length}, Range: ${pRows.length > 0 ? new Date(pRows[0].time * 1000).toISOString().split('T')[0] : 'N/A'} -> ${pRows.length > 0 ? new Date(pRows[pRows.length - 1].time * 1000).toISOString().split('T')[0] : 'N/A'}`);
  }
}
