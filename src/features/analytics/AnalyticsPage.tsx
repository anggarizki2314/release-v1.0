import React, { useState, useMemo } from 'react';
import { Search, BarChart3, FolderKanban } from 'lucide-react';
import { AnalyticsSessionCard } from './AnalyticsSessionCard';
import { AnalyticsDetail } from './AnalyticsDetail';
import { useSessionStore } from '../backtest';
import { loadTradingStateSync } from '../backtest/sessionRepository';
import type { AnalyticsSession } from './types';
import './AnalyticsPage.css';

interface AnalyticsPageProps {
  onBackToHub?: () => void;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ onBackToHub }) => {
  // Read real sessions from SQLite DB / localStorage via useSessionStore
  const { sessions } = useSessionStore();
  const [selectedSession, setSelectedSession] = useState<AnalyticsSession | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.symbol.toLowerCase().includes(q) ||
        s.mode.toLowerCase().includes(q)
    );
  }, [searchQuery, sessions]);

  // Overall Statistics calculated dynamically from real session histories
  const stats = useMemo(() => {
    const totalSessions = sessions.length;
    let grandTotalTrades = 0;
    let grandWins = 0;
    let grandGrossProfit = 0;
    let grandGrossLoss = 0;

    sessions.forEach((s) => {
      let tCount = s.totalTrades ?? 0;
      let wRate = s.winRate ?? 0;

      const sync = loadTradingStateSync(s.id);
      if (sync?.schema?.history && Array.isArray(sync.schema.history) && sync.schema.history.length > 0) {
        const history = sync.schema.history;
        tCount = history.length;
        let wCount = 0;
        history.forEach((h: any) => {
          const p = Number(h.profit || 0) - Number(h.commission || 0) + Number(h.swap || 0);
          if (p > 0) {
            wCount++;
            grandGrossProfit += p;
          } else if (p < 0) {
            grandGrossLoss += Math.abs(p);
          }
        });
        wRate = tCount > 0 ? (wCount / tCount) * 100 : 0;
      }

      grandTotalTrades += tCount;
      grandWins += Math.round((wRate / 100) * tCount);
    });

    const avgWinRate = grandTotalTrades > 0
      ? ((grandWins / grandTotalTrades) * 100).toFixed(1)
      : '0.0';

    const avgProfitFactor = grandGrossLoss > 0
      ? (grandGrossProfit / grandGrossLoss).toFixed(2)
      : grandGrossProfit > 0
      ? grandGrossProfit.toFixed(2)
      : '0.00';

    return { totalSessions, totalTrades: grandTotalTrades, avgWinRate, avgProfitFactor };
  }, [sessions]);

  // If a session is selected for detailed inspection:
  if (selectedSession) {
    return (
      <AnalyticsDetail
        session={selectedSession}
        onBack={() => setSelectedSession(null)}
      />
    );
  }

  return (
    <div className="ana-page">
      {/* Top Header */}
      <header className="ana-page__header">
        <div className="ana-page__title-wrap">
          <BarChart3 size={24} className="ana-page__title-icon" />
          <div>
            <h1 className="ana-page__title">BACKTEST SESSION ANALYTICS</h1>
            <p className="ana-page__subtitle">
              Detailed performance metrics, winrates, risk profiles, & trade journals.
            </p>
          </div>
        </div>

        {onBackToHub && (
          <button className="ana-page__hub-btn" onClick={onBackToHub}>
            ← Back to Session Hub
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="ana-page__body">
        {/* Overall Overview Banner */}
        <div className="ana-overview-banner">
          <div className="ana-banner-stat">
            <span className="ana-banner-stat__label">Total Sessions Tracked</span>
            <span className="ana-banner-stat__val">{stats.totalSessions}</span>
          </div>

          <div className="ana-banner-stat">
            <span className="ana-banner-stat__label">Total Executed Trades</span>
            <span className="ana-banner-stat__val">{stats.totalTrades} Trades</span>
          </div>

          <div className="ana-banner-stat">
            <span className="ana-banner-stat__label">Average Win Rate</span>
            <span className="ana-banner-stat__val ana-banner-stat__val--green">{stats.avgWinRate}%</span>
          </div>

          <div className="ana-banner-stat">
            <span className="ana-banner-stat__label">Average Profit Factor</span>
            <span className="ana-banner-stat__val ana-banner-stat__val--blue">{stats.avgProfitFactor}</span>
          </div>
        </div>

        {/* Toolbar & Search */}
        <div className="ana-page__toolbar">
          <div className="ana-page__search-wrap">
            <Search size={15} className="ana-page__search-icon" />
            <input
              type="text"
              className="ana-page__search-input"
              placeholder="Search session by name or pair (e.g. XAUUSD, EURUSD)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Sessions Cards Grid / Empty State */}
        {filteredSessions.length === 0 ? (
          <div className="home-empty-state" style={{ margin: '3rem auto' }}>
            <FolderKanban size={48} style={{ opacity: 0.5 }} />
            <h3 style={{ margin: 0 }}>No Real Sessions Found</h3>
            <p style={{ fontSize: '0.875rem', opacity: 0.7, margin: 0 }}>
              You haven't created any backtest sessions yet. Go to the Sessions tab to create a new session!
            </p>
          </div>
        ) : (
          <div className="ana-page__grid">
            {filteredSessions.map((session) => (
              <AnalyticsSessionCard
                key={session.id}
                session={session}
                onViewAnalytics={(sess) => setSelectedSession(sess)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
