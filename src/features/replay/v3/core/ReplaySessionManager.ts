/**
 * Replay Engine V3 — ReplaySessionManager
 * Session creation, validation, snapshot generation, and destruction.
 * Architecture Frozen v1.0
 */

import type { Timeframe } from '@/types';
import type {
  ReplayTimestampUTC,
  ReplayStartMode,
  ReplaySession,
  ReplaySessionSnapshot,
} from '../contracts/ReplayTypes';
import type { CandleRepository } from '../data/CandleRepository';

export interface CreateSessionParams {
  readonly symbol: string;
  readonly timeframe: Timeframe | string;
  readonly targetStartUTC: ReplayTimestampUTC;
  readonly targetEndUTC?: ReplayTimestampUTC;
  readonly startMode?: ReplayStartMode;
  readonly layout?: string;
  readonly symbolList?: readonly string[];
  readonly timeframeList?: readonly string[];
}

export class ReplaySessionManager {
  private activeSession: ReplaySession | null = null;
  private activeSnapshot: ReplaySessionSnapshot | null = null;

  constructor(private repository: CandleRepository) {}

  /**
   * Session Creation Pipeline:
   * 1. Validate repository dataset
   * 2. Perform Binary Search via Repository using ReplayStartMode
   * 3. Validate result
   * 4. Build immutable ReplaySession & ReplaySessionSnapshot
   */
  public createSession(params: CreateSessionParams): {
    session: ReplaySession;
    snapshot: ReplaySessionSnapshot;
    resolvedStartCandleTime: ReplayTimestampUTC;
    resolvedStartIndex: number;
  } {
    const {
      symbol,
      timeframe,
      targetStartUTC,
      startMode = 'PREVIOUS',
      layout = 'single',
      symbolList = [symbol],
      timeframeList = [timeframe as string],
    } = params;

    const datasetLength = this.repository.getDatasetLength(symbol, timeframe);
    if (datasetLength === 0) {
      throw new Error(`Cannot create session: empty dataset for ${symbol} ${timeframe}`);
    }

    const match = this.repository.findCandleIndexByTime(
      symbol,
      timeframe as Timeframe,
      targetStartUTC,
      startMode
    );

    if (!match) {
      throw new Error(
        `Failed to resolve start candle for ${symbol} at timestamp ${targetStartUTC} using mode ${startMode}`
      );
    }

    const resolvedStartCandleTime = match.candle.time;
    const resolvedStartIndex = match.index;

    console.log('[REPLAY DATE FORENSIC 3] Engine createSession', { targetStartUTC, startMode, resolvedStartIndex, resolvedStartCandleTime, datasetLength, symbol, timeframe });

    // Last candle in repository sets end boundary
    const lastCandle = this.repository.getCandleAt(symbol, timeframe, datasetLength - 1);
    const endUTC = params.targetEndUTC ?? lastCandle?.time ?? resolvedStartCandleTime;

    const session: ReplaySession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      replayStartTimeUTC: resolvedStartCandleTime,
      replayEndTimeUTC: endUTC,
      replayStartMode: startMode,
      createdAt: Date.now(),
    };

    const snapshot: ReplaySessionSnapshot = {
      version: 1,
      sessionId: session.id,
      replayStartTimeUTC: session.replayStartTimeUTC,
      replayEndTimeUTC: session.replayEndTimeUTC,
      replayStartMode: session.replayStartMode,
      speed: 1,
      status: 'ready',
      layout,
      symbolList,
      timeframeList,
      createdAt: session.createdAt,
    };

    this.activeSession = session;
    this.activeSnapshot = snapshot;

    return {
      session,
      snapshot,
      resolvedStartCandleTime,
      resolvedStartIndex,
    };
  }

  public getActiveSession(): ReplaySession | null {
    return this.activeSession;
  }

  public getActiveSnapshot(): ReplaySessionSnapshot | null {
    return this.activeSnapshot;
  }

  public destroySession(): string | null {
    if (!this.activeSession) return null;
    const id = this.activeSession.id;
    this.activeSession = null;
    this.activeSnapshot = null;
    return id;
  }
}
