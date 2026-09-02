/**
 * Replay Engine V3 — Unified Facade API
 * Orchestrates Timeline, SessionManager, PlaybackController, CandleRepository, and ChartSynchronizer.
 * Architecture Frozen v1.0
 */

import type { Candle, Timeframe } from '@/types';
import type { ReplayTimestampUTC, ReplayStartMode, ReplaySession, ReplaySessionSnapshot } from './contracts/ReplayTypes';
import { ReplayClock } from './core/ReplayClock';
import { ReplayTimeline } from './core/ReplayTimeline';
import { ReplayEventBus } from './core/ReplayEventBus';
import { ReplaySessionManager, type CreateSessionParams } from './core/ReplaySessionManager';
import { PlaybackController } from './core/PlaybackController';
import { CandleRepository } from './data/CandleRepository';
import { ChartSynchronizer } from './context/ChartSynchronizer';
import { ChartContext } from './context/ChartContext';

export class ReplayEngineV3 {
  public readonly repository: CandleRepository;
  public readonly timeline: ReplayTimeline;
  public readonly eventBus: ReplayEventBus;
  public readonly sessionManager: ReplaySessionManager;
  public readonly playback: PlaybackController;
  public readonly synchronizer: ChartSynchronizer;

  private clock: ReplayClock;

  constructor() {
    this.repository = new CandleRepository();
    this.timeline = new ReplayTimeline();
    this.eventBus = new ReplayEventBus();
    this.clock = new ReplayClock();
    this.sessionManager = new ReplaySessionManager(this.repository);
    this.playback = new PlaybackController(this.clock, this.timeline, this.eventBus);
    this.synchronizer = new ChartSynchronizer();

    // Connect EventBus ReplayTimeChanged to ChartSynchronizer
    this.eventBus.on('ReplayTimeChanged', (payload) => {
      this.synchronizer.handleTimeChanged(payload);
    });
  }

  public loadCandles(symbol: string, timeframe: Timeframe | string, candles: Candle[]): number {
    return this.repository.loadDataset(symbol, timeframe, candles);
  }

  public createSession(params: CreateSessionParams): {
    session: ReplaySession;
    snapshot: ReplaySessionSnapshot;
    resolvedStartCandleTime: ReplayTimestampUTC;
    resolvedStartIndex: number;
  } {
    const result = this.sessionManager.createSession(params);
    this.timeline.initSession(result.session);

    // Initial event distribution to all chart contexts
    this.eventBus.emit('ReplayTimeChanged', {
      version: 1,
      eventId: this.eventBus.generateEventId(),
      currentTimeUTC: result.resolvedStartCandleTime,
      playbackDirection: 'forward',
      reason: 'session_start',
      speed: this.timeline.playbackSpeed,
    });

    return {
      session: result.session,
      snapshot: result.snapshot,
      resolvedStartCandleTime: result.resolvedStartCandleTime,
      resolvedStartIndex: result.resolvedStartIndex,
    };
  }

  public createChartContext(
    paneId: string,
    symbol: string,
    timeframe: Timeframe | string
  ): ChartContext {
    const context = new ChartContext(paneId, symbol, timeframe, this.repository);
    this.synchronizer.registerChart(context);

    // If a replay session is already active, immediately initialize the new context with current replay time state
    if (this.timeline.state.activeSession && this.timeline.currentReplayTimeUTC !== null) {
      context.onReplayTimeChanged({
        version: 1,
        eventId: this.eventBus.generateEventId(),
        currentTimeUTC: this.timeline.currentReplayTimeUTC,
        playbackDirection: 'forward',
        reason: 'session_start',
        speed: this.timeline.playbackSpeed,
      });
    }

    return context;
  }

  public destroyChartContext(paneId: string): void {
    this.synchronizer.unregisterChart(paneId);
  }

  public play(): void {
    this.playback.play();
  }

  public pause(): void {
    this.playback.pause();
  }

  public stop(): void {
    this.playback.stop();
  }

  public setSpeed(speed: number): void {
    this.playback.setSpeed(speed);
  }

  public jumpToTime(targetTimeUTC: ReplayTimestampUTC): boolean {
    return this.playback.jumpToTime(targetTimeUTC);
  }

  public stepForward(stepSeconds: number = 60): boolean {
    return this.playback.stepForward(stepSeconds);
  }

  public stepBackward(stepSeconds: number = 60): boolean {
    return this.playback.stepBackward(stepSeconds);
  }

  public reset(): void {
    this.clock.stop();
    this.timeline.reset();
    this.sessionManager.destroySession();
    this.synchronizer.clear();
    this.repository.clear();
    this.eventBus.clear();
  }
}
