import React, { useMemo } from 'react';
import { Target, Shield, Calendar, Flag, RotateCcw } from 'lucide-react';
import type { AnalyticsSession } from './types';
import type { SessionAnalyticsResult } from './useSessionAnalytics';
import { formatCurrency, formatSignedCurrency } from '@/utils/formatters';
import './TradingObjectiveCard.css';

interface TradingObjectiveCardProps {
  session: AnalyticsSession;
  analytics: SessionAnalyticsResult;
}

export const TradingObjectiveCard: React.FC<TradingObjectiveCardProps> = ({
  session,
  analytics,
}) => {
  const initialBalance = session.initialBalance || 10000;

  // Rules strictly inherited from session wizard configuration (Read-only prop firm parameters)
  const dailyLossPct = session.challengeRules?.dailyLossPercent
    ?? (session.challengeStatus?.dailyLossLimit && initialBalance > 0
      ? Number(((session.challengeStatus.dailyLossLimit / initialBalance) * 100).toFixed(1))
      : 5);

  const maxLossPct = session.challengeRules?.maxLossPercent
    ?? (session.challengeStatus?.maxLossLimit && initialBalance > 0
      ? Number(((session.challengeStatus.maxLossLimit / initialBalance) * 100).toFixed(1))
      : 10);

  const minTradingDays = session.challengeRules?.minimumTradingDays
    ?? session.challengeStatus?.minimumTradingDays
    ?? 3;

  const targetPct = session.challengeRules?.profitTargetPercent
    ?? (session.challengeStatus?.targetLimit && initialBalance > 0
      ? Number(((session.challengeStatus.targetLimit / initialBalance) * 100).toFixed(1))
      : 8);

  // Calculate unique trading days from closed trades
  const currentTradingDays = useMemo(() => {
    if (!analytics.trades || analytics.trades.length === 0) {
      return session.status === 'active' ? 1 : 0;
    }
    const daysSet = new Set<string>();
    analytics.trades.forEach((t) => {
      const timeMs = t.closedAt || t.openedAt;
      if (timeMs) {
        const d = new Date(timeMs).toISOString().split('T')[0];
        if (d) daysSet.add(d);
      }
    });
    return Math.max(1, daysSet.size);
  }, [analytics.trades, session.status]);

  // Calculations
  const maxDailyLimitDollar = (initialBalance * dailyLossPct) / 100;
  const dailyLossTillNowDollar = session.challengeStatus?.dailyLossCurrent ?? 0;
  const todayPermittedLossDollar = Math.max(0, maxDailyLimitDollar - dailyLossTillNowDollar);

  const maxLossLimitDollar = (initialBalance * maxLossPct) / 100;
  // Maximum loss till now = peak equity - lowest equity OR initial balance drawdown
  const maxLossTillNowDollar = session.challengeStatus?.maxLossCurrent ?? (analytics.netProfit < 0 ? Math.abs(analytics.netProfit) : 0);
  const maxPermittedLossDollar = Math.max(0, maxLossLimitDollar - maxLossTillNowDollar);

  const targetDollar = (initialBalance * targetPct) / 100;
  const currentResultProfitDollar = analytics.netProfit;

  // Status flags
  const isDailyLossFailed = dailyLossTillNowDollar >= maxDailyLimitDollar && maxDailyLimitDollar > 0;
  const isMaxLossFailed = maxLossTillNowDollar >= maxLossLimitDollar && maxLossLimitDollar > 0;
  const isTargetPassed = currentResultProfitDollar >= targetDollar && targetDollar > 0;
  const isDaysPassed = currentTradingDays >= minTradingDays;

  return (
    <div className="to-wrapper">
      {/* Header */}
      <div className="to-header">
        <div className="to-header__title-wrap">
          <div className="to-header__icon-bg">
            <Target size={18} className="to-header__icon" />
          </div>
          <h3 className="to-header__title">Trading Objective</h3>
        </div>

        <div className="to-header__sync">
          <span className="to-header__sync-dot" />
          <span className="to-header__sync-text">Sync Terhubung</span>
          <RotateCcw size={13} className="to-header__sync-icon" />
        </div>
      </div>

      {/* 2x2 Objective Cards Grid */}
      <div className="to-grid">
        {/* Card 1: Daily Loss Limit */}
        <div className={`to-card ${isDailyLossFailed ? 'to-card--failed' : ''}`}>
          <div className="to-card__header">
            <div className="to-card__title-wrap">
              <Shield size={16} className="to-card__icon to-card__icon--cyan" />
              <span className="to-card__title">Daily Loss Limit</span>
            </div>
            <span className={`to-badge ${isDailyLossFailed ? 'to-badge--failed' : 'to-badge--ongoing'}`}>
              {isDailyLossFailed ? 'Failed' : 'Ongoing'}
            </span>
          </div>

          <div className="to-card__config-row">
            <span className="to-card__config-label">Limit:</span>
            <span className="to-card__badge-val mono">{dailyLossPct}%</span>
            <span className="to-card__config-unit">dari modal</span>
          </div>

          <div className="to-card__body">
            <div className="to-card__row">
              <span className="to-card__label">Max Daily Limit:</span>
              <span className="to-card__val mono">{formatCurrency(maxDailyLimitDollar)}</span>
            </div>
            <div className="to-card__row">
              <span className="to-card__label">Daily Loss till now:</span>
              <span className={`to-card__val mono ${dailyLossTillNowDollar > 0 ? 'to-card__val--red' : ''}`}>
                {dailyLossTillNowDollar > 0 ? `-${formatCurrency(dailyLossTillNowDollar)}` : '$0.00'}
              </span>
            </div>
            <div className="to-card__row to-card__row--highlight">
              <span className="to-card__label">Today's Permitted Loss:</span>
              <span className="to-card__val mono to-card__val--cyan">{formatCurrency(todayPermittedLossDollar)}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Maximum Loss Limit */}
        <div className={`to-card ${isMaxLossFailed ? 'to-card--failed' : ''}`}>
          <div className="to-card__header">
            <div className="to-card__title-wrap">
              <Shield size={16} className="to-card__icon to-card__icon--cyan" />
              <span className="to-card__title">Maximum Loss Limit</span>
            </div>
            <span className={`to-badge ${isMaxLossFailed ? 'to-badge--failed' : 'to-badge--ongoing'}`}>
              {isMaxLossFailed ? 'Failed' : 'Ongoing'}
            </span>
          </div>

          <div className="to-card__config-row">
            <span className="to-card__config-label">Limit:</span>
            <span className="to-card__badge-val mono">{maxLossPct}%</span>
            <span className="to-card__config-unit">dari modal</span>
          </div>

          <div className="to-card__body">
            <div className="to-card__row">
              <span className="to-card__label">Max Loss Limit:</span>
              <span className="to-card__val mono">{formatCurrency(maxLossLimitDollar)}</span>
            </div>
            <div className="to-card__row">
              <span className="to-card__label">Max Loss till now:</span>
              <span className={`to-card__val mono ${maxLossTillNowDollar > 0 ? 'to-card__val--red' : ''}`}>
                {maxLossTillNowDollar > 0 ? `-${formatCurrency(maxLossTillNowDollar)}` : '$0.00'}
              </span>
            </div>
            <div className="to-card__row to-card__row--highlight">
              <span className="to-card__label">Max Permitted Loss:</span>
              <span className="to-card__val mono to-card__val--cyan">{formatCurrency(maxPermittedLossDollar)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Minimum Trading Days */}
        <div className="to-card">
          <div className="to-card__header">
            <div className="to-card__title-wrap">
              <Calendar size={16} className="to-card__icon to-card__icon--cyan" />
              <span className="to-card__title">Minimum Trading Days</span>
            </div>
            <span className={`to-badge ${isDaysPassed ? 'to-badge--passed' : 'to-badge--ongoing'}`}>
              {isDaysPassed ? 'Passed' : 'Ongoing'}
            </span>
          </div>

          <div className="to-card__config-row">
            <span className="to-card__config-label">Minimum:</span>
            <span className="to-card__badge-val mono">{minTradingDays}</span>
            <span className="to-card__config-unit">hari</span>
          </div>

          <div className="to-card__body to-card__body--spacious">
            <div className="to-card__row to-card__row--highlight">
              <span className="to-card__label">Current Result:</span>
              <span className="to-card__val mono">{currentTradingDays} Hari</span>
            </div>
          </div>
        </div>

        {/* Card 4: Profit Target */}
        <div className={`to-card ${isTargetPassed ? 'to-card--passed' : ''}`}>
          <div className="to-card__header">
            <div className="to-card__title-wrap">
              <Flag size={16} className="to-card__icon to-card__icon--cyan" />
              <span className="to-card__title">Profit Target</span>
            </div>
            <span className={`to-badge ${isTargetPassed ? 'to-badge--passed' : 'to-badge--ongoing'}`}>
              {isTargetPassed ? 'Passed' : 'Ongoing'}
            </span>
          </div>

          <div className="to-card__config-row">
            <span className="to-card__config-label">Target:</span>
            <span className="to-card__badge-val mono">{targetPct}%</span>
            <span className="to-card__config-unit">dari modal</span>
          </div>

          <div className="to-card__body">
            <div className="to-card__row">
              <span className="to-card__label">Minimum:</span>
              <span className="to-card__val mono">{formatCurrency(targetDollar)}</span>
            </div>
            <div className="to-card__row to-card__row--highlight">
              <span className="to-card__label">Current Result:</span>
              <span className={`to-card__val mono ${currentResultProfitDollar >= 0 ? 'to-card__val--green' : 'to-card__val--red'}`}>
                {formatSignedCurrency(currentResultProfitDollar)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
