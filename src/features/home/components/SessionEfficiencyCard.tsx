import React, { useMemo } from 'react';
import type { AnalyticsSession } from '../../analytics/types';
import { formatCurrency, formatSignedCurrency } from '@/utils/formatters';
import { PnlSparkline } from './PnlSparkline';
import { getSessionMetrics } from '../utils/sessionMetrics';

interface SessionEfficiencyCardProps {
  sessions: AnalyticsSession[];
}

export const SessionEfficiencyCard: React.FC<SessionEfficiencyCardProps> = ({ sessions }) => {
  const lastOpenedId = typeof window !== 'undefined' ? localStorage.getItem('forex_replay_last_opened_session_id') : null;
  const activeSess = useMemo(() => {
    if (lastOpenedId) {
      const found = sessions.find((s) => s.id === lastOpenedId);
      if (found) return found;
    }
    return sessions[0] || null;
  }, [sessions, lastOpenedId]);

  const metrics = useMemo(() => {
    return getSessionMetrics(activeSess);
  }, [activeSess]);

  return (
    <div className="analytics-preview-grid">
      {/* P&L Performance Wave Chart Panel */}
      <div className="pnl-perf-card">
        <div className="pnl-perf-card__header">
          <h4 className="pnl-perf-card__title">
            P&L Performance {activeSess ? `(${activeSess.name})` : '(Recent Session)'}
          </h4>
          <span className={`pnl-perf-card__badge ${metrics.isPos ? 'is-pos' : 'is-neg'}`}>
            {formatSignedCurrency(metrics.netPnl)} ({metrics.isPos ? '+' : ''}{metrics.netPnlPct.toFixed(2)}%)
          </span>
        </div>
        <div className="pnl-perf-card__chart">
          <PnlSparkline height={85} data={metrics.equityPoints} isPositive={metrics.isPos} gradientId="main-pnl-wave" />
        </div>
      </div>

      {/* Session Efficiency Metrics Panel */}
      <div className="session-eff-card">
        <h4 className="session-eff-card__title">
          Session Efficiency {activeSess ? `• ${activeSess.symbol}` : ''}
        </h4>
        <div className="session-eff-card__grid">
          <div className="session-eff-card__item">
            <span className="session-eff-card__label">Total Profit/Loss</span>
            <span className={`session-eff-card__val ${metrics.isPos ? 'is-pos' : 'is-neg'}`}>
              {formatSignedCurrency(metrics.netPnl)}
            </span>
          </div>

          <div className="session-eff-card__item">
            <span className="session-eff-card__label">Win Rate</span>
            <span className="session-eff-card__val">{metrics.winRate.toFixed(1)}%</span>
          </div>

          <div className="session-eff-card__item">
            <span className="session-eff-card__label">Current Balance</span>
            <span className="session-eff-card__val">{formatCurrency(metrics.curBal)}</span>
          </div>

          <div className="session-eff-card__item">
            <span className="session-eff-card__label">Max Drawdown</span>
            <span className="session-eff-card__val" style={{ color: metrics.maxDrawdownPct > 0 ? '#f87171' : undefined }}>
              {metrics.maxDrawdownPct > 0 ? `-${metrics.maxDrawdownPct.toFixed(2)}%` : '0.00%'}
            </span>
          </div>

          <div className="session-eff-card__item">
            <span className="session-eff-card__label">Avg Risk-Reward</span>
            <span className="session-eff-card__val">
              {metrics.avgRR > 0 ? `1:${metrics.avgRR.toFixed(2)}` : '1:0.00'}
            </span>
          </div>

          <div className="session-eff-card__item">
            <span className="session-eff-card__label">Profit Factor</span>
            <span className="session-eff-card__val">{metrics.profitFactor.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
