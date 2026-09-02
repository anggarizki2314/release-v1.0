/**
 * Trading Engine 2.0 — OrdersTab
 * Renders active PENDING orders in the Bottom Panel.
 * Synchronized with TradingEngineService.
 */

import React, { useState, useEffect } from 'react';
import { tradingEngine } from '../TradingEngineService';
import type { OrderModel } from '../order/OrderTypes';
import { ModifyPositionModal, type ModifyItemData } from './ModifyPositionModal';
import './TradingTables.css';

export const OrdersTab: React.FC = () => {
  const [orders, setOrders] = useState<ReadonlyArray<OrderModel>>(() => tradingEngine.getPendingOrders());
  const [modifyItem, setModifyItem] = useState<ModifyItemData | null>(null);

  useEffect(() => {
    setOrders(tradingEngine.getPendingOrders());
    return tradingEngine.subscribe(() => {
      setOrders(tradingEngine.getPendingOrders());
    });
  }, []);

  if (orders.length === 0) {
    return (
      <div className="te2-empty-state">
        <span>No pending orders. Place a BUY LIMIT, SELL LIMIT, BUY STOP, or SELL STOP order to see it here.</span>
      </div>
    );
  }

  return (
    <div className="te2-table-container">
      <table className="te2-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Symbol</th>
            <th>Type</th>
            <th>Volume</th>
            <th>Price</th>
            <th>SL</th>
            <th>TP</th>
            <th>Status</th>
            <th>Time</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const isJpy = o.symbol.includes('JPY');
            const fmt = (p: number | null) => (p != null ? p.toFixed(isJpy ? 2 : 5) : '—');
            const isBuy = o.direction === 'BUY';

            return (
              <tr key={o.orderId}>
                <td>{o.orderId}</td>
                <td><strong>{o.symbol}</strong></td>
                <td>
                  <span className={`te2-badge ${isBuy ? 'buy' : 'sell'}`}>
                    {o.type.replace('_', ' ')}
                  </span>
                </td>
                <td>
                  <span
                    style={{ cursor: 'pointer', borderBottom: '1px dashed #38bdf8' }}
                    title="Click to modify lot size"
                    onClick={() => setModifyItem({
                      id: o.orderId,
                      symbol: o.symbol,
                      direction: o.direction,
                      entryPrice: o.entryPrice,
                      volume: o.volume,
                      stopLoss: o.stopLoss,
                      takeProfit: o.takeProfit,
                      isPendingOrder: true,
                    })}
                  >
                    {o.volume} Lot
                  </span>
                </td>
                <td>{fmt(o.entryPrice)}</td>
                <td>{fmt(o.stopLoss)}</td>
                <td>{fmt(o.takeProfit)}</td>
                <td>
                  <span className="te2-badge pending">PENDING</span>
                </td>
                <td>{new Date(o.createdAt).toLocaleTimeString()}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="te2-btn-modify"
                      onClick={() => setModifyItem({
                        id: o.orderId,
                        symbol: o.symbol,
                        direction: o.direction,
                        entryPrice: o.entryPrice,
                        volume: o.volume,
                        stopLoss: o.stopLoss,
                        takeProfit: o.takeProfit,
                        isPendingOrder: true,
                      })}
                    >
                      Modify
                    </button>
                    <button
                      type="button"
                      className="te2-btn-cancel"
                      onClick={() => tradingEngine.cancelOrder(o.orderId)}
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Modify Order Modal */}
      <ModifyPositionModal
        isOpen={modifyItem !== null}
        item={modifyItem}
        onClose={() => setModifyItem(null)}
        onSave={(updates) => {
          if (modifyItem) {
            tradingEngine.modifyOrder(modifyItem.id, {
              volume: updates.volume,
              entryPrice: updates.entryPrice,
              stopLoss: updates.stopLoss,
              takeProfit: updates.takeProfit,
            });
          }
        }}
      />
    </div>
  );
};
