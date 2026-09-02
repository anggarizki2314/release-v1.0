import React, { useState, useEffect, useRef } from 'react';
import { X, Pencil } from 'lucide-react';
import { ColorPicker } from '@features/appearance';
import type { DrawingObject, DrawingPoint, DrawingStyle } from '../engine/types';
import {
  getTemplatesForTool,
  saveTemplate,
  deleteTemplate,
  getFactoryDefaultStyle,
  type DrawingTemplate,
} from '../services/templateService';
import './PositionDrawingSettingsModal.css';

interface PositionDrawingSettingsModalProps {
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

const FONT_SIZES = [10, 11, 12, 14, 16, 20, 24];

export default function PositionDrawingSettingsModal({
  isOpen,
  onClose,
  drawing,
  onSave,
}: PositionDrawingSettingsModalProps) {
  if (!isOpen) return null;

  const isLong = drawing.type === 'long-position';
  const toolTitle = isLong ? 'Posisi Pembelian' : 'Posisi Penjualan';

  const [activeTab, setActiveTab] = useState<'input' | 'corak' | 'visibilitas'>('input');

  // ── Points & Coordinates ──
  const p0 = drawing.points[0] || { time: 0, price: 0 };
  const p1 = drawing.points[1] || { time: 0, price: 0 };
  const p2 = drawing.points[2] || { time: 0, price: 0 };

  const [entryPrice, setEntryPrice] = useState<number>(p0.price);
  const [stopPrice, setStopPrice] = useState<number>(p1.price);
  const [targetPrice, setTargetPrice] = useState<number>(
    p2.price !== 0 ? p2.price : isLong ? p0.price + Math.abs(p0.price - p1.price) * 2 : p0.price - Math.abs(p0.price - p1.price) * 2
  );

  // Estimate pip size / tick size for point-to-tick conversion
  const pipSize = entryPrice > 100 ? 0.01 : entryPrice > 10 ? 0.001 : 0.0001;

  const [profitTicks, setProfitTicks] = useState<number>(() => {
    const diff = Math.abs(targetPrice - entryPrice);
    return Math.round(diff / pipSize);
  });

  const [stopTicks, setStopTicks] = useState<number>(() => {
    const diff = Math.abs(entryPrice - stopPrice);
    return Math.round(diff / pipSize);
  });

  // Handle Target Price / Ticks updates
  const handleProfitTicksChange = (ticks: number) => {
    setProfitTicks(ticks);
    const newTarget = isLong ? entryPrice + ticks * pipSize : entryPrice - ticks * pipSize;
    setTargetPrice(parseFloat(newTarget.toFixed(5)));
  };

  const handleProfitPriceChange = (price: number) => {
    setTargetPrice(price);
    const diff = Math.abs(price - entryPrice);
    setProfitTicks(Math.round(diff / pipSize));
  };

  // Handle Stop Price / Ticks updates
  const handleStopTicksChange = (ticks: number) => {
    setStopTicks(ticks);
    const newStop = isLong ? entryPrice - ticks * pipSize : entryPrice + ticks * pipSize;
    setStopPrice(parseFloat(newStop.toFixed(5)));
  };

  const handleStopPriceChange = (price: number) => {
    setStopPrice(price);
    const diff = Math.abs(price - entryPrice);
    setStopTicks(Math.round(diff / pipSize));
  };

  // ── Input Tab State ──
  const [accountSize, setAccountSize] = useState<number>((drawing.style as any).accountSize ?? 1000);
  const [accountCurrency, setAccountCurrency] = useState<string>((drawing.style as any).accountCurrency ?? 'Bawaan');
  const [lotSize, setLotSize] = useState<number>((drawing.style as any).lotSize ?? 1);
  const [riskValue, setRiskValue] = useState<number>((drawing.style as any).riskValue ?? 25.00);
  const [riskType, setRiskType] = useState<'PERCENT' | 'CASH'>((drawing.style as any).riskType ?? 'PERCENT');
  const [leverage, setLeverage] = useState<number>((drawing.style as any).leverage ?? 10000.0);
  const [quantityPrecision, setQuantityPrecision] = useState<string>((drawing.style as any).quantityPrecision ?? 'Bawaan');

  // ── Corak / Style Tab State ──
  const [lineColor, setLineColor] = useState(drawing.style.color || '#787b86');
  const [lineStyle, setLineStyle] = useState<'solid' | 'dashed' | 'dotted'>(drawing.style.lineStyle || 'solid');
  const [stopColor, setStopColor] = useState((drawing.style as any).slColor || (drawing.style as any).stopColor || 'rgba(242, 54, 69, 0.45)');
  const [targetColor, setTargetColor] = useState((drawing.style as any).tpColor || (drawing.style as any).targetColor || 'rgba(34, 171, 148, 0.45)');
  const [textColor, setTextColor] = useState((drawing.style as any).textColor || '#ffffff');
  const [fontSize, setFontSize] = useState<number>((drawing.style as any).fontSize || 12);
  const [showPriceLabel, setShowPriceLabel] = useState<boolean>((drawing.style as any).showPriceLabel ?? true);
  const [statsMode, setStatsMode] = useState<string>((drawing.style as any).statsMode ?? 'all');
  const [compactStats, setCompactStats] = useState<boolean>((drawing.style as any).compactStats ?? false);
  const [alwaysShowStats, setAlwaysShowStats] = useState<boolean>((drawing.style as any).alwaysShowStats ?? true);

  // ── Visibility Tab State ──
  const [visTick, setVisTick] = useState(true);
  const [visSeconds, setVisSeconds] = useState(true);
  const [visMinutes, setVisMinutes] = useState(true);
  const [visHours, setVisHours] = useState(true);
  const [visDays, setVisDays] = useState(true);
  const [visWeeks, setVisWeeks] = useState(true);
  const [visMonths, setVisMonths] = useState(true);
  const [visRanges, setVisRanges] = useState(true);

  // ── Template Dropdown State ──
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [templates, setTemplates] = useState<DrawingTemplate[]>(() => getTemplatesForTool(drawing.type));
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const templateWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (templateWrapRef.current && !templateWrapRef.current.contains(e.target as Node)) {
        setTemplateMenuOpen(false);
      }
    };
    if (templateMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [templateMenuOpen]);

  const handleApplyTemplate = (tpl: DrawingTemplate) => {
    if (tpl.style.color) setLineColor(tpl.style.color);
    if ((tpl.style as any).slColor) setStopColor((tpl.style as any).slColor);
    if ((tpl.style as any).tpColor) setTargetColor((tpl.style as any).tpColor);
    if ((tpl.style as any).textColor) setTextColor((tpl.style as any).textColor);
    if ((tpl.style as any).fontSize) setFontSize((tpl.style as any).fontSize);
    setTemplateMenuOpen(false);
  };

  const handleSaveTemplateSubmit = () => {
    if (!newTemplateName.trim()) return;
    const currentStyle: Partial<DrawingStyle> = {
      color: lineColor,
      lineStyle,
      tpColor: targetColor,
      slColor: stopColor,
      textColor,
      fontSize,
      showPriceLabel,
      compactStats,
      alwaysShowStats,
      accountSize,
      accountCurrency,
      lotSize,
      riskValue,
      riskType,
      leverage,
      quantityPrecision,
    } as any;
    const saved = saveTemplate(drawing.type, newTemplateName.trim(), currentStyle);
    setTemplates(getTemplatesForTool(drawing.type));
    setNewTemplateName('');
    setShowSaveTemplateDialog(false);
    setTemplateMenuOpen(false);
  };

  const handleResetDefaults = () => {
    const factory = getFactoryDefaultStyle(drawing.type);
    setLineColor(factory.color || '#787b86');
    setStopColor('rgba(242, 54, 69, 0.45)');
    setTargetColor('rgba(34, 171, 148, 0.45)');
    setTextColor('#ffffff');
    setFontSize(12);
    setShowPriceLabel(true);
    setCompactStats(false);
    setAlwaysShowStats(true);
    setTemplateMenuOpen(false);
  };

  // ── Save & Apply Handler ──
  const handleOk = () => {
    const styleChanges: Partial<DrawingStyle> = {
      color: lineColor,
      lineStyle,
      tpColor: targetColor,
      slColor: stopColor,
      targetColor,
      stopColor,
      textColor,
      fontSize,
      showPriceLabel,
      compactStats,
      alwaysShowStats,
      accountSize,
      accountCurrency,
      lotSize,
      riskValue,
      riskType,
      leverage,
      quantityPrecision,
    } as any;

    const newPoints: DrawingPoint[] = [
      { time: p0.time, price: entryPrice },
      { time: p1.time, price: stopPrice },
      { time: p2.time !== 0 ? p2.time : p0.time, price: targetPrice },
    ];

    onSave(drawing.id, styleChanges, drawing.text, newPoints);
    onClose();
  };

  return (
    <div className="tv-modal-overlay" onClick={onClose}>
      <div className="tv-modal-content tv-position-modal" onClick={(e) => e.stopPropagation()}>
        {/* ── Modal Header ── */}
        <div className="tv-modal-header">
          <div className="tv-modal-title-group">
            <span className="tv-modal-title">{toolTitle}</span>
            <Pencil size={15} className="tv-modal-title-icon" />
          </div>
          <button className="tv-modal-close-btn" onClick={onClose} title="Tutup">
            <X size={18} />
          </button>
        </div>

        {/* ── Tabs Navigation ── */}
        <div className="tv-modal-tabs">
          <button
            type="button"
            className={`tv-modal-tab ${activeTab === 'input' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('input')}
          >
            Input
          </button>
          <button
            type="button"
            className={`tv-modal-tab ${activeTab === 'corak' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('corak')}
          >
            Corak
          </button>
          <button
            type="button"
            className={`tv-modal-tab ${activeTab === 'visibilitas' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('visibilitas')}
          >
            Visibilitas
          </button>
        </div>

        {/* ── Modal Body ── */}
        <div className="tv-modal-body tv-position-body">
          {/* TAB 1: INPUT */}
          {activeTab === 'input' && (
            <div className="tv-position-form">
              {/* Ukuran akun */}
              <div className="tv-pos-row">
                <label className="tv-pos-label">Ukuran akun</label>
                <div className="tv-pos-input-group">
                  <input
                    type="number"
                    className="tv-pos-input tv-pos-input--number"
                    value={accountSize}
                    onChange={(e) => setAccountSize(parseFloat(e.target.value) || 0)}
                  />
                  <select
                    className="tv-pos-select"
                    value={accountCurrency}
                    onChange={(e) => setAccountCurrency(e.target.value)}
                  >
                    <option value="Bawaan">Bawaan</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="IDR">IDR</option>
                    <option value="JPY">JPY</option>
                  </select>
                </div>
              </div>

              {/* Ukuran lot */}
              <div className="tv-pos-row">
                <label className="tv-pos-label">Ukuran lot</label>
                <div className="tv-pos-control-group">
                  <input
                    type="number"
                    className="tv-pos-input"
                    value={lotSize}
                    onChange={(e) => setLotSize(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Risiko */}
              <div className="tv-pos-row">
                <label className="tv-pos-label">Risiko</label>
                <div className="tv-pos-input-group">
                  <input
                    type="number"
                    step="0.01"
                    className="tv-pos-input tv-pos-input--number"
                    value={riskValue}
                    onChange={(e) => setRiskValue(parseFloat(e.target.value) || 0)}
                  />
                  <select
                    className="tv-pos-select"
                    value={riskType}
                    onChange={(e) => setRiskType(e.target.value as any)}
                  >
                    <option value="PERCENT">%</option>
                    <option value="CASH">USD</option>
                  </select>
                </div>
              </div>

              {/* Harga entri */}
              <div className="tv-pos-row">
                <label className="tv-pos-label">Harga entri</label>
                <div className="tv-pos-control-group">
                  <input
                    type="number"
                    step="any"
                    className="tv-pos-input"
                    value={entryPrice}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setEntryPrice(val);
                      if (val > 0) {
                        const newTarget = isLong ? val + profitTicks * pipSize : val - profitTicks * pipSize;
                        const newStop = isLong ? val - stopTicks * pipSize : val + stopTicks * pipSize;
                        setTargetPrice(parseFloat(newTarget.toFixed(5)));
                        setStopPrice(parseFloat(newStop.toFixed(5)));
                      }
                    }}
                  />
                </div>
              </div>

              {/* Leverage */}
              <div className="tv-pos-row">
                <label className="tv-pos-label">Leverage</label>
                <div className="tv-pos-control-group">
                  <input
                    type="number"
                    step="any"
                    className="tv-pos-input"
                    value={leverage}
                    onChange={(e) => setLeverage(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* LEVEL PROFIT */}
              <div className="tv-pos-section-divider">
                <span className="tv-pos-section-title">LEVEL PROFIT</span>
              </div>

              {/* Profit Tick */}
              <div className="tv-pos-row">
                <label className="tv-pos-label">Tick</label>
                <div className="tv-pos-control-group">
                  <input
                    type="number"
                    className="tv-pos-input"
                    value={profitTicks}
                    onChange={(e) => handleProfitTicksChange(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              </div>

              {/* Profit Harga */}
              <div className="tv-pos-row">
                <label className="tv-pos-label">Harga</label>
                <div className="tv-pos-control-group">
                  <input
                    type="number"
                    step="any"
                    className="tv-pos-input"
                    value={targetPrice}
                    onChange={(e) => handleProfitPriceChange(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* LEVEL STOP */}
              <div className="tv-pos-section-divider">
                <span className="tv-pos-section-title">LEVEL STOP</span>
              </div>

              {/* Stop Tick */}
              <div className="tv-pos-row">
                <label className="tv-pos-label">Tick</label>
                <div className="tv-pos-control-group">
                  <input
                    type="number"
                    className="tv-pos-input"
                    value={stopTicks}
                    onChange={(e) => handleStopTicksChange(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              </div>

              {/* Stop Harga */}
              <div className="tv-pos-row">
                <label className="tv-pos-label">Harga</label>
                <div className="tv-pos-control-group">
                  <input
                    type="number"
                    step="any"
                    className="tv-pos-input"
                    value={stopPrice}
                    onChange={(e) => handleStopPriceChange(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* KUANTITAS presisi */}
              <div className="tv-pos-row">
                <label className="tv-pos-label">KUANTITAS presisi</label>
                <div className="tv-pos-control-group">
                  <select
                    className="tv-pos-select tv-pos-select--full"
                    value={quantityPrecision}
                    onChange={(e) => setQuantityPrecision(e.target.value)}
                  >
                    <option value="Bawaan">Bawaan</option>
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CORAK / STYLE */}
          {activeTab === 'corak' && (
            <div className="tv-position-form">
              {/* Garis */}
              <div className="tv-pos-row">
                <label className="tv-pos-label">Garis</label>
                <div className="tv-pos-control-group">
                  <ColorPicker value={lineColor} onChange={setLineColor} width={44} height={28} align="left" />
                  <div className="tv-pos-line-preview" title="Garis Standar">
                    <div className={`tv-line-sample tv-line-sample--${lineStyle}`} />
                  </div>
                </div>
              </div>

              {/* Warna stop */}
              <div className="tv-pos-row">
                <label className="tv-pos-label">Warna stop</label>
                <div className="tv-pos-control-group">
                  <ColorPicker value={stopColor} onChange={setStopColor} width={44} height={28} align="left" />
                </div>
              </div>

              {/* Warna target */}
              <div className="tv-pos-row">
                <label className="tv-pos-label">Warna target</label>
                <div className="tv-pos-control-group">
                  <ColorPicker value={targetColor} onChange={setTargetColor} width={44} height={28} align="left" />
                </div>
              </div>

              {/* Teks */}
              <div className="tv-pos-row">
                <label className="tv-pos-label">Teks</label>
                <div className="tv-pos-control-group">
                  <ColorPicker value={textColor} onChange={setTextColor} width={44} height={28} align="left" />
                  <select
                    className="tv-pos-select tv-pos-select--compact"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                  >
                    {FONT_SIZES.map((sz) => (
                      <option key={sz} value={sz}>
                        {sz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Label harga */}
              <div className="tv-pos-checkbox-row">
                <label className="tv-custom-checkbox">
                  <input
                    type="checkbox"
                    checked={showPriceLabel}
                    onChange={(e) => setShowPriceLabel(e.target.checked)}
                  />
                  <span className="tv-checkmark" />
                  <span className="tv-checkbox-label">Label harga</span>
                </label>
              </div>

              {/* INFO SECTION */}
              <div className="tv-pos-section-divider">
                <span className="tv-pos-section-title">INFO</span>
              </div>

              {/* Statistik Dropdown */}
              <div className="tv-pos-row">
                <label className="tv-pos-label">Statistik</label>
                <div className="tv-pos-control-group">
                  <select
                    className="tv-pos-select tv-pos-select--full"
                    value={statsMode}
                    onChange={(e) => setStatsMode(e.target.value)}
                  >
                    <option value="all">Offset harga TP, Offs...</option>
                    <option value="compact">Offset harga TP, Offset SL, Rasio R:R</option>
                    <option value="rr_only">Hanya Rasio Risiko / Hasil</option>
                  </select>
                </div>
              </div>

              {/* Mode statistik ringkas */}
              <div className="tv-pos-checkbox-row">
                <label className="tv-custom-checkbox">
                  <input
                    type="checkbox"
                    checked={compactStats}
                    onChange={(e) => setCompactStats(e.target.checked)}
                  />
                  <span className="tv-checkmark" />
                  <span className="tv-checkbox-label">Mode statistik ringkas</span>
                </label>
              </div>

              {/* Selalu tampilkan statistik */}
              <div className="tv-pos-checkbox-row">
                <label className="tv-custom-checkbox">
                  <input
                    type="checkbox"
                    checked={alwaysShowStats}
                    onChange={(e) => setAlwaysShowStats(e.target.checked)}
                  />
                  <span className="tv-checkmark" />
                  <span className="tv-checkbox-label">Selalu tampilkan statistik</span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: VISIBILITAS */}
          {activeTab === 'visibilitas' && (
            <div className="tv-visibility-list">
              <label className="tv-custom-checkbox tv-vis-item">
                <input type="checkbox" checked={visTick} onChange={(e) => setVisTick(e.target.checked)} />
                <span className="tv-checkmark" />
                <span className="tv-checkbox-label">Tick</span>
              </label>

              <div className="tv-vis-slider-row">
                <label className="tv-custom-checkbox tv-vis-item">
                  <input type="checkbox" checked={visSeconds} onChange={(e) => setVisSeconds(e.target.checked)} />
                  <span className="tv-checkmark" />
                  <span className="tv-checkbox-label">Detik</span>
                </label>
                <div className="tv-vis-range-wrap">
                  <input type="number" className="tv-vis-input" value="1" readOnly />
                  <div className="tv-vis-slider-track">
                    <span className="tv-vis-slider-thumb" />
                  </div>
                  <input type="number" className="tv-vis-input" value="59" readOnly />
                </div>
              </div>

              <div className="tv-vis-slider-row">
                <label className="tv-custom-checkbox tv-vis-item">
                  <input type="checkbox" checked={visMinutes} onChange={(e) => setVisMinutes(e.target.checked)} />
                  <span className="tv-checkmark" />
                  <span className="tv-checkbox-label">Menit</span>
                </label>
                <div className="tv-vis-range-wrap">
                  <input type="number" className="tv-vis-input" value="1" readOnly />
                  <div className="tv-vis-slider-track">
                    <span className="tv-vis-slider-thumb" />
                  </div>
                  <input type="number" className="tv-vis-input" value="59" readOnly />
                </div>
              </div>

              <div className="tv-vis-slider-row">
                <label className="tv-custom-checkbox tv-vis-item">
                  <input type="checkbox" checked={visHours} onChange={(e) => setVisHours(e.target.checked)} />
                  <span className="tv-checkmark" />
                  <span className="tv-checkbox-label">Jam</span>
                </label>
                <div className="tv-vis-range-wrap">
                  <input type="number" className="tv-vis-input" value="1" readOnly />
                  <div className="tv-vis-slider-track">
                    <span className="tv-vis-slider-thumb" />
                  </div>
                  <input type="number" className="tv-vis-input" value="24" readOnly />
                </div>
              </div>

              <div className="tv-vis-slider-row">
                <label className="tv-custom-checkbox tv-vis-item">
                  <input type="checkbox" checked={visDays} onChange={(e) => setVisDays(e.target.checked)} />
                  <span className="tv-checkmark" />
                  <span className="tv-checkbox-label">Hari</span>
                </label>
                <div className="tv-vis-range-wrap">
                  <input type="number" className="tv-vis-input" value="1" readOnly />
                  <div className="tv-vis-slider-track">
                    <span className="tv-vis-slider-thumb" />
                  </div>
                  <input type="number" className="tv-vis-input" value="366" readOnly />
                </div>
              </div>

              <div className="tv-vis-slider-row">
                <label className="tv-custom-checkbox tv-vis-item">
                  <input type="checkbox" checked={visWeeks} onChange={(e) => setVisWeeks(e.target.checked)} />
                  <span className="tv-checkmark" />
                  <span className="tv-checkbox-label">Minggu</span>
                </label>
                <div className="tv-vis-range-wrap">
                  <input type="number" className="tv-vis-input" value="1" readOnly />
                  <div className="tv-vis-slider-track">
                    <span className="tv-vis-slider-thumb" />
                  </div>
                  <input type="number" className="tv-vis-input" value="52" readOnly />
                </div>
              </div>

              <div className="tv-vis-slider-row">
                <label className="tv-custom-checkbox tv-vis-item">
                  <input type="checkbox" checked={visMonths} onChange={(e) => setVisMonths(e.target.checked)} />
                  <span className="tv-checkmark" />
                  <span className="tv-checkbox-label">Bulan</span>
                </label>
                <div className="tv-vis-range-wrap">
                  <input type="number" className="tv-vis-input" value="1" readOnly />
                  <div className="tv-vis-slider-track">
                    <span className="tv-vis-slider-thumb" />
                  </div>
                  <input type="number" className="tv-vis-input" value="12" readOnly />
                </div>
              </div>

              <label className="tv-custom-checkbox tv-vis-item">
                <input type="checkbox" checked={visRanges} onChange={(e) => setVisRanges(e.target.checked)} />
                <span className="tv-checkmark" />
                <span className="tv-checkbox-label">Ranges</span>
              </label>
            </div>
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div className="tv-modal-footer">
          {/* Template Button */}
          <div className="tv-template-wrap" ref={templateWrapRef}>
            <button
              type="button"
              className="tv-btn tv-btn--ghost tv-template-btn"
              onClick={() => setTemplateMenuOpen(!templateMenuOpen)}
            >
              Template <span className="tv-chevron">▾</span>
            </button>

            {templateMenuOpen && (
              <div className="tv-template-menu">
                <button
                  type="button"
                  className="tv-template-item"
                  onClick={() => setShowSaveTemplateDialog(true)}
                >
                  Simpan Sebagai...
                </button>
                <button
                  type="button"
                  className="tv-template-item"
                  onClick={handleResetDefaults}
                >
                  Terapkan Bawaan
                </button>
                {templates.length > 0 && <div className="tv-template-divider" />}
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    className="tv-template-item"
                    onClick={() => handleApplyTemplate(tpl)}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="tv-footer-actions">
            <button type="button" className="tv-btn tv-btn--secondary" onClick={onClose}>
              Batal
            </button>
            <button type="button" className="tv-btn tv-btn--primary" onClick={handleOk}>
              Ok
            </button>
          </div>
        </div>

        {/* Save Template Modal Prompt */}
        {showSaveTemplateDialog && (
          <div className="tv-save-template-overlay" onClick={() => setShowSaveTemplateDialog(false)}>
            <div className="tv-save-template-dialog" onClick={(e) => e.stopPropagation()}>
              <h4 className="tv-save-template-title">Simpan Template</h4>
              <input
                type="text"
                className="tv-pos-input tv-pos-input--full"
                placeholder="Nama template..."
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                autoFocus
              />
              <div className="tv-save-template-actions">
                <button
                  type="button"
                  className="tv-btn tv-btn--secondary"
                  onClick={() => setShowSaveTemplateDialog(false)}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="tv-btn tv-btn--primary"
                  onClick={handleSaveTemplateSubmit}
                  disabled={!newTemplateName.trim()}
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
