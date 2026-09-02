import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { Candle } from '@/types';

const EMPTY_MASTER_CANDLES: Candle[] = [];
import TopBar from './TopBar';
import LeftToolbar from './LeftToolbar';
import LayoutGrid from './LayoutGrid';
import BottomPanel from './BottomPanel';
import { useSymbols } from '@features/data';
import { useTimezone } from '@features/timezone';
import { ThemeProvider } from '@features/appearance';
import { WorkspaceProvider, useWorkspace } from '@features/workspace';
import AppearancePanel from '@features/appearance/AppearancePanel';
import { HomePage } from '@features/home';
import { CreateSessionWizard, type SessionConfig } from '@features/sessionWizard/CreateSessionWizard';
import { ChallengeConfiguration } from '@features/challenge/ChallengeConfiguration';
import { useSessionStore, saveReplayState } from '@features/backtest';
import { tradingEngine } from '@features/trading2/TradingEngineService';
import { ReplayProvider } from '@features/replay';
import { useCandles, clearSymbolTimeframeCache } from '@features/chart';
import ReplaySetupModal from '@components/replay/ReplaySetupModal';
import { IndicatorModal } from '@features/indicators';
import type { AnalyticsSession } from '@features/analytics/types';
import './AppShell.css';

type AppScreen = 'HOME' | 'SESSION_WIZARD' | 'CHALLENGE_CONFIG' | 'CHART';

export default function AppShell() {
  return (
    <ThemeProvider>
      <WorkspaceProvider>
        <AppShellInner />
      </WorkspaceProvider>
    </ThemeProvider>
  );
}

function AppShellInner() {
  const [screen, setScreen] = useState<AppScreen>('HOME');
  const [pendingConfig, setPendingConfig] = useState<SessionConfig | null>(null);

  const { workspace, updateChart, updateUI, switchSessionWorkspace } = useWorkspace();
  const { timezone, selectTimezone, loaded } = useTimezone();
  const { symbols, refresh: refreshSymbols } = useSymbols();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [isReplaySetupOpen, setIsReplaySetupOpen] = useState(false);
  const [isIndicatorModalOpen, setIsIndicatorModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenReplay = () => setIsReplaySetupOpen(true);
    const handleOpenIndicator = () => setIsIndicatorModalOpen(true);

    window.addEventListener('open-replay-setup-modal', handleOpenReplay);
    window.addEventListener('open-indicator-modal', handleOpenIndicator);

    return () => {
      window.removeEventListener('open-replay-setup-modal', handleOpenReplay);
      window.removeEventListener('open-indicator-modal', handleOpenIndicator);
    };
  }, []);

  // Auto-refresh symbols from SQLite whenever user enters CHART screen
  useEffect(() => {
    if (screen === 'CHART') {
      refreshSymbols();
    }
  }, [screen, refreshSymbols]);

  // Sync loaded timezone preference to workspace state
  useEffect(() => {
    if (loaded && timezone && workspace.chart.timezone !== timezone) {
      updateChart({ timezone });
    }
  }, [loaded, timezone, workspace.chart.timezone, updateChart]);

  const [activeTool, setActiveTool] = useState(workspace.ui.activeTool);
  const [magnetEnabled, setMagnetEnabled] = useState(false);
  const handleToggleMagnet = useCallback(() => setMagnetEnabled((v) => !v), []);
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(true);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(Math.min(220, Math.max(140, workspace.ui.bottomPanelHeight || 200)));

  useEffect(() => {
    updateUI({ activeTool, bottomPanelHeight, bottomPanelCollapsed });
  }, [activeTool, bottomPanelHeight, bottomPanelCollapsed, updateUI]);

  const [isPreparingChart, setIsPreparingChart] = useState(false);
  const [chartLoadingText, setChartLoadingText] = useState('Loading Market Data...');

  const [isAppInitializing, setIsAppInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const { initSessions, createNewSession, activeSession, setActiveSessionId, updateSessionReplayPointer } = useSessionStore();

  const runStartupInit = useCallback(async () => {
    setIsAppInitializing(true);
    setInitError(null);
    try {
      await Promise.allSettled([
        refreshSymbols(),
        initSessions(),
      ]);
    } catch (err: any) {
      console.error('[AppStartup] Initialization error:', err);
      setInitError(err?.message || 'Failed to initialize core metadata');
    } finally {
      setIsAppInitializing(false);
      // Wait for React to finish rendering and paint the dashboard DOM
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.forexReplay?.notifyAppReady?.();
        }, 400);
      });
    }
  }, [refreshSymbols, initSessions]);

  useEffect(() => {
    runStartupInit();
  }, [runStartupInit]);

  const handleNonBlockingLaunch = (text: string, action: () => Promise<unknown> | unknown) => {
    setChartLoadingText(text);
    setIsPreparingChart(true);
    setTimeout(async () => {
      try {
        await action();
        setBottomPanelCollapsed(true);
        setScreen('CHART');
      } catch (err) {
        console.error('[Session Launch Error]', err);
        alert('Error launching session: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setTimeout(() => setIsPreparingChart(false), 200);
      }
    }, 30);
  };

  // Sync activeSession's initialBalance, mode, & challenge rules with TradingEngineService
  useEffect(() => {
    if (activeSession && typeof activeSession.initialBalance === 'number') {
      const mode = activeSession.mode === 'challenge' ? 'CHALLENGE' : 'NORMAL';
      const challengeRules = activeSession.challengeStatus ? {
        maxDailyLossPercent: activeSession.initialBalance > 0 ? (activeSession.challengeStatus.dailyLossLimit / activeSession.initialBalance) * 100 : 5,
        maxTotalLossPercent: activeSession.initialBalance > 0 ? (activeSession.challengeStatus.maxLossLimit / activeSession.initialBalance) * 100 : 10,
        profitTargetPercent: activeSession.initialBalance > 0 ? (activeSession.challengeStatus.targetLimit / activeSession.initialBalance) * 100 : 8,
      } : undefined;

      tradingEngine.initializeSession({
        id: activeSession.id,
        initialBalance: activeSession.initialBalance,
        currency: 'USD',
        leverage: 100,
        mode,
        challengeRules,
      });
    }
  }, [activeSession?.id, activeSession?.initialBalance, activeSession?.mode]);

  // Free chart datasets and snapshots when leaving CHART screen to keep Dashboard 100% lightweight
  useEffect(() => {
    if (screen !== 'CHART') {
      clearSymbolTimeframeCache();
      tradingEngine.snapshotManager.clear();
      void window.forexReplay?.trimMemory?.();
    }
  }, [screen]);

  // Filter symbols strictly to those available in the active session
  const sessionSymbolNames = activeSession?.symbols || (pendingConfig?.symbols ?? null);
  const activeSessionSymbols = sessionSymbolNames && sessionSymbolNames.length > 0
    ? symbols.filter((s) => sessionSymbolNames.includes(s.name))
    : symbols;

  // Primary symbol resolution: prioritize activeSession.symbol, ensuring ID and Name NEVER mismatch!
  const primarySymbolObj = useMemo(() => {
    if (activeSession?.symbol) {
      const match = symbols.find((s) => s.name === activeSession.symbol);
      if (match) return match;
    }
    return activeSessionSymbols[0] ?? null;
  }, [activeSession?.symbol, symbols, activeSessionSymbols]);

  const primarySymbolId = primarySymbolObj?.id ?? null;
  const primarySymbolName = primarySymbolObj?.name ?? null;

  const activeSessionRef = useRef(activeSession);
  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  const saveReplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdatesRef = useRef<{ currentReplayIndex: number | null; currentReplayTime: number | null } | null>(null);

  const flushReplaySave = useCallback(() => {
    const sess = activeSessionRef.current;
    const pending = pendingUpdatesRef.current;
    if (sess && pending) {
      void saveReplayState(sess.id, pending.currentReplayIndex, pending.currentReplayTime);
      pendingUpdatesRef.current = null;
    }
  }, []);

  const handleUpdateSessionState = useCallback(
    (updates: { currentReplayIndex?: number | null; currentReplayTime?: number | null }) => {
      const sess = activeSessionRef.current;
      if (!sess) return;

      const idx = updates.currentReplayIndex ?? null;
      const time = updates.currentReplayTime ?? null;
      pendingUpdatesRef.current = { currentReplayIndex: idx, currentReplayTime: time };

      updateSessionReplayPointer(sess.id, idx, time);
      void saveReplayState(sess.id, idx, time);
    },
    [updateSessionReplayPointer]
  );

  useEffect(() => {
    const handleBeforeUnload = () => {
      flushReplaySave();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flushReplaySave();
    };
  }, [flushReplaySave]);

  // Primary M1 base dataset for session ReplayProvider (loaded strictly when entering CHART screen)
  const { m1Candles, candles: rawM1Fallback } = useCandles(screen === 'CHART' ? primarySymbolId : null, 'M1', activeSession);
  const masterReplayCandles = useMemo(() => {
    if (m1Candles.length > 0) return m1Candles;
    if (rawM1Fallback.length > 0) return rawM1Fallback;
    return EMPTY_MASTER_CANDLES;
  }, [m1Candles, rawM1Fallback]);

  const LoadingOverlay = () => (
    <div className="chart-loading-overlay">
      <div className="chart-loading-card">
        <div className="chart-loading-spinner" />
        <span className="chart-loading-text">{chartLoadingText}</span>
      </div>
    </div>
  );

  // GLOBAL STARTUP INITIALIZATION GATE
  if (isAppInitializing) {
    return (
      <div className="global-startup-screen">
        <div className="global-startup-card">
          <div className="global-startup-brand">
            <span className="global-startup-title">TradePro</span>
          </div>
          <div className="global-startup-status">
            <div className="global-startup-spinner" />
            <span className="global-startup-text">Initializing application...</span>
          </div>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="global-startup-screen">
        <div className="global-startup-card">
          <h2 style={{ color: '#f87171', margin: 0, fontSize: '1.1rem' }}>Initialization Failed</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.5rem 0 1rem 0' }}>{initError}</p>
          <button className="btn-primary-action" onClick={runStartupInit}>
            Retry Initialization
          </button>
        </div>
      </div>
    );
  }

  // SCREEN 1: HOME & SESSION_WIZARD MODAL POPUP
  if (screen === 'HOME' || screen === 'SESSION_WIZARD') {
    return (
      <>
        {isPreparingChart && <LoadingOverlay />}
        <HomePage
          onCreateSessionClick={() => setScreen('SESSION_WIZARD')}
          onResumeSessionClick={(sess) => {
            setIsReplaySetupOpen(false);
            handleNonBlockingLaunch('Resuming Replay Session...', async () => {
              if (sess) {
                await initSessions();
                setActiveSessionId(sess.id);
                switchSessionWorkspace(sess.id, false, null, 'M3');
                const mode = sess.mode === 'challenge' ? 'CHALLENGE' : 'NORMAL';
                const challengeRules = sess.challengeStatus ? {
                  maxDailyLossPercent: sess.initialBalance > 0 ? (sess.challengeStatus.dailyLossLimit / sess.initialBalance) * 100 : 5,
                  maxTotalLossPercent: sess.initialBalance > 0 ? (sess.challengeStatus.maxLossLimit / sess.initialBalance) * 100 : 10,
                  profitTargetPercent: sess.initialBalance > 0 ? (sess.challengeStatus.targetLimit / sess.initialBalance) * 100 : 8,
                } : undefined;

                await tradingEngine.initializeSession({
                  id: sess.id,
                  initialBalance: sess.initialBalance,
                  currency: 'USD',
                  leverage: 100,
                  mode,
                  challengeRules,
                });
              }
            });
          }}
        />
        {screen === 'SESSION_WIZARD' && (
          <CreateSessionWizard
            onCancel={() => setScreen('HOME')}
            onNextStep={(config) => {
              setPendingConfig(config);
              handleNonBlockingLaunch(
                config.mode === 'challenge' ? 'Preparing Challenge Session...' : 'Preparing Market Data...',
                async () => {
                  const newSess = await createNewSession(config);
                  const matchSym = symbols.find((s) => s.name === config.symbol);
                  switchSessionWorkspace(newSess.id, true, matchSym?.id ?? null, config.timeframe || 'M15');

                  const mode = newSess.mode === 'challenge' ? 'CHALLENGE' : 'NORMAL';
                  const challengeRules = newSess.challengeStatus ? {
                    maxDailyLossPercent: newSess.initialBalance > 0 ? (newSess.challengeStatus.dailyLossLimit / newSess.initialBalance) * 100 : 5,
                    maxTotalLossPercent: newSess.initialBalance > 0 ? (newSess.challengeStatus.maxLossLimit / newSess.initialBalance) * 100 : 10,
                    profitTargetPercent: newSess.initialBalance > 0 ? (newSess.challengeStatus.targetLimit / newSess.initialBalance) * 100 : 8,
                  } : undefined;

                  await tradingEngine.initializeSession({
                    id: newSess.id,
                    initialBalance: newSess.initialBalance,
                    currency: 'USD',
                    leverage: 100,
                    mode,
                    challengeRules,
                  });

                  setIsReplaySetupOpen(true);
                }
              );
            }}
          />
        )}
      </>
    );
  }

  // SCREEN 3: CHALLENGE CONFIG
  if (screen === 'CHALLENGE_CONFIG' && pendingConfig) {
    return (
      <>
        {isPreparingChart && <LoadingOverlay />}
        <ChallengeConfiguration
          sessionConfig={pendingConfig}
          onBack={() => setScreen('SESSION_WIZARD')}
          onStartSession={(challengeParams) => {
            handleNonBlockingLaunch('Preparing Challenge Session...', async () => {
              const fullConfig = {
                ...pendingConfig,
                challengeRules: challengeParams,
              };
              const newSess = await createNewSession(fullConfig);
              const matchSym = symbols.find((s) => s.name === pendingConfig.symbol);
              switchSessionWorkspace(newSess.id, true, matchSym?.id ?? null, pendingConfig.timeframe || 'M15');

              const challengeRules = newSess.challengeStatus ? {
                maxDailyLossPercent: newSess.initialBalance > 0 ? (newSess.challengeStatus.dailyLossLimit / newSess.initialBalance) * 100 : 5,
                maxTotalLossPercent: newSess.initialBalance > 0 ? (newSess.challengeStatus.maxLossLimit / newSess.initialBalance) * 100 : 10,
                profitTargetPercent: newSess.initialBalance > 0 ? (newSess.challengeStatus.targetLimit / newSess.initialBalance) * 100 : 8,
              } : undefined;

              await tradingEngine.initializeSession({
                id: newSess.id,
                initialBalance: newSess.initialBalance,
                currency: 'USD',
                leverage: 100,
                mode: 'CHALLENGE',
                challengeRules,
              });

              setIsReplaySetupOpen(true);
            });
          }}
        />
      </>
    );
  }

  // SCREEN 4: CHART WORKSPACE
  return (
    <ReplayProvider
      symbolId={primarySymbolId}
      symbol={primarySymbolName}
      timeframe="M1"
      allCandles={masterReplayCandles}
      activeSession={activeSession}
      onUpdateSessionState={handleUpdateSessionState}
      symbols={activeSessionSymbols}
    >
      <div className="app-shell">
        <TopBar
          timezone={workspace.chart.timezone || timezone}
          onTimezoneChange={(tz) => { selectTimezone(tz); updateChart({ timezone: tz }); }}
          onAppearanceClick={() => setAppearanceOpen(true)}
          onAnalyticsClick={() => setScreen('HOME')}
          activeSession={activeSession}
        />
        <div className="app-shell__body">
          <LeftToolbar
            activeTool={activeTool}
            magnetEnabled={magnetEnabled}
            onSelectTool={setActiveTool}
            onToggleMagnet={handleToggleMagnet}
            onOpenSessions={() => setScreen('HOME')}
            onSymbolsImported={refreshSymbols}
          />
          <div className="app-shell__workspace">
            <LayoutGrid
              symbols={activeSessionSymbols}
              timezone={workspace.chart.timezone || timezone}
              activeTool={activeTool}
              magnetEnabled={magnetEnabled}
              onActiveToolChange={setActiveTool}
              activeSession={activeSession}
              style={{
                height: bottomPanelCollapsed
                  ? 'calc(100% - var(--bottompanel-collapsed-h))'
                  : `calc(100% - ${bottomPanelHeight}px)`,
              }}
            />
            <BottomPanel
              collapsed={bottomPanelCollapsed}
              height={bottomPanelHeight}
              onToggleCollapsed={() => setBottomPanelCollapsed((v) => !v)}
              onResize={setBottomPanelHeight}
            />
          </div>
        </div>
        {appearanceOpen && <AppearancePanel onClose={() => setAppearanceOpen(false)} />}
      </div>

      <ReplaySetupModal
        isOpen={isReplaySetupOpen}
        onClose={() => setIsReplaySetupOpen(false)}
      />

      <IndicatorModal
        isOpen={isIndicatorModalOpen}
        onClose={() => setIsIndicatorModalOpen(false)}
      />
    </ReplayProvider>
  );
}
