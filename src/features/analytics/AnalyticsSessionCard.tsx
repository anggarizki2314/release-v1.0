import React, { useMemo } from 'react';
import { BarChart2, Calendar, Clock, DollarSign, Shield, TrendingUp, TrendingDown } from 'lucide-react';
import type { AnalyticsSession } from './types';
import { formatCurrency } from '@/utils/formatters';
import { loadTradingStateSync } from '../backtest/sessionRepository';
import './AnalyticsSessionCard.css';

interface AnalyticsSessionCardProps {
  session: AnalyticsSession;
  onViewAnalytics: (session: AnalyticsSession) => void;
}

export const AnalyticsSessionCard: React.FC<AnalyticsSessionCardProps> = ({
  session,
  onViewAnalytics,
}) => {
  const cardMetrics = useMemo(() => {
    let curBal = session.currentBalance ?? session.initialBalance;
    let netPnl = session.netProfit ?? 0;
    let netPnlPct = session.netProfitPercent ?? 0;
    let winRate = session.winRate ?? 0;
    let totalTrades = session.totalTrades ?? 0;

    const sync = loadTradingStateSync(session.id);
    if (sync?.schema?.history && Array.isArray(sync.schema.history) && sync.schema.history.length > 0) {
      const history = sync.schema.history;
      totalTrades = history.length;
      let wins = 0;
      let pnlSum = 0;
      history.forEach((h: any) => {
        const p = Number(h.profit || 0) - Number(h.commission || 0) + Number(h.swap || 0);
        pnlSum += p;
        if (p > 0) wins++;
      });
      winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
      netPnl = pnlSum;
      curBal = session.initialBalance + pnlSum;
      netPnlPct = session.initialBalance > 0 ? (pnlSum / session.initialBalance) * 100 : 0;
    }

    return {
      curBal,
      netPnl,
      netPnlPct,
      winRate,
      totalTrades,
      isPos: netPnl >= 0,
    };
  }, [session]);

  const { curBal, netPnlPct, winRate, totalTrades, isPos } = cardMetrics;

  return (
    <div className="ana-card">
      {/* Header Badges */}
      <div className="ana-card__header">
        <div className="ana-card__badges">
          <span className="ana-card__symbol">{session.symbol}</span>
          {session.mode === 'challenge' ? (
            <span className="ana-card__mode ana-card__mode--challenge">
              <Shield size={11} /> Challenge
            </span>
          ) : (
            <span className="ana-card__mode ana-card__mode--normal">Normal</span>
          )}
        </div>

        <span className={`ana-card__status ana-card__status--${session.status}`}>
          {session.status}
        </span>
      </div>

      {/* Main Content */}
      <div className="ana-card__body">
        <h3 className="ana-card__title" title={session.name}>
          {session.name}
        </h3>

        <div className="ana-card__meta">
          <div className="ana-card__meta-item">
            <Calendar size={13} />
            <span>{session.dateRange}</span>
          </div>

          <div className="ana-card__meta-item">
            <Clock size={13} />
            <span>{session.lastPlayed}</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="ana-card__metrics">
          <div className="ana-card__metric-item">
            <span className="ana-card__metric-label">Balance</span>
            <span className="ana-card__metric-val">
              {formatCurrency(curBal)}
            </span>
          </div>

          <div className="ana-card__metric-item">
            <span className="ana-card__metric-label">Profit %</span>
            <span className={`ana-card__metric-val ${isPos ? 'ana-card__val--pos' : 'ana-card__val--neg'}`}>
              {isPos ? '+' : ''}{netPnlPct.toFixed(2)}%
            </span>
          </div>

          <div className="ana-card__metric-item">
            <span className="ana-card__metric-label">Win Rate</span>
            <span className="ana-card__metric-val">{winRate.toFixed(1)}%</span>
          </div>

          <div className="ana-card__metric-item">
            <span className="ana-card__metric-label">Trades</span>
            <span className="ana-card__metric-val">{totalTrades}</span>
          </div>
        </div>
      </div>

      {/* Footer CTA Button */}
      <div className="ana-card__footer">
        <button className="ana-card__view-btn" onClick={() => onViewAnalytics(session)}>
          <BarChart2 size={15} />
          <span>View Analytics</span>
        </button>
      </div>
    </div>
  );
};
