/**
 * Replay Engine V3 — ReplayClock Implementation (Pure Time Source)
 * Architecture Frozen v1.0
 */

import type { IClock, ClockTick } from '../contracts/IClock';

export class ReplayClock implements IClock {
  private _isRunning = false;
  private lastFrameTimeMs = 0;
  private animFrameId: number | null = null;
  private tickCallback: ((tick: ClockTick) => void) | null = null;
  private _frameCount = 0;

  public start(): void {
    if (this._isRunning) return;
    this._isRunning = true;
    this._frameCount = 0;
    this.lastFrameTimeMs = performance.now();
    console.log('[REPLAY FORENSIC 5] ReplayClock STARTED (requestAnimationFrame)', { isRunning: this._isRunning });
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  public pause(): void {
    this._isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public resume(): void {
    if (!this._isRunning) this.start();
  }

  public stop(): void {
    this.pause();
    this.lastFrameTimeMs = 0;
  }

  public isRunning(): boolean {
    return this._isRunning;
  }

  public onTick(callback: (tick: ClockTick) => void): void {
    this.tickCallback = callback;
  }

  private loop = (nowMs: number) => {
    if (!this._isRunning) return;
    const elapsedMilliseconds = Math.max(0, nowMs - this.lastFrameTimeMs);
    this.lastFrameTimeMs = nowMs;
    this._frameCount++;

    if (this._frameCount % 60 === 1) {
      console.log('[REPLAY FORENSIC 6] ReplayClock loop tick', { frameCount: this._frameCount, elapsedMs: elapsedMilliseconds, isRunning: this._isRunning });
    }

    this.tickCallback?.({ elapsedMilliseconds, frameTimeMilliseconds: nowMs });
    this.animFrameId = requestAnimationFrame(this.loop);
  };
}
