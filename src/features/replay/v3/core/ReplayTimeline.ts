/**
 * Replay Engine V3 — ReplayTimeline (Pure Global Clock SSoT)
 * SSoT: currentReplayTimeUTC (Unix seconds ONLY).
 * Architecture Frozen v1.0
 */

import type { ReplayTimestampUTC, PlaybackStatus, ReplaySession, ReplayTimelineState } from '../contracts/ReplayTypes';

export class ReplayTimeline {
  private _status: PlaybackStatus = 'idle';
  private _replayStartTimeUTC: ReplayTimestampUTC | null = null;
  private _replayEndTimeUTC: ReplayTimestampUTC | null = null;
  private _currentReplayTimeUTC: ReplayTimestampUTC | null = null;
  private _playbackSpeed = 1;
  private _activeSession: ReplaySession | null = null;
  private _elapsedReplayMs = 0;

  public get state(): ReplayTimelineState {
    return {
      status: this._status,
      currentReplayTimeUTC: this._currentReplayTimeUTC,
      replayStartTimeUTC: this._replayStartTimeUTC,
      replayEndTimeUTC: this._replayEndTimeUTC,
      playbackSpeed: this._playbackSpeed,
      activeSession: this._activeSession,
    };
  }

  public get currentReplayTimeUTC(): ReplayTimestampUTC | null {
    return this._currentReplayTimeUTC;
  }

  public get status(): PlaybackStatus {
    return this._status;
  }

  public get playbackSpeed(): number {
    return this._playbackSpeed;
  }

  public setPlaybackSpeed(speed: number): void {
    if (speed > 0) {
      this._playbackSpeed = speed;
    }
  }

  public setStatus(status: PlaybackStatus): void {
    this._status = status;
  }

  public initSession(session: ReplaySession): void {
    this._activeSession = session;
    this._replayStartTimeUTC = session.replayStartTimeUTC;
    this._replayEndTimeUTC = session.replayEndTimeUTC;
    this._currentReplayTimeUTC = session.replayStartTimeUTC;
    this._elapsedReplayMs = 0;
    this._status = 'ready';
    console.log('[REPLAY DATE FORENSIC 4] Engine initSession', { replayStartTimeUTC: this._replayStartTimeUTC, replayEndTimeUTC: this._replayEndTimeUTC, currentReplayTimeUTC: this._currentReplayTimeUTC, status: this._status });
  }

  /**
   * Non-accumulative time advance to eliminate floating point drift:
   * currentReplayTimeUTC = replayStartTimeUTC + Math.floor(elapsedReplayMs / 1000)
   */
  public advanceElapsedMilliseconds(deltaMs: number): {
    updated: boolean;
    reachedEnd: boolean;
  } {
    if (
      this._status !== 'playing' ||
      this._replayStartTimeUTC === null ||
      this._replayEndTimeUTC === null
    ) {
      return { updated: false, reachedEnd: false };
    }

    this._elapsedReplayMs += deltaMs * this._playbackSpeed;
    const newTime = this._replayStartTimeUTC + Math.floor(this._elapsedReplayMs / 1000);

    if (newTime >= this._replayEndTimeUTC) {
      this._currentReplayTimeUTC = this._replayEndTimeUTC;
      this._status = 'finished';
      return { updated: true, reachedEnd: true };
    }

    if (newTime !== this._currentReplayTimeUTC) {
      this._currentReplayTimeUTC = newTime;
      return { updated: true, reachedEnd: false };
    }

    return { updated: false, reachedEnd: false };
  }

  /**
   * Jump to target UTC timestamp. Re-syncs elapsed milliseconds to match exact target.
   */
  public jumpToTime(targetTimeUTC: ReplayTimestampUTC): boolean {
    if (this._replayStartTimeUTC === null || this._replayEndTimeUTC === null) return false;

    const clampedTime = Math.max(
      this._replayStartTimeUTC,
      Math.min(targetTimeUTC, this._replayEndTimeUTC)
    );

    this._currentReplayTimeUTC = clampedTime;
    this._elapsedReplayMs = (clampedTime - this._replayStartTimeUTC) * 1000;

    if (clampedTime >= this._replayEndTimeUTC) {
      this._status = 'finished';
    } else if (this._status === 'finished') {
      this._status = 'paused';
    }

    return true;
  }

  public reset(): void {
    this._status = 'idle';
    this._replayStartTimeUTC = null;
    this._replayEndTimeUTC = null;
    this._currentReplayTimeUTC = null;
    this._elapsedReplayMs = 0;
    this._activeSession = null;
  }
}
