import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Info, HelpCircle, ChevronDown } from 'lucide-react';
import { useIndicatorStore } from './useIndicatorStore';
import type {
  IndicatorConfig,
  RsiIndicatorConfig,
  EmaIndicatorConfig,
  EmaLineItem,
  RsiSource,
  SessionsIndicatorConfig,
  KillzonesIndicatorConfig,
  MacrosIndicatorConfig,
  SessionOpensIndicatorConfig,
  QuartersIndicatorConfig,
} from './types';
import './IndicatorSettingsModal.css';

export interface IndicatorSettingsModalProps {
  isOpen: boolean;
  indicatorId: string | null;
  onClose: () => void;
}

export const IndicatorSettingsModal: React.FC<IndicatorSettingsModalProps> = ({
  isOpen,
  indicatorId,
  onClose,
}) => {
  const { indicators, updateIndicator } = useIndicatorStore();
  const indicator = indicators.find((ind) => ind.id === indicatorId);

  const [activeTab, setActiveTab] = useState<'input' | 'corak' | 'visibilitas'>('input');
  const [showDefaultMenu, setShowDefaultMenu] = useState(false);

  // RSI specific fields
  const [period, setPeriod] = useState<number>(14);
  const [source, setSource] = useState<RsiSource>('close');
  const [calcDivergence, setCalcDivergence] = useState<boolean>(false);
  const [maType, setMaType] = useState<'SMA' | 'EMA' | 'RMA' | 'WMA' | 'None'>('SMA');
  const [maLength, setMaLength] = useState<number>(14);
  const [bbStdDev, setBbStdDev] = useState<number>(2);
  const [timeframeMode, setTimeframeMode] = useState<string>('chart');
  const [waitForClose, setWaitForClose] = useState<boolean>(true);

  // RSI Style
  const [color, setColor] = useState<string>('#a855f7');
  const [lineWidth, setLineWidth] = useState<number>(2);
  const [showMa, setShowMa] = useState<boolean>(true);
  const [maColor, setMaColor] = useState<string>('#eab308');
  const [showUpperBand, setShowUpperBand] = useState<boolean>(true);
  const [overbought, setOverbought] = useState<number>(70);
  const [showMiddleBand, setShowMiddleBand] = useState<boolean>(true);
  const [middle, setMiddle] = useState<number>(50);
  const [showLowerBand, setShowLowerBand] = useState<boolean>(true);
  const [oversold, setOversold] = useState<number>(30);
  const [showBackgroundFill, setShowBackgroundFill] = useState<boolean>(true);
  const [bandColor, setBandColor] = useState<string>('#a855f7');

  // Daye Quarterly Theory specific fields (matching exact screenshot)
  const [plotType, setPlotType] = useState<'bottom_pane' | 'overlay'>('bottom_pane');
  const [plotSize, setPlotSize] = useState<number>(2);
  const [historicalCycles, setHistoricalCycles] = useState<boolean>(false);
  const [showLabels, setShowLabels] = useState<boolean>(false);
  const [borderAuto, setBorderAuto] = useState<boolean>(true);
  const [borderColor, setBorderColor] = useState<string>('#000000');
  const [q1Color, setQ1Color] = useState<string>('#1e293b');
  const [q2Color, setQ2Color] = useState<string>('#451a1a');
  const [q3Color, setQ3Color] = useState<string>('#14532d');
  const [q4Color, setQ4Color] = useState<string>('#1e3a8a');
  const [showYearly, setShowYearly] = useState<boolean>(false);
  const [showMonthly, setShowMonthly] = useState<boolean>(false);
  const [showWeekly, setShowWeekly] = useState<boolean>(true);
  const [showDaily, setShowDaily] = useState<boolean>(true);
  const [show90min, setShow90min] = useState<boolean>(true);
  const [showMicro, setShowMicro] = useState<boolean>(false);

  // Sessions fields
  const [sessions, setSessions] = useState<any[]>([]);

  // Session Opens fields
  const [opens, setOpens] = useState<any[]>([]);

  // EMA multi fields
  const [emas, setEmas] = useState<EmaLineItem[]>([]);

  // Timeframe visibility fields
  const [visSeconds, setVisSeconds] = useState<boolean>(true);
  const [visMinutes, setVisMinutes] = useState<boolean>(true);
  const [visHours, setVisHours] = useState<boolean>(true);
  const [visDays, setVisDays] = useState<boolean>(true);
  const [visWeeks, setVisWeeks] = useState<boolean>(true);
  const [visMonths, setVisMonths] = useState<boolean>(true);

  // Sync state when indicator opens
  useEffect(() => {
    if (!indicator) return;

    setColor(indicator.color);
    setVisSeconds(indicator.visibility?.seconds ?? true);
    setVisMinutes(indicator.visibility?.minutes ?? true);
    setVisHours(indicator.visibility?.hours ?? true);
    setVisDays(indicator.visibility?.days ?? true);
    setVisWeeks(indicator.visibility?.weeks ?? true);
    setVisMonths(indicator.visibility?.months ?? true);

    if (indicator.type === 'RSI') {
      const rsi = indicator as RsiIndicatorConfig;
      setPeriod(rsi.period ?? 14);
      setSource(rsi.source ?? 'close');
      setCalcDivergence(rsi.calcDivergence ?? false);
      setMaType(rsi.maType ?? 'SMA');
      setMaLength(rsi.maLength ?? 14);
      setBbStdDev(rsi.bbStdDev ?? 2);
      setTimeframeMode(rsi.timeframeMode ?? 'chart');
      setWaitForClose(rsi.waitForClose ?? true);

      setLineWidth(rsi.lineWidth ?? 2);
      setShowMa(rsi.showMa ?? true);
      setMaColor(rsi.maColor ?? '#eab308');
      setShowUpperBand(rsi.showUpperBand ?? true);
      setOverbought(rsi.overbought ?? 70);
      setShowMiddleBand(rsi.showMiddleBand ?? true);
      setMiddle(rsi.middle ?? 50);
      setShowLowerBand(rsi.showLowerBand ?? true);
      setOversold(rsi.oversold ?? 30);
      setShowBackgroundFill(rsi.showBackgroundFill ?? true);
      setBandColor(rsi.bandColor || '#a855f7');
    } else if (indicator.type === 'QUARTERS') {
      const q = indicator as QuartersIndicatorConfig;
      setPlotType(q.plotType ?? 'bottom_pane');
      setPlotSize(q.plotSize ?? 2);
      setHistoricalCycles(q.historicalCycles ?? false);
      setShowLabels(q.showLabels ?? false);
      setBorderAuto(q.borderAuto ?? true);
      setBorderColor(q.borderColor || '#000000');
      setQ1Color(q.q1Color || '#1e293b');
      setQ2Color(q.q2Color || '#451a1a');
      setQ3Color(q.q3Color || '#14532d');
      setQ4Color(q.q4Color || '#1e3a8a');
      setShowYearly(q.showYearlyQuarters ?? false);
      setShowMonthly(q.showMonthlyQuarters ?? false);
      setShowWeekly(q.showWeeklyQuarters ?? true);
      setShowDaily(q.showDailyQuarters ?? true);
      setShow90min(q.show90minCycles ?? true);
      setShowMicro(q.showMicroCycles ?? false);
    } else if (indicator.type === 'EMA') {
      const ema = indicator as EmaIndicatorConfig;
      setPeriod(ema.period ?? 20);
      setSource((ema.source as RsiSource) ?? 'close');
      setLineWidth(ema.lineWidth ?? 2);
      if (ema.emas && ema.emas.length > 0) {
        setEmas(JSON.parse(JSON.stringify(ema.emas)));
      } else {
        setEmas([
          { id: 'ema_1', name: 'EMA 1', enabled: true, period: ema.period ?? 20, source: (ema.source as any) || 'close', color: ema.color || '#3b82f6', lineWidth: ema.lineWidth || 2, lineStyle: 'solid' },
          { id: 'ema_2', name: 'EMA 2', enabled: false, period: 50, source: 'close', color: '#f59e0b', lineWidth: 2, lineStyle: 'solid' },
          { id: 'ema_3', name: 'EMA 3', enabled: false, period: 100, source: 'close', color: '#10b981', lineWidth: 2, lineStyle: 'solid' },
          { id: 'ema_4', name: 'EMA 4', enabled: false, period: 200, source: 'close', color: '#ef4444', lineWidth: 2, lineStyle: 'solid' },
          { id: 'ema_5', name: 'EMA 5', enabled: false, period: 9, source: 'close', color: '#8b5cf6', lineWidth: 1, lineStyle: 'solid' },
        ]);
      }
    } else if (indicator.type === 'SESSIONS' || indicator.type === 'KILLZONES' || indicator.type === 'MACROS') {
      const sess = indicator as SessionsIndicatorConfig | KillzonesIndicatorConfig | MacrosIndicatorConfig;
      setSessions(JSON.parse(JSON.stringify(sess.sessions || [])));
    } else if (indicator.type === 'SESSION_OPENS') {
      const so = indicator as SessionOpensIndicatorConfig;
      setOpens(JSON.parse(JSON.stringify(so.opens || [])));
    }
  }, [indicator]);

  // Keyboard shortcut (Escape to close, Enter to save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    indicator,
    color,
    period,
    source,
    overbought,
    middle,
    oversold,
    lineWidth,
    bandColor,
    maType,
    maLength,
    maColor,
    showMa,
    showUpperBand,
    showMiddleBand,
    showLowerBand,
    showBackgroundFill,
    calcDivergence,
    bbStdDev,
    timeframeMode,
    waitForClose,
    plotType,
    plotSize,
    historicalCycles,
    showLabels,
    borderAuto,
    borderColor,
    q1Color,
    q2Color,
    q3Color,
    q4Color,
    showYearly,
    showMonthly,
    showWeekly,
    showDaily,
    show90min,
    showMicro,
    sessions,
  ]);

  if (!isOpen || !indicator) return null;

  const handleSave = () => {
    const updates: Partial<IndicatorConfig> = {
      color,
      visibility: {
        seconds: visSeconds,
        minutes: visMinutes,
        hours: visHours,
        days: visDays,
        weeks: visWeeks,
        months: visMonths,
      },
    };

    if (indicator.type === 'RSI') {
      Object.assign(updates, {
        period,
        source,
        calcDivergence,
        maType,
        maLength,
        bbStdDev,
        timeframeMode,
        waitForClose,
        lineWidth,
        showMa,
        maColor,
        showUpperBand,
        overbought,
        showMiddleBand,
        middle,
        showLowerBand,
        oversold,
        showBackgroundFill,
        bandColor,
        name: `RSI ${period} ${source}`,
      });
    } else if (indicator.type === 'QUARTERS') {
      Object.assign(updates, {
        plotType,
        plotSize,
        historicalCycles,
        showLabels,
        borderAuto,
        borderColor,
        q1Color,
        q2Color,
        q3Color,
        q4Color,
        showYearlyQuarters: showYearly,
        showMonthlyQuarters: showMonthly,
        showWeeklyQuarters: showWeekly,
        showDailyQuarters: showDaily,
        show90minCycles: show90min,
        showMicroCycles: showMicro,
        name: 'Daye Quarterly Theory ®',
      });
    } else if (indicator.type === 'EMA') {
      const activePeriods = emas.filter((e) => e.enabled).map((e) => e.period);
      const name = activePeriods.length > 0 ? `EMA (${activePeriods.join(', ')})` : 'EMA';
      Object.assign(updates, {
        period: emas[0]?.period || period,
        source: emas[0]?.source || source,
        lineWidth: emas[0]?.lineWidth || lineWidth,
        color: emas[0]?.color || color,
        name,
        emas,
      });
    } else if (indicator.type === 'SESSIONS' || indicator.type === 'KILLZONES' || indicator.type === 'MACROS') {
      Object.assign(updates, {
        sessions,
      });
    } else if (indicator.type === 'SESSION_OPENS') {
      Object.assign(updates, {
        opens,
      });
    }

    updateIndicator(indicator.id, updates);
    onClose();
  };

  const handleApplyDefaults = () => {
    setVisSeconds(true);
    setVisMinutes(true);
    setVisHours(true);
    setVisDays(true);
    setVisWeeks(true);
    setVisMonths(true);

    if (indicator.type === 'RSI') {
      setPeriod(14);
      setSource('close');
      setCalcDivergence(false);
      setMaType('SMA');
      setMaLength(14);
      setBbStdDev(2);
      setTimeframeMode('chart');
      setWaitForClose(true);

      setColor('#a855f7');
      setLineWidth(2);
      setShowMa(true);
      setMaColor('#eab308');
      setShowUpperBand(true);
      setOverbought(70);
      setShowMiddleBand(true);
      setMiddle(50);
      setShowLowerBand(true);
      setOversold(30);
      setShowBackgroundFill(true);
      setBandColor('#a855f7');
    } else if (indicator.type === 'QUARTERS') {
      setPlotType('bottom_pane');
      setPlotSize(2);
      setHistoricalCycles(false);
      setShowLabels(false);
      setBorderAuto(true);
      setBorderColor('#000000');
      setQ1Color('#1e293b');
      setQ2Color('#451a1a');
      setQ3Color('#14532d');
      setQ4Color('#1e3a8a');
      setShowYearly(false);
      setShowMonthly(false);
      setShowWeekly(true);
      setShowDaily(true);
      setShow90min(true);
      setShowMicro(false);
    } else if (indicator.type === 'EMA') {
      setPeriod(20);
      setSource('close');
      setColor('#3b82f6');
      setLineWidth(2);
      setEmas([
        { id: 'ema_1', name: 'EMA 1', enabled: true, period: 20, source: 'close', color: '#3b82f6', lineWidth: 2, lineStyle: 'solid' },
        { id: 'ema_2', name: 'EMA 2', enabled: true, period: 50, source: 'close', color: '#f59e0b', lineWidth: 2, lineStyle: 'solid' },
        { id: 'ema_3', name: 'EMA 3', enabled: true, period: 100, source: 'close', color: '#10b981', lineWidth: 2, lineStyle: 'solid' },
        { id: 'ema_4', name: 'EMA 4', enabled: true, period: 200, source: 'close', color: '#ef4444', lineWidth: 2, lineStyle: 'solid' },
        { id: 'ema_5', name: 'EMA 5', enabled: false, period: 9, source: 'close', color: '#8b5cf6', lineWidth: 1, lineStyle: 'solid' },
      ]);
    }
    setShowDefaultMenu(false);
  };

  // Get modal title
  const getModalTitle = () => {
    if (indicator.type === 'RSI') return 'RSI';
    if (indicator.type === 'QUARTERS') return 'Daye Quarterly Theory °';
    return indicator.name;
  };

  return createPortal(
    <div className="tv-settings-backdrop" onClick={onClose}>
      <div className="tv-settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="tv-settings-header">
          <h2 className="tv-settings-title">{getModalTitle()}</h2>
          <button className="tv-settings-close-btn" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="tv-settings-nav">
          <button
            type="button"
            className={`tv-nav-tab ${activeTab === 'input' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('input')}
          >
            Input
          </button>
          <button
            type="button"
            className={`tv-nav-tab ${activeTab === 'corak' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('corak')}
          >
            Corak
          </button>
          <button
            type="button"
            className={`tv-nav-tab ${activeTab === 'visibilitas' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('visibilitas')}
          >
            Visibilitas
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="tv-settings-body">
          {activeTab === 'input' && (
            <div className="tv-tab-pane">
              {/* ── DAYE QUARTERLY THEORY INPUTS (Matching screenshot) ── */}
              {indicator.type === 'QUARTERS' && (
                <>
                  {/* PLOT SETTINGS */}
                  <div className="tv-section-label">PLOT SETTINGS</div>

                  <div className="tv-split-row">
                    <div className="tv-inline-group">
                      <span className="tv-row-label">Plot Type</span>
                      <select
                        value={plotType}
                        onChange={(e) => setPlotType(e.target.value as any)}
                        className="tv-select tv-select-compact"
                      >
                        <option value="bottom_pane">Bottom ...</option>
                        <option value="overlay">Overlay ...</option>
                      </select>
                    </div>

                    <div className="tv-inline-group">
                      <label className="tv-checkbox-container">
                        <input
                          type="checkbox"
                          checked={historicalCycles}
                          onChange={(e) => setHistoricalCycles(e.target.checked)}
                        />
                        <span className="tv-checkbox-custom" />
                        <span className="tv-checkbox-text">Historical Cycles?</span>
                      </label>
                      <span className="tv-info-icon" title="Tampilkan riwayat siklus sebelumnya pada chart">
                        <Info size={14} />
                      </span>
                    </div>
                  </div>

                  <div className="tv-split-row">
                    <div className="tv-inline-group">
                      <span className="tv-row-label">Plot Size</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={plotSize}
                        onChange={(e) => setPlotSize(Math.max(1, Number(e.target.value)))}
                        className="tv-input-num tv-input-compact"
                      />
                    </div>

                    <div className="tv-inline-group">
                      <label className="tv-checkbox-container">
                        <input
                          type="checkbox"
                          checked={showLabels}
                          onChange={(e) => setShowLabels(e.target.checked)}
                        />
                        <span className="tv-checkbox-custom" />
                        <span className="tv-checkbox-text">Show Labels?</span>
                      </label>
                    </div>
                  </div>

                  {/* QUARTERS COLORS */}
                  <div className="tv-section-label" style={{ marginTop: '16px' }}>
                    QUARTERS COLORS
                  </div>

                  <div className="tv-quarters-border-row">
                    <span className="tv-row-label">Border</span>
                    <input
                      type="color"
                      value={borderColor}
                      onChange={(e) => setBorderColor(e.target.value)}
                      className="tv-color-box-solid"
                    />
                    <label className="tv-checkbox-container">
                      <input
                        type="checkbox"
                        checked={borderAuto}
                        onChange={(e) => setBorderAuto(e.target.checked)}
                      />
                      <span className="tv-checkbox-custom" />
                      <span className="tv-checkbox-text">Automatic?</span>
                    </label>
                  </div>

                  {/* 4 Quarter Color Swatches */}
                  <div className="tv-quarters-palette-grid">
                    <div className="tv-quarter-color-slot">
                      <input
                        type="color"
                        value={q1Color}
                        onChange={(e) => setQ1Color(e.target.value)}
                        className="tv-quarter-checker-box"
                        style={{ backgroundColor: q1Color }}
                        title="Q1 (Accumulation)"
                      />
                    </div>
                    <div className="tv-quarter-color-slot">
                      <input
                        type="color"
                        value={q2Color}
                        onChange={(e) => setQ2Color(e.target.value)}
                        className="tv-quarter-checker-box"
                        style={{ backgroundColor: q2Color }}
                        title="Q2 (Manipulation)"
                      />
                    </div>
                    <div className="tv-quarter-color-slot">
                      <input
                        type="color"
                        value={q3Color}
                        onChange={(e) => setQ3Color(e.target.value)}
                        className="tv-quarter-checker-box"
                        style={{ backgroundColor: q3Color }}
                        title="Q3 (Distribution)"
                      />
                    </div>
                    <div className="tv-quarter-color-slot">
                      <input
                        type="color"
                        value={q4Color}
                        onChange={(e) => setQ4Color(e.target.value)}
                        className="tv-quarter-checker-box"
                        style={{ backgroundColor: q4Color }}
                        title="Q4 (Reversal)"
                      />
                    </div>
                  </div>

                  {/* TIME CYCLES */}
                  <div className="tv-section-label" style={{ marginTop: '16px' }}>
                    TIME CYCLES
                  </div>

                  <div className="tv-checkbox-row">
                    <label className="tv-checkbox-container">
                      <input
                        type="checkbox"
                        checked={showYearly}
                        onChange={(e) => setShowYearly(e.target.checked)}
                      />
                      <span className="tv-checkbox-custom" />
                      <span className="tv-checkbox-text">Yearly Quarters</span>
                    </label>
                  </div>

                  <div className="tv-checkbox-row">
                    <label className="tv-checkbox-container">
                      <input
                        type="checkbox"
                        checked={showMonthly}
                        onChange={(e) => setShowMonthly(e.target.checked)}
                      />
                      <span className="tv-checkbox-custom" />
                      <span className="tv-checkbox-text">Monthly Quarters</span>
                    </label>
                  </div>

                  <div className="tv-checkbox-row">
                    <label className="tv-checkbox-container">
                      <input
                        type="checkbox"
                        checked={showWeekly}
                        onChange={(e) => setShowWeekly(e.target.checked)}
                      />
                      <span className="tv-checkbox-custom" />
                      <span className="tv-checkbox-text">Weekly Quarters</span>
                    </label>
                  </div>

                  <div className="tv-checkbox-row">
                    <label className="tv-checkbox-container">
                      <input
                        type="checkbox"
                        checked={showDaily}
                        onChange={(e) => setShowDaily(e.target.checked)}
                      />
                      <span className="tv-checkbox-custom" />
                      <span className="tv-checkbox-text">Daily Quarters</span>
                    </label>
                  </div>

                  <div className="tv-checkbox-row">
                    <label className="tv-checkbox-container">
                      <input
                        type="checkbox"
                        checked={show90min}
                        onChange={(e) => setShow90min(e.target.checked)}
                      />
                      <span className="tv-checkbox-custom" />
                      <span className="tv-checkbox-text">90min Cycles</span>
                    </label>
                  </div>

                  <div className="tv-checkbox-row">
                    <label className="tv-checkbox-container">
                      <input
                        type="checkbox"
                        checked={showMicro}
                        onChange={(e) => setShowMicro(e.target.checked)}
                      />
                      <span className="tv-checkbox-custom" />
                      <span className="tv-checkbox-text">Micro Cycles</span>
                    </label>
                  </div>
                </>
              )}

              {/* ── RSI INPUTS ── */}
              {indicator.type === 'RSI' && (
                <>
                  <div className="tv-section-label">PENGATURAN RSI</div>

                  <div className="tv-form-row">
                    <label className="tv-row-label">Panjang RSI</label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={period}
                      onChange={(e) => setPeriod(Math.max(1, Number(e.target.value)))}
                      className="tv-input-num"
                    />
                  </div>

                  <div className="tv-form-row">
                    <label className="tv-row-label">Sumber</label>
                    <select
                      value={source}
                      onChange={(e) => setSource(e.target.value as RsiSource)}
                      className="tv-select"
                    >
                      <option value="close">Penutupan (Close)</option>
                      <option value="open">Pembukaan (Open)</option>
                      <option value="high">Tertinggi (High)</option>
                      <option value="low">Terendah (Low)</option>
                      <option value="hl2">hl2 (T+R/2)</option>
                      <option value="hlc3">hlc3 (T+R+P/3)</option>
                      <option value="ohlc4">ohlc4 (B+T+R+P/4)</option>
                    </select>
                  </div>

                  <div className="tv-checkbox-row">
                    <label className="tv-checkbox-container">
                      <input
                        type="checkbox"
                        checked={calcDivergence}
                        onChange={(e) => setCalcDivergence(e.target.checked)}
                      />
                      <span className="tv-checkbox-custom" />
                      <span className="tv-checkbox-text">Hitung Divergence</span>
                    </label>
                    <span className="tv-info-icon" title="Deteksi perbedaan arah antara pergerakan harga dan RSI">
                      <Info size={14} />
                    </span>
                  </div>

                  {/* PENGHALUSAN */}
                  <div className="tv-section-label" style={{ marginTop: '16px' }}>
                    PENGHALUSAN
                  </div>

                  <div className="tv-form-row">
                    <label className="tv-row-label">Tipe</label>
                    <select
                      value={maType}
                      onChange={(e) => setMaType(e.target.value as any)}
                      className="tv-select"
                    >
                      <option value="SMA">SMA</option>
                      <option value="EMA">EMA</option>
                      <option value="RMA">SMMA (RMA)</option>
                      <option value="WMA">WMA</option>
                      <option value="None">Tidak ada</option>
                    </select>
                  </div>

                  <div className="tv-form-row">
                    <label className="tv-row-label">Panjang</label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={maLength}
                      onChange={(e) => setMaLength(Math.max(1, Number(e.target.value)))}
                      className="tv-input-num"
                    />
                  </div>

                  <div className="tv-form-row">
                    <label className="tv-row-label">StdDev BB</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="number"
                        min={0.1}
                        max={10}
                        step={0.1}
                        value={bbStdDev}
                        onChange={(e) => setBbStdDev(Number(e.target.value))}
                        className="tv-input-num is-disabled"
                        disabled
                      />
                      <span className="tv-info-icon" title="Deviasi standar Bollinger Bands saat tipe MA aktif">
                        <Info size={14} />
                      </span>
                    </div>
                  </div>

                  {/* PERHITUNGAN */}
                  <div className="tv-section-label" style={{ marginTop: '16px' }}>
                    PERHITUNGAN
                  </div>

                  <div className="tv-form-row">
                    <label className="tv-row-label">Kerangka waktu</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <select
                        value={timeframeMode}
                        onChange={(e) => setTimeframeMode(e.target.value)}
                        className="tv-select"
                      >
                        <option value="chart">Chart</option>
                        <option value="1m">1 menit</option>
                        <option value="5m">5 menit</option>
                        <option value="15m">15 menit</option>
                        <option value="1h">1 jam</option>
                        <option value="4h">4 jam</option>
                        <option value="1D">1 hari</option>
                      </select>
                      <span className="tv-info-icon" title="Resolusi data yang digunakan untuk menghitung osilator">
                        <HelpCircle size={14} />
                      </span>
                    </div>
                  </div>

                  <div className="tv-checkbox-row">
                    <label className="tv-checkbox-container">
                      <input
                        type="checkbox"
                        checked={waitForClose}
                        onChange={(e) => setWaitForClose(e.target.checked)}
                      />
                      <span className="tv-checkbox-custom" />
                      <span className="tv-checkbox-text">Tunggu kerangka waktu ditutup</span>
                    </label>
                  </div>
                </>
              )}

              {/* ── EMA INPUTS (1 - 5) ── */}
              {indicator.type === 'EMA' && (
                <>
                  <div className="tv-section-label">PENGATURAN EMA (1 - 5)</div>
                  {emas.map((emaItem, idx) => (
                    <div
                      key={emaItem.id}
                      className="tv-checkbox-row"
                      style={{
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '10px',
                      }}
                    >
                      <label className="tv-checkbox-container" style={{ minWidth: '85px' }}>
                        <input
                          type="checkbox"
                          checked={emaItem.enabled}
                          onChange={(e) => {
                            const copy = [...emas];
                            copy[idx].enabled = e.target.checked;
                            setEmas(copy);
                          }}
                        />
                        <span className="tv-checkbox-custom" />
                        <span className="tv-checkbox-text" style={{ fontWeight: 600 }}>{`EMA ${idx + 1}`}</span>
                      </label>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Periode:</span>
                          <input
                            type="number"
                            min={1}
                            max={1000}
                            value={emaItem.period}
                            onChange={(e) => {
                              const copy = [...emas];
                              copy[idx].period = Math.max(1, Number(e.target.value));
                              setEmas(copy);
                            }}
                            className="tv-input-num"
                            style={{ width: '56px', height: '26px' }}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Sumber:</span>
                          <select
                            value={emaItem.source}
                            onChange={(e) => {
                              const copy = [...emas];
                              copy[idx].source = e.target.value as 'close' | 'open' | 'high' | 'low';
                              setEmas(copy);
                            }}
                            className="tv-select"
                            style={{ width: '90px', fontSize: '11px', height: '26px' }}
                          >
                            <option value="close">Close</option>
                            <option value="open">Open</option>
                            <option value="high">High</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* ── SESSIONS, KILLZONES & MACROS INPUTS ── */}
              {(indicator.type === 'SESSIONS' || indicator.type === 'KILLZONES' || indicator.type === 'MACROS') && (
                <>
                  <div className="tv-section-label">
                    {indicator.type === 'MACROS'
                      ? 'ICT MACROS AKTIF'
                      : indicator.type === 'KILLZONES'
                      ? 'ICT KILLZONES AKTIF'
                      : 'SESI PASAR AKTIF'}
                  </div>
                  {sessions.map((sess, idx) => (
                    <div key={sess.id} className="tv-checkbox-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="tv-checkbox-container">
                        <input
                          type="checkbox"
                          checked={sess.enabled}
                          onChange={(e) => {
                            const copy = [...sessions];
                            copy[idx].enabled = e.target.checked;
                            setSessions(copy);
                          }}
                        />
                        <span className="tv-checkbox-custom" />
                        <span className="tv-checkbox-text">{sess.name}</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="text"
                          value={sess.startUtc}
                          onChange={(e) => {
                            const copy = [...sessions];
                            copy[idx].startUtc = e.target.value;
                            setSessions(copy);
                          }}
                          style={{
                            width: '46px',
                            height: '22px',
                            background: '#0f1117',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            color: '#ffffff',
                            textAlign: 'center',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                          }}
                          placeholder="00:00"
                        />
                        <span style={{ color: '#64748b', fontSize: '10px' }}>-</span>
                        <input
                          type="text"
                          value={sess.endUtc}
                          onChange={(e) => {
                            const copy = [...sessions];
                            copy[idx].endUtc = e.target.value;
                            setSessions(copy);
                          }}
                          style={{
                            width: '46px',
                            height: '22px',
                            background: '#0f1117',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            color: '#ffffff',
                            textAlign: 'center',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                          }}
                          placeholder="09:00"
                        />
                        <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>UTC</span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* ── SESSION OPENS INPUTS ── */}
              {indicator.type === 'SESSION_OPENS' && (
                <>
                  <div className="tv-section-label">LEVEL HARGA PEMBUKAAN (OPENS)</div>
                  {opens.map((op, idx) => (
                    <div
                      key={op.id}
                      className="tv-checkbox-row"
                      style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}
                    >
                      <label className="tv-checkbox-container">
                        <input
                          type="checkbox"
                          checked={op.enabled}
                          onChange={(e) => {
                            const copy = [...opens];
                            copy[idx].enabled = e.target.checked;
                            setOpens(copy);
                          }}
                        />
                        <span className="tv-checkbox-custom" />
                        <span className="tv-checkbox-text">{op.name}</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="text"
                          value={op.timeUtc}
                          onChange={(e) => {
                            const copy = [...opens];
                            copy[idx].timeUtc = e.target.value;
                            setOpens(copy);
                          }}
                          style={{
                            width: '52px',
                            height: '22px',
                            background: '#0f1117',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            color: '#ffffff',
                            textAlign: 'center',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                          }}
                          placeholder="00:00"
                        />
                        <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>UTC</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {activeTab === 'corak' && (
            <div className="tv-tab-pane">
              {indicator.type === 'QUARTERS' && (
                <>
                  <div className="tv-section-label">TAMPILAN QUARTERS</div>
                  <div className="tv-style-row">
                    <span className="tv-style-label">Gaya Border: Solid 1px</span>
                  </div>
                  <div className="tv-style-row">
                    <span className="tv-style-label">Label Font: 9.5px Bold</span>
                  </div>
                </>
              )}

              {indicator.type === 'RSI' && (
                <>
                  <div className="tv-section-label">PLOT</div>

                  <div className="tv-style-row">
                    <label className="tv-checkbox-container">
                      <input type="checkbox" checked={true} readOnly />
                      <span className="tv-checkbox-custom" />
                    </label>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="tv-color-box"
                    />
                    <select
                      value={lineWidth}
                      onChange={(e) => setLineWidth(Number(e.target.value))}
                      className="tv-line-width-select"
                    >
                      <option value={1}>1px</option>
                      <option value={2}>2px</option>
                      <option value={3}>3px</option>
                      <option value={4}>4px</option>
                    </select>
                    <span className="tv-style-label">RSI</span>
                  </div>

                  <div className="tv-style-row">
                    <label className="tv-checkbox-container">
                      <input
                        type="checkbox"
                        checked={showMa}
                        onChange={(e) => setShowMa(e.target.checked)}
                      />
                      <span className="tv-checkbox-custom" />
                    </label>
                    <input
                      type="color"
                      value={maColor}
                      onChange={(e) => setMaColor(e.target.value)}
                      className="tv-color-box"
                    />
                    <span className="tv-style-label">RSI-based MA</span>
                  </div>

                  <div className="tv-section-label" style={{ marginTop: '16px' }}>
                    LEVEL RSI
                  </div>

                  <div className="tv-style-row">
                    <label className="tv-checkbox-container">
                      <input
                        type="checkbox"
                        checked={showUpperBand}
                        onChange={(e) => setShowUpperBand(e.target.checked)}
                      />
                      <span className="tv-checkbox-custom" />
                    </label>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="tv-color-box"
                    />
                    <input
                      type="number"
                      min={50}
                      max={99}
                      value={overbought}
                      onChange={(e) => setOverbought(Number(e.target.value))}
                      className="tv-input-num tv-level-num"
                    />
                    <span className="tv-style-label">Pita Atas RSI (Overbought)</span>
                  </div>

                  <div className="tv-style-row">
                    <label className="tv-checkbox-container">
                      <input
                        type="checkbox"
                        checked={showMiddleBand}
                        onChange={(e) => setShowMiddleBand(e.target.checked)}
                      />
                      <span className="tv-checkbox-custom" />
                    </label>
                    <input type="color" value="#94a3b8" readOnly className="tv-color-box" />
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={middle}
                      onChange={(e) => setMiddle(Number(e.target.value))}
                      className="tv-input-num tv-level-num"
                    />
                    <span className="tv-style-label">Pita Tengah RSI (Middle)</span>
                  </div>

                  <div className="tv-style-row">
                    <label className="tv-checkbox-container">
                      <input
                        type="checkbox"
                        checked={showLowerBand}
                        onChange={(e) => setShowLowerBand(e.target.checked)}
                      />
                      <span className="tv-checkbox-custom" />
                    </label>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="tv-color-box"
                    />
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={oversold}
                      onChange={(e) => setOversold(Number(e.target.value))}
                      className="tv-input-num tv-level-num"
                    />
                    <span className="tv-style-label">Pita Bawah RSI (Oversold)</span>
                  </div>

                  <div className="tv-style-row">
                    <label className="tv-checkbox-container">
                      <input
                        type="checkbox"
                        checked={showBackgroundFill}
                        onChange={(e) => setShowBackgroundFill(e.target.checked)}
                      />
                      <span className="tv-checkbox-custom" />
                    </label>
                    <input
                      type="color"
                      value={bandColor}
                      onChange={(e) => setBandColor(e.target.value)}
                      className="tv-color-box"
                    />
                    <span className="tv-style-label">Latar Belakang Pita RSI</span>
                  </div>
                </>
              )}

              {indicator.type === 'EMA' && (
                <>
                  <div className="tv-section-label">WARNA & CORAK GARIS EMA</div>
                  {emas.map((emaItem, idx) => {
                    const currentOpacity = emaItem.opacity !== undefined ? emaItem.opacity : 1;
                    const opacityPct = Math.round(currentOpacity * 100);

                    return (
                      <div
                        key={emaItem.id}
                        className="tv-style-row"
                        style={{
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label className="tv-checkbox-container">
                            <input
                              type="checkbox"
                              checked={emaItem.enabled}
                              onChange={(e) => {
                                const copy = [...emas];
                                copy[idx].enabled = e.target.checked;
                                setEmas(copy);
                              }}
                            />
                            <span className="tv-checkbox-custom" />
                          </label>
                          <input
                            type="color"
                            value={emaItem.color}
                            onChange={(e) => {
                              const copy = [...emas];
                              copy[idx].color = e.target.value;
                              setEmas(copy);
                            }}
                            className="tv-color-box"
                          />
                          <span className="tv-style-label" style={{ fontWeight: 600, minWidth: '70px', fontSize: '12px' }}>
                            {`EMA ${idx + 1} (${emaItem.period})`}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {/* Opacity Slider */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              opacity: emaItem.enabled ? 1 : 0.35,
                            }}
                            title={`Opasitas Garis EMA: ${opacityPct}%`}
                          >
                            <input
                              type="range"
                              min="10"
                              max="100"
                              step="5"
                              value={opacityPct}
                              onChange={(e) => {
                                const copy = [...emas];
                                copy[idx].opacity = Number(e.target.value) / 100;
                                setEmas(copy);
                              }}
                              style={{
                                width: '45px',
                                height: '4px',
                                accentColor: emaItem.color || '#3b82f6',
                                cursor: 'pointer',
                              }}
                            />
                            <span
                              style={{
                                fontSize: '10px',
                                color: '#94a3b8',
                                width: '28px',
                                fontFamily: 'monospace',
                                textAlign: 'right',
                              }}
                            >
                              {opacityPct}%
                            </span>
                          </div>

                          {/* Line Width */}
                          <select
                            value={emaItem.lineWidth || 2}
                            onChange={(e) => {
                              const copy = [...emas];
                              copy[idx].lineWidth = Number(e.target.value);
                              setEmas(copy);
                            }}
                            className="tv-line-width-select"
                            style={{ height: '26px' }}
                            title="Ketebalan Garis"
                          >
                            <option value={1}>1px</option>
                            <option value={2}>2px</option>
                            <option value={3}>3px</option>
                            <option value={4}>4px</option>
                          </select>

                          {/* Line Style */}
                          <select
                            value={emaItem.lineStyle || 'solid'}
                            onChange={(e) => {
                              const copy = [...emas];
                              copy[idx].lineStyle = e.target.value as 'solid' | 'dashed' | 'dotted';
                              setEmas(copy);
                            }}
                            className="tv-select"
                            style={{ width: '75px', fontSize: '11px', height: '26px' }}
                            title="Gaya Garis"
                          >
                            <option value="solid">Solid</option>
                            <option value="dashed">Dashed</option>
                            <option value="dotted">Dotted</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {(indicator.type === 'SESSIONS' || indicator.type === 'KILLZONES' || indicator.type === 'MACROS') && (
                <>
                  <div className="tv-section-label">
                    {indicator.type === 'MACROS' ? 'WARNA, GAYA & OPASITAS MACROS' : 'WARNA, GAYA & OPASITAS SESI'}
                  </div>
                  {sessions.map((sess, idx) => {
                    const fillActive = sess.fillEnabled !== false;
                    const borderActive = sess.showHighLow !== false;
                    const currentOpacity = sess.opacity !== undefined ? sess.opacity : 0.15;
                    const opacityPct = Math.round(currentOpacity * 100);
                    const currentBorderOpacity = sess.borderOpacity !== undefined ? sess.borderOpacity : 0.85;
                    const borderOpacityPct = Math.round(currentBorderOpacity * 100);

                    return (
                      <div
                        key={sess.id}
                        className="tv-style-row"
                        style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
                          <input
                            type="color"
                            value={sess.highLowColor || '#38bdf8'}
                            onChange={(e) => {
                              const copy = [...sessions];
                              copy[idx].highLowColor = e.target.value;
                              copy[idx].bgColor = e.target.value;
                              setSessions(copy);
                            }}
                            className="tv-color-box"
                          />
                          <span className="tv-style-label" style={{ fontSize: '11px' }}>{sess.name}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {/* Fill Checkbox */}
                          <label className="tv-checkbox-container" style={{ fontSize: '10.5px' }} title="Isi background kotak sesi">
                            <input
                              type="checkbox"
                              checked={fillActive}
                              onChange={(e) => {
                                const copy = [...sessions];
                                copy[idx].fillEnabled = e.target.checked;
                                setSessions(copy);
                              }}
                            />
                            <span className="tv-checkbox-custom" />
                            <span className="tv-checkbox-text" style={{ fontSize: '10.5px', color: '#94a3b8' }}>Fill</span>
                          </label>

                          {/* Opacity Slider (Fill) */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              opacity: fillActive ? 1 : 0.35,
                              pointerEvents: fillActive ? 'auto' : 'none',
                            }}
                            title={`Opasitas Fill: ${opacityPct}%`}
                          >
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={opacityPct}
                              onChange={(e) => {
                                const copy = [...sessions];
                                copy[idx].opacity = Number(e.target.value) / 100;
                                setSessions(copy);
                              }}
                              style={{
                                width: '40px',
                                height: '4px',
                                accentColor: sess.highLowColor || '#38bdf8',
                                cursor: 'pointer',
                              }}
                            />
                            <span
                              style={{
                                fontSize: '9.5px',
                                color: '#94a3b8',
                                width: '24px',
                                fontFamily: 'monospace',
                                textAlign: 'right',
                              }}
                            >
                              {opacityPct}%
                            </span>
                          </div>

                          {/* Border Checkbox */}
                          <label className="tv-checkbox-container" style={{ fontSize: '10.5px', marginLeft: '4px' }} title="Garis batas High/Low sesi">
                            <input
                              type="checkbox"
                              checked={borderActive}
                              onChange={(e) => {
                                const copy = [...sessions];
                                copy[idx].showHighLow = e.target.checked;
                                setSessions(copy);
                              }}
                            />
                            <span className="tv-checkbox-custom" />
                            <span className="tv-checkbox-text" style={{ fontSize: '10.5px', color: '#94a3b8' }}>Garis</span>
                          </label>

                          {/* Opacity Slider (Garis) */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              opacity: borderActive ? 1 : 0.35,
                              pointerEvents: borderActive ? 'auto' : 'none',
                            }}
                            title={`Opasitas Garis: ${borderOpacityPct}%`}
                          >
                            <input
                              type="range"
                              min="10"
                              max="100"
                              step="5"
                              value={borderOpacityPct}
                              onChange={(e) => {
                                const copy = [...sessions];
                                copy[idx].borderOpacity = Number(e.target.value) / 100;
                                setSessions(copy);
                              }}
                              style={{
                                width: '40px',
                                height: '4px',
                                accentColor: sess.highLowColor || '#38bdf8',
                                cursor: 'pointer',
                              }}
                            />
                            <span
                              style={{
                                fontSize: '9.5px',
                                color: '#94a3b8',
                                width: '24px',
                                fontFamily: 'monospace',
                                textAlign: 'right',
                              }}
                            >
                              {borderOpacityPct}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {indicator.type === 'SESSION_OPENS' && (
                <>
                  <div className="tv-section-label">GAYA, WARNA & OPASITAS GARIS OPEN</div>
                  {opens.map((op, idx) => {
                    const currentOpacity = op.opacity !== undefined ? op.opacity : 0.9;
                    const opacityPct = Math.round(currentOpacity * 100);

                    return (
                      <div
                        key={op.id}
                        className="tv-style-row"
                        style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '130px' }}>
                          <input
                            type="color"
                            value={op.color || '#38bdf8'}
                            onChange={(e) => {
                              const copy = [...opens];
                              copy[idx].color = e.target.value;
                              setOpens(copy);
                            }}
                            className="tv-color-box"
                          />
                          <span className="tv-style-label" style={{ fontSize: '11px' }}>{op.name}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {/* Opacity Slider */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }} title={`Opasitas: ${opacityPct}%`}>
                            <input
                              type="range"
                              min="10"
                              max="100"
                              step="5"
                              value={opacityPct}
                              onChange={(e) => {
                                const copy = [...opens];
                                copy[idx].opacity = Number(e.target.value) / 100;
                                setOpens(copy);
                              }}
                              style={{
                                width: '54px',
                                height: '4px',
                                accentColor: op.color || '#38bdf8',
                                cursor: 'pointer',
                              }}
                            />
                            <span
                              style={{
                                fontSize: '10px',
                                color: '#94a3b8',
                                width: '28px',
                                fontFamily: 'monospace',
                                textAlign: 'right',
                              }}
                            >
                              {opacityPct}%
                            </span>
                          </div>

                          {/* Line Style Select */}
                          <select
                            value={op.lineStyle || 'solid'}
                            onChange={(e) => {
                              const copy = [...opens];
                              copy[idx].lineStyle = e.target.value;
                              setOpens(copy);
                            }}
                            className="tv-select"
                            style={{ width: '80px', height: '22px', fontSize: '10.5px' }}
                          >
                            <option value="solid">Solid</option>
                            <option value="dashed">Dashed</option>
                            <option value="dotted">Dotted</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {activeTab === 'visibilitas' && (
            <div className="tv-tab-pane">
              <div className="tv-section-label">VISIBILITAS KERANGKA WAKTU</div>
              <div className="tv-checkbox-row">
                <label className="tv-checkbox-container">
                  <input
                    type="checkbox"
                    checked={visSeconds}
                    onChange={(e) => setVisSeconds(e.target.checked)}
                  />
                  <span className="tv-checkbox-custom" />
                  <span className="tv-checkbox-text">Detik</span>
                </label>
              </div>
              <div className="tv-checkbox-row">
                <label className="tv-checkbox-container">
                  <input
                    type="checkbox"
                    checked={visMinutes}
                    onChange={(e) => setVisMinutes(e.target.checked)}
                  />
                  <span className="tv-checkbox-custom" />
                  <span className="tv-checkbox-text">Menit</span>
                </label>
              </div>
              <div className="tv-checkbox-row">
                <label className="tv-checkbox-container">
                  <input
                    type="checkbox"
                    checked={visHours}
                    onChange={(e) => setVisHours(e.target.checked)}
                  />
                  <span className="tv-checkbox-custom" />
                  <span className="tv-checkbox-text">Jam</span>
                </label>
              </div>
              <div className="tv-checkbox-row">
                <label className="tv-checkbox-container">
                  <input
                    type="checkbox"
                    checked={visDays}
                    onChange={(e) => setVisDays(e.target.checked)}
                  />
                  <span className="tv-checkbox-custom" />
                  <span className="tv-checkbox-text">Hari</span>
                </label>
              </div>
              <div className="tv-checkbox-row">
                <label className="tv-checkbox-container">
                  <input
                    type="checkbox"
                    checked={visWeeks}
                    onChange={(e) => setVisWeeks(e.target.checked)}
                  />
                  <span className="tv-checkbox-custom" />
                  <span className="tv-checkbox-text">Minggu</span>
                </label>
              </div>
              <div className="tv-checkbox-row">
                <label className="tv-checkbox-container">
                  <input
                    type="checkbox"
                    checked={visMonths}
                    onChange={(e) => setVisMonths(e.target.checked)}
                  />
                  <span className="tv-checkbox-custom" />
                  <span className="tv-checkbox-text">Bulan</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="tv-settings-footer">
          <div className="tv-default-dropdown-wrapper">
            <button
              type="button"
              className="tv-btn-default"
              onClick={() => setShowDefaultMenu(!showDefaultMenu)}
            >
              <span>Bawaan</span>
              <ChevronDown size={14} />
            </button>
            {showDefaultMenu && (
              <div className="tv-default-menu">
                <button type="button" onClick={handleApplyDefaults}>
                  Terapkan Bawaan
                </button>
              </div>
            )}
          </div>

          <div className="tv-footer-buttons">
            <button type="button" className="tv-btn-cancel" onClick={onClose}>
              Batal
            </button>
            <button type="button" className="tv-btn-ok" onClick={handleSave}>
              Ok
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default IndicatorSettingsModal;
