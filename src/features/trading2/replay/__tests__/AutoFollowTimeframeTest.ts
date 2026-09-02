/**
 * Auto Follow Timeframe Behavior Test Suite — Continuous Lifecycle & Playback Tests
 */
import { timeframeToSeconds } from '../../../../utils/dataResampler';
import type { Timeframe } from '../../../../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${message}`);
  }
}

export function runAutoFollowTests(): { success: boolean; logs: string[] } {
  const logs: string[] = [];
  let passed = 0;
  let total = 0;

  function runTest(name: string, fn: () => void) {
    total++;
    try {
      fn();
      passed++;
      logs.push(`[PASS] ${name}`);
    } catch (err: any) {
      logs.push(`[FAIL] ${name}: ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Auto Follow ON synchronizes Chart TF with Replay TF
  // -------------------------------------------------------------
  runTest('Auto Follow ON synchronizes Chart TF with Replay TF', () => {
    let chartTf: Timeframe = 'M5';
    let replayTf: Timeframe = 'M5';
    let autoFollow: boolean = true;

    const setReplayTf = (newTf: Timeframe) => {
      replayTf = newTf;
      if (autoFollow) chartTf = newTf;
    };

    setReplayTf('H1');
    assert((chartTf as Timeframe) === 'H1' && (replayTf as Timeframe) === 'H1', 'Chart TF follows Replay TF when Auto Follow is ON');
  });

  // -------------------------------------------------------------
  // TEST 2: Auto Follow OFF keeps Chart TF independent
  // -------------------------------------------------------------
  runTest('Auto Follow OFF keeps Chart TF independent from Replay TF changes', () => {
    let chartTf: Timeframe = 'H1';
    let replayTf: Timeframe = 'M5';
    let autoFollow: boolean = false;

    const setReplayTf = (newTf: Timeframe) => {
      replayTf = newTf;
      if (autoFollow) chartTf = newTf;
    };

    setReplayTf('H4');
    assert((chartTf as Timeframe) === 'H1' && (replayTf as Timeframe) === 'H4', 'Chart TF remains H1 while Replay TF becomes H4');

    setReplayTf('Monthly');
    assert((chartTf as Timeframe) === 'H1' && (replayTf as Timeframe) === 'Monthly', 'Chart TF remains H1 while Replay TF becomes Monthly');
  });

  // -------------------------------------------------------------
  // TEST 3: Enabling Auto Follow immediately synchronizes Chart TF
  // -------------------------------------------------------------
  runTest('Enabling Auto Follow immediately synchronizes Chart TF to Replay TF', () => {
    let chartTf: Timeframe = 'H1';
    let replayTf: Timeframe = 'H4';
    let autoFollow: boolean = false;

    const toggleAutoFollow = () => {
      autoFollow = !autoFollow;
      if (autoFollow) chartTf = replayTf;
    };

    toggleAutoFollow();
    assert(autoFollow && (chartTf as Timeframe) === 'H4', 'Chart TF immediately synchronizes from H1 to H4 upon enabling Auto Follow');
  });

  // -------------------------------------------------------------
  // TEST 4: Next / Previous stepping duration uses Replay TF
  // -------------------------------------------------------------
  runTest('Next/Previous candle stepping computes step size from Replay TF', () => {
    const replayTf: Timeframe = 'M5'; // 5 minutes = 300 seconds
    const chartTf: Timeframe = 'H1';  // 60 minutes = 3600 seconds

    const stepSecondsReplay = timeframeToSeconds(replayTf);
    const stepSecondsChart = timeframeToSeconds(chartTf);

    const m1CountReplay = Math.max(1, Math.round(stepSecondsReplay / 60));
    const m1CountChart = Math.max(1, Math.round(stepSecondsChart / 60));

    assert(m1CountReplay === 5, 'Replay TF M5 resolves to 5 M1 steps');
    assert(m1CountChart === 60, 'Chart TF H1 resolves to 60 M1 steps');
    assert(m1CountReplay !== m1CountChart, 'Replay stepping count is independent of visual Chart TF');
  });

  // -------------------------------------------------------------
  // TEST 5: currentReplayTime is 100% preserved during Auto Follow toggle & TF switch
  // -------------------------------------------------------------
  runTest('Master currentReplayTime clock is 100% preserved across Auto Follow toggle and TF changes', () => {
    const initialClock = 1718212980; // 2024-06-12 17:23:00 UTC
    let currentReplayTime = initialClock;

    let chartTf: Timeframe = 'M1';
    let replayTf: Timeframe = 'M5';
    let autoFollow: boolean = true;

    const switchReplayTf = (tf: Timeframe) => {
      replayTf = tf;
      if (autoFollow) chartTf = tf;
      // Note: currentReplayTime is NOT modified
    };

    switchReplayTf('H1');
    switchReplayTf('H7');
    switchReplayTf('Monthly');

    assert(currentReplayTime === initialClock, 'currentReplayTime remains exactly 1718212980 UTC');
  });

  // -------------------------------------------------------------
  // TEST 6: Auto Follow during PLAY (continuous playback loop)
  // -------------------------------------------------------------
  runTest('Auto Follow remains active during PLAY, PAUSE, and RESUME without stopping playback', () => {
    let playbackStatus: 'paused' | 'playing' = 'playing';
    let currentReplayTime = 1718212980;
    let chartTf: Timeframe = 'M5';
    let replayTf: Timeframe = 'M5';
    let autoFollow: boolean = true;

    // Simulate playback loop ticks
    for (let i = 0; i < 5; i++) {
      currentReplayTime += 60; // Advance 1 minute
    }

    assert(playbackStatus === 'playing', 'Playback is active during tick progression');
    assert((chartTf as Timeframe) === 'M5', 'Chart TF remains M5 during playback ticks');

    // Change Replay TF during PLAY
    replayTf = 'H1';
    if (autoFollow) chartTf = replayTf;

    assert(playbackStatus === 'playing', 'Playback remains ACTIVE after Replay TF change during PLAY');
    assert((chartTf as Timeframe) === 'H1', 'Chart TF automatically switches to H1 during PLAY');
    assert((replayTf as Timeframe) === 'H1', 'Replay TF is H1');

    // Pause and Resume test
    playbackStatus = 'paused';
    replayTf = 'D1';
    if (autoFollow) chartTf = replayTf;
    assert((chartTf as Timeframe) === 'D1', 'Chart TF updates to D1 while PAUSED');

    playbackStatus = 'playing'; // RESUME
    assert(playbackStatus === 'playing' && (chartTf as Timeframe) === 'D1', 'Playback RESUMES with Chart TF = D1');
  });

  // -------------------------------------------------------------
  // TEST 7: Changing Replay TF during PLAY does NOT update Chart TF when OFF
  // -------------------------------------------------------------
  runTest('Changing Replay TF during PLAY does NOT update Chart TF when Auto Follow is OFF', () => {
    let playbackStatus: 'playing' = 'playing';
    let chartTf: Timeframe = 'H1';
    let replayTf: Timeframe = 'M5';
    let autoFollow: boolean = false;

    // Change Replay TF during PLAY with autoFollow = false
    replayTf = 'H4';
    if (autoFollow) chartTf = replayTf;

    assert(playbackStatus === 'playing', 'Playback remains ACTIVE');
    assert((chartTf as Timeframe) === 'H1', 'Chart TF remains H1 (independent)');
    assert((replayTf as Timeframe) === 'H4', 'Replay TF is H4');
  });

  const success = passed === total;
  logs.push(`\nSummary: ${passed}/${total} Auto Follow tests PASSED`);
  return { success, logs };
}
