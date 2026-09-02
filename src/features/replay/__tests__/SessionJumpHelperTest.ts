import { calculateNextSessionJump, SESSION_JUMP_OPTIONS } from '../sessionJumpHelper';

function runSessionJumpHelperTests() {
  console.log('--- RUNNING REPLAY SESSION JUMP HELPER TEST SUITE ---');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`[PASS] Test ${total}: ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${total}: ${msg}`);
      process.exit(1);
    }
  }

  // Wednesday 2026-08-19 03:30:00 UTC (Sesi Asia, sebelum London)
  const t_wed_0330 = Math.floor(Date.UTC(2026, 7, 19, 3, 30, 0) / 1000);

  // Test 1: Options catalog has 15 options
  assert(SESSION_JUMP_OPTIONS.length === 15, `Session jump options catalog has ${SESSION_JUMP_OPTIONS.length} options`);

  // Test 2: Jump to Midnight Open (04:00 UTC) from 03:30 UTC -> Lands at 04:00 UTC today
  const midnightJump = calculateNextSessionJump(t_wed_0330, 'MIDNIGHT_OPEN');
  const expectedMidnight = Math.floor(Date.UTC(2026, 7, 19, 4, 0, 0) / 1000);
  assert(midnightJump === expectedMidnight, `Jump to NY Midnight Open lands at today 04:00 UTC (${midnightJump} == ${expectedMidnight})`);

  // Test 3: Jump to London Open (07:00 UTC) from 03:30 UTC -> Lands at 07:00 UTC today
  const loJump = calculateNextSessionJump(t_wed_0330, 'LONDON_OPEN');
  const expectedLO = Math.floor(Date.UTC(2026, 7, 19, 7, 0, 0) / 1000);
  assert(loJump === expectedLO, `Jump to London Open lands at today 07:00 UTC (${loJump} == ${expectedLO})`);

  // Test 4: Jump to NY Open (12:00 UTC) from 03:30 UTC -> Lands at 12:00 UTC today
  const nyoJump = calculateNextSessionJump(t_wed_0330, 'NY_OPEN');
  const expectedNYO = Math.floor(Date.UTC(2026, 7, 19, 12, 0, 0) / 1000);
  assert(nyoJump === expectedNYO, `Jump to NY Open lands at today 12:00 UTC (${nyoJump} == ${expectedNYO})`);

  // Test 5: Jump to Wall Street Open (13:30 UTC) from 03:30 UTC
  const wsoJump = calculateNextSessionJump(t_wed_0330, 'WALL_STREET_OPEN');
  const expectedWSO = Math.floor(Date.UTC(2026, 7, 19, 13, 30, 0) / 1000);
  assert(wsoJump === expectedWSO, `Jump to Wall Street Open lands at today 13:30 UTC (${wsoJump} == ${expectedWSO})`);

  // Test 6: Jump to London Close (14:00 UTC) from 03:30 UTC
  const lcJump = calculateNextSessionJump(t_wed_0330, 'LONDON_CLOSE');
  const expectedLC = Math.floor(Date.UTC(2026, 7, 19, 14, 0, 0) / 1000);
  assert(lcJump === expectedLC, `Jump to London Close lands at today 14:00 UTC (${lcJump} == ${expectedLC})`);

  // Test 7: Jump to London Pre-Open Macro (06:33 UTC / 02:33 NY) from 03:30 UTC
  const londonMacroJump = calculateNextSessionJump(t_wed_0330, 'MACRO_LONDON_PRE');
  const expectedLondonMacro = Math.floor(Date.UTC(2026, 7, 19, 6, 33, 0) / 1000);
  assert(londonMacroJump === expectedLondonMacro, `Jump to London Pre Macro lands at 06:33 UTC (${londonMacroJump} == ${expectedLondonMacro})`);

  // Test 8: Jump to NY AM Macro 2 (Silver Bullet 13:50 UTC / 09:50 NY) from 03:30 UTC
  const silverBulletJump = calculateNextSessionJump(t_wed_0330, 'MACRO_NY_AM_2');
  const expectedSilverBullet = Math.floor(Date.UTC(2026, 7, 19, 13, 50, 0) / 1000);
  assert(silverBulletJump === expectedSilverBullet, `Jump to Silver Bullet Macro lands at 13:50 UTC (${silverBulletJump} == ${expectedSilverBullet})`);

  // Test 9: Next ICT Macro (Auto terdekat dari 03:30 UTC -> London Pre at 06:33 UTC)
  const nextMacroJump = calculateNextSessionJump(t_wed_0330, 'NEXT_MACRO');
  assert(nextMacroJump === expectedLondonMacro, `Next ICT Macro lands at nearest macro 06:33 UTC (${nextMacroJump} == ${expectedLondonMacro})`);

  // Test 10: Next H4 Candle Open from 03:30 UTC -> Lands at 04:00 UTC
  const h4Jump = calculateNextSessionJump(t_wed_0330, 'NEXT_H4');
  const expectedH4 = Math.floor(Date.UTC(2026, 7, 19, 4, 0, 0) / 1000);
  assert(h4Jump === expectedH4, `Next H4 from 03:30 lands at 04:00 UTC (${h4Jump} == ${expectedH4})`);

  // Test 11: Next Day jumps to opening candle of next day: 21:00 UTC (05:00 WIB)
  const nextDayJump = calculateNextSessionJump(t_wed_0330, 'NEXT_DAY');
  const expectedNextDay = Math.floor(Date.UTC(2026, 7, 19, 21, 0, 0) / 1000);
  assert(nextDayJump === expectedNextDay, `Next Day lands at opening candle 21:00 UTC (${nextDayJump} == ${expectedNextDay})`);

  // Test 12: Next Week (Sunday 21:00 UTC / Monday 05:00 WIB Open) from Wednesday 2026-08-19 -> Lands on Sunday 2026-08-23 21:00 UTC
  const nextWeekJump = calculateNextSessionJump(t_wed_0330, 'NEXT_WEEK_OPEN');
  const expectedNextWeek = Math.floor(Date.UTC(2026, 7, 23, 21, 0, 0) / 1000);
  assert(nextWeekJump === expectedNextWeek, `Next Week jump lands on weekly open Sunday 21:00 UTC (${nextWeekJump} == ${expectedNextWeek})`);

  // Test 13: High Impact News jump lands 60 seconds before the event
  const mockNews = [
    { timestamp: t_wed_0330 + 1800, impact: 'LOW' }, // +30 min (low)
    { timestamp: t_wed_0330 + 7200, impact: 'HIGH' }, // +2 hours (CPI high)
  ];
  const newsJump = calculateNextSessionJump(t_wed_0330, 'HIGH_IMPACT_NEWS', mockNews);
  assert(newsJump === t_wed_0330 + 7200 - 60, `News jump lands 60s before high-impact event (${newsJump} == ${t_wed_0330 + 7200 - 60})`);

  // Test 14: High Impact News returns null if no future events exist
  const emptyNewsJump = calculateNextSessionJump(t_wed_0330, 'HIGH_IMPACT_NEWS', []);
  assert(emptyNewsJump === null, 'Returns null when no future news events exist');

  console.log(`\nResult: ${passed}/${total} passed. Success: ${passed === total}\n`);
}

runSessionJumpHelperTests();
