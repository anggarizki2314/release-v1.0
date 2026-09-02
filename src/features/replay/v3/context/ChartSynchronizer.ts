/**
 * Replay Engine V3 — ChartSynchronizer
 * Pure Event Fan-Out Distributor.
 * Architecture Frozen v1.0
 */

import type { ReplayTimeChangedPayload } from '../contracts/ReplayEvents';
import type { ChartContext } from './ChartContext';

export class ChartSynchronizer {
  private chartContexts: ChartContext[] = [];

  public registerChart(context: ChartContext): void {
    if (!this.chartContexts.some((c) => c.paneId === context.paneId)) {
      this.chartContexts.push(context);
      // Sort deterministically by paneId to guarantee ordered event delivery
      this.chartContexts.sort((a, b) => a.paneId.localeCompare(b.paneId));
    }
  }

  public unregisterChart(paneId: string): void {
    this.chartContexts = this.chartContexts.filter((c) => c.paneId !== paneId);
  }

  public getChartContexts(): readonly ChartContext[] {
    return this.chartContexts;
  }

  /**
   * Deterministic ordered fan-out distribution of ReplayTimeChanged event.
   */
  public handleTimeChanged(payload: ReplayTimeChangedPayload): void {
    if (this.chartContexts.length === 0 || payload.reason === 'session_start') {
      console.log('[REPLAY FORENSIC 8] ChartSynchronizer handleTimeChanged', { chartContextsCount: this.chartContexts.length, currentTimeUTC: payload.currentTimeUTC, reason: payload.reason, paneIds: this.chartContexts.map(c => c.paneId) });
    }
    for (let i = 0; i < this.chartContexts.length; i++) {
      this.chartContexts[i].onReplayTimeChanged(payload);
    }
  }

  public clear(): void {
    this.chartContexts = [];
  }
}
