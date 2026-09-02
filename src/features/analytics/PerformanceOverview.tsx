import React from 'react';
import type { SessionAnalyticsResult } from './useSessionAnalytics';
import { formatCurrency, formatSignedCurrency } from '@/utils/formatters';
import './PerformanceOverview.css';

interface PerformanceOverviewProps {
  analytics: SessionAnalyticsResult;
}

export const PerformanceOverview: React.FC<PerformanceOverviewProps> = ({ analytics }) => {
  const isPosPnl = analytics.netProfit >= 0;

  return (
    <div className="perf-overview">
      {/* Primary KPI Row (Matching Reference Screenshot 1) */}
      <div className="perf-overview__grid">
        {/* Card 1: Win Rate */}
        <div className="perf-kpi-card">
          <div className="perf-kpi-card__arc" />
          <div className="perf-kpi-card__top">
            <span className="perf-kpi-card__title">WIN RATE PERCENTAGE</span>
          </div>
          <div className="perf-kpi-card__main">
            <div className="perf-kpi-card__value">
              {analytics.winRate.toFixed(1)}%
            </div>
            <div className="perf-kpi-card__sub">
              {analytics.winningTrades} Win vs {analytics.losingTrades} Loss
            </div>
          </div>
        </div>

        {/* Card 2: Total Trades */}
        <div className="perf-kpi-card">
          <div className="perf-kpi-card__arc" />
          <div className="perf-kpi-card__top">
            <span className="perf-kpi-card__title">TOTAL EKSEKUSI TRADE</span>
          </div>
          <div className="perf-kpi-card__main">
            <div className="perf-kpi-card__value">
              {analytics.totalTrades}
            </div>
            <div className="perf-kpi-card__sub">
              Rentang data terpilih
            </div>
          </div>
        </div>

        {/* Card 3: Average Risk-Reward */}
        <div className="perf-kpi-card">
          <div className="perf-kpi-card__arc" />
          <div className="perf-kpi-card__top">
            <span className="perf-kpi-card__title">RATA-RATA RISK-REWARD</span>
          </div>
          <div className="perf-kpi-card__main">
            <div className="perf-kpi-card__value">
              {analytics.avgRR > 0 ? `1:${analytics.avgRR.toFixed(2)}` : '1:0.00'}
            </div>
            <div className="perf-kpi-card__sub">
              Jumlah RR didapat / Banyaknya RR
            </div>
          </div>
        </div>

        {/* Card 4: Expectancy Per Trade */}
        <div className="perf-kpi-card">
          <div className="perf-kpi-card__arc" />
          <div className="perf-kpi-card__top">
            <span className="perf-kpi-card__title">EXPECTANCY PER TRADE</span>
          </div>
          <div className="perf-kpi-card__main">
            <div className={`perf-kpi-card__value ${analytics.expectancy >= 0 ? 'perf-kpi-card__value--green' : 'perf-kpi-card__value--red'}`}>
              {analytics.expectancy >= 0 ? '+' : ''}${analytics.expectancy.toFixed(2)}
            </div>
            <div className="perf-kpi-card__sub">
              Rasio ekspektasi per trade
            </div>
          </div>
        </div>
      </div>

      {/* Secondary KPI Row */}
      <div className="perf-overview__grid">
        {/* Card 5: Net Profit */}
        <div className="perf-kpi-card">
          <div className="perf-kpi-card__arc" />
          <div className="perf-kpi-card__top">
            <span className="perf-kpi-card__title">NET REALIZED P&L</span>
          </div>
          <div className="perf-kpi-card__main">
            <div className={`perf-kpi-card__value ${isPosPnl ? 'perf-kpi-card__value--green' : 'perf-kpi-card__value--red'}`}>
              {formatSignedCurrency(analytics.netProfit)}
            </div>
            <div className="perf-kpi-card__sub">
              {isPosPnl ? '+' : ''}{analytics.netProfitPercent.toFixed(2)}% dari modal awal
            </div>
          </div>
        </div>

        {/* Card 6: Profit Factor */}
        <div className="perf-kpi-card">
          <div className="perf-kpi-card__arc" />
          <div className="perf-kpi-card__top">
            <span className="perf-kpi-card__title">PROFIT FACTOR</span>
          </div>
          <div className="perf-kpi-card__main">
            <div className="perf-kpi-card__value">
              {analytics.profitFactor.toFixed(2)}
            </div>
            <div className="perf-kpi-card__sub">
              Gross Win ${analytics.grossProfit.toFixed(0)} / Loss ${analytics.grossLoss.toFixed(0)}
            </div>
          </div>
        </div>

        {/* Card 7: Max Drawdown */}
        <div className="perf-kpi-card">
          <div className="perf-kpi-card__arc" />
          <div className="perf-kpi-card__top">
            <span className="perf-kpi-card__title">MAX DRAWDOWN</span>
          </div>
          <div className="perf-kpi-card__main">
            <div className="perf-kpi-card__value" style={{ color: '#f87171' }}>
              -{analytics.maxDrawdownPercent.toFixed(2)}%
            </div>
            <div className="perf-kpi-card__sub">
              Peak DD: -${analytics.maxDrawdown.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Card 8: Current Equity */}
        <div className="perf-kpi-card">
          <div className="perf-kpi-card__arc" />
          <div className="perf-kpi-card__top">
            <span className="perf-kpi-card__title">CURRENT BALANCE</span>
          </div>
          <div className="perf-kpi-card__main">
            <div className="perf-kpi-card__value">
              {formatCurrency(analytics.currentBalance)}
            </div>
            <div className="perf-kpi-card__sub">
              Modal Awal: {formatCurrency(analytics.initialBalance)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
