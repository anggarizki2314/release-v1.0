import React, { useMemo } from 'react';
import type { AnalyticsSession } from '../../analytics/types';
import { formatCurrency, formatSignedCurrency } from '@/utils/formatters';
import { PnlSparkline } from './PnlSparkline';
import { getSessionMetrics } from '../utils/sessionMetrics';
import { Play } from 'lucide-react';

interface ActiveSessionCardProps {
  session: AnalyticsSession;
  onResume: (session: AnalyticsSession) => void;
}

export const ActiveSessionCard: React.FC<ActiveSessionCardProps> = ({ session, onResume }) => {
  const metrics = useMemo(() => {
    return getSessionMetrics(session);
  }, [session]);

  const isPos = metrics.isPos;

  return (
    <div className="active-session-card" onClick={() => onResume(session)}>
      <div className="active-session-card__header">
        <div className="active-session-card__title-group">
          <div className="active-session-card__title-row">
            <h3 className="active-session-card__title">{session.name}</h3>
          </div>
          <span className="active-session-card__sub">
            Started: {session.dateRange || 'May 24, 2024 08:30 AM'} • {session.symbol}
          </span>
        </div>

        <button className="active-session-card__resume-btn" onClick={(e) => { e.stopPropagation(); onResume(session); }}>
          <Play size={14} fill="currentColor" /> Resume
        </button>
      </div>

      <div className="active-session-card__body">
        <div className="active-session-card__metrics">
          <div className="active-session-card__metric">
            <span className="active-session-card__label">Net P&L</span>
            <span className={`active-session-card__val ${isPos ? 'is-pos' : 'is-neg'}`}>
              {formatSignedCurrency(metrics.netPnl)}
            </span>
          </div>

          <div className="active-session-card__metric">
            <span className="active-session-card__label">Win Rate</span>
            <span className="active-session-card__val">
              {metrics.winRate.toFixed(1)}%
            </span>
          </div>

          <div className="active-session-card__metric">
            <span className="active-session-card__label">Trades</span>
            <span className="active-session-card__val">{metrics.totalTrades}</span>
          </div>

          <div className="active-session-card__metric">
            <span className="active-session-card__label">Current Balance</span>
            <span className="active-session-card__val">{formatCurrency(metrics.curBal)}</span>
          </div>
        </div>

        <div className="active-session-card__chart">
          <PnlSparkline height={60} data={metrics.equityPoints} isPositive={isPos} gradientId={`active-sess-${session.id}`} />
        </div>
      </div>
    </div>
  );
};
