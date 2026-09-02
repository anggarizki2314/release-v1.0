import React from 'react';
import { formatCurrency, formatSignedCurrency } from '@/utils/formatters';

interface OpenPositionCardProps {
  symbolName?: string;
  side?: 'buy' | 'sell' | 'long' | 'short';
  quantity?: number;
  stopPrice?: number;
  unrealizedPnl?: number;
  marketPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export const OpenPositionCard: React.FC<OpenPositionCardProps> = ({
  symbolName = 'EURUSD',
  side = 'long',
  quantity = 100,
  stopPrice = 1.0832,
  unrealizedPnl = 215.50,
  marketPrice = 1.0847,
  stopLoss = 1.0820,
  takeProfit = 1.0890,
}) => {
  const isBuy = side.toLowerCase() === 'buy' || side.toLowerCase() === 'long';
  const isPos = unrealizedPnl >= 0;

  return (
    <div className="open-position-card">
      <div className="open-position-card__header">
        <h4 className="open-position-card__title">Open Position</h4>
        <span className={`open-position-card__badge ${isBuy ? 'is-buy' : 'is-sell'}`}>
          {isBuy ? 'Long' : 'Short'}
        </span>
      </div>

      <div className="open-position-card__content">
        <div className="open-position-card__symbol-group">
          <div className="open-position-card__symbol-icon">
            <span>{symbolName.substring(0, 2)}</span>
          </div>
          <div className="open-position-card__symbol-info">
            <span className="open-position-card__symbol-name">{symbolName}</span>
            <span className="open-position-card__symbol-sub">Forex Pair</span>
          </div>
        </div>

        <div className="open-position-card__grid">
          <div className="open-position-card__item">
            <span className="open-position-card__label">Quantity</span>
            <span className="open-position-card__val">{quantity}</span>
          </div>

          <div className="open-position-card__item">
            <span className="open-position-card__label">Stop Price</span>
            <span className="open-position-card__val">{formatCurrency(stopPrice)}</span>
          </div>

          <div className="open-position-card__item">
            <span className="open-position-card__label">Unrealized P&L</span>
            <span className={`open-position-card__val ${isPos ? 'is-pos' : 'is-neg'}`}>
              {formatSignedCurrency(unrealizedPnl)}
              <span className="open-position-card__sub-val">(1,134)</span>
            </span>
          </div>

          <div className="open-position-card__item">
            <span className="open-position-card__label">Market Price</span>
            <span className="open-position-card__val">{formatCurrency(marketPrice)}</span>
          </div>

          <div className="open-position-card__item">
            <span className="open-position-card__label">Stop Loss</span>
            <span className="open-position-card__val">{formatCurrency(stopLoss)}</span>
          </div>

          <div className="open-position-card__item">
            <span className="open-position-card__label">Take Profit</span>
            <span className="open-position-card__val">{formatCurrency(takeProfit)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
