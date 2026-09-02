/**
 * Replay Engine V3 — Core Type Contracts
 * Architecture Frozen v1.0
 */

import type { Timeframe } from '@/types';

/**
 * Unified SSoT timestamp type across all V3 modules (Unix timestamp in seconds).
 */
export type ReplayTimestampUTC = number;

/**
 * Resolution modes when matching a target date to candle timestamps.
 */
export type ReplayStartMode = 'EXACT' | 'PREVIOUS' | 'NEXT' | 'NEAREST';

/**
 * Playback status lifecycle states.
 */
export type PlaybackStatus = 'idle' | 'ready' | 'playing' | 'paused' | 'finished';

/**
 * Direction of replay playback movement.
 */
export type PlaybackDirection = 'forward' | 'backward';

/**
 * Triggers for timeline timestamp updates.
 */
export type TimeChangeReason = 'tick' | 'jump' | 'step' | 'session_start';

/**
 * Immutable Replay Session definition.
 */
export interface ReplaySession {
  readonly id: string;
  readonly replayStartTimeUTC: ReplayTimestampUTC;
  readonly replayEndTimeUTC: ReplayTimestampUTC;
  readonly replayStartMode: ReplayStartMode;
  readonly createdAt: number;
}

/**
 * Immutable Snapshot for workspace save/load, session restore, and crash recovery.
 */
export interface ReplaySessionSnapshot {
  readonly version: 1;
  readonly sessionId: string;
  readonly replayStartTimeUTC: ReplayTimestampUTC;
  readonly replayEndTimeUTC: ReplayTimestampUTC;
  readonly replayStartMode: ReplayStartMode;
  readonly speed: number;
  readonly status: PlaybackStatus;
  readonly layout: string;
  readonly symbolList: readonly string[];
  readonly timeframeList: readonly string[];
  readonly createdAt: number;
}

/**
 * Pure Global Timeline Clock State (SSoT: currentReplayTimeUTC).
 */
export interface ReplayTimelineState {
  readonly status: PlaybackStatus;
  readonly currentReplayTimeUTC: ReplayTimestampUTC | null;
  readonly replayStartTimeUTC: ReplayTimestampUTC | null;
  readonly replayEndTimeUTC: ReplayTimestampUTC | null;
  readonly playbackSpeed: number;
  readonly activeSession: ReplaySession | null;
}

/**
 * Window Metadata Descriptor (Zero candle arrays, metadata only).
 */
export interface WindowDescriptor {
  readonly version: 1;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly preloadBefore: number;
  readonly preloadAfter: number;
  readonly shouldLoadMore: boolean;
  readonly direction: PlaybackDirection;
}

/**
 * Composite Key for Level 1 ReplayCache.
 */
export interface ReplayCacheKey {
  readonly symbol: string;
  readonly timeframe: Timeframe;
  readonly timestampUTC: ReplayTimestampUTC;
}

/**
 * Helper to generate composite cache key string.
 */
export function formatCompositeCacheKey(key: ReplayCacheKey): string {
  return `${key.symbol.toUpperCase()}:${key.timeframe}:${key.timestampUTC}`;
}
