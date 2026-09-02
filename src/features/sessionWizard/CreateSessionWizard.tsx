import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Shield,
  X,
  Lock,
  Info,
  Check,
  Plus,
} from 'lucide-react';
import { useSymbols } from '@features/data';
import { getAllSessions } from '../backtest/sessionRepository';
import type { AnalyticsSession } from '../analytics/types';
import { PairAvatar } from '../../components/common/PairAvatar';
import './CreateSessionWizard.css';

export interface SessionConfig {
  name: string;
  symbol: string;
  symbols: string[];
  timeframe: string;
  startDate: string;
  endDate: string;
  initialBalance: number;
  mode: 'normal' | 'challenge';
  challengeRules?: {
    dailyLossPercent: number;
    maxLossPercent: number;
    profitTargetPercent: number;
    minimumTradingDays: number;
  };
}

interface CreateSessionWizardProps {
  onCancel: () => void;
  onNextStep: (config: SessionConfig) => void;
}

export type InstrumentCategory =
  | 'Forex'
  | 'Metals'
  | 'Indices'
  | 'Commodities'
  | 'Crypto'
  | 'ETFs'
  | 'Bonds'
  | 'Futures'
  | 'Stocks';

const CATEGORIES: { id: InstrumentCategory; label: string }[] = [
  { id: 'Forex', label: 'Forex' },
  { id: 'Metals', label: 'Metals' },
  { id: 'Indices', label: 'Indices' },
  { id: 'Commodities', label: 'Commodities' },
  { id: 'Crypto', label: 'Crypto' },
  { id: 'ETFs', label: 'ETFs' },
  { id: 'Bonds', label: 'Bonds' },
  { id: 'Futures', label: 'Futures' },
  { id: 'Stocks', label: 'Stocks' },
];

/**
 * Dukascopy & Trading Instrument Categorizer
 */
export function getSymbolCategory(symName: string): InstrumentCategory {
  if (!symName) return 'Forex';
  const s = symName.toUpperCase().trim();

  // 1. Metals
  if (
    s.startsWith('XAU') ||
    s.startsWith('XAG') ||
    s.startsWith('XPT') ||
    s.startsWith('XPD') ||
    s.includes('GOLD') ||
    s.includes('SILVER') ||
    s.includes('PLATINUM') ||
    s.includes('PALLADIUM')
  ) {
    return 'Metals';
  }

  // 2. Indices (Dukascopy *IDX* and global major index tickers)
  if (
    s.includes('IDX') ||
    s.includes('US30') ||
    s.includes('USA30') ||
    s.includes('DOW') ||
    s.includes('DJI') ||
    s.includes('NAS100') ||
    s.includes('US100') ||
    s.includes('USTECH') ||
    s.includes('NDX') ||
    s.includes('NASDAQ') ||
    s.includes('USATECH') ||
    s.includes('SPX') ||
    s.includes('SP500') ||
    s.includes('US500') ||
    s.includes('USA500') ||
    s.includes('GER30') ||
    s.includes('GER40') ||
    s.includes('DAX') ||
    s.includes('DEUIDX') ||
    s.includes('UK100') ||
    s.includes('FTSE') ||
    s.includes('GBRIDX') ||
    s.includes('JPN225') ||
    s.includes('NIKKEI') ||
    s.includes('JPNIDX') ||
    s.includes('AUS200') ||
    s.includes('AUSIDX') ||
    s.includes('FRA40') ||
    s.includes('FRAIDX') ||
    s.includes('EUSTX') ||
    s.includes('EUSIDX') ||
    s.includes('HK50') ||
    s.includes('HKGIDX') ||
    s.includes('INDEX')
  ) {
    return 'Indices';
  }

  // 3. Commodities & Energy
  if (
    s.includes('CMD') ||
    s.includes('OIL') ||
    s.includes('BRENT') ||
    s.includes('WTI') ||
    s.includes('USO') ||
    s.includes('LIGHT') ||
    s.includes('GAS') ||
    s.includes('NGAS') ||
    s.includes('COPPER') ||
    s.includes('COFFEE') ||
    s.includes('SUGAR') ||
    s.includes('COCOA') ||
    s.includes('WHEAT')
  ) {
    return 'Commodities';
  }

  // 4. Crypto
  if (
    s.includes('BTC') ||
    s.includes('ETH') ||
    s.includes('SOL') ||
    s.includes('LTC') ||
    s.includes('XRP') ||
    s.includes('ADA') ||
    s.includes('DOT') ||
    s.includes('DOGE') ||
    s.includes('CRYPTO')
  ) {
    return 'Crypto';
  }

  // 5. Default to Forex
  return 'Forex';
}



export const CreateSessionWizard: React.FC<CreateSessionWizardProps> = ({
  onCancel,
  onNextStep,
}) => {
  const { symbols, loading: symbolsLoading } = useSymbols();
  const [pastSessions, setPastSessions] = useState<AnalyticsSession[]>([]);

  // Wizard Step: 1 to 5
  const [step, setStep] = useState<number>(1);

  // Step 1: Backtesting Type
  const [mode, setMode] = useState<'normal' | 'challenge'>('normal');

  // Step 2: Multi-Pair Selection & Category Tabs
  const [selectedCategory, setSelectedCategory] = useState<InstrumentCategory>('Metals');
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);

  // Step 3: Date Range
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Step 4: Balance & Challenge Rules
  const [initialBalance, setInitialBalance] = useState<number | string>(10000);
  const [profitTargetPercent, setProfitTargetPercent] = useState<number | string>(10);
  const [maxDrawdownPercent, setMaxDrawdownPercent] = useState<number | string>(10);
  const [maxDailyDrawdownPercent, setMaxDailyDrawdownPercent] = useState<number | string>(5);

  // Step 5: Session Title
  const [sessionTitle, setSessionTitle] = useState<string>('');

  // Load past sessions to calculate true Top Pairs history
  useEffect(() => {
    let isMounted = true;
    void getAllSessions().then((list: AnalyticsSession[]) => {
      if (isMounted && Array.isArray(list)) {
        setPastSessions(list);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Set of categories available in imported database
  const availableCategories = useMemo(() => {
    const set = new Set<InstrumentCategory>();
    for (const s of symbols) {
      set.add(getSymbolCategory(s.name));
    }
    return set;
  }, [symbols]);

  // Top pairs: calculates real usage from past sessions history, sorted by session count
  const topUsedPairs = useMemo(() => {
    const usageMap = new Map<string, number>();
    for (const sess of pastSessions) {
      const mainSym = (sess.symbol || '').toUpperCase().trim();
      if (mainSym) {
        usageMap.set(mainSym, (usageMap.get(mainSym) || 0) + 1);
      }
      if (sess.symbols && Array.isArray(sess.symbols)) {
        for (const sub of sess.symbols) {
          const clean = (sub || '').toUpperCase().trim();
          if (clean && clean !== mainSym) {
            usageMap.set(clean, (usageMap.get(clean) || 0) + 1);
          }
        }
      }
    }

    const list: Array<{
      name: string;
      count: number;
      category: InstrumentCategory;
    }> = [];

    for (const sym of symbols) {
      const clean = sym.name.toUpperCase().trim();
      const count = usageMap.get(clean) || 0;
      list.push({
        name: sym.name,
        count,
        category: getSymbolCategory(sym.name),
      });
    }

    // Sort: highest usage count first, then by candle count
    list.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const symA = symbols.find((s) => s.name === a.name);
      const symB = symbols.find((s) => s.name === b.name);
      return (symB?.candleCount || 0) - (symA?.candleCount || 0);
    });

    return list.slice(0, 6);
  }, [pastSessions, symbols]);

  // Auto-select initial symbol from Top Used Pairs or database
  useEffect(() => {
    if (symbols.length > 0 && selectedSymbols.length === 0) {
      if (topUsedPairs.length > 0) {
        const top = topUsedPairs[0];
        setSelectedSymbols([top.name]);
        setSelectedCategory(top.category);
      } else {
        const first = symbols[0];
        setSelectedSymbols([first.name]);
        setSelectedCategory(getSymbolCategory(first.name));
      }
    }
  }, [symbols, selectedSymbols, topUsedPairs]);

  // Toggle symbol in multi-selection
  const toggleSymbol = (symName: string) => {
    setSelectedSymbols((prev) => {
      if (prev.includes(symName)) {
        if (prev.length === 1) return prev; // Keep at least one symbol selected
        return prev.filter((s) => s !== symName);
      } else {
        return [...prev, symName];
      }
    });
  };

  const removeSymbol = (symName: string) => {
    setSelectedSymbols((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((s) => s !== symName);
    });
  };

  // Active symbol objects matching selectedSymbols
  const activeSymbolObjs = useMemo(() => {
    return symbols.filter((s) => selectedSymbols.includes(s.name));
  }, [symbols, selectedSymbols]);

  // Compute common overlapping date range across all selected symbols
  const validFirstTimes = useMemo(
    () => activeSymbolObjs.map((s) => s.firstTime).filter((t): t is number => t !== null),
    [activeSymbolObjs]
  );
  const validLastTimes = useMemo(
    () => activeSymbolObjs.map((s) => s.lastTime).filter((t): t is number => t !== null),
    [activeSymbolObjs]
  );

  const commonMinTime = validFirstTimes.length > 0 ? Math.max(...validFirstTimes) : null;
  const commonMaxTime = validLastTimes.length > 0 ? Math.min(...validLastTimes) : null;

  const hasData = validFirstTimes.length > 0 && validLastTimes.length > 0;
  const hasOverlap =
    hasData && commonMinTime !== null && commonMaxTime !== null && commonMinTime <= commonMaxTime;

  const availableMinDateStr = useMemo(() => {
    if (!commonMinTime) return '';
    return new Date(commonMinTime * 1000).toISOString().split('T')[0];
  }, [commonMinTime]);

  const availableMaxDateStr = useMemo(() => {
    if (!commonMaxTime) return '';
    return new Date(commonMaxTime * 1000).toISOString().split('T')[0];
  }, [commonMaxTime]);

  // Sync date range whenever selected symbols change
  useEffect(() => {
    if (availableMinDateStr && availableMaxDateStr) {
      setStartDate(availableMinDateStr);
      setEndDate(availableMaxDateStr);
    }
  }, [availableMinDateStr, availableMaxDateStr]);

  // Filtered symbols by selected category
  const filteredSymbols = useMemo(() => {
    if (symbols.length === 0) return [];
    return symbols.filter((s) => getSymbolCategory(s.name) === selectedCategory);
  }, [symbols, selectedCategory]);

  // Preset Date Range handler
  const handlePreset = (preset: 'ALL' | '1Y' | '6M' | '3M' | '1M') => {
    if (!commonMaxTime) return;
    const maxSec = commonMaxTime;
    const maxIso = new Date(maxSec * 1000).toISOString().split('T')[0];
    setEndDate(maxIso);

    if (preset === 'ALL') {
      if (commonMinTime) {
        setStartDate(new Date(commonMinTime * 1000).toISOString().split('T')[0]);
      }
      return;
    }

    let days = 30;
    if (preset === '1Y') days = 365;
    else if (preset === '6M') days = 180;
    else if (preset === '3M') days = 90;
    else if (preset === '1M') days = 30;

    const startSec = Math.max(commonMinTime || 0, maxSec - days * 86400);
    setStartDate(new Date(startSec * 1000).toISOString().split('T')[0]);
  };

  // Submit & Start Session
  const handleStartBacktesting = () => {
    if (selectedSymbols.length === 0) {
      alert('Please select at least one trading symbol.');
      return;
    }
    if (!hasOverlap) {
      alert('Selected pairs do not share an overlapping historical date range.');
      return;
    }
    if (!startDate || !endDate) {
      alert('Please choose a valid date range.');
      return;
    }
    if (startDate > endDate) {
      alert('Start date cannot be after end date.');
      return;
    }
    const parsedBalance = typeof initialBalance === 'string'
      ? Number(initialBalance.replace(/[^0-9.]/g, ''))
      : Number(initialBalance);
    const numBalance = !isNaN(parsedBalance) && parsedBalance > 0 ? parsedBalance : 10000;
    if (isNaN(numBalance) || numBalance <= 0) {
      alert('Please enter a valid initial balance greater than $0.');
      return;
    }

    const title = sessionTitle.trim() || `${selectedSymbols.join(', ')} Backtest`;

    onNextStep({
      name: title,
      symbol: selectedSymbols[0],
      symbols: selectedSymbols,
      timeframe: 'M15',
      startDate,
      endDate,
      initialBalance: numBalance,
      mode,
      challengeRules:
        mode === 'challenge'
          ? {
              dailyLossPercent: Number(maxDailyDrawdownPercent) || 5,
              maxLossPercent: Number(maxDrawdownPercent) || 10,
              profitTargetPercent: Number(profitTargetPercent) || 10,
              minimumTradingDays: 0,
            }
          : undefined,
    });
  };

  return (
    <div className="csw-backdrop">
      <div className="csw-modal">
        {/* Close Button Top Right */}
        <button type="button" className="csw-close-btn" onClick={onCancel} title="Close">
          <X size={18} />
        </button>

        {/* ── 5-Step Progress Stepper ── */}
        <div className="csw-stepper">
          {/* Step 1 */}
          <div className={`csw-stepper__item ${step === 1 ? 'is-active' : ''} ${step > 1 ? 'is-completed' : ''}`}>
            <div className="csw-stepper__badge">1</div>
            <span className="csw-stepper__label">BACKTESTING TYPE</span>
          </div>

          <div className={`csw-stepper__line ${step >= 2 ? 'is-filled' : ''}`} />

          {/* Step 2 */}
          <div className={`csw-stepper__item ${step === 2 ? 'is-active' : ''} ${step > 2 ? 'is-completed' : ''}`}>
            <div className="csw-stepper__badge">2</div>
            <span className="csw-stepper__label">TRADING PAIR</span>
          </div>

          <div className={`csw-stepper__line ${step >= 3 ? 'is-filled' : ''}`} />

          {/* Step 3 */}
          <div className={`csw-stepper__item ${step === 3 ? 'is-active' : ''} ${step > 3 ? 'is-completed' : ''}`}>
            <div className="csw-stepper__badge">3</div>
            <span className="csw-stepper__label">DATE RANGE</span>
          </div>

          <div className={`csw-stepper__line ${step >= 4 ? 'is-filled' : ''}`} />

          {/* Step 4 */}
          <div className={`csw-stepper__item ${step === 4 ? 'is-active' : ''} ${step > 4 ? 'is-completed' : ''}`}>
            <div className="csw-stepper__badge">4</div>
            <span className="csw-stepper__label">INITIAL BALANCE</span>
          </div>

          <div className={`csw-stepper__line ${step >= 5 ? 'is-filled' : ''}`} />

          {/* Step 5 */}
          <div className={`csw-stepper__item ${step === 5 ? 'is-active' : ''}`}>
            <div className="csw-stepper__badge">5</div>
            <span className="csw-stepper__label">REVIEW & START</span>
          </div>
        </div>

        {/* ── STEP 1: Select Backtesting Type ── */}
        {step === 1 && (
          <div className="csw-step-content">
            <h2 className="csw-step-title">Step 1: Select Backtesting Type</h2>

            <div className="csw-field-label">BACKTESTING TYPE:</div>

            <div className="csw-type-cards">
              <div
                className={`csw-type-card ${mode === 'normal' ? 'is-selected' : ''}`}
                onClick={() => setMode('normal')}
              >
                <div className="csw-type-card__icon-box">
                  <TrendingUp size={20} />
                </div>
                <div className="csw-type-card__info">
                  <div className="csw-type-card__title">Normal</div>
                  <div className="csw-type-card__desc">
                    Normal backtesting session with full visibility of the trading pair.
                  </div>
                </div>
              </div>

              <div
                className={`csw-type-card ${mode === 'challenge' ? 'is-selected' : ''}`}
                onClick={() => setMode('challenge')}
              >
                <div className="csw-type-card__icon-box">
                  <Shield size={20} />
                </div>
                <div className="csw-type-card__info">
                  <div className="csw-type-card__title">Prop Firm Challenge</div>
                  <div className="csw-type-card__desc">
                    Simulate prop firm rules with daily loss & max drawdown limits.
                  </div>
                </div>
              </div>
            </div>

            <div className="csw-actions csw-actions--single">
              <button
                type="button"
                className="csw-btn-next csw-btn-next--full"
                onClick={() => setStep(2)}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Select Trading Symbol (Multi-Select Supported) ── */}
        {step === 2 && (
          <div className="csw-step-content">
            <h2 className="csw-step-title">Step 2: Select Trading Symbol</h2>

            {/* Category Tabs */}
            <div className="csw-category-tabs">
              {CATEGORIES.map((cat) => {
                const isAvailable = availableCategories.has(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`csw-category-tab ${selectedCategory === cat.id ? 'is-active' : ''}`}
                    onClick={() => setSelectedCategory(cat.id)}
                    title={isAvailable ? `${cat.label} Pairs` : `No ${cat.label} data imported yet`}
                  >
                    <span>{cat.label}</span>
                    {!isAvailable && <Lock size={11} className="csw-cat-lock" />}
                  </button>
                );
              })}
            </div>

            {/* Selected Active Pairs Pills Box */}
            {selectedSymbols.length > 0 && (
              <div className="csw-selected-box">
                <div className="csw-selected-header">
                  <span className="csw-selected-title">
                    SELECTED PAIRS ({selectedSymbols.length}):
                  </span>
                </div>
                <div className="csw-selected-pills">
                  {selectedSymbols.map((sym) => (
                    <span key={sym} className="csw-selected-pill">
                      <PairAvatar symbol={sym} size={16} />
                      <span className="csw-selected-pill-name">{sym}</span>
                      {selectedSymbols.length > 1 && (
                        <button
                          type="button"
                          className="csw-selected-pill-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSymbol(sym);
                          }}
                          title="Remove pair"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Top Pairs Card */}
            <div className="csw-top-pairs-card">
              <div className="csw-top-pairs-title">YOUR TOP PAIRS (CLICK TO TOGGLE):</div>
              <div className="csw-top-pairs-list">
                {symbolsLoading ? (
                  <span className="csw-muted-text">Loading pairs...</span>
                ) : topUsedPairs.length === 0 ? (
                  <span className="csw-muted-text">No pairs imported yet.</span>
                ) : (
                  topUsedPairs.map((p) => {
                    const isSelected = selectedSymbols.includes(p.name);
                    return (
                      <button
                        key={p.name}
                        type="button"
                        className={`csw-top-pair-pill ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => toggleSymbol(p.name)}
                        title={`${p.name} (${p.category}) — Played in ${p.count} session${p.count === 1 ? '' : 's'}`}
                      >
                        {isSelected && <Check size={12} className="csw-pair-check" />}
                        <PairAvatar symbol={p.name} size={16} />
                        <span className="csw-pair-name">{p.name}</span>
                        <span className="csw-pair-count">{p.count}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Category Available Pairs Grid (Multi-Select Chips with Pair Avatar) */}
            <div className="csw-field-group">
              <label className="csw-field-label">
                AVAILABLE IN {selectedCategory.toUpperCase()} ({filteredSymbols.length}):
              </label>
              {filteredSymbols.length === 0 ? (
                <div className="csw-empty-category">
                  No {selectedCategory} pairs found in database. Go to Data Hub to import CSV files.
                </div>
              ) : (
                <div className="csw-category-pairs-grid">
                  {filteredSymbols.map((s) => {
                    const isSelected = selectedSymbols.includes(s.name);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`csw-cat-pair-chip ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => toggleSymbol(s.name)}
                      >
                        <PairAvatar symbol={s.name} size={18} />
                        <span className="csw-chip-name">{s.name}</span>
                        <span className="csw-chip-meta">
                          {s.candleCount.toLocaleString('en-US')} bars
                        </span>
                        {isSelected ? (
                          <Check size={13} className="csw-chip-badge is-active" />
                        ) : (
                          <Plus size={13} className="csw-chip-badge" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Note Callout */}
            <div className="csw-note-callout">
              <strong className="csw-note-prefix">Note:</strong> You can select multiple pairs (e.g. XAUUSD & USATECHIDXUSD) to trade both within the same backtesting session.
            </div>

            <div className="csw-actions">
              <button type="button" className="csw-btn-back" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                type="button"
                className="csw-btn-next"
                disabled={selectedSymbols.length === 0}
                onClick={() => setStep(3)}
              >
                Next ({selectedSymbols.length} {selectedSymbols.length === 1 ? 'Pair' : 'Pairs'})
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Select Date Range ── */}
        {step === 3 && (
          <div className="csw-step-content">
            <h2 className="csw-step-title">Step 3: Select Date Range</h2>

            {/* Available Range Banner */}
            {hasOverlap ? (
              <div className="csw-range-banner">
                <Info size={15} className="csw-range-icon" />
                <span>
                  Common Available Range for ({selectedSymbols.join(', ')}): {' '}
                  <span className="csw-range-highlight">{availableMinDateStr || '—'}</span> to{' '}
                  <span className="csw-range-highlight">{availableMaxDateStr || '—'}</span>
                </span>
              </div>
            ) : (
              <div className="csw-range-banner csw-range-banner--warning">
                <Info size={15} className="csw-range-icon" />
                <span>
                  Selected pairs ({selectedSymbols.join(', ')}) do not share an overlapping historical date range.
                </span>
              </div>
            )}

            <div className="csw-dates-grid">
              <div className="csw-field-group">
                <label className="csw-field-label">REPLAY START DATE:</label>
                <input
                  type="date"
                  className="csw-input-field"
                  value={startDate}
                  min={availableMinDateStr || undefined}
                  max={availableMaxDateStr || undefined}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={!hasOverlap}
                  required
                />
              </div>

              <div className="csw-field-group">
                <label className="csw-field-label">REPLAY END DATE:</label>
                <input
                  type="date"
                  className="csw-input-field"
                  value={endDate}
                  min={availableMinDateStr || undefined}
                  max={availableMaxDateStr || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={!hasOverlap}
                  required
                />
              </div>
            </div>

            {/* Quick Preset Chips */}
            <div className="csw-preset-row">
              <button
                type="button"
                className="csw-preset-btn"
                disabled={!hasOverlap}
                onClick={() => handlePreset('ALL')}
              >
                Full Data
              </button>
              <button
                type="button"
                className="csw-preset-btn"
                disabled={!hasOverlap}
                onClick={() => handlePreset('1Y')}>
                Last 1 Year
              </button>
              <button
                type="button"
                className="csw-preset-btn"
                disabled={!hasOverlap}
                onClick={() => handlePreset('6M')}>
                Last 6 Months
              </button>
              <button
                type="button"
                className="csw-preset-btn"
                disabled={!hasOverlap}
                onClick={() => handlePreset('3M')}>
                Last 3 Months
              </button>
              <button
                type="button"
                className="csw-preset-btn"
                disabled={!hasOverlap}
                onClick={() => handlePreset('1M')}>
                Last 1 Month
              </button>
            </div>

            <div className="csw-actions">
              <button type="button" className="csw-btn-back" onClick={() => setStep(2)}>
                Back
              </button>
              <button
                type="button"
                className="csw-btn-next"
                disabled={!hasOverlap || !startDate || !endDate}
                onClick={() => setStep(4)}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Set Initial Balance & Prop-Firm Rules ── */}
        {step === 4 && (
          <div className="csw-step-content">
            <h2 className="csw-step-title">
              {mode === 'challenge'
                ? 'Step 4: Set Initial Balance & Prop-Firm Rules'
                : 'Step 4: Set Initial Balance'}
            </h2>

            <div className="csw-field-group">
              <label className="csw-field-label">INITIAL BALANCE ($):</label>
              <input
                type="text"
                inputMode="decimal"
                className="csw-input-field"
                value={initialBalance}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setInitialBalance('');
                    return;
                  }
                  const clean = raw.replace(/[$ ]/g, '').replace(/,/g, '');
                  if (/^\d*\.?\d*$/.test(clean)) {
                    setInitialBalance(clean);
                  }
                }}
                placeholder="10000"
                required
              />
            </div>

            {/* Quick Balance Presets */}
            <div className="csw-preset-row">
              {[5000, 10000, 25000, 50000, 100000, 200000].map((amt) => {
                const currentVal = Number(String(initialBalance).replace(/,/g, ''));
                return (
                  <button
                    key={amt}
                    type="button"
                    className={`csw-preset-btn ${currentVal === amt ? 'is-active' : ''}`}
                    onClick={() => setInitialBalance(amt)}
                  >
                    ${amt.toLocaleString('en-US')}
                  </button>
                );
              })}
            </div>

            {mode === 'challenge' && (
              <>
                <div className="csw-field-group">
                  <label className="csw-field-label">PROFIT TARGET (%):</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="csw-input-field"
                    value={profitTargetPercent}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setProfitTargetPercent('');
                        return;
                      }
                      const clean = raw.replace(/[% ]/g, '').replace(/,/g, '');
                      if (/^\d*\.?\d*$/.test(clean)) {
                        setProfitTargetPercent(clean);
                      }
                    }}
                    placeholder="10"
                    required
                  />
                </div>

                <div className="csw-field-group">
                  <label className="csw-field-label">MAX DRAWDOWN (%):</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="csw-input-field"
                    value={maxDrawdownPercent}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setMaxDrawdownPercent('');
                        return;
                      }
                      const clean = raw.replace(/[% ]/g, '').replace(/,/g, '');
                      if (/^\d*\.?\d*$/.test(clean)) {
                        setMaxDrawdownPercent(clean);
                      }
                    }}
                    placeholder="10"
                    required
                  />
                </div>

                <div className="csw-field-group">
                  <label className="csw-field-label">MAX DAILY DRAWDOWN (%):</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="csw-input-field"
                    value={maxDailyDrawdownPercent}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setMaxDailyDrawdownPercent('');
                        return;
                      }
                      const clean = raw.replace(/[% ]/g, '').replace(/,/g, '');
                      if (/^\d*\.?\d*$/.test(clean)) {
                        setMaxDailyDrawdownPercent(clean);
                      }
                    }}
                    placeholder="5"
                    required
                  />
                </div>
              </>
            )}

            <div className="csw-actions">
              <button type="button" className="csw-btn-back" onClick={() => setStep(3)}>
                Back
              </button>
              <button
                type="button"
                className="csw-btn-next"
                disabled={!initialBalance || isNaN(Number(String(initialBalance).replace(/,/g, ''))) || Number(String(initialBalance).replace(/,/g, '')) <= 0}
                onClick={() => setStep(5)}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 5: Review & Start Backtesting ── */}
        {step === 5 && (
          <div className="csw-step-content">
            <h2 className="csw-step-title">Step 5: Review & Start Backtesting</h2>

            <div className="csw-field-group">
              <label className="csw-field-label">SESSION TITLE:</label>
              <input
                type="text"
                className="csw-input-field"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="Unnamed session"
              />
            </div>

            {/* Summary Review Card */}
            <div className="csw-review-card">
              <div className="csw-review-col">
                <div className="csw-review-label">BACKTESTING TYPE:</div>
                <div className="csw-review-val">
                  {mode === 'challenge' ? 'Prop Firm Challenge' : 'Normal'}
                </div>

                <div className="csw-review-label" style={{ marginTop: '1.25rem' }}>
                  DATE RANGE:
                </div>
                <div className="csw-review-val">
                  {startDate || '—'} - {endDate || '—'}
                </div>
              </div>

              <div className="csw-review-col">
                <div className="csw-review-label">
                  TRADING {selectedSymbols.length > 1 ? `PAIRS (${selectedSymbols.length})` : 'PAIR'}:
                </div>
                <div className="csw-review-val csw-review-val--pair-wrap">
                  {selectedSymbols.map((sym) => (
                    <span key={sym} className="csw-review-pair-chip">
                      <PairAvatar symbol={sym} size={16} />
                      <span>{sym}</span>
                    </span>
                  ))}
                </div>

                <div className="csw-review-label" style={{ marginTop: '1.25rem' }}>
                  INITIAL BALANCE:
                </div>
                <div className="csw-review-val">
                  ${Number(String(initialBalance).replace(/,/g, '') || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="csw-actions">
              <button type="button" className="csw-btn-back" onClick={() => setStep(4)}>
                Back
              </button>
              <button
                type="button"
                className="csw-btn-start"
                onClick={handleStartBacktesting}
              >
                Start Backtesting
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
