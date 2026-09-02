import React, { useState, useEffect, useRef } from 'react';
import { X, Pencil, Trash2 } from 'lucide-react';
import { ColorPicker } from '@features/appearance';
import type { DrawingObject, DrawingPoint, DrawingStyle } from '../engine/types';
import {
  getTemplatesForTool,
  saveTemplate,
  deleteTemplate,
  getFactoryDefaultStyle,
  type DrawingTemplate,
} from '../services/templateService';
import './GeneralDrawingSettingsModal.css';

interface GeneralDrawingSettingsModalProps {
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

const TOOL_NAME_MAP: Record<string, string> = {
  trendline: 'Garis tren',
  ray: 'Sinar',
  'info-line': 'Garis Info',
  'extended-line': 'Garis Diperpanjang',
  'horizontal-line': 'Garis Horisontal',
  'horizontal-ray': 'Sinar Horisontal',
  'vertical-line': 'Garis Vertikal',
  'cross-line': 'Garis Silang',
  arrow: 'Panah',
  'arrow-marker': 'Penanda Panah',
  'arrow-up': 'Panah Naik',
  'arrow-down': 'Panah Turun',
  brush: 'Kuas',
  highlighter: 'Stabilo',
  path: 'Jalur',
  rectangle: 'Persegi Panjang',
  'rotated-rectangle': 'Persegi Panjang Terputar',
  circle: 'Lingkaran',
  ellipse: 'Elips',
  triangle: 'Segitiga',
  polyline: 'Poli-garis',
  curve: 'Kurva',
  'double-curve': 'Kurva Ganda',
  arc: 'Busur',
  text: 'Teks',
  'anchored-text': 'Teks Tertambat',
  note: 'Catatan',
  'anchored-note': 'Catatan Tertambat',
  callout: 'Keterangan',
  balloon: 'Balon',
  'price-label': 'Label Harga',
  'fib-retracement': 'Fib Retracement',
  fibonacci: 'Fib Retracement',
  'fib-extension': 'Fib Trend-Based Extension',
  'fib-channel': 'Kanal Fibonacci',
  'fib-time-zone': 'Zona Waktu Fib',
  'fib-timezone': 'Zona Waktu Fib',
  'fib-fan': 'Kipas Fibonacci',
  'gann-box': 'Kotak Gann',
  'gann-fan': 'Kipas Gann',
  channel: 'Saluran Paralel',
  pitchfork: 'Pitchfork',
  'schiff-pitchfork': 'Schiff Pitchfork',
  'long-position': 'Posisi Long',
  'short-position': 'Posisi Short',
  forecast: 'Prakiraan',
  'bars-pattern': 'Pola Bar',
  'price-range': 'Rentang Harga',
  'date-range': 'Rentang Tanggal',
  'date-price-range': 'Rentang Tanggal & Harga',
};

const FONT_SIZES = [10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40];

export default function GeneralDrawingSettingsModal({
  isOpen,
  onClose,
  drawing,
  onSave,
}: GeneralDrawingSettingsModalProps) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'corak' | 'teks' | 'koordinat' | 'visibilitas'>('corak');

  // ── Style State ──
  const [strokeColor, setStrokeColor] = useState(drawing.style.color || drawing.style.strokeColor || '#ff9800');
  const [opacity, setOpacity] = useState(drawing.style.opacity ?? 100);
  const [lineWidth, setLineWidth] = useState(drawing.style.lineWidth || drawing.style.strokeWidth || 2);
  const [lineStyle, setLineStyle] = useState<'solid' | 'dashed' | 'dotted'>(drawing.style.lineStyle || 'solid');
  
  // Extend & Endpoints
  const [extendOption, setExtendOption] = useState<string>(() => {
    if (drawing.type === 'ray' || drawing.type === 'horizontal-ray') return 'right';
    if (drawing.type === 'extended-line' || (drawing.style as any).extend === 'both') return 'both';
    if ((drawing.style as any).extend === 'left') return 'left';
    if ((drawing.style as any).extend === 'right') return 'right';
    return 'none';
  });
  const [showMidpoint, setShowMidpoint] = useState<boolean>((drawing.style as any).showMidpoint ?? false);
  const [showPriceLabel, setShowPriceLabel] = useState<boolean>((drawing.style as any).showPriceLabel ?? false);

  const [leftEndpoint, setLeftEndpoint] = useState<'none' | 'circle' | 'arrow'>((drawing.style as any).leftEndpoint || 'none');
  const [rightEndpoint, setRightEndpoint] = useState<'none' | 'circle' | 'arrow'>((drawing.style as any).rightEndpoint || 'none');

  // Shapes / Fill State
  const isShape =
    drawing.type === 'rectangle' ||
    drawing.type === 'rotated-rectangle' ||
    drawing.type === 'circle' ||
    drawing.type === 'ellipse' ||
    drawing.type === 'triangle' ||
    drawing.style.fillEnabled !== undefined ||
    drawing.style.fill !== undefined;

  const [fillEnabled, setFillEnabled] = useState(drawing.style.fillEnabled ?? false);
  const [fillColor, setFillColor] = useState(drawing.style.fillColor || drawing.style.fill || 'rgba(41, 98, 255, 0.2)');
  const [fillOpacity, setFillOpacity] = useState(drawing.style.fillOpacity ?? 20);

  // Info / Stats
  const [statsVisibility, setStatsVisibility] = useState<string>((drawing.style as any).statsVisibility || 'hidden');
  const [statsPosition, setStatsPosition] = useState<string>((drawing.style as any).statsPosition || 'right');
  const [alwaysShowStats, setAlwaysShowStats] = useState<boolean>((drawing.style as any).alwaysShowStats ?? false);

  // ── Text State ──
  const [textValue, setTextValue] = useState(drawing.text || (drawing.style as any).text || '');
  const [textColor, setTextColor] = useState((drawing.style as any).textColor || '#ffffff');
  const [fontSize, setFontSize] = useState((drawing.style as any).fontSize || 11);
  const [isBold, setIsBold] = useState<boolean>((drawing.style as any).bold ?? false);
  const [isItalic, setIsItalic] = useState<boolean>((drawing.style as any).italic ?? false);
  const [textValign, setTextValign] = useState<'above' | 'center' | 'below'>((drawing.style as any).textValign || 'center');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>((drawing.style as any).textAlign || 'center');

  // ── Coordinates State ──
  const [points, setPoints] = useState<DrawingPoint[]>(() =>
    drawing.points.map((p) => ({ time: p.time, price: p.price }))
  );

  // ── Visibility State ──
  const [visSeconds, setVisSeconds] = useState(true);
  const [visMinutes, setVisMinutes] = useState(true);
  const [visHours, setVisHours] = useState(true);
  const [visDays, setVisDays] = useState(true);
  const [visWeeks, setVisWeeks] = useState(true);
  const [visMonths, setVisMonths] = useState(true);

  // ── Template State ──
  const [templates, setTemplates] = useState<DrawingTemplate[]>(() => getTemplatesForTool(drawing.type));
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const templateMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTemplates(getTemplatesForTool(drawing.type));
  }, [drawing.type]);

  // Close template menu when clicking outside
  useEffect(() => {
    if (!showTemplateMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
        setShowTemplateMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTemplateMenu]);

  // Apply template
  const handleApplyTemplate = (tpl: DrawingTemplate) => {
    if (tpl.style) {
      if (tpl.style.color || tpl.style.strokeColor) setStrokeColor((tpl.style.color || tpl.style.strokeColor)!);
      if (tpl.style.opacity !== undefined) setOpacity(tpl.style.opacity);
      if (tpl.style.lineWidth !== undefined) setLineWidth(tpl.style.lineWidth);
      if (tpl.style.lineStyle) setLineStyle(tpl.style.lineStyle);
      if (tpl.style.fillEnabled !== undefined) setFillEnabled(tpl.style.fillEnabled);
      if (tpl.style.fillColor || tpl.style.fill) setFillColor((tpl.style.fillColor || tpl.style.fill)!);
      if ((tpl.style as any).textColor) setTextColor((tpl.style as any).textColor);
      if ((tpl.style as any).fontSize) setFontSize((tpl.style as any).fontSize);
      if ((tpl.style as any).bold !== undefined) setIsBold((tpl.style as any).bold);
      if ((tpl.style as any).italic !== undefined) setIsItalic((tpl.style as any).italic);
      if ((tpl.style as any).textAlign) setTextAlign((tpl.style as any).textAlign);
      if ((tpl.style as any).textValign) setTextValign((tpl.style as any).textValign);
      if ((tpl.style as any).extend) setExtendOption((tpl.style as any).extend);
      if ((tpl.style as any).showMidpoint !== undefined) setShowMidpoint((tpl.style as any).showMidpoint);
      if ((tpl.style as any).showPriceLabel !== undefined) setShowPriceLabel((tpl.style as any).showPriceLabel);
    }
    if (tpl.text !== undefined) {
      setTextValue(tpl.text);
    }
    setShowTemplateMenu(false);
  };

  // Reset to Factory Default Style
  const handleApplyDefaultStyle = () => {
    const def = getFactoryDefaultStyle(drawing.type);
    if (def.color || def.strokeColor) setStrokeColor((def.color || def.strokeColor)!);
    if (def.lineWidth !== undefined) setLineWidth(def.lineWidth);
    if (def.lineStyle) setLineStyle(def.lineStyle);
    if (def.fillEnabled !== undefined) setFillEnabled(def.fillEnabled);
    if (def.fillColor || def.fill) setFillColor((def.fillColor || def.fill)!);
    setExtendOption('none');
    setShowMidpoint(false);
    setShowPriceLabel(false);
    setStatsVisibility('hidden');
    setShowTemplateMenu(false);
  };

  // Save new Template
  const handleSaveTemplate = () => {
    if (!newTemplateName.trim()) return;
    saveTemplate(
      newTemplateName.trim(),
      drawing.type,
      {
        color: strokeColor,
        strokeColor: strokeColor,
        opacity,
        lineWidth,
        lineStyle,
        fillEnabled,
        fillColor,
        fill: fillColor,
        fillOpacity,
        textColor,
        fontSize,
        bold: isBold,
        italic: isItalic,
        textAlign,
        textValign,
        extend: extendOption,
        showMidpoint,
        showPriceLabel,
        statsVisibility,
        statsPosition,
        alwaysShowStats,
      } as any,
      textValue
    );
    setTemplates(getTemplatesForTool(drawing.type));
    setNewTemplateName('');
    setShowSaveTemplateModal(false);
  };

  // Delete Template
  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTemplate(id);
    setTemplates(getTemplatesForTool(drawing.type));
  };

  // Coordinates Point Change
  const handlePointPriceChange = (index: number, val: number) => {
    setPoints((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], price: val };
      return next;
    });
  };

  const handlePointBarTimeChange = (index: number, val: number) => {
    setPoints((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], time: val };
      return next;
    });
  };

  // Save all settings to engine
  const handleSave = () => {
    const styleChanges: Partial<DrawingStyle> = {
      color: strokeColor,
      strokeColor: strokeColor,
      opacity,
      lineWidth,
      lineStyle,
      fillEnabled,
      fillColor: fillEnabled ? fillColor : 'transparent',
      fill: fillEnabled ? fillColor : 'transparent',
      fillOpacity,
      textColor,
      fontSize,
      bold: isBold,
      italic: isItalic,
      textAlign,
      textValign,
      extend: extendOption,
      showMidpoint,
      showPriceLabel,
      leftEndpoint,
      rightEndpoint,
      statsVisibility,
      statsPosition,
      alwaysShowStats,
    } as any;

    onSave(drawing.id, styleChanges, textValue, points);
    onClose();
  };

  const toolDisplayName = TOOL_NAME_MAP[drawing.type] || drawing.type;

  return (
    <div className="tv-modal-overlay">
      <div className="tv-modal-content">
        {/* ── Modal Header ── */}
        <div className="tv-modal-header">
          <div className="tv-modal-title-group">
            <span className="tv-modal-title">{toolDisplayName}</span>
            <Pencil size={14} className="tv-modal-title-icon" />
          </div>
          <button className="tv-modal-close-btn" onClick={onClose} title="Tutup">
            <X size={16} />
          </button>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="tv-modal-tabs">
          <button
            className={`tv-modal-tab ${activeTab === 'corak' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('corak')}
          >
            Corak
          </button>
          <button
            className={`tv-modal-tab ${activeTab === 'teks' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('teks')}
          >
            Teks
          </button>
          <button
            className={`tv-modal-tab ${activeTab === 'koordinat' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('koordinat')}
          >
            Koordinat
          </button>
          <button
            className={`tv-modal-tab ${activeTab === 'visibilitas' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('visibilitas')}
          >
            Visibilitas
          </button>
        </div>

        {/* ── Modal Body ── */}
        <div className="tv-modal-body">
          {/* TAB 1: CORAK */}
          {activeTab === 'corak' && (
            <div className="tv-form-container">
              {/* Garis Row */}
              <div className="tv-form-row">
                <span className="tv-form-label">Garis</span>
                <div className="tv-form-controls-row">
                  {/* Combined Color Swatch + Line Width Box */}
                  <div className="tv-color-width-combo">
                    <div className="tv-color-swatch-box" style={{ backgroundColor: strokeColor }}>
                      <ColorPicker value={strokeColor} onChange={setStrokeColor} size={22} />
                    </div>
                    <div className="tv-line-width-divider" />
                    <div className="tv-line-width-preview" style={{ height: Math.min(lineWidth, 4) }} />
                    <select
                      className="tv-line-width-select"
                      value={lineWidth}
                      onChange={(e) => setLineWidth(Number(e.target.value))}
                    >
                      <option value={1}>1px</option>
                      <option value={2}>2px</option>
                      <option value={3}>3px</option>
                      <option value={4}>4px</option>
                      <option value={5}>5px</option>
                    </select>
                  </div>

                  {/* Left Endpoint Style Button */}
                  <button
                    type="button"
                    className={`tv-endpoint-btn ${leftEndpoint !== 'none' ? 'is-active' : ''}`}
                    onClick={() => setLeftEndpoint(leftEndpoint === 'none' ? 'circle' : leftEndpoint === 'circle' ? 'arrow' : 'none')}
                    title="Ujung Kiri"
                  >
                    {leftEndpoint === 'circle' ? (
                      <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="4" cy="7" r="2.5" fill="currentColor" />
                        <line x1="6.5" y1="7" x2="16" y2="7" />
                      </svg>
                    ) : leftEndpoint === 'arrow' ? (
                      <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M7 3L3 7L7 11" strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="3" y1="7" x2="16" y2="7" />
                      </svg>
                    ) : (
                      <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="4" cy="7" r="2" />
                        <line x1="6" y1="7" x2="16" y2="7" />
                      </svg>
                    )}
                  </button>

                  {/* Right Endpoint Style Button */}
                  <button
                    type="button"
                    className={`tv-endpoint-btn ${rightEndpoint !== 'none' ? 'is-active' : ''}`}
                    onClick={() => setRightEndpoint(rightEndpoint === 'none' ? 'circle' : rightEndpoint === 'circle' ? 'arrow' : 'none')}
                    title="Ujung Kanan"
                  >
                    {rightEndpoint === 'circle' ? (
                      <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <line x1="2" y1="7" x2="11.5" y2="7" />
                        <circle cx="14" cy="7" r="2.5" fill="currentColor" />
                      </svg>
                    ) : rightEndpoint === 'arrow' ? (
                      <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <line x1="2" y1="7" x2="15" y2="7" />
                        <path d="M11 3L15 7L11 11" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <line x1="2" y1="7" x2="12" y2="7" />
                        <circle cx="14" cy="7" r="2" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Perpanjang Row */}
              <div className="tv-form-row">
                <span className="tv-form-label">Perpanjang</span>
                <select
                  className="tv-select"
                  value={extendOption}
                  onChange={(e) => setExtendOption(e.target.value)}
                >
                  <option value="none">Jangan perpanjang</option>
                  <option value="left">Perpanjang ke kiri</option>
                  <option value="right">Perpanjang ke kanan</option>
                  <option value="both">Perpanjang kedua arah</option>
                </select>
              </div>

              {/* Custom Checkbox Titik Tengah */}
              <label className="tv-custom-checkbox">
                <input
                  type="checkbox"
                  checked={showMidpoint}
                  onChange={(e) => setShowMidpoint(e.target.checked)}
                />
                <span className="tv-checkmark" />
                <span className="tv-checkbox-label">Titik tengah</span>
              </label>

              {/* Custom Checkbox Label Harga */}
              <label className="tv-custom-checkbox">
                <input
                  type="checkbox"
                  checked={showPriceLabel}
                  onChange={(e) => setShowPriceLabel(e.target.checked)}
                />
                <span className="tv-checkmark" />
                <span className="tv-checkbox-label">Label harga</span>
              </label>

              {/* Shapes Background Fill (if applicable) */}
              {isShape && (
                <div className="tv-form-row">
                  <span className="tv-form-label">Latar</span>
                  <div className="tv-form-controls-row">
                    <label className="tv-custom-checkbox">
                      <input
                        type="checkbox"
                        checked={fillEnabled}
                        onChange={(e) => setFillEnabled(e.target.checked)}
                      />
                      <span className="tv-checkmark" />
                    </label>
                    {fillEnabled && (
                      <div className="tv-color-picker-wrap">
                        <ColorPicker value={fillColor} onChange={setFillColor} size={32} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Section INFO */}
              <div className="tv-section-title">INFO</div>

              {/* Statistik Row */}
              <div className="tv-form-row">
                <span className="tv-form-label">Statistik</span>
                <select
                  className="tv-select"
                  value={statsVisibility}
                  onChange={(e) => setStatsVisibility(e.target.value)}
                >
                  <option value="hidden">Tersembunyi</option>
                  <option value="always">Tampilkan selalu</option>
                  <option value="hover">Saat melayang</option>
                </select>
              </div>

              {/* Posisi Statistik Row */}
              <div className="tv-form-row">
                <span className="tv-form-label">Posisi statistik</span>
                <select
                  className="tv-select"
                  value={statsPosition}
                  onChange={(e) => setStatsPosition(e.target.value)}
                >
                  <option value="right">Kanan</option>
                  <option value="left">Kiri</option>
                  <option value="center">Tengah</option>
                </select>
              </div>

              {/* Custom Checkbox Selalu Tampilkan Statistik */}
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
          )}

          {/* TAB 2: TEKS */}
          {activeTab === 'teks' && (
            <div className="tv-form-container">
              {/* Text formatting bar */}
              <div className="tv-text-toolbar">
                <div className="tv-color-picker-wrap">
                  <ColorPicker value={textColor} onChange={setTextColor} size={32} />
                </div>

                <select
                  className="tv-select tv-select--compact tv-select--font"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                >
                  {FONT_SIZES.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className={`tv-format-btn ${isBold ? 'is-active' : ''}`}
                  onClick={() => setIsBold(!isBold)}
                  title="Tebal"
                >
                  B
                </button>

                <button
                  type="button"
                  className={`tv-format-btn ${isItalic ? 'is-active' : ''}`}
                  onClick={() => setIsItalic(!isItalic)}
                  title="Miring"
                >
                  <i>I</i>
                </button>
              </div>

              {/* Textarea */}
              <div className="tv-textarea-wrap">
                <textarea
                  className="tv-textarea"
                  rows={4}
                  placeholder="Tambahkan teks"
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Text Alignment Row */}
              <div className="tv-form-row">
                <span className="tv-form-label">Perataan teks</span>
                <div className="tv-form-controls-row">
                  <select
                    className="tv-select tv-select--align"
                    value={textValign}
                    onChange={(e) => setTextValign(e.target.value as any)}
                  >
                    <option value="above">Teratas</option>
                    <option value="center">Tengah</option>
                    <option value="below">Terbawah</option>
                  </select>

                  <select
                    className="tv-select tv-select--align"
                    value={textAlign}
                    onChange={(e) => setTextAlign(e.target.value as any)}
                  >
                    <option value="left">Kiri</option>
                    <option value="center">Tengah</option>
                    <option value="right">Kanan</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: KOORDINAT */}
          {activeTab === 'koordinat' && (
            <div className="tv-form-container">
              {points.map((pt, idx) => (
                <div key={idx} className="tv-coords-group">
                  <div className="tv-coords-title">Titik {idx + 1}</div>
                  <div className="tv-coords-row">
                    <div className="tv-coords-field">
                      <label className="tv-coords-label">Harga</label>
                      <input
                        type="number"
                        step="any"
                        className="tv-input tv-coords-input"
                        value={pt.price}
                        onChange={(e) => handlePointPriceChange(idx, parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="tv-coords-field">
                      <label className="tv-coords-label">Bar / Waktu</label>
                      <input
                        type="number"
                        className="tv-input tv-coords-input"
                        value={Math.round(pt.time)}
                        onChange={(e) => handlePointBarTimeChange(idx, parseInt(e.target.value, 10) || 0)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: VISIBILITAS */}
          {activeTab === 'visibilitas' && (
            <div className="tv-form-container tv-vis-container">
              <div className="tv-vis-col">
                <label className="tv-custom-checkbox">
                  <input type="checkbox" checked={visSeconds} onChange={(e) => setVisSeconds(e.target.checked)} />
                  <span className="tv-checkmark" />
                  <span className="tv-checkbox-label">Detik</span>
                </label>
                <label className="tv-custom-checkbox">
                  <input type="checkbox" checked={visMinutes} onChange={(e) => setVisMinutes(e.target.checked)} />
                  <span className="tv-checkmark" />
                  <span className="tv-checkbox-label">Menit</span>
                </label>
                <label className="tv-custom-checkbox">
                  <input type="checkbox" checked={visHours} onChange={(e) => setVisHours(e.target.checked)} />
                  <span className="tv-checkmark" />
                  <span className="tv-checkbox-label">Jam</span>
                </label>
              </div>
              <div className="tv-vis-col">
                <label className="tv-custom-checkbox">
                  <input type="checkbox" checked={visDays} onChange={(e) => setVisDays(e.target.checked)} />
                  <span className="tv-checkmark" />
                  <span className="tv-checkbox-label">Hari</span>
                </label>
                <label className="tv-custom-checkbox">
                  <input type="checkbox" checked={visWeeks} onChange={(e) => setVisWeeks(e.target.checked)} />
                  <span className="tv-checkmark" />
                  <span className="tv-checkbox-label">Minggu</span>
                </label>
                <label className="tv-custom-checkbox">
                  <input type="checkbox" checked={visMonths} onChange={(e) => setVisMonths(e.target.checked)} />
                  <span className="tv-checkmark" />
                  <span className="tv-checkbox-label">Bulan</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div className="tv-modal-footer">
          {/* Template Menu Button (Bottom Left) */}
          <div className="tv-template-wrapper" ref={templateMenuRef}>
            <button
              type="button"
              className="tv-btn tv-btn-template"
              onClick={() => setShowTemplateMenu(!showTemplateMenu)}
            >
              <span>Template</span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1 1l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Template Dropdown Popover */}
            {showTemplateMenu && (
              <div className="tv-template-dropdown">
                <button
                  type="button"
                  className="tv-template-dropdown-item tv-template-dropdown-item--action"
                  onClick={() => {
                    setShowTemplateMenu(false);
                    setShowSaveTemplateModal(true);
                  }}
                >
                  Simpan Template Gambar Sebagai...
                </button>
                <button
                  type="button"
                  className="tv-template-dropdown-item tv-template-dropdown-item--action"
                  onClick={handleApplyDefaultStyle}
                >
                  Terapkan Template Gambar Bawaan
                </button>

                <div className="tv-template-divider" />

                <div className="tv-template-list">
                  {templates.length === 0 && (
                    <div className="tv-template-empty">Belum ada template</div>
                  )}
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="tv-template-item"
                      onClick={() => handleApplyTemplate(tpl)}
                    >
                      <span className="tv-template-name">{tpl.name}</span>
                      <button
                        type="button"
                        className="tv-template-delete-btn"
                        onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                        title="Hapus template"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons (Bottom Right) */}
          <div className="tv-modal-actions">
            <button type="button" className="tv-btn tv-btn-cancel" onClick={onClose}>
              Batal
            </button>
            <button type="button" className="tv-btn tv-btn-ok" onClick={handleSave}>
              Ok
            </button>
          </div>
        </div>

        {/* ── Sub-Dialog "Simpan template gambar" ── */}
        {showSaveTemplateModal && (
          <div className="tv-submodal-overlay">
            <div className="tv-submodal-card">
              <div className="tv-submodal-header">
                <span className="tv-submodal-title">Simpan template gambar</span>
                <button
                  type="button"
                  className="tv-modal-close-btn"
                  onClick={() => setShowSaveTemplateModal(false)}
                >
                  <X size={15} />
                </button>
              </div>
              <div className="tv-submodal-body">
                <label className="tv-submodal-label">Nama template baru</label>
                <input
                  type="text"
                  className="tv-input tv-input--focus"
                  placeholder=""
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTemplate();
                  }}
                  autoFocus
                />
              </div>
              <div className="tv-submodal-footer">
                <button
                  type="button"
                  className="tv-btn tv-btn-cancel"
                  onClick={() => setShowSaveTemplateModal(false)}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className={`tv-btn ${newTemplateName.trim() ? 'tv-btn-save-active' : 'tv-btn-disabled'}`}
                  onClick={handleSaveTemplate}
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
