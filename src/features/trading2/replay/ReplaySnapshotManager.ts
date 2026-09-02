/**
 * Trading Engine 2.0 — ReplaySnapshotManager
 * Manages index-keyed serializable snapshots of TradingStore state for replay time-travel.
 * Enables 100% deterministic backward/forward navigation, branch invalidation on user mutations,
 * and timeframe switch re-anchoring.
 *
 * Snapshot Semantics:
 * snapshotManager.getSnapshot(index) = Trading Engine state AFTER processing candle[index].
 * snapshotManager.getSnapshot(replayStartIndex) = Initial Trading Engine state BEFORE processing
 * any candles beyond replayStartIndex.
 */

import type { TradingStore } from '../store/TradingStore';
import type { TradingStoreSnapshot, TradingStoreSchema } from '../store/TradingStoreTypes';
import { TradingStoreSelectors } from '../store/TradingStoreSelectors';
import { REPLAY_DEBUG } from '@/config/debug';

export class ReplaySnapshotManager {
  private snapshots: Map<number, TradingStoreSnapshot> = new Map();
  private store: TradingStore;
  private lastCapturedSnapshot: TradingStoreSnapshot | null = null;
  private lastSignature: string = '';
  private baseStartIndex: number = 0;

  constructor(store: TradingStore) {
    this.store = store;
  }

  /**
   * Fast, comprehensive fingerprint of trading store state to detect ANY mutation.
   * Accurately captures:
   *  - Store revision counter
   *  - Stop Loss / Take Profit edits on existing positions
   *  - Volume / partial close changes
   *  - Pending order modifications
   *  - Floating PnL & Account balance changes
   *  - Closed trade history additions
   */
  private getStoreSignature(schema: TradingStoreSchema): string {
    const rev = this.store.getRevision();
    const acc = schema.account;
    const base = `rev:${rev}|bal:${acc.balance}|pnl:${acc.floatingPnL}|eq:${acc.equity}|mg:${acc.margin}|hist:${schema.history.length}`;

    if (schema.positions.length === 0 && schema.orders.length === 0) {
      return `empty|${base}`;
    }

    // Granular position signature (captures SL, TP, volume, modifiedAt, currentPrice, status)
    const posSig = schema.positions
      .map(
        (p) =>
          `${p.positionId}:${p.volume}:${p.stopLoss}:${p.takeProfit}:${p.currentPrice}:${p.floatingPnL}:${p.status}:${p.modifiedAt}`
      )
      .join(';');

    // Granular order signature (captures entryPrice, SL, TP, volume, status)
    const ordSig = schema.orders
      .map(
        (o) =>
          `${o.orderId}:${o.volume}:${o.entryPrice}:${o.stopLoss}:${o.takeProfit}:${o.status}`
      )
      .join(';');

    return `${base}|P:${posSig}|O:${ordSig}|R:${schema.runtime.selectedPositionId}:${schema.runtime.selectedOrderId}`;
  }

  /**
   * Initializes snapshot manager for a new replay session or timeframe,
   * capturing S_start at replayStartIndex.
   */
  public initialize(startIndex: number): TradingStoreSnapshot {
    this.clear();
    this.baseStartIndex = startIndex;
    const raw = this.store.getSchemaRaw();
    const initialSnapshot = TradingStoreSelectors.getSnapshot(raw);
    this.lastCapturedSnapshot = initialSnapshot;
    this.lastSignature = this.getStoreSignature(raw);

    this.saveSnapshot(startIndex, initialSnapshot);
    return initialSnapshot;
  }

  /**
   * Saves a snapshot of current TradingStore state for candle index.
   * If snapshot is omitted, captures current store schema state with dirty check.
   */
  public saveSnapshot(index: number, snapshot?: TradingStoreSnapshot): void {
    let s: TradingStoreSnapshot;

    if (snapshot) {
      s = snapshot;
      this.lastCapturedSnapshot = s;
      this.lastSignature = this.getStoreSignature(s.schema);
    } else {
      const raw = this.store.getSchemaRaw();
      const currentSig = this.getStoreSignature(raw);

      // Dirty check: reuse cached snapshot if store state has not changed
      if (this.lastCapturedSnapshot && currentSig === this.lastSignature) {
        s = this.lastCapturedSnapshot;
      } else {
        s = TradingStoreSelectors.getSnapshot(raw);
        this.lastCapturedSnapshot = s;
        this.lastSignature = currentSig;
      }
    }

    if (REPLAY_DEBUG) {
      console.log('[SNAPSHOT-SAVE]', {
        index,
        openPositionsCount: s.schema.positions.length,
        openPositions: s.schema.positions.map((p) => ({ positionId: p.positionId, symbol: p.symbol, status: p.status })),
      });
    }

    this.snapshots.set(index, s);

    // Memory Optimization: Keep a generous snapshot buffer (up to 2,000 checkpoints)
    if (this.snapshots.size > 2000) {
      const keys = Array.from(this.snapshots.keys());
      for (const k of keys) {
        if (k !== this.baseStartIndex && k < index - 1000 && k % 10 !== 0) {
          this.snapshots.delete(k);
        }
      }
    }
  }

  /**
   * Retrieves snapshot for candle index.
   */
  public getSnapshot(index: number): TradingStoreSnapshot | null {
    return this.snapshots.get(index) ?? null;
  }

  /**
   * Returns true if snapshot exists for index.
   */
  public hasSnapshot(index: number): boolean {
    return this.snapshots.has(index);
  }

  /**
   * Restores TradingStore state from snapshot at index or nearest preceding snapshot.
   * Emits SnapshotLoaded event on TradingStore, notifying all UI listeners.
   */
  public restoreSnapshot(index: number): boolean {
    let snapshot = this.snapshots.get(index);
    if (!snapshot) {
      const available = Array.from(this.snapshots.keys()).filter((i) => i <= index);
      if (available.length > 0) {
        const nearest = Math.max(...available);
        snapshot = this.snapshots.get(nearest);
      }
    }
    if (!snapshot) return false;

    this.store.loadSnapshot(snapshot);

    // Invalidate cached snapshot signature to ensure next save re-checks
    this.lastCapturedSnapshot = snapshot;
    this.lastSignature = this.getStoreSignature(snapshot.schema);

    return true;
  }

  /**
   * Branch Invalidation: When user mutates state at currentIndex (e.g. creates/cancels order),
   * invalidates all snapshots for index > currentIndex.
   * Also updates current index snapshot with post-mutation state.
   */
  public invalidateAfter(currentIndex: number): void {
    const keys = Array.from(this.snapshots.keys());
    for (const idx of keys) {
      if (idx > currentIndex) {
        this.snapshots.delete(idx);
      }
    }
    const raw = this.store.getSchemaRaw();
    const currentSnapshot = TradingStoreSelectors.getSnapshot(raw);
    this.lastCapturedSnapshot = currentSnapshot;
    this.lastSignature = this.getStoreSignature(raw);

    this.snapshots.set(currentIndex, currentSnapshot);
  }

  /**
   * Clears all cached snapshots.
   */
  public clear(): void {
    this.snapshots.clear();
    this.lastCapturedSnapshot = null;
    this.lastSignature = '';
  }

  /**
   * Returns number of cached snapshots.
   */
  public size(): number {
    return this.snapshots.size;
  }

  /**
   * Estimates total memory usage of cached snapshots in bytes.
   */
  public getEstimatedMemoryUsageBytes(): number {
    let bytes = 0;
    for (const snapshot of this.snapshots.values()) {
      bytes += JSON.stringify(snapshot).length * 2;
    }
    return bytes;
  }
}
