import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Database,
  BarChart3,
  Settings,
  Plus,
  Play,
  Trash2,
  TrendingUp,
  Layers,
  Instagram,
} from 'lucide-react';
import { useTheme } from '../appearance/ThemeManager';
import { AnalyticsPage } from '../analytics';
import { DataHubView } from './DataHubView';
import { SettingsView } from './SettingsView';
import { useSessionStore } from '../backtest';
import type { AnalyticsSession } from '../analytics/types';
import { formatCurrency, formatSignedCurrency } from '@/utils/formatters';
import { ActiveSessionCard } from './components/ActiveSessionCard';
import { SessionEfficiencyCard } from './components/SessionEfficiencyCard';
import { getSessionMetrics } from './utils/sessionMetrics';
import './HomePage.css';

export type HomeTab = 'sessions' | 'data' | 'analytics' | 'settings';

interface HomePageProps {
  activeTab?: HomeTab;
  onTabChange?: (tab: HomeTab) => void;
  onCreateSessionClick: () => void;
  onResumeSessionClick: (session: AnalyticsSession) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  activeTab: externalTab,
  onTabChange,
  onCreateSessionClick,
  onResumeSessionClick,
}) => {
  const { theme } = useTheme();
  const [internalTab, setInternalTab] = useState<HomeTab>('sessions');
  const [showAllSessionsModal, setShowAllSessionsModal] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('forex_replay_show_all_sessions');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const toggleShowAllSessions = () => {
    setShowAllSessionsModal((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('forex_replay_show_all_sessions', JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save showAllSessions preference', err);
      }
      return next;
    });
  };

  // Persistent session store integrated with SQLite WAL database & localStorage
  const { sessions, initSessions, deleteSession: storeDeleteSession, deleteAllSessions: storeDeleteAllSessions, loading: sessionsLoading } = useSessionStore();

  useEffect(() => {
    initSessions();
  }, [initSessions]);

  const currentTab = externalTab ?? internalTab;

  const handleSelectTab = (tab: HomeTab) => {
    setInternalTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const handleResumeSession = (session: AnalyticsSession) => {
    try {
      localStorage.setItem('forex_replay_last_opened_session_id', session.id);
    } catch (err) {
      console.error('Failed to save last opened session id', err);
    }
    onResumeSessionClick(session);
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this backtest session?')) {
      await storeDeleteSession(id);
    }
  };

  const handleDeleteAllSessions = async () => {
    if (confirm('Apakah Anda yakin ingin menghapus SEMUA sesi backtest? Tindakan ini akan menghapus semua histori transaksi dan tidak dapat dibatalkan.')) {
      await storeDeleteAllSessions();
    }
  };

  const lastOpenedId = typeof window !== 'undefined' ? localStorage.getItem('forex_replay_last_opened_session_id') : null;
  const activeSession = (lastOpenedId ? sessions.find((s) => s.id === lastOpenedId) : null) || (sessions[0] as AnalyticsSession | undefined);

  return (
    <div className="home-root">
      {/* Left Sidebar Navigation */}
      <aside className="home-sidebar">
        <div>
          {/* Header Brand Logo: Icon + TradePro / ForexReplay */}
          <div className="home-sidebar__brand">
            <div className="home-sidebar__brand-icon">
              <TrendingUp size={20} />
            </div>
            <span className="home-sidebar__brand-text">TradePro</span>
          </div>

          {/* Navigation Links */}
          <nav className="home-nav">
            <button
              className={`home-nav__link ${currentTab === 'sessions' ? 'is-active' : ''}`}
              onClick={() => handleSelectTab('sessions')}
            >
              <FolderKanban size={18} />
              <span>Sessions</span>
            </button>

            <button
              className={`home-nav__link ${currentTab === 'data' ? 'is-active' : ''}`}
              onClick={() => handleSelectTab('data')}
            >
              <Database size={18} />
              <span>Data Hub</span>
            </button>

            <button
              className={`home-nav__link ${currentTab === 'analytics' ? 'is-active' : ''}`}
              onClick={() => handleSelectTab('analytics')}
            >
              <BarChart3 size={18} />
              <span>Analytics</span>
            </button>

            <button
              className={`home-nav__link ${currentTab === 'settings' ? 'is-active' : ''}`}
              onClick={() => handleSelectTab('settings')}
            >
              <Settings size={18} />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Footer info at Bottom Left (Obfuscated brand signature) */}
        <div className="home-footer-info">
          <span>{(() => [12,61,42,46,59,42,43,111,13,54,111,14,33,40,40,32,54,54].map(c => String.fromCharCode(c ^ 0x4f)).join(''))()}</span>
          <a 
            href={(() => [39,59,59,63,60,117,96,96,38,33,60,59,46,40,61,46,34,97,44,32,34,96,33,40,32,32,54,16].map(c => String.fromCharCode(c ^ 0x4f)).join(''))()} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ffffff', textDecoration: 'none', opacity: 0.9, transition: 'opacity 0.2s', fontSize: '1rem', fontWeight: 500 }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.9'}
          >
            <Instagram size={18} />
            {(() => [15,33,40,32,32,54,16].map(c => String.fromCharCode(c ^ 0x4f)).join(''))()}
          </a>
        </div>
      </aside>

      {/* Right Main Content Panel */}
      <main className="home-main">
        {/* TAB 1: SESSIONS / DASHBOARD OVERVIEW */}
        {currentTab === 'sessions' && (
          <div className="dashboard-grid-layout">
            {/* Top Section: Buttons Stack + Analytics Preview */}
            <div className="top-dashboard-section">
              {/* Action Buttons Stack */}
              <div className="action-buttons-stack">
                <button className="btn-primary-action" onClick={onCreateSessionClick}>
                  <Plus size={18} />
                  <span>Create New Session</span>
                </button>

                <button
                  className="btn-secondary-action"
                  onClick={() => {
                    if (activeSession) handleResumeSession(activeSession);
                    else onCreateSessionClick();
                  }}
                >
                  <Play size={16} fill="currentColor" />
                  <span>Resume Session</span>
                </button>

                <button className="btn-tertiary-action" onClick={toggleShowAllSessions}>
                  <Layers size={16} />
                  <span>{showAllSessionsModal ? 'Hide Sessions' : 'View All Sessions'}</span>
                </button>
              </div>

              {/* Analytics Preview Cards (7-Day Performance Sparkline + Session Efficiency) */}
              <SessionEfficiencyCard sessions={sessions} />
            </div>

            {/* Simple Data Cards Section */}
            <div className="data-cards-section">
              <span className="section-label">ACTIVE BACKTEST SESSION</span>

              {/* Active Session Card */}
              {sessionsLoading ? (
                <div className="session-loading-skeleton">
                  <div className="session-loading-spinner" />
                  <span>Loading active session...</span>
                </div>
              ) : activeSession ? (
                <ActiveSessionCard session={activeSession} onResume={handleResumeSession} />
              ) : (
                <div className="home-empty-state">
                  <FolderKanban size={36} />
                  <h3>No Active Session Found</h3>
                  <p>Create a backtest session to start testing your strategies.</p>
                </div>
              )}
            </div>

            {/* View All Sessions List (Toggled via button) */}
            {showAllSessionsModal && (
              <div className="home-sessions-section" style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="section-label" style={{ margin: 0 }}>ALL SESSIONS ({sessions.length})</span>
                  {sessions.length > 0 && (
                    <button
                      className="btn-delete-all"
                      onClick={handleDeleteAllSessions}
                      title="Delete All Sessions"
                    >
                      <Trash2 size={13} />
                      <span>Delete All Sessions</span>
                    </button>
                  )}
                </div>

                {sessionsLoading ? (
                  <div className="session-loading-skeleton">
                    <div className="session-loading-spinner" />
                    <span>Loading sessions list...</span>
                  </div>
                ) : sessions.length > 0 ? (
                  <div className="home-sessions-grid">
                    {sessions.map((sess) => {
                      const metrics = getSessionMetrics(sess);
                      const isPos = metrics.isPos;
                      return (
                        <div key={sess.id} className="session-card">
                          <div className="session-card__header">
                            <div className="session-card__title-wrap">
                              <span className="session-card__status-dot" />
                              <h3 className="session-card__title">{sess.name}</h3>
                            </div>
                            <div className="session-card__header-right">
                              <button
                                className="session-card__btn-delete"
                                onClick={(e) => handleDeleteSession(sess.id, e)}
                                title="Delete Session"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="session-card__data-list">
                            <div className="session-card__row">
                              <span className="session-card__label">Pair:</span>
                              <span className="session-card__val">{sess.symbol}</span>
                            </div>
                            <div className="session-card__row">
                              <span className="session-card__label">Current Balance:</span>
                              <span className="session-card__val">{formatCurrency(metrics.curBal)}</span>
                            </div>
                            <div className="session-card__row">
                              <span className="session-card__label">Current PnL:</span>
                              <span className={`session-card__val ${isPos ? 'is-pos' : 'is-neg'}`}>
                                {isPos ? '+' : ''}{metrics.netPnlPct.toFixed(2)}% ({formatSignedCurrency(metrics.netPnl)})
                              </span>
                            </div>
                            <div className="session-card__row">
                              <span className="session-card__label">Trades:</span>
                              <span className="session-card__val">{metrics.totalTrades}</span>
                            </div>
                            <div className="session-card__row">
                              <span className="session-card__label">Last Played:</span>
                              <span className="session-card__val">{sess.lastPlayed}</span>
                            </div>
                          </div>

                          <div className="session-card__footer">
                            <button className="session-card__btn-resume" onClick={() => handleResumeSession(sess)}>
                              <Play size={14} fill="currentColor" />
                              <span>Resume Session</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="home-empty-state" style={{ padding: '2rem' }}>
                    <p>No backtest sessions recorded yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DATA HUB */}
        {currentTab === 'data' && <DataHubView />}

        {/* TAB 3: ANALYTICS */}
        {currentTab === 'analytics' && <AnalyticsPage />}

        {/* TAB 4: SETTINGS */}
        {currentTab === 'settings' && <SettingsView />}
      </main>
    </div>
  );
};
