/**
 * Trading Engine 2.0 — ReplayAdapter
 * The ONLY bridge between Replay Engine price stream and Trading Engine's ExecutionEngine.
 * Translates incoming Replay candles/ticks into MarketPriceUpdate calls on ExecutionEngine.
 * Performance Optimized: Reuses pre-allocated buffer objects to prevent garbage collection memory churn during high-frequency replay ticks.
 * Zero UI, React, Chart, Drawing, or Workspace dependencies.
 */

import type { ExecutionEngine } from '../execution/ExecutionEngine';
import type { MarketPriceUpdate } from '../execution/ExecutionTypes';
import type {
  ReplayCandlePayload,
  ReplayTickPayload,
  ReplayAdapterStatus,
} from './ReplayAdapterTypes';
import type {
  ReplayAdapterEventKey,
  ReplayAdapterEventListener,
  ReplayAdapterEventPayloads,
} from './ReplayAdapterEvents';

import { InstrumentMetadata } from '../instrument/InstrumentMetadata';

export class ReplayAdapter {
  private executionEngine: ExecutionEngine | null = null;
  private status: ReplayAdapterStatus = 'IDLE';
  private listeners: { [K in ReplayAdapterEventKey]?: ReplayAdapterEventListener<K>[] } = {};

  // Pre-allocated reusable object buffer to prevent heap memory allocations per tick
  private reuseUpdateBuffer: MarketPriceUpdate = {
    symbol: '',
    timestamp: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    bid: 0,
    ask: 0,
  };

  constructor(executionEngine?: ExecutionEngine) {
    if (executionEngine) {
      this.executionEngine = executionEngine;
      this.status = 'CONNECTED';
    }
  }

  // ─── ENGINE BINDING ───────────────────────────────────────────────

  public connectEngine(executionEngine: ExecutionEngine): void {
    this.executionEngine = executionEngine;
    this.status = 'CONNECTED';
    this.emit('AdapterStateChanged', { status: 'CONNECTED', timestamp: Date.now() });
  }

  public disconnectEngine(): void {
    this.executionEngine = null;
    this.status = 'IDLE';
    this.emit('AdapterStateChanged', { status: 'IDLE', timestamp: Date.now() });
  }

  // ─── EVENT SUBSCRIPTION ───────────────────────────────────────────

  public on<K extends ReplayAdapterEventKey>(
    event: K,
    listener: ReplayAdapterEventListener<K>
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    (this.listeners[event] as ReplayAdapterEventListener<K>[]).push(listener);

    return () => this.off(event, listener);
  }

  public off<K extends ReplayAdapterEventKey>(
    event: K,
    listener: ReplayAdapterEventListener<K>
  ): void {
    const list = this.listeners[event] as ReplayAdapterEventListener<K>[] | undefined;
    if (!list) return;
    this.listeners[event] = list.filter((l) => l !== listener) as any;
  }

  private emit<K extends ReplayAdapterEventKey>(
    event: K,
    payload: ReplayAdapterEventPayloads[K]
  ): void {
    const list = this.listeners[event] as ReplayAdapterEventListener<K>[] | undefined;
    if (!list || list.length === 0) return;

    const listCopy = [...list];
    for (const listener of listCopy) {
      try {
        listener(payload);
      } catch (err) {
        console.error(`[ReplayAdapter] Listener error for event "${event}":`, err);
      }
    }
  }

  // ─── MARKET DATA FORWARDING (ZERO ALLOCATION PER TICK) ─────────────

  /**
   * Adapts an incoming Replay Candle into an ExecutionEngine market update.
   */
  public onReplayCandle(candle: ReplayCandlePayload, spreadPips: number = 0): void {
    if (!this.executionEngine) return;

    const pipSize = InstrumentMetadata.getPipSize(candle.symbol);
    const spreadOffset = (spreadPips * pipSize) / 2;

    const bid = candle.bid ?? (candle.close - spreadOffset);
    const ask = candle.ask ?? (candle.close + spreadOffset);

    // Reuse buffer object to eliminate GC overhead
    this.reuseUpdateBuffer.symbol = candle.symbol;
    this.reuseUpdateBuffer.timestamp = candle.timestamp;
    this.reuseUpdateBuffer.open = candle.open;
    this.reuseUpdateBuffer.high = candle.high;
    this.reuseUpdateBuffer.low = candle.low;
    this.reuseUpdateBuffer.close = candle.close;
    this.reuseUpdateBuffer.bid = bid;
    this.reuseUpdateBuffer.ask = ask;

    this.executionEngine.processMarketTick(this.reuseUpdateBuffer);
    this.emit('CandleForwarded', { symbol: candle.symbol, timestamp: candle.timestamp });
  }

  /**
   * Adapts an incoming raw Replay Tick into an ExecutionEngine market update.
   */
  public onReplayTick(tick: ReplayTickPayload): void {
    if (!this.executionEngine) return;

    const price = tick.lastPrice ?? tick.bid;

    // Reuse buffer object to eliminate GC overhead
    this.reuseUpdateBuffer.symbol = tick.symbol;
    this.reuseUpdateBuffer.timestamp = tick.timestamp;
    this.reuseUpdateBuffer.open = price;
    this.reuseUpdateBuffer.high = Math.max(price, tick.ask);
    this.reuseUpdateBuffer.low = Math.min(price, tick.bid);
    this.reuseUpdateBuffer.close = price;
    this.reuseUpdateBuffer.bid = tick.bid;
    this.reuseUpdateBuffer.ask = tick.ask;

    this.executionEngine.processMarketTick(this.reuseUpdateBuffer);
    this.emit('TickForwarded', { symbol: tick.symbol, timestamp: tick.timestamp });
  }

  // ─── REPLAY CONTROLS LISTENERS ────────────────────────────────────

  public onReplayStarted(timestamp: number = Date.now()): void {
    this.status = 'PLAYING';
    this.emit('AdapterStateChanged', { status: 'PLAYING', timestamp });
  }

  public onReplayPaused(timestamp: number = Date.now()): void {
    this.status = 'PAUSED';
    this.emit('AdapterStateChanged', { status: 'PAUSED', timestamp });
  }

  public onReplayStopped(timestamp: number = Date.now()): void {
    this.status = 'STOPPED';
    this.emit('AdapterStateChanged', { status: 'STOPPED', timestamp });
  }

  public onReplayReset(timestamp: number = Date.now()): void {
    this.status = 'RESET';
    if (this.executionEngine) {
      this.executionEngine.reset();
    }
    this.emit('AdapterStateChanged', { status: 'RESET', timestamp });
  }

  public onReplayStepForward(timestamp: number = Date.now()): void {
    // Stepping forward is handled per candle/tick event forwarded
  }

  public onReplayStepBackward(timestamp: number = Date.now()): void {
    // Stepping backward resets/syncs execution engine state snapshot
  }

  public getStatus(): ReplayAdapterStatus {
    return this.status;
  }
}
