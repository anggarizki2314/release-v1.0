/**
 * Trading Engine 2.0 — ClosedPositionRepository
 * Central repository storing snapshots of all closed positions.
 * Source of truth for Trade History, Analytics, Challenge Review, and Account Engine.
 * Subscribes strictly to PositionEngine events.
 */

import type { PositionModel } from '../position/PositionTypes';
import type { PositionManager } from '../position/PositionManager';
import { InstrumentMetadata } from '../instrument/InstrumentMetadata';

export interface ClosedPositionRecord {
  positionId: string;
  orderId: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  volume: number;
  entryPrice: number;
  exitPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  floatingPnL: number;
  realizedPnL: number;
  commission: number;
  swap: number;
  openedAt: number;
  closedAt: number;
  comment: string | null;
  magicNumber: number | null;
}

export type ClosedPositionRepositoryListener = (closedPositions: ReadonlyArray<ClosedPositionRecord>) => void;

export class ClosedPositionRepository {
  private closedPositions: ClosedPositionRecord[] = [];
  private listeners: Set<ClosedPositionRepositoryListener> = new Set();
  private positionManager: PositionManager | null = null;
  private unsubscribePosManager: (() => void) | null = null;

  constructor(positionManager?: PositionManager) {
    if (positionManager) {
      this.bindPositionManager(positionManager);
    }
  }

  public bindPositionManager(positionManager: PositionManager): void {
    if (this.unsubscribePosManager) {
      this.unsubscribePosManager();
    }
    this.positionManager = positionManager;
    this.unsubscribePosManager = this.positionManager.on('PositionChanged', (payload) => {
      if (payload.closedPosition) {
        this.saveClosedPosition(payload.closedPosition);
      } else if (payload.event === 'RESET') {
        this.clear();
      }
    });
  }

  /**
   * Calculates realized PnL for a closed position based on direction & instrument contract size.
   */
  public calculateRealizedPnL(pos: PositionModel): number {
    const contractSize = InstrumentMetadata.getContractSize(pos.symbol);
    const exitPrice = pos.currentPrice;
    let priceDiff = 0;

    if (pos.direction === 'BUY') {
      priceDiff = exitPrice - pos.entryPrice;
    } else {
      priceDiff = pos.entryPrice - exitPrice;
    }

    const rawGrossPnL = priceDiff * pos.volume * contractSize;
    const grossPnL = InstrumentMetadata.convertQuoteToAccount(
      pos.symbol,
      rawGrossPnL,
      exitPrice || pos.entryPrice
    );
    const netPnL = grossPnL - (pos.commission || 0) - (pos.swap || 0);
    return Math.round(netPnL * 100) / 100;
  }

  /**
   * Saves a closed position snapshot into the repository.
   */
  public saveClosedPosition(pos: PositionModel): ClosedPositionRecord {
    // Avoid duplicate insertions
    const existing = this.closedPositions.find((p) => p.positionId === pos.positionId);
    if (existing) return existing;

    const realizedPnL = this.calculateRealizedPnL(pos);

    const record: ClosedPositionRecord = {
      positionId: pos.positionId,
      orderId: pos.orderId,
      symbol: pos.symbol,
      direction: pos.direction,
      volume: pos.volume,
      entryPrice: pos.entryPrice,
      exitPrice: pos.currentPrice,
      stopLoss: pos.stopLoss,
      takeProfit: pos.takeProfit,
      floatingPnL: pos.floatingPnL,
      realizedPnL,
      commission: pos.commission || 0,
      swap: pos.swap || 0,
      openedAt: pos.openedAt,
      closedAt: pos.closedAt ?? Date.now(),
      comment: pos.comment,
      magicNumber: pos.magicNumber,
    };

    this.closedPositions.push(record);
    this.notifyListeners();
    return record;
  }

  /**
   * Gets all closed position records.
   */
  public getClosedPositions(): ReadonlyArray<ClosedPositionRecord> {
    return this.closedPositions;
  }

  /**
   * Calculates total cumulative realized PnL across all closed positions.
   */
  public getTotalRealizedPnL(): number {
    return this.closedPositions.reduce((sum, p) => sum + p.realizedPnL, 0);
  }

  /**
   * Gets statistics: closed trade count, win count, loss count.
   */
  public getStatistics(): { closedPositions: number; winTrades: number; lossTrades: number } {
    const closedPositions = this.closedPositions.length;
    const winTrades = this.closedPositions.filter((p) => p.realizedPnL > 0).length;
    const lossTrades = this.closedPositions.filter((p) => p.realizedPnL < 0).length;
    return { closedPositions, winTrades, lossTrades };
  }

  /**
   * Directly adds a hydrated closed position record.
   */
  public addClosedPositionRecord(record: ClosedPositionRecord): void {
    console.log('[CLOSED-TRADE-HYDRATE]', {
      tradeId: record.orderId,
      positionId: record.positionId,
      symbol: record.symbol,
      action: 'HISTORY_ONLY',
    });

    const existing = this.closedPositions.find((p) => p.positionId === record.positionId);
    if (!existing) {
      this.closedPositions.push({ ...record });
      this.notifyListeners();
    }
  }

  /**
   * Removes a closed position by its position ID.
   */
  public removeClosedPosition(positionId: string): void {
    const idx = this.closedPositions.findIndex((p) => p.positionId === positionId);
    if (idx >= 0) {
      this.closedPositions.splice(idx, 1);
      this.notifyListeners();
    }
  }

  /**
   * Clears all recorded closed positions.
   */
  public clear(): void {
    this.closedPositions = [];
    this.notifyListeners();
  }

  public subscribe(listener: ClosedPositionRepositoryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const recordsCopy = [...this.closedPositions];
    this.listeners.forEach((l) => {
      try {
        l(recordsCopy);
      } catch (err) {
        console.error('[ClosedPositionRepository] Listener error:', err);
      }
    });
  }
}
