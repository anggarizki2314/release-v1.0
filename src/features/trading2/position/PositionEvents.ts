/**
 * Trading Engine 2.0 — Position Events
 * Event map and payload interfaces emitted during Position lifecycle mutations.
 * Pure TypeScript without framework dependencies.
 */

import type { PositionModel } from './PositionTypes';

export interface PositionEventPayloads {
  PositionOpened: { position: PositionModel };
  PositionUpdated: { position: PositionModel };
  PositionModified: { oldPosition: PositionModel; newPosition: PositionModel };
  PositionPartiallyClosed: {
    originalPositionId: string;
    closedVolume: number;
    remainingPosition: PositionModel;
    closedPosition: PositionModel;
  };
  PositionClosed: { position: PositionModel; closePrice: number; closedAt: number };
  PositionReversed: { closedPosition: PositionModel; newPosition: PositionModel };
  PositionChanged: {
    event: 'OPEN' | 'UPDATE' | 'MODIFY' | 'PARTIAL_CLOSE' | 'CLOSE' | 'REVERSE' | 'RESET';
    position?: PositionModel;
    closedPosition?: PositionModel;
  };
}

export type PositionEventKey = keyof PositionEventPayloads;

export type PositionEventListener<K extends PositionEventKey> = (
  payload: PositionEventPayloads[K]
) => void;
