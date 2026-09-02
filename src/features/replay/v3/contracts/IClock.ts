/**
 * Replay Engine V3 — IClock Interface (Pure Time Source)
 * Architecture Frozen v1.0
 */

/**
 * Raw millisecond tick emitted by IClock implementations.
 */
export interface ClockTick {
  readonly elapsedMilliseconds: number;
  readonly frameTimeMilliseconds: number;
}

/**
 * Pure Time Source interface. Decoupled from candles, charts, or replay sessions.
 */
export interface IClock {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  onTick(callback: (tick: ClockTick) => void): void;
  isRunning(): boolean;
}
