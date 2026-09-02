/**
 * Replay Engine V3 — PlaybackController
 * Controls IClock, advances ReplayTimeline, and emits versioned events.
 * Architecture Frozen v1.0
 */

import type { ReplayTimestampUTC, TimeChangeReason } from '../contracts/ReplayTypes';
import type { IClock, ClockTick } from '../contracts/IClock';
import type { ReplayTimeline } from './ReplayTimeline';
import type { ReplayEventBus } from './ReplayEventBus';

export class PlaybackController {
  private _tickCount = 0;

  constructor(
    private clock: IClock,
    private timeline: ReplayTimeline,
    private eventBus: ReplayEventBus
  ) {
    this.clock.onTick(this.handleClockTick);
  }

  private handleClockTick = (tick: ClockTick) => {
    if (this.timeline.status !== 'playing') return;

    const previousTimeUTC = this.timeline.currentReplayTimeUTC;
    const result = this.timeline.advanceElapsedMilliseconds(tick.elapsedMilliseconds);

    this._tickCount++;
    if (result.updated) {
      console.log('[REPLAY FIX 3] Clock tick:', { previousTimeUTC, currentTimeUTC: this.timeline.currentReplayTimeUTC });
    }

    if (this._tickCount % 60 === 1 || result.reachedEnd) {
      console.log('[REPLAY FORENSIC 7] handleClockTick', { tickCount: this._tickCount, elapsedMs: tick.elapsedMilliseconds, updated: result.updated, reachedEnd: result.reachedEnd, currentTimeUTC: this.timeline.currentReplayTimeUTC, timelineStatus: this.timeline.status });
    }

    if (result.updated) {
      const currentTimeUTC = this.timeline.currentReplayTimeUTC;
      if (currentTimeUTC !== null) {
        this.emitTimeChanged(currentTimeUTC, 'tick');
      }
    }

    if (result.reachedEnd) {
      this.clock.stop();
      const finalTimeUTC = this.timeline.currentReplayTimeUTC ?? 0;
      this.eventBus.emit('ReplayFinished', {
        version: 1,
        eventId: this.eventBus.generateEventId(),
        finalTimeUTC,
      });
    }
  };

  public play(): void {
    if (this.timeline.status === 'finished') return;
    if (!this.timeline.state.activeSession || this.timeline.currentReplayTimeUTC === null) {
      console.warn('[REPLAY FORENSIC 4 REJECTED] play() called without active session — request ignored');
      return;
    }
    console.log('[REPLAY FIX 2] Play accepted:', { currentReplayTimeUTC: this.timeline.currentReplayTimeUTC, activeSession: true });
    console.log('[REPLAY FORENSIC 4] engine.play() CALLED', { timelineStatusBefore: this.timeline.status, currentReplayTimeUTC: this.timeline.currentReplayTimeUTC, playbackSpeed: this.timeline.playbackSpeed, activeSession: true });
    this._tickCount = 0;
    this.timeline.setStatus('playing');
    this.clock.start();

    const timeUTC = this.timeline.currentReplayTimeUTC ?? 0;
    this.eventBus.emit('ReplayStarted', {
      version: 1,
      eventId: this.eventBus.generateEventId(),
      timeUTC,
    });
  }

  public pause(): void {
    if (this.timeline.status === 'playing') {
      this.clock.pause();
      this.timeline.setStatus('paused');

      const timeUTC = this.timeline.currentReplayTimeUTC ?? 0;
      this.eventBus.emit('ReplayPaused', {
        version: 1,
        eventId: this.eventBus.generateEventId(),
        timeUTC,
      });
    }
  }

  public stop(): void {
    this.clock.stop();
    this.timeline.setStatus('ready');

    const timeUTC = this.timeline.currentReplayTimeUTC ?? 0;
    this.eventBus.emit('ReplayStopped', {
      version: 1,
      eventId: this.eventBus.generateEventId(),
      timeUTC,
    });
  }

  public setSpeed(speed: number): void {
    this.timeline.setPlaybackSpeed(speed);
    this.eventBus.emit('ReplaySpeedChanged', {
      version: 1,
      eventId: this.eventBus.generateEventId(),
      speed,
    });
  }

  public jumpToTime(targetTimeUTC: ReplayTimestampUTC): boolean {
    const previousTimeUTC = this.timeline.currentReplayTimeUTC ?? 0;
    const success = this.timeline.jumpToTime(targetTimeUTC);

    if (success) {
      const newTimeUTC = this.timeline.currentReplayTimeUTC ?? targetTimeUTC;
      this.eventBus.emit('ReplayJumped', {
        version: 1,
        eventId: this.eventBus.generateEventId(),
        targetTimeUTC: newTimeUTC,
        previousTimeUTC,
      });
      this.emitTimeChanged(newTimeUTC, 'jump');
    }

    return success;
  }

  public stepForward(stepSeconds: number = 60): boolean {
    const current = this.timeline.currentReplayTimeUTC;
    if (current === null) return false;
    return this.jumpToTime(current + stepSeconds);
  }

  public stepBackward(stepSeconds: number = 60): boolean {
    const current = this.timeline.currentReplayTimeUTC;
    if (current === null) return false;
    return this.jumpToTime(current - stepSeconds);
  }

  private emitTimeChanged(currentTimeUTC: ReplayTimestampUTC, reason: TimeChangeReason): void {
    console.log('[REPLAY FIX 4] ReplayTimeChanged:', { currentReplayTimeUTC: currentTimeUTC });
    this.eventBus.emit('ReplayTimeChanged', {
      version: 1,
      eventId: this.eventBus.generateEventId(),
      currentTimeUTC,
      playbackDirection: 'forward',
      reason,
      speed: this.timeline.playbackSpeed,
    });
  }
}
