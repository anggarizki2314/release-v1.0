/**
 * Trading Engine 2.0 — ExecutionRuntime
 * Execution runtime state tracking (status, tick counter, timestamp, pause/resume/reset).
 * Zero UI, React, Chart, or Replay dependencies.
 */

export type ExecutionState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED';

export class ExecutionRuntime {
  private state: ExecutionState = 'IDLE';
  private totalTicksProcessed: number = 0;
  private lastMarketTimestamp: number | null = null;

  public start(): void {
    this.state = 'RUNNING';
  }

  public pause(): void {
    this.state = 'PAUSED';
  }

  public stop(): void {
    this.state = 'STOPPED';
  }

  public reset(): void {
    this.state = 'IDLE';
    this.totalTicksProcessed = 0;
    this.lastMarketTimestamp = null;
  }

  public incrementTickCount(timestamp: number): void {
    this.totalTicksProcessed++;
    this.lastMarketTimestamp = timestamp;
  }

  public getState(): ExecutionState {
    return this.state;
  }

  public getTotalTicks(): number {
    return this.totalTicksProcessed;
  }

  public getLastTimestamp(): number | null {
    return this.lastMarketTimestamp;
  }
}
