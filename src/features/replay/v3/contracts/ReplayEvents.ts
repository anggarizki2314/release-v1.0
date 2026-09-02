/**
 * Replay Engine V3 — Event Bus Contracts
 * Architecture Frozen v1.0
 */

import type {
  ReplayTimestampUTC,
  PlaybackDirection,
  TimeChangeReason,
  ReplaySession,
} from './ReplayTypes';

/**
 * Payload for ReplayTimeChanged event.
 */
export interface ReplayTimeChangedPayload {
  readonly version: 1;
  readonly eventId: string;
  readonly currentTimeUTC: ReplayTimestampUTC;
  readonly playbackDirection: PlaybackDirection;
  readonly reason: TimeChangeReason;
  readonly speed: number;
}

/**
 * Strongly typed Event Map for ReplayEventBus.
 */
export interface ReplayEventMap {
  'ReplaySessionCreated': { readonly version: 1; readonly eventId: string; readonly session: ReplaySession };
  'ReplaySessionDestroyed': { readonly version: 1; readonly eventId: string; readonly sessionId: string };
  'ReplayStarted': { readonly version: 1; readonly eventId: string; readonly timeUTC: ReplayTimestampUTC };
  'ReplayPaused': { readonly version: 1; readonly eventId: string; readonly timeUTC: ReplayTimestampUTC };
  'ReplayStopped': { readonly version: 1; readonly eventId: string; readonly timeUTC: ReplayTimestampUTC };
  'ReplayFinished': { readonly version: 1; readonly eventId: string; readonly finalTimeUTC: ReplayTimestampUTC };
  'ReplayTimeChanged': ReplayTimeChangedPayload;
  'ReplaySpeedChanged': { readonly version: 1; readonly eventId: string; readonly speed: number };
  'ReplayJumped': { readonly version: 1; readonly eventId: string; readonly targetTimeUTC: ReplayTimestampUTC; readonly previousTimeUTC: ReplayTimestampUTC };
}

export type ReplayEventKey = keyof ReplayEventMap;
export type ReplayEventHandler<K extends ReplayEventKey> = (data: ReplayEventMap[K]) => void;
