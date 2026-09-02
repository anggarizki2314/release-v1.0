/**
 * Trading Engine 2.0 — PositionManager
 * Handles Hedging position lifecycle: Open, Modify, Close, Partial Close, and Reverse.
 */

import type { Position, ClosedTrade, PositionSide, TradeCloseReason } from '../types/models';
import type { OpenPositionCommand, ModifyPositionCommand, PartialCloseCommand, ReversePositionCommand } from '../types/commands';
import type { TradingStore } from './TradingStore';
import type { TradingEventBus } from './EventBus';
import type { AccountManager } from './AccountManager';

export class PositionManager {
  private idCounter: number = 1;

  constructor(
    private store: TradingStore,
    private eventBus: TradingEventBus,
    private accountManager: AccountManager
  ) {}

  /**
   * Opens a new Hedging position.
   * Multiple BUY and SELL positions on the same symbol can coexist simultaneously.
   */
  public openPosition(cmd: OpenPositionCommand, currentPrice: number, now: number): Position {
    const positionId = `POS-${Date.now()}-${this.idCounter++}`;
    const orderId = `ORD-${Date.now()}-${this.idCounter}`;

    const position: Position = {
      positionId,
      orderId,
      symbol: cmd.symbol,
      side: cmd.side,
      volume: cmd.volume,
      entryPrice: cmd.entryPrice ?? currentPrice,
      currentPrice: cmd.entryPrice ?? currentPrice,
      sl: cmd.sl ?? null,
      tp: cmd.tp ?? null,
      floatingPnl: 0,
      commission: 0,
      swap: 0,
      comment: cmd.comment ?? null,
      magicNumber: cmd.magicNumber ?? null,
      createdTime: now,
      modifiedTime: now,
      status: 'OPEN',
    };

    this.store.addPosition(position);
    this.accountManager.recalculate();

    this.eventBus.emit('position:opened', { position });
    return position;
  }

  /**
   * Modifies Stop Loss or Take Profit of an existing position.
   */
  public modifyPosition(cmd: ModifyPositionCommand, now: number): Position | undefined {
    const pos = this.store.getPositionById(cmd.positionId);
    if (!pos || pos.status !== 'OPEN') return undefined;

    const updated: Position = {
      ...pos,
      sl: cmd.sl !== undefined ? cmd.sl : pos.sl,
      tp: cmd.tp !== undefined ? cmd.tp : pos.tp,
      modifiedTime: now,
    };

    this.store.updatePosition(updated);
    this.eventBus.emit('position:modified', { position: updated });
    return updated;
  }

  /**
   * Closes an open position fully.
   */
  public closePosition(positionId: string, exitPrice: number, now: number, reason: TradeCloseReason = 'MANUAL'): ClosedTrade | undefined {
    const pos = this.store.removePosition(positionId);
    if (!pos) return undefined;

    const closedPos: Position = {
      ...pos,
      currentPrice: exitPrice,
      status: 'CLOSED',
      modifiedTime: now,
    };

    const tradeId = `TRD-${Date.now()}-${this.idCounter++}`;
    const realizedPnl = this.calculatePnl(pos.side, pos.entryPrice, exitPrice, pos.volume, pos.symbol);

    const trade: ClosedTrade = {
      tradeId,
      positionId: pos.positionId,
      symbol: pos.symbol,
      side: pos.side,
      volume: pos.volume,
      entryPrice: pos.entryPrice,
      exitPrice,
      sl: pos.sl,
      tp: pos.tp,
      realizedPnl,
      commission: pos.commission,
      swap: pos.swap,
      comment: pos.comment,
      magicNumber: pos.magicNumber,
      openTime: pos.createdTime,
      closeTime: now,
      closeReason: reason,
    };

    this.store.addTradeToHistory(trade);
    this.accountManager.applyRealizedPnl(realizedPnl);
    this.eventBus.emit('position:closed', { position: closedPos, trade });
    this.eventBus.emit('history:updated', { trades: this.store.getHistory() as ClosedTrade[] });

    return trade;
  }

  /**
   * Partials closes a position by reducing its volume.
   */
  public partialClose(cmd: PartialCloseCommand, exitPrice: number, now: number): ClosedTrade | undefined {
    const pos = this.store.getPositionById(cmd.positionId);
    if (!pos || pos.status !== 'OPEN' || cmd.closeVolume >= pos.volume) {
      if (pos) return this.closePosition(cmd.positionId, exitPrice, now, 'PARTIAL');
      return undefined;
    }

    const remainingVolume = pos.volume - cmd.closeVolume;
    const updated: Position = {
      ...pos,
      volume: remainingVolume,
      modifiedTime: now,
    };

    this.store.updatePosition(updated);

    const tradeId = `TRD-${Date.now()}-${this.idCounter++}`;
    const realizedPnl = this.calculatePnl(pos.side, pos.entryPrice, exitPrice, cmd.closeVolume, pos.symbol);

    const trade: ClosedTrade = {
      tradeId,
      positionId: pos.positionId,
      symbol: pos.symbol,
      side: pos.side,
      volume: cmd.closeVolume,
      entryPrice: pos.entryPrice,
      exitPrice,
      sl: pos.sl,
      tp: pos.tp,
      realizedPnl,
      commission: 0,
      swap: 0,
      comment: pos.comment ? `${pos.comment} (Partial)` : 'Partial Close',
      magicNumber: pos.magicNumber,
      openTime: pos.createdTime,
      closeTime: now,
      closeReason: 'PARTIAL',
    };

    this.store.addTradeToHistory(trade);
    this.accountManager.applyRealizedPnl(realizedPnl);
    this.eventBus.emit('position:modified', { position: updated });
    this.eventBus.emit('history:updated', { trades: this.store.getHistory() as ClosedTrade[] });

    return trade;
  }

  /**
   * Reverses a position: closes current side and opens an equivalent position on the opposite side.
   */
  public reversePosition(cmd: ReversePositionCommand, currentPrice: number, now: number): Position | undefined {
    const pos = this.store.getPositionById(cmd.positionId);
    if (!pos) return undefined;

    const oppositeSide: PositionSide = pos.side === 'BUY' ? 'SELL' : 'BUY';
    const exitPrice = cmd.closePrice ?? currentPrice;

    this.closePosition(pos.positionId, exitPrice, now, 'REVERSE');

    return this.openPosition({
      symbol: pos.symbol,
      side: oppositeSide,
      volume: pos.volume,
      entryPrice: currentPrice,
      sl: null,
      tp: null,
      comment: pos.comment ? `Reverse of ${pos.positionId}` : 'Reversed',
      magicNumber: pos.magicNumber,
    }, currentPrice, now);
  }

  /**
   * Updates floating PnL for all open positions on incoming price tick.
   */
  public updateFloatingPnlOnTick(symbol: string, bid: number, ask: number): void {
    const positions = this.store.getPositions();
    let updatedCount = 0;

    positions.forEach((pos) => {
      if (pos.symbol !== symbol) return;

      const currentPrice = pos.side === 'BUY' ? bid : ask;
      const floatingPnl = this.calculatePnl(pos.side, pos.entryPrice, currentPrice, pos.volume, pos.symbol);

      const updated: Position = {
        ...pos,
        currentPrice,
        floatingPnl,
      };

      this.store.updatePosition(updated);
      updatedCount++;
    });

    if (updatedCount > 0) {
      this.accountManager.recalculate();
      this.eventBus.emit('position:updated', { positions: this.store.getPositions() as Position[] });
    }
  }

  /**
   * Internal PnL calculation interface:
   * (ExitPrice - EntryPrice) * Volume * ContractSize for BUY
   * (EntryPrice - ExitPrice) * Volume * ContractSize for SELL
   */
  private calculatePnl(side: PositionSide, entry: number, exit: number, volume: number, _symbol: string): number {
    const contractSize = 100_000;
    const diff = side === 'BUY' ? exit - entry : entry - exit;
    return diff * volume * contractSize;
  }
}
