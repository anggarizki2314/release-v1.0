import { useState, useEffect, memo } from 'react';
import { Settings, Moon, Sun, BarChart2, LayoutTemplate, TrendingUp, RefreshCw, ChevronDown, Plus } from 'lucide-react';
import { TimezoneSelector } from '@features/timezone';
import { useWorkspace } from '@features/workspace';
import { useTheme, THEME_PRESETS, DEFAULT_THEME, type ThemeObject } from '@features/appearance';
import { OrderPopup } from '@features/trading2/ui/OrderPopup';
import type { OrderType } from '@features/trading2/order/OrderTypes';
import { tradingEngine } from '@features/trading2/TradingEngineService';
import { activeChartBridge } from '@features/trading2/integration/ActiveChartBridge';
import type { LayoutMode } from '@features/workspace/types';
import './TopBar.css';

interface DraftOrderInfo {
  paneId: string;
  symbol: string;
  timeframe: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  drawingId: string;
}

interface ActivePaneContext {
  paneId: string;
  symbol: string;
  timeframe: string;
  currentPrice: number;
}

interface TopBarProps {
  timezone: string;
  onTimezoneChange: (tz: string) => void;
  onAppearanceClick?: () => void;
  onAnalyticsClick?: () => void;
  onResetChart?: () => void;
  activeSession?: any;
}

const LAYOUT_OPTIONS: { mode: LayoutMode; label: string }[] = [
  { mode: '1', label: 'Single' },
  { mode: '2v', label: 'Vertical' },
  { mode: '2h', label: 'Horizontal' },
  { mode: '3l', label: 'Left' },
  { mode: '3r', label: 'Right' },
  { mode: '3t', label: 'Top' },
  { mode: '3b', label: 'Bottom' },
  { mode: '4', label: 'Grid' },
];

function LayoutIcon({ mode }: { mode: LayoutMode }) {
  const props = { width: 16, height: 14, viewBox: "0 0 16 14", fill: "none", className: "topbar__layout-icon" };
  switch (mode) {
    case '1':
      return (
        <svg {...props}>
          <rect x="1" y="1" width="14" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case '2v':
      return (
        <svg {...props}>
          <rect x="1" y="1" width="6" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="9" y="1" width="6" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case '2h':
      return (
        <svg {...props}>
          <rect x="1" y="1" width="14" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="1" y="8" width="14" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case '3l':
      return (
        <svg {...props}>
          <rect x="1" y="1" width="6" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="9" y="1" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="9" y="8" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case '3r':
      return (
        <svg {...props}>
          <rect x="1" y="1" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="1" y="8" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="9" y="1" width="6" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case '3t':
      return (
        <svg {...props}>
          <rect x="1" y="1" width="14" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="1" y="8" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="9" y="8" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case '3b':
      return (
        <svg {...props}>
          <rect x="1" y="1" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="9" y="1" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="1" y="8" width="14" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case '4':
      return (
        <svg {...props}>
          <rect x="1" y="1" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="9" y="1" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="1" y="8" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="9" y="8" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    default:
      return null;
  }
}

function isDarkTheme(theme: ThemeObject): boolean {
  const bg = theme?.app?.background || '#121418';
  if (bg.startsWith('#')) {
    const hex = bg.replace('#', '');
    const r = parseInt(hex.substring(0, 2) || '0', 16);
    const g = parseInt(hex.substring(2, 4) || '0', 16);
    const b = parseInt(hex.substring(4, 6) || '0', 16);
    return 0.299 * r + 0.587 * g + 0.114 * b < 128;
  }
  return true;
}

function TopBar({
  timezone,
  onTimezoneChange,
  onAppearanceClick,
  onAnalyticsClick,
  activeSession,
}: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const isDark = isDarkTheme(theme);

  const toggleThemeMode = () => {
    if (isDark) {
      const lightPreset = THEME_PRESETS.find((p) => p.id === 'tradingview-light') || THEME_PRESETS[1];
      setTheme(lightPreset.theme);
    } else {
      const darkPreset = THEME_PRESETS.find((p) => p.id === 'dark-mantap') || DEFAULT_THEME;
      setTheme(darkPreset.theme);
    }
  };

  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const [activeDraftOrder, setActiveDraftOrder] = useState<DraftOrderInfo | null>(null);
  const [, setBridgeTick] = useState(0);

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedOrderType, setSelectedOrderType] = useState<OrderType>('BUY_MARKET');

  const { workspace, setLayoutMode, toggleLinkSymbol, toggleLinkTimeframe, toggleSyncCrosshair } =
    useWorkspace();

  // Subscribe to ActiveChartBridge live updates
  useEffect(() => {
    return activeChartBridge.subscribe(() => {
      setBridgeTick((t) => t + 1);
    });
  }, []);

  // Listen for draft order selection change (BUY/SELL Drawing selected)
  useEffect(() => {
    const handleDraftOrder = (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      const detail = customEvent.detail;
      if (detail && detail.selected) {
        setActiveDraftOrder({
          paneId: detail.paneId,
          symbol: detail.symbol,
          timeframe: detail.timeframe,
          direction: detail.direction,
          entryPrice: detail.entryPrice,
          stopLoss: detail.stopLoss,
          takeProfit: detail.takeProfit,
          drawingId: detail.drawingId,
        });
      } else {
        setActiveDraftOrder(null);
      }
    };

    window.addEventListener('draft-order-selection-changed', handleDraftOrder);
    return () => window.removeEventListener('draft-order-selection-changed', handleDraftOrder);
  }, []);

  const handlePlaceOrderClick = () => {
    if (activeDraftOrder) {
      const orderType: OrderType = activeDraftOrder.direction === 'BUY' ? 'BUY_LIMIT' : 'SELL_LIMIT';
      setSelectedOrderType(orderType);
    } else {
      setSelectedOrderType('BUY_MARKET');
    }
    setIsPopupOpen(true);
  };

  // Single Source of Truth: Workspace -> Active Pane -> Active Chart State -> Trading Popup
  const isMarket = selectedOrderType.includes('MARKET');
  const targetSymbol = activeDraftOrder?.symbol || activeChartBridge.getChartState(workspace.activePaneId)?.symbol || activeChartBridge.getChartState()?.symbol || '';
  const liveChart = (targetSymbol ? activeChartBridge.getChartStateBySymbol(targetSymbol) : undefined) ??
    activeChartBridge.getChartState(workspace.activePaneId) ??
    activeChartBridge.getChartState();

  const popupSymbol = targetSymbol || liveChart?.symbol || '';
  const popupTimeframe = activeDraftOrder?.timeframe || liveChart?.timeframe || '';
  const popupPrice = isMarket
    ? (liveChart?.currentReplayPrice && liveChart.currentReplayPrice > 0 ? liveChart.currentReplayPrice : (activeDraftOrder?.entryPrice ?? 0))
    : (activeDraftOrder?.entryPrice ?? (liveChart?.currentReplayPrice ?? 0));
  const popupSL = activeDraftOrder?.stopLoss ?? undefined;
  const popupTP = activeDraftOrder?.takeProfit ?? undefined;

  return (
    <header className="topbar">
      {/* ── Left Section: Brand & Indikator ── */}
      <div className="topbar__section topbar__section--left">
        <div style={{ position: 'relative' }}>
          <div
            className="topbar__brand"
            onClick={() => setBrandMenuOpen(!brandMenuOpen)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
            title="Menu TradePro"
          >
            <div className="topbar__logo-mark">
              <TrendingUp size={14} strokeWidth={2.6} />
            </div>
            <span className="topbar__logo-text">TradePro</span>
            <ChevronDown size={12} style={{ opacity: 0.6, marginLeft: '2px' }} />
          </div>

          {brandMenuOpen && (
            <div
              className="topbar__menu"
              style={{ minWidth: '210px', left: 0, top: '100%', marginTop: '4px' }}
              onClick={() => setBrandMenuOpen(false)}
            >
              <button
                className="topbar__menu-item"
                onClick={onAnalyticsClick}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span>🏠</span>
                <span>Sessions & Beranda</span>
              </button>
              <button
                className="topbar__menu-item"
                onClick={onAppearanceClick}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span>⚙️</span>
                <span>Pengaturan Tampilan</span>
              </button>
              <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />
              <button
                className="topbar__menu-item"
                style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={async () => {
                  if (window.confirm('Apakah Anda yakin ingin menghapus lisensi aktif dari perangkat ini untuk mengganti lisensi baru?')) {
                    if (window.forexReplay?.deactivateLicense) {
                      await window.forexReplay.deactivateLicense();
                      window.location.reload();
                    }
                  }
                }}
              >
                <span>🔑</span>
                <span>Reset / Ganti Lisensi</span>
              </button>
            </div>
          )}
        </div>

        <div className="topbar__divider" />

        {/* Indicators Button */}
        <button
          className="topbar__indicator-btn"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('open-indicator-modal'));
          }}
          title="Indikator Teknikal"
          aria-label="Indikator"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="topbar__indicator-icon"
          >
            <path
              d="M2.5 8.5L6.5 4.5L10.5 7.5L17.5 2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="2.5" y="11.5" width="3" height="6.5" rx="0.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <rect x="8" y="9.5" width="3" height="8.5" rx="0.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <rect x="13.5" y="6.5" width="3" height="11.5" rx="0.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
          </svg>
          <span className="topbar__indicator-label">Indikator</span>
          <ChevronDown size={13} strokeWidth={2} className="topbar__indicator-chevron" />
        </button>
      </div>

      <div className="topbar__spacer" />

      {/* ── Right Section: Tools + Replay Bar + Timezone + Settings ── */}
      <div className="topbar__section topbar__section--right">
        {/* Place Order Primary Action */}
        <button
          className="topbar__place-order-btn is-active"
          onClick={handlePlaceOrderClick}
          title={
            activeDraftOrder
              ? `Place Order for ${activeDraftOrder.direction} ${activeDraftOrder.symbol}`
              : 'Open Order Placement (Market, Limit, Stop)'
          }
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="topbar__place-order-custom-icon"
          >
            {/* Green Circle (Buy / Long) */}
            <circle cx="7.5" cy="7.5" r="5.5" fill="#10b981" />
            <path
              d="M7.5 4.5V10.5M7.5 4.5L5.2 6.8M7.5 4.5L9.8 6.8"
              stroke="#ffffff"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Red Circle (Sell / Short) */}
            <circle cx="12.5" cy="12.5" r="5.5" fill="#ef4444" />
            <path
              d="M12.5 15.5V9.5M12.5 15.5L10.2 13.2M12.5 15.5L14.8 13.2"
              stroke="#ffffff"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="topbar__place-order-label">
            Place Order {activeDraftOrder ? `(${activeDraftOrder.direction})` : ''}
          </span>
        </button>

        <div className="topbar__divider" />

        {/* Layout Switcher */}
        <div
          className="topbar__selector-wrap"
          tabIndex={0}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setLayoutMenuOpen(false);
          }}
        >
          <button
            className="topbar__layout-btn"
            onClick={() => setLayoutMenuOpen((v) => !v)}
            title="Pilih Tata Letak Multi-Chart"
            aria-label="Pilih Tata Letak Multi-Chart"
          >
            <svg
              width="17"
              height="14"
              viewBox="0 0 18 15"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="topbar__custom-layout-icon"
            >
              {/* Outer Bounding Box */}
              <rect x="1" y="1" width="16" height="13" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
              {/* Vertical divider splitting left 1 and right 2 */}
              <line x1="6.5" y1="1" x2="6.5" y2="14" stroke="currentColor" strokeWidth="1.5" />
              {/* Horizontal divider on right side */}
              <line x1="6.5" y1="7.5" x2="17" y2="7.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="topbar__layout-label">Layout</span>
            <ChevronDown size={13} strokeWidth={2} className="topbar__layout-chevron" />
          </button>
          {layoutMenuOpen && (
            <div className="topbar__menu">
              {LAYOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.mode}
                  className={`topbar__menu-item ${workspace.layoutMode === opt.mode ? 'is-active' : ''}`}
                  onClick={() => {
                    setLayoutMode(opt.mode);
                    setLayoutMenuOpen(false);
                  }}
                >
                  <LayoutIcon mode={opt.mode} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Replay Bar Slot (Right beside Layout Switcher) */}
        <div id="topbar-replay-slot" className="topbar__replay-slot" />

        <div className="topbar__divider" />

        {/* Timezone Selector */}
        <TimezoneSelector
          referenceUtcSeconds={Math.floor(Date.now() / 1000)}
          value={timezone}
          onChange={onTimezoneChange}
        />

        <div className="topbar__divider" />

        {/* Performance / Sessions */}
        {onAnalyticsClick && (
          <button
            className="topbar__icon-only"
            aria-label="Performance"
            onClick={onAnalyticsClick}
            title="Sessions & Performance"
          >
            <BarChart2 size={16} />
          </button>
        )}

        {/* Workspace Sync Settings */}
        <div
          className="topbar__selector-wrap"
          tabIndex={0}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setSettingsMenuOpen(false);
          }}
        >
          <button
            className="topbar__icon-only"
            onClick={() => setSettingsMenuOpen((v) => !v)}
            title="Workspace Sync Options"
          >
            <Settings size={16} />
          </button>
          {settingsMenuOpen && (
            <div className="topbar__menu">
              <button
                className={`topbar__menu-item ${workspace.linkSymbol ? 'is-active' : ''}`}
                onClick={toggleLinkSymbol}
              >
                {workspace.linkSymbol ? '✓ Link Symbol' : 'Link Symbol'}
              </button>
              <button
                className={`topbar__menu-item ${workspace.linkTimeframe ? 'is-active' : ''}`}
                onClick={toggleLinkTimeframe}
              >
                {workspace.linkTimeframe ? '✓ Link Timeframe' : 'Link Timeframe'}
              </button>
              <button
                className={`topbar__menu-item ${workspace.syncCrosshair ? 'is-active' : ''}`}
                onClick={toggleSyncCrosshair}
              >
                {workspace.syncCrosshair ? '✓ Sync Crosshair' : 'Sync Crosshair'}
              </button>
            </div>
          )}
        </div>

        {/* Dark / Light Mode Toggle */}
        <button
          className="topbar__icon-only"
          aria-label={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
          title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
          onClick={toggleThemeMode}
        >
          {isDark ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* Appearance Settings */}
        <button className="topbar__icon-only" aria-label="Settings" onClick={onAppearanceClick} title="Chart & Appearance Settings">
          <Settings size={16} />
        </button>
      </div>

      {isPopupOpen && (
        <OrderPopup
          isOpen={isPopupOpen}
          orderType={selectedOrderType}
          symbol={popupSymbol}
          timeframe={popupTimeframe}
          currentPrice={popupPrice}
          initialStopLoss={popupSL}
          initialTakeProfit={popupTP}
          balance={tradingEngine.getAccountModel()?.balance ?? 100_000}
          initialDeposit={activeSession?.initialBalance ?? tradingEngine.getAccountModel()?.initialBalance ?? 100_000}
          freeMargin={tradingEngine.getAccountModel()?.freeMargin ?? 100_000}
          leverage={tradingEngine.getAccountModel()?.leverage ?? 100}
          onClose={() => setIsPopupOpen(false)}
          onPlaceOrder={(cmd) => {
            setIsPopupOpen(false);

            // Delete draft drawing if order came from PLACE ORDER
            if (activeDraftOrder?.drawingId) {
              window.dispatchEvent(
                new CustomEvent('delete-draft-drawing', {
                  detail: {
                    paneId: activeDraftOrder.paneId,
                    drawingId: activeDraftOrder.drawingId,
                  },
                })
              );
            }

            // FINAL VALIDATION FOR MARKET ORDERS
            const targetSymbol = cmd.symbol;
            const liveChart = activeChartBridge.getChartStateBySymbol(targetSymbol) ?? activeChartBridge.getChartState(workspace.activePaneId) ?? activeChartBridge.getChartState();
            if (cmd.type.includes('MARKET')) {
              if (liveChart && liveChart.symbol && liveChart.symbol.toUpperCase() === targetSymbol.toUpperCase() && liveChart.currentReplayPrice > 0) {
                cmd.entryPrice = liveChart.currentReplayPrice;
              }
            }

            const replayTime = liveChart?.currentReplayTime;
            const replayNow = replayTime ? (replayTime < 10000000000 ? replayTime * 1000 : replayTime) : Date.now();

            // Place order via TradingEngineService
            const result = tradingEngine.placeOrder(cmd, replayNow, liveChart?.currentReplayIndex);

            // Dispatch event to update chart Order Lines overlay
            window.dispatchEvent(
              new CustomEvent('real-order-created', {
                detail: { order: result.order },
              })
            );

            const orderTypeLabel = cmd.type.startsWith('BUY') ? 'BUY' : 'SELL';
            const statusLabel = result.isMarketOrder ? 'Market Position Opened' : 'Pending Order Created';

            window.dispatchEvent(
              new CustomEvent('show-toast', {
                detail: `✓ ${statusLabel}: ${orderTypeLabel} ${cmd.volume} lot ${cmd.symbol} @ ${cmd.entryPrice.toFixed(5)}`,
              })
            );

            setActiveDraftOrder(null);
          }}
        />
      )}
    </header>
  );
}

export default memo(TopBar);
