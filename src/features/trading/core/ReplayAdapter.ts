/**
 * Trading Engine 2.0 — ReplayAdapter
 * Bridges incoming Replay Engine candles/ticks to Trading Engine commands.
 * Replay Engine sends only Market Ticks; Trading Engine evaluates all business logic internally.
 */

import type { TradingEngine } from '../TradingEngine';

export interface ReplayTickPayload {
  symbol: string;
  bid: number;
  ask: number;
  time: number;
}

export interface ReplayCandlePayload {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  time: number;
}

export class ReplayAdapter {
  constructor(private engine: TradingEngine) {}

  /**
   * Adapts a raw tick from Replay Engine into a ProcessTickCommand on Trading Engine.
   */
  public onReplayTick(tick: ReplayTickPayload): void {
    this.engine.processTick({
      symbol: tick.symbol,
      bid: tick.bid,
      ask: tick.ask,
      time: tick.time,
    });
  }

  /**
   * Adapts a candle step from Replay Engine into a ProcessTickCommand (bid/ask derived from close).
   */
  public onReplayCandle(candle: ReplayCandlePayload, spreadPips: number = 0): void {
    const isJpy = candle.symbol.toUpperCase().includes('JPY');
    const pipSize = isJpy ? 0.01 : 0.0001;
    const spreadOffset = (spreadPips * pipSize) / 2;

    const bid = candle.close - spreadOffset;
    const ask = candle.close + spreadOffset;

    this.engine.processTick({
      symbol: candle.symbol,
      bid,
      ask,
      time: candle.time,
    });
  }
}
