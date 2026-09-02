import React, { useState, useRef } from 'react';
import { X, Pencil } from 'lucide-react';
import { ColorPicker } from '@features/appearance';
import type { DrawingObject, DrawingPoint, DrawingStyle } from '../engine/types';
import {
  getTemplatesForTool,
  getFactoryDefaultStyle,
  type DrawingTemplate,
} from '../services/templateService';
import './FibonacciSettingsModal.css';

export interface FibLevelConfig {
  level: number;
  color: string;
  enabled: boolean;
  lineWidth?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

interface FibonacciSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  drawing: DrawingObject;
  onSave: (
    id: string,
    styleChanges: Partial<DrawingStyle>,
    textValue?: string,
    points?: DrawingPoint[]
  ) => void;
}

// 24 Standard TradingView Fibonacci Retracement Levels (2 Columns x 12 Rows)
export const TRADINGVIEW_FIB_RETRACEMENT_LEVELS: FibLevelConfig[] = [
  // Left Column
  { level: 0, color: '#787b86', enabled: true },
  { level: 0.382, color: '#4caf50', enabled: true },
  { level: 0.618, color: '#089981', enabled: true },
  { level: 1, color: '#787b86', enabled: true },
  { level: 2.618, color: '#9c27b0', enabled: true },
  { level: 4.236, color: '#e91e63', enabled: false },
  { level: 1.768, color: '#ff9800', enabled: false },
  { level: 2.414, color: '#4caf50', enabled: false },
  { level: 3, color: '#00bcd4', enabled: false },
  { level: 3.414, color: '#2962ff', enabled: false },
  { level: 4.272, color: '#9c27b0', enabled: false },
  { level: 4.618, color: '#e91e63', enabled: false },
  // Right Column
  { level: 0.236, color: '#f23645', enabled: true },
  { level: 0.5, color: '#4caf50', enabled: true },
  { level: 0.786, color: '#00bcd4', enabled: true },
  { level: 1.618, color: '#2962ff', enabled: true },
  { level: 3.618, color: '#e91e63', enabled: true },
  { level: 2.768, color: '#f23645', enabled: false },
  { level: 2.272, color: '#ff9800', enabled: false },
  { level: 2, color: '#089981', enabled: false },
  { level: 3.272, color: '#2962ff', enabled: false },
  { level: 4, color: '#673ab7', enabled: false },
  { level: 4.414, color: '#e91e63', enabled: false },
  { level: 4.764, color: '#673ab7', enabled: false },
];

export function getInitialLevelsForDrawing(drawing: DrawingObject): FibLevelConfig[] {
  const existing = (drawing.style as any).fibLevels ?? drawing.style.levels;
  const baseDefaults = TRADINGVIEW_FIB_RETRACEMENT_LEVELS;

  if (Array.isArray(existing) && existing.length > 0) {
    const existingMap = new Map<number, any>();
    existing.forEach((item: any) => {
      const lvl = typeof item === 'number' ? item : item.level;
      existingMap.set(Number(lvl), item);
    });

    return baseDefaults.map((def) => {
      const found = existingMap.get(def.level);
      if (found) {
        return {
          level: def.level,
          color: typeof found === 'object' && found.color ? found.color : def.color,
          enabled: typeof found === 'object' && found.enabled !== undefined ? found.enabled : true,
          lineWidth: typeof found === 'object' ? found.lineWidth : undefined,
          lineStyle: typeof found === 'object' ? found.lineStyle : undefined,
        };
      }
      return def;
    });
  }
  return baseDefaults.map((d) => ({ ...d }));
}

const TOOL_TITLE_MAP: Record<string, string> = {
  'fib-retracement': 'Fib Retracement',
  fibonacci: 'Fib Retracement',
};

const FONT_SIZES = [10, 11, 12, 14, 16, 20, 24, 28];

export default function FibonacciSettingsModal({
  isOpen,
  onClose,
  drawing,
  onSave,
}: FibonacciSettingsModalProps) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'corak' | 'koordinat' | 'visibilitas'>('corak');

  // ─── Corak (Style) States ───
  const [showTrendline, setShowTrendline] = useState<boolean>(
    (drawing.style as any).showTrendline ?? true
  );
  const [trendlineColor, setTrendlineColor] = useState<string>(
    drawing.style.color || '#ffffff'
  );
  const [trendlineStyle, setTrendlineStyle] = useState<'solid' | 'dashed' | 'dotted'>(
    (drawing.style as any).trendlineStyle || 'dashed'
  );
  const [trendlineWidth, setTrendlineWidth] = useState<number>(
    (drawing.style as any).trendlineWidth || 1
  );

  const [levelLineStyle, setLevelLineStyle] = useState<'solid' | 'dashed' | 'dotted'>(
    drawing.style.lineStyle || 'solid'
  );
  const [levelLineWidth, setLevelLineWidth] = useState<number>(
    drawing.style.lineWidth || 1
  );

  const [extendOption, setExtendOption] = useState<string>(
    (drawing.style as any).extend || 'none'
  );

  const [levels, setLevels] = useState<FibLevelConfig[]>(() =>
    getInitialLevelsForDrawing(drawing)
  );

  const [singleColor, setSingleColor] = useState<string | null>(null);

  const [fillEnabled, setFillEnabled] = useState<boolean>(
    drawing.style.fillEnabled ?? true
  );
  const [fillOpacity, setFillOpacity] = useState<number>(
    drawing.style.fillOpacity ?? 20
  );

  const [reverse, setReverse] = useState<boolean>(
    (drawing.style as any).reverse ?? false
  );
  const [showPrices, setShowPrices] = useState<boolean>(
    (drawing.style as any).showPrices ?? false
  );
  const [showLevels, setShowLevels] = useState<boolean>(
    (drawing.style as any).showLevels ?? true
  );
  const [labelFormat, setLabelFormat] = useState<'values' | 'percent'>(
    (drawing.style as any).labelFormat || 'percent'
  );

  const [labelPosition, setLabelPosition] = useState<'left' | 'center' | 'right'>(
    (drawing.style as any).labelPosition || 'right'
  );
  const [labelValign, setLabelValign] = useState<'above' | 'center' | 'below'>(
    (drawing.style as any).labelValign || 'above'
  );

  const [showText, setShowText] = useState<boolean>(
    (drawing.style as any).showText ?? false
  );
  const [textHAlign, setTextHAlign] = useState<'left' | 'center' | 'right'>(
    (drawing.style as any).textAlign || 'center'
  );
  const [textVAlign, setTextVAlign] = useState<'above' | 'center' | 'below'>(
    (drawing.style as any).textValign || 'center'
  );

  const [fontSize, setFontSize] = useState<number>(
    (drawing.style as any).fontSize || 12
  );
  const [logScale, setLogScale] = useState<boolean>(
    (drawing.style as any).logScale ?? false
  );

  // ─── Coordinates State ───
  const [points, setPoints] = useState<DrawingPoint[]>(() =>
    drawing.points.map((p) => ({ time: p.time, price: p.price }))
  );

  // ─── Visibility State ───
  const [visSeconds, setVisSeconds] = useState(true);
  const [visMinutes, setVisMinutes] = useState(true);
  const [visHours, setVisHours] = useState(true);
  const [visDays, setVisDays] = useState(true);
  const [visWeeks, setVisWeeks] = useState(true);
  const [visMonths, setVisMonths] = useState(true);

  // ─── Templates ───
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const templateMenuRef = useRef<HTMLDivElement>(null);

  // Split levels into left (0..11) and right (12..23) columns
  const midPoint = Math.ceil(levels.length / 2);
  const leftColumnLevels = levels.slice(0, midPoint);
  const rightColumnLevels = levels.slice(midPoint);

  const handleLevelToggle = (actualIndex: number) => {
    setLevels((prev) =>
      prev.map((item, idx) =>
        idx === actualIndex ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  const handleLevelValChange = (actualIndex: number, val: number) => {
    setLevels((prev) =>
      prev.map((item, idx) =>
        idx === actualIndex ? { ...item, level: val } : item
      )
    );
  };

  const handleLevelColorChange = (actualIndex: number, color: string) => {
    setLevels((prev) =>
      prev.map((item, idx) =>
        idx === actualIndex ? { ...item, color } : item
      )
    );
  };

  const handleApplySingleColor = (color: string) => {
    setSingleColor(color);
    setLevels((prev) => prev.map((item) => ({ ...item, color })));
  };

  const handleSave = () => {
    const styleChanges: Partial<DrawingStyle> = {
      color: trendlineColor,
      lineWidth: levelLineWidth,
      lineStyle: levelLineStyle,
      fillEnabled,
      fillOpacity,
      levels: levels.filter((l) => l.enabled),
      ...({
        fibLevels: levels,
        showTrendline,
        trendlineColor,
        trendlineStyle,
        trendlineWidth,
        extend: extendOption,
        reverse,
        showPrices,
        showLevels,
        labelFormat,
        labelPosition,
        labelValign,
        showText,
        textAlign: textHAlign,
        textValign: textVAlign,
        fontSize,
        logScale,
      } as any),
    };

    onSave(drawing.id, styleChanges, undefined, points);
    onClose();
  };

  const toolTitle = TOOL_TITLE_MAP[drawing.type] || 'Fib Retracement';

  return (
    <div className="tv-modal-overlay" onClick={onClose}>
      <div className="tv-modal-content fib-tv-modal" onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className="tv-modal-header">
          <div className="tv-modal-title-group">
            <span className="tv-modal-title">{toolTitle}</span>
            <Pencil size={14} className="tv-modal-title-icon" />
          </div>
          <button className="tv-modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="tv-modal-tabs">
          <button
            type="button"
            className={`tv-modal-tab ${activeTab === 'corak' ? 'tv-modal-tab--active' : ''}`}
            onClick={() => setActiveTab('corak')}
          >
            Corak
          </button>
          <button
            type="button"
            className={`tv-modal-tab ${activeTab === 'koordinat' ? 'tv-modal-tab--active' : ''}`}
            onClick={() => setActiveTab('koordinat')}
          >
            Koordinat
          </button>
          <button
            type="button"
            className={`tv-modal-tab ${activeTab === 'visibilitas' ? 'tv-modal-tab--active' : ''}`}
            onClick={() => setActiveTab('visibilitas')}
          >
            Visibilitas
          </button>
        </div>

        {/* ── Body ── */}
        <div className="tv-modal-body fib-modal-scrollable">
          {activeTab === 'corak' && (
            <div className="fib-corak-container">
              {/* 1. Garis tren */}
              <div className="tv-form-row">
                <label className="tv-checkbox-label">
                  <input
                    type="checkbox"
                    className="tv-checkbox"
                    checked={showTrendline}
                    onChange={(e) => setShowTrendline(e.target.checked)}
                  />
                  <span>Garis tren</span>
                </label>
                <div className="tv-tv-combo-box">
                  <div className="tv-color-swatch-box" style={{ backgroundColor: trendlineColor }}>
                    <ColorPicker value={trendlineColor} onChange={setTrendlineColor} size={20} />
                  </div>
                  <div className="tv-line-style-select-wrap">
                    <span className="tv-line-style-preview">
                      {trendlineStyle === 'solid' ? '——' : trendlineStyle === 'dotted' ? '····' : '----'}
                    </span>
                    <select
                      className="tv-line-style-overlay-select"
                      value={trendlineStyle}
                      onChange={(e) => setTrendlineStyle(e.target.value as any)}
                    >
                      <option value="solid">—— Solid</option>
                      <option value="dashed">---- Dashed</option>
                      <option value="dotted">···· Dotted</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Garis Level */}
              <div className="tv-form-row">
                <span className="tv-form-label">Garis Level</span>
                <div className="tv-control-group">
                  <div className="tv-line-btn-wrap tv-line-btn-style">
                    <span className="tv-line-btn-preview">
                      {levelLineStyle === 'solid' ? '———' : levelLineStyle === 'dotted' ? '······' : '------'}
                    </span>
                    <select
                      className="tv-line-style-overlay-select"
                      value={levelLineStyle}
                      onChange={(e) => setLevelLineStyle(e.target.value as any)}
                    >
                      <option value="solid">——— Solid</option>
                      <option value="dashed">------ Dashed</option>
                      <option value="dotted">······ Dotted</option>
                    </select>
                  </div>
                  <div className="tv-line-btn-wrap tv-line-btn-width">
                    <div
                      className="tv-line-thickness-bar"
                      style={{ height: Math.max(1, Math.min(levelLineWidth * 1.5, 4)) }}
                    />
                    <select
                      className="tv-line-style-overlay-select"
                      value={levelLineWidth}
                      onChange={(e) => setLevelLineWidth(Number(e.target.value))}
                    >
                      <option value={1}>1px</option>
                      <option value={2}>2px</option>
                      <option value={3}>3px</option>
                      <option value={4}>4px</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. Perpanjang */}
              <div className="tv-form-row">
                <span className="tv-form-label">Perpanjang</span>
                <select
                  className="tv-select tv-select--wide"
                  value={extendOption}
                  onChange={(e) => setExtendOption(e.target.value)}
                >
                  <option value="none">Jangan perpanjang</option>
                  <option value="right">Ke kanan</option>
                  <option value="left">Ke kiri</option>
                  <option value="both">Kedua arah</option>
                </select>
              </div>

              <div className="tv-divider" />

              {/* 4. 2-Column Grid of 24 Fibonacci Levels */}
              <div className="fib-grid-2col">
                {/* Left Column */}
                <div className="fib-col">
                  {leftColumnLevels.map((item, idx) => {
                    const actualIdx = idx;
                    return (
                      <div key={actualIdx} className="fib-grid-cell">
                        <input
                          type="checkbox"
                          className="tv-checkbox"
                          checked={item.enabled}
                          onChange={() => handleLevelToggle(actualIdx)}
                        />
                        <input
                          type="number"
                          step="0.001"
                          className={`fib-val-input ${!item.enabled ? 'fib-val-input--dimmed' : ''}`}
                          value={item.level}
                          onChange={(e) =>
                            handleLevelValChange(actualIdx, parseFloat(e.target.value) || 0)
                          }
                        />
                        <ColorPicker
                          value={item.color}
                          onChange={(c) => handleLevelColorChange(actualIdx, c)}
                          size={24}
                          align="left"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Right Column */}
                <div className="fib-col">
                  {rightColumnLevels.map((item, idx) => {
                    const actualIdx = midPoint + idx;
                    return (
                      <div key={actualIdx} className="fib-grid-cell">
                        <input
                          type="checkbox"
                          className="tv-checkbox"
                          checked={item.enabled}
                          onChange={() => handleLevelToggle(actualIdx)}
                        />
                        <input
                          type="number"
                          step="0.001"
                          className={`fib-val-input ${!item.enabled ? 'fib-val-input--dimmed' : ''}`}
                          value={item.level}
                          onChange={(e) =>
                            handleLevelValChange(actualIdx, parseFloat(e.target.value) || 0)
                          }
                        />
                        <ColorPicker
                          value={item.color}
                          onChange={(c) => handleLevelColorChange(actualIdx, c)}
                          size={24}
                          align="right"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="tv-divider" />

              {/* 5. Gunakan satu warna */}
              <div className="tv-form-row">
                <span className="tv-form-label">Gunakan satu warna</span>
                <ColorPicker
                  value={singleColor || '#089981'}
                  onChange={handleApplySingleColor}
                  size={24}
                />
              </div>

              {/* 6. Latar */}
              <div className="tv-form-row">
                <label className="tv-checkbox-label">
                  <input
                    type="checkbox"
                    className="tv-checkbox"
                    checked={fillEnabled}
                    onChange={(e) => setFillEnabled(e.target.checked)}
                  />
                  <span>Latar</span>
                </label>
                <div className="fib-slider-track-wrap">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={fillOpacity}
                    onChange={(e) => setFillOpacity(Number(e.target.value))}
                    className="fib-opacity-slider"
                  />
                </div>
              </div>

              {/* 7. Membalik */}
              <div className="tv-form-row">
                <label className="tv-checkbox-label">
                  <input
                    type="checkbox"
                    className="tv-checkbox"
                    checked={reverse}
                    onChange={(e) => setReverse(e.target.checked)}
                  />
                  <span>Membalik</span>
                </label>
              </div>

              {/* 8. Harga */}
              <div className="tv-form-row">
                <label className="tv-checkbox-label">
                  <input
                    type="checkbox"
                    className="tv-checkbox"
                    checked={showPrices}
                    onChange={(e) => setShowPrices(e.target.checked)}
                  />
                  <span>Harga</span>
                </label>
              </div>

              {/* 9. Level-Level */}
              <div className="tv-form-row">
                <label className="tv-checkbox-label">
                  <input
                    type="checkbox"
                    className="tv-checkbox"
                    checked={showLevels}
                    onChange={(e) => setShowLevels(e.target.checked)}
                  />
                  <span>Level-Level</span>
                </label>
                <select
                  className="tv-select tv-select--align"
                  value={labelFormat}
                  onChange={(e) => setLabelFormat(e.target.value as any)}
                >
                  <option value="percent">Persen</option>
                  <option value="values">Nilai</option>
                </select>
              </div>

              {/* 10. Label */}
              <div className="tv-form-row">
                <span className="tv-form-label">Label</span>
                <div className="tv-control-group">
                  <select
                    className="tv-select tv-select--align"
                    value={labelPosition}
                    onChange={(e) => setLabelPosition(e.target.value as any)}
                  >
                    <option value="left">Kiri</option>
                    <option value="center">Tengah</option>
                    <option value="right">Kanan</option>
                  </select>
                  <select
                    className="tv-select tv-select--align"
                    value={labelValign}
                    onChange={(e) => setLabelValign(e.target.value as any)}
                  >
                    <option value="above">Teratas</option>
                    <option value="center">Tengah</option>
                    <option value="below">Terbawah</option>
                  </select>
                </div>
              </div>

              {/* 11. Teks */}
              <div className="tv-form-row">
                <label className="tv-checkbox-label">
                  <input
                    type="checkbox"
                    className="tv-checkbox"
                    checked={showText}
                    onChange={(e) => setShowText(e.target.checked)}
                  />
                  <span>Teks</span>
                </label>
                <div className="tv-control-group">
                  <select
                    className="tv-select tv-select--align"
                    value={textHAlign}
                    onChange={(e) => setTextHAlign(e.target.value as any)}
                  >
                    <option value="left">Kiri</option>
                    <option value="center">Tengah</option>
                    <option value="right">Kanan</option>
                  </select>
                  <select
                    className="tv-select tv-select--align"
                    value={textVAlign}
                    onChange={(e) => setTextVAlign(e.target.value as any)}
                  >
                    <option value="above">Teratas</option>
                    <option value="center">Tengah</option>
                    <option value="below">Terbawah</option>
                  </select>
                </div>
              </div>

              {/* 12. Ukuran Font */}
              <div className="tv-form-row">
                <span className="tv-form-label">Ukuran Font</span>
                <select
                  className="tv-select tv-select--align"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                >
                  {FONT_SIZES.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
              </div>

              {/* 13. Level fib berbasis skala log */}
              <div className="tv-form-row">
                <label className="tv-checkbox-label">
                  <input
                    type="checkbox"
                    className="tv-checkbox"
                    checked={logScale}
                    onChange={(e) => setLogScale(e.target.checked)}
                  />
                  <span>Level fib berbasis skala log</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'koordinat' && (
            <div className="tv-tab-pane">
              {points.map((pt, idx) => (
                <div key={idx} className="tv-coord-group">
                  <div className="tv-coord-title">Titik {idx + 1}</div>
                  <div className="tv-form-row">
                    <span className="tv-form-label">Harga</span>
                    <input
                      type="number"
                      step="any"
                      className="tv-input tv-input--full"
                      value={pt.price}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          setPoints((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, price: val } : p))
                          );
                        }
                      }}
                    />
                  </div>
                  <div className="tv-form-row">
                    <span className="tv-form-label">Waktu (Epoch)</span>
                    <input
                      type="number"
                      className="tv-input tv-input--full"
                      value={pt.time}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          setPoints((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, time: val } : p))
                          );
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'visibilitas' && (
            <div className="tv-tab-pane">
              <div className="tv-visibility-grid">
                <label className="tv-checkbox-label">
                  <input
                    type="checkbox"
                    className="tv-checkbox"
                    checked={visSeconds}
                    onChange={(e) => setVisSeconds(e.target.checked)}
                  />
                  <span>Detik</span>
                </label>
                <label className="tv-checkbox-label">
                  <input
                    type="checkbox"
                    className="tv-checkbox"
                    checked={visMinutes}
                    onChange={(e) => setVisMinutes(e.target.checked)}
                  />
                  <span>Menit</span>
                </label>
                <label className="tv-checkbox-label">
                  <input
                    type="checkbox"
                    className="tv-checkbox"
                    checked={visHours}
                    onChange={(e) => setVisHours(e.target.checked)}
                  />
                  <span>Jam</span>
                </label>
                <label className="tv-checkbox-label">
                  <input
                    type="checkbox"
                    className="tv-checkbox"
                    checked={visDays}
                    onChange={(e) => setVisDays(e.target.checked)}
                  />
                  <span>Hari</span>
                </label>
                <label className="tv-checkbox-label">
                  <input
                    type="checkbox"
                    className="tv-checkbox"
                    checked={visWeeks}
                    onChange={(e) => setVisWeeks(e.target.checked)}
                  />
                  <span>Minggu</span>
                </label>
                <label className="tv-checkbox-label">
                  <input
                    type="checkbox"
                    className="tv-checkbox"
                    checked={visMonths}
                    onChange={(e) => setVisMonths(e.target.checked)}
                  />
                  <span>Bulan</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="tv-modal-footer">
          <div className="tv-modal-footer-left" ref={templateMenuRef}>
            <button
              type="button"
              className="tv-btn tv-btn-secondary"
              onClick={() => setShowTemplateMenu(!showTemplateMenu)}
            >
              Template ▾
            </button>

            {showTemplateMenu && (
              <div className="tv-template-dropdown">
                <div
                  className="tv-template-item"
                  onClick={() => {
                    setShowTemplateMenu(false);
                    const def = getFactoryDefaultStyle(drawing.type);
                    if (def) {
                      setShowTrendline(true);
                      setTrendlineColor(def.color || '#ffffff');
                      setLevels(getInitialLevelsForDrawing({ ...drawing, style: def }));
                      setFillEnabled(def.fillEnabled ?? true);
                      setFillOpacity(def.fillOpacity ?? 20);
                    }
                  }}
                >
                  Terapkan Default
                </div>
              </div>
            )}
          </div>

          <div className="tv-modal-footer-right">
            <button type="button" className="tv-btn tv-btn-cancel" onClick={onClose}>
              Batal
            </button>
            <button type="button" className="tv-btn tv-btn-ok" onClick={handleSave}>
              Ok
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
