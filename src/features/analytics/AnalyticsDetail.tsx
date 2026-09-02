import React from 'react';
import { ArrowLeft, Shield, CheckCircle } from 'lucide-react';
import { PerformanceOverview } from './PerformanceOverview';
import { TradingObjectiveCard } from './TradingObjectiveCard';
import { EquityCurveChart } from './EquityCurveChart';
import { WinnersLosersCard } from './WinnersLosersCard';
import { DailyPerformanceMatrix } from './DailyPerformanceMatrix';
import { TradeDistributionChart } from './TradeDistributionChart';
import { TradeJournal } from './TradeJournal';
import { useSessionAnalytics } from './useSessionAnalytics';
import type { AnalyticsSession } from './types';
import './AnalyticsDetail.css';

interface AnalyticsDetailProps {
  session: AnalyticsSession;
  onBack: () => void;
}

export const AnalyticsDetail: React.FC<AnalyticsDetailProps> = ({ session, onBack }) => {
  const isChallenge = session.mode === 'challenge';
  
  // Real session-scoped analytics data & calculations
  const analytics = useSessionAnalytics(session);

  return (
    <div className="ana-detail">
      {/* Sticky Header */}
      <header className="ana-detail__header">
        <div className="ana-detail__left">
          <button className="ana-detail__back-btn" onClick={onBack} title="Back to Sessions List">
            <ArrowLeft size={16} />
            <span>Back to Sessions</span>
          </button>

          <div className="ana-detail__title-wrap">
            <h2 className="ana-detail__title">{session.name}</h2>
            <div className="ana-detail__badges">
              <span className="ana-detail__tag">{session.symbol}</span>
              <span className="ana-detail__tag">{session.dateRange}</span>
              {isChallenge ? (
                <span className="ana-detail__mode ana-detail__mode--challenge">
                  <Shield size={12} /> Challenge Mode
                </span>
              ) : (
                <span className="ana-detail__mode ana-detail__mode--normal">Normal Replay</span>
              )}
            </div>
          </div>
        </div>

        {isChallenge && (
          <div className="ana-detail__challenge-badge">
            <CheckCircle size={16} />
            <span>CHALLENGE STATUS: {session.status.toUpperCase()}</span>
          </div>
        )}
      </header>

      {/* Main Dashboard Body */}
      <main className="ana-detail__body">
        {/* Section 1: Top KPI Cards */}
        <section className="ana-detail__section">
          <PerformanceOverview analytics={analytics} />
        </section>

        {/* Section 2: PNL Performance Curve & Sub-Metrics Cards */}
        <section className="ana-detail__section">
          <EquityCurveChart equityCurve={analytics.equityCurve} analytics={analytics} />
        </section>

        {/* Section 3: Winners and Losers Side-by-Side Cards */}
        <section className="ana-detail__section">
          <WinnersLosersCard analytics={analytics} />
        </section>

        {/* Section 4: Challenge Trading Objective (Displayed for Challenge sessions right above Daily Performance) */}
        {isChallenge && (
          <section className="ana-detail__section">
            <TradingObjectiveCard session={session} analytics={analytics} />
          </section>
        )}

        {/* Section 5: Daily Performance Matrix & Monthly Returns */}
        <section className="ana-detail__section">
          <DailyPerformanceMatrix analytics={analytics} />
        </section>

        {/* Section 5: Win/Loss Donut, Session Radar, & Pair Breakdown */}
        <section className="ana-detail__section">
          <TradeDistributionChart analytics={analytics} />
        </section>

        {/* Section 6: Real Trade Journal Table */}
        <section className="ana-detail__section">
          <TradeJournal trades={analytics.trades} />
        </section>
      </main>
    </div>
  );
};
