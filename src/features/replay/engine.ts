import type { Candle, Timeframe } from '@/types';
import type { ReplayState, ReplayStatus } from './types';
import { findNearestCandleIndex } from './replayStartPoint';

export interface ReplayEngineConfig {
  symbolId: number;
  symbol: string;
  timeframe: Timeframe;
  allCandles: Candle[];
  replayStartIndex: number;
}

export interface ReplayDataView {
  historicalCandles: Candle[];
  visibleCandle: Candle | null;
  futureCandles: Candle[];
  currentIndex: number;
  totalCandles: number;
  replayStartTime: number;
  replayEndTime: number;
}

export class ReplayEngine {
  private config: ReplayEngineConfig | null = null;
  private currentIndex: number = -1;
  private status: ReplayStatus = 'idle';

  constructor() {}

  isInitialized(): boolean {
    return this.config !== null;
  }

  getStatus(): ReplayStatus {
    return this.status;
  }

  getAllCandles(): Candle[] {
    return this.config ? this.config.allCandles : [];
  }

  private setStatus(status: ReplayStatus): void {
    this.status = status;
  }

  /**
   * Initialize replay engine with full dataset dan start point index.
   * - allCandles harus sudah sorted by time ASC (dari database)
   * - replayStartIndex adalah index dalam allCandles dimana replay dimulai
   * - State transition: idle → ready
   */
  initialize(config: ReplayEngineConfig): void {
    if (config.allCandles.length === 0) {
      throw new Error('Cannot initialize replay with empty candles');
    }

    if (config.replayStartIndex < 0 || config.replayStartIndex >= config.allCandles.length) {
      throw new Error(
        `Invalid replay start index ${config.replayStartIndex}, must be 0-${config.allCandles.length - 1}`
      );
    }

    this.config = config;
    this.currentIndex = config.replayStartIndex;
    this.setStatus('ready');
  }

  /**
   * Reset engine ke idle state. Useful saat symbol/timeframe berubah.
   */
  reset(): void {
    this.config = null;
    this.currentIndex = -1;
    this.setStatus('idle');
  }

  /**
   * Get current replay state snapshot untuk UI/context updates.
   */
  getReplayState(): ReplayState {
    if (!this.config) {
      return {
        isReplayMode: false,
        replaySelectionMode: false,
        status: 'idle',
        symbol: null,
        symbolId: null,
        timeframe: null,
        replayStartTime: null,
        replayStartIndex: null,
        currentReplayTime: null,
        currentReplayIndex: null,
        replayEndTime: null,
        totalCandlesInReplay: 0,
      };
    }

    const startTime = this.config.allCandles[this.config.replayStartIndex].time;
    const endTime = this.config.allCandles[this.config.allCandles.length - 1].time;
    const currentCandle = this.config.allCandles[this.currentIndex];

    return {
      isReplayMode: true,
      replaySelectionMode: false,
      status: this.status,
      symbol: this.config.symbol,
      symbolId: this.config.symbolId,
      timeframe: this.config.timeframe,
      replayStartTime: startTime,
      replayStartIndex: this.config.replayStartIndex,
      currentReplayTime: currentCandle?.time ?? null,
      currentReplayIndex: this.currentIndex - this.config.replayStartIndex,
      replayEndTime: endTime,
      totalCandlesInReplay: this.config.allCandles.length - this.config.replayStartIndex,
    };
  }

  /**
   * Get current data view: historical context, visible candle, dan future.
   * Digunakan oleh chart layer untuk filter mana candle yang boleh ditampilkan.
   */
  getDataView(): ReplayDataView {
    if (!this.config) {
      throw new Error('ReplayEngine not initialized');
    }

    const startIdx = this.config.replayStartIndex;
    const currentIdx = this.currentIndex;
    const allCandles = this.config.allCandles;

    const historicalCandles = allCandles.slice(0, currentIdx + 1);
    const visibleCandle = allCandles[currentIdx] ?? null;
    const futureCandles = allCandles.slice(currentIdx + 1);

    return {
      historicalCandles,
      visibleCandle,
      futureCandles,
      currentIndex: currentIdx,
      totalCandles: allCandles.length,
      replayStartTime: allCandles[startIdx].time,
      replayEndTime: allCandles[allCandles.length - 1].time,
    };
  }

  /**
   * Transition ke playing state.
   */
  play(): void {
    if (!this.config) throw new Error('ReplayEngine not initialized');
    this.setStatus('playing');
  }

  /**
   * Transition ke paused state.
   */
  pause(): void {
    if (!this.config) throw new Error('ReplayEngine not initialized');
    if (this.status === 'playing') {
      this.setStatus('paused');
    }
  }

  /**
   * Cek apakah replay sudah mencapai akhir.
   */
  isFinished(): boolean {
    if (!this.config) return false;
    return this.currentIndex >= this.config.allCandles.length - 1;
  }

  /**
   * Dapatkan posisi replay sebagai persentase (0-100).
   */
  getProgressPercentage(): number {
    if (!this.config) return 0;
    const startIdx = this.config.replayStartIndex;
    const totalReplayCandles = this.config.allCandles.length - startIdx;
    const currentPosition = this.currentIndex - startIdx + 1;
    return (currentPosition / totalReplayCandles) * 100;
  }

  /**
   * Dapatkan candle pada index spesifik (untuk internal use).
   */
  getCandleAtIndex(index: number): Candle | null {
    if (!this.config || index < 0 || index >= this.config.allCandles.length) {
      return null;
    }
    return this.config.allCandles[index];
  }

  /**
   * Set current replay position by index (absolute, not offset dari start).
   * Used oleh slider/seekbar untuk jump ke posisi tertentu.
   */
  setCurrentIndex(index: number): void {
    if (!this.config) throw new Error('ReplayEngine not initialized');
    if (index < this.config.replayStartIndex || index >= this.config.allCandles.length) {
      throw new Error(
        `Cannot set index ${index}, must be ${this.config.replayStartIndex}-${this.config.allCandles.length - 1}`
      );
    }
    this.currentIndex = index;
    if (this.isFinished()) {
      this.setStatus('finished');
    } else if (this.status === 'finished') {
      this.setStatus('paused');
    }
  }

  /**
   * Dapatkan current index (absolute dalam array).
   */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  private hasMoreFutureData: boolean = false;

  setHasMoreFutureData(hasMore: boolean): void {
    this.hasMoreFutureData = hasMore;
  }

  isBufferExhausted(): boolean {
    if (!this.config) return false;
    return this.currentIndex >= this.config.allCandles.length - 1 && !this.hasMoreFutureData;
  }

  updateAllCandles(candles: Candle[]): void {
    if (this.config && candles.length > 0) {
      const prevCandle = this.config.allCandles[this.currentIndex];
      const prevStartCandle = this.config.allCandles[this.config.replayStartIndex];

      this.config.allCandles = candles;

      if (prevCandle) {
        const newIdx = findNearestCandleIndex(candles, prevCandle.time);
        if (newIdx >= 0) {
          this.currentIndex = newIdx;
        }
      }

      if (prevStartCandle) {
        const newStartIdx = findNearestCandleIndex(candles, prevStartCandle.time);
        if (newStartIdx >= 0) {
          this.config.replayStartIndex = newStartIdx;
        }
      }
    }
  }
}

