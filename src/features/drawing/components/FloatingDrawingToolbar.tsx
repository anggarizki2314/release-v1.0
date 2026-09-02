/**
 * FloatingDrawingToolbar — TradingView style toolbar when a drawing is selected.
 * Provides quick access to template presets, line color, text color, width, style, settings, and actions.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  GripVertical,
  Pencil,
  Type,
  Settings,
  AlarmClock,
  Lock,
  Unlock,
  Trash2,
  MoreHorizontal,
  Copy,
  EyeOff,
  RotateCcw,
  X,
} from 'lucide-react';
import { ColorPicker } from '@features/appearance';
import type { DrawingObject, DrawingStyle } from '../engine/types';
import FibonacciSettingsModal from './FibonacciSettingsModal';
import {
  getTemplatesForTool,
  saveTemplate,
  deleteTemplate,
  clearToolDefaultStyle,
  getFactoryDefaultStyle,
  type DrawingTemplate,
} from '../services/templateService';
import './FloatingDrawingToolbar.css';

interface FloatingDrawingToolbarProps {
  x: number;
  y: number;
  drawing: DrawingObject;
  containerRef?: React.RefObject<HTMLCanvasElement | HTMLElement | null>;
  onStyleChange: (id: string, changes: Partial<DrawingStyle>, text?: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onLock: (id: string) => void;
  onHide: (id: string) => void;
  onOpenSettings?: (drawing: DrawingObject) => void;
}

const LINE_WIDTHS = [1, 2, 3, 4, 5];
const LINE_STYLES: { value: DrawingStyle['lineStyle']; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

/** 4-squares template icon with '+' matching TradingView */
const TemplateGridIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 18 18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2.5" y="2.5" width="5.5" height="5.5" rx="1.5" />
    <rect x="10" y="2.5" width="5.5" height="5.5" rx="1.5" />
    <rect x="2.5" y="10" width="5.5" height="5.5" rx="1.5" />
    <rect x="10" y="10" width="5.5" height="5.5" rx="1.5" />
    <path d="M4.5 11.75v2M3.5 12.75h2" strokeWidth="1.2" />
  </svg>
);

export default function FloatingDrawingToolbar({
  x,
  y,
  drawing,
  containerRef,
  onStyleChange,
  onDuplicate,
  onDelete,
  onLock,
  onHide,
  onOpenSettings,
}: FloatingDrawingToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarSize, setToolbarSize] = useState({ width: 340, height: 42 });
  const [showWidthMenu, setShowWidthMenu] = useState(false);
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showFibModal, setShowFibModal] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templates, setTemplates] = useState<DrawingTemplate[]>(() => getTemplatesForTool(drawing.type));

  const style = drawing.style;

  const isFibonacci =
    (drawing.type as string) === 'fib-retracement' ||
    (drawing.type as string) === 'fibonacci';

  const isPosition =
    (drawing.type as string) === 'long-position' ||
    (drawing.type as string) === 'short-position';

  const strokeColor = style.strokeColor || style.color || '#ff9800';
  const textColor = (style as any).textColor || '#ffffff';

  // Measure actual DOM toolbar dimensions
  useEffect(() => {
    if (toolbarRef.current) {
      const rect = toolbarRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setToolbarSize({ width: rect.width, height: rect.height });
      }
    }
  }, [drawing.type, drawing.id, isPosition, isFibonacci]);

  // Container dimensions
  const parentElem = containerRef?.current?.parentElement || toolbarRef.current?.parentElement;
  const chartWidth = parentElem?.clientWidth || containerRef?.current?.clientWidth || 800;
  const chartHeight = parentElem?.clientHeight || containerRef?.current?.clientHeight || 600;

  const margin = 8;
  const tWidth = toolbarSize.width;
  const tHeight = toolbarSize.height;

  const minX = margin;
  const maxX = Math.max(margin, chartWidth - tWidth - margin);
  const minY = margin;
  const maxY = Math.max(margin, chartHeight - tHeight - margin);

  let finalX: number;
  let finalY: number;

  if (dragPos) {
    finalX = Math.max(minX, Math.min(dragPos.x, maxX));
    finalY = Math.max(minY, Math.min(dragPos.y, maxY));
  } else {
    const idealX = x - tWidth / 2;
    let idealY = y - tHeight - 12;

    if (idealY < minY) {
      idealY = y + 24;
    }

    finalX = Math.max(minX, Math.min(idealX, maxX));
    finalY = Math.max(minY, Math.min(idealY, maxY));
  }

  const flipDropdownUp = finalY > chartHeight - 200;

  // ── Drag Toolbar Handler ──
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = finalX;
    const initialY = finalY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const clampedX = Math.max(minX, Math.min(initialX + dx, maxX));
      const clampedY = Math.max(minY, Math.min(initialY + dy, maxY));
      setDragPos({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // ── Template helpers ──
  const refreshTemplates = useCallback(() => {
    setTemplates(getTemplatesForTool(drawing.type));
  }, [drawing.type]);

  const handleSaveTemplate = useCallback(() => {
    if (!templateName.trim()) return;
    saveTemplate(templateName.trim(), drawing.type, drawing.style, drawing.text);
    setTemplateName('');
    setShowSaveModal(false);
    refreshTemplates();
  }, [templateName, drawing.type, drawing.style, drawing.text, refreshTemplates]);

  const handleLoadTemplate = useCallback((tpl: DrawingTemplate) => {
    onStyleChange(drawing.id, tpl.style, tpl.text);
    setShowTemplates(false);
  }, [drawing.id, onStyleChange]);

  const handleDeleteTemplate = useCallback((id: string) => {
    deleteTemplate(id);
    refreshTemplates();
  }, [refreshTemplates]);

  const handleResetStyle = useCallback(() => {
    clearToolDefaultStyle(drawing.type);
    const factoryStyle = getFactoryDefaultStyle(drawing.type);
    onStyleChange(drawing.id, factoryStyle);
    setShowTemplates(false);
  }, [drawing.id, drawing.type, onStyleChange]);

  const posStyle = {
    left: `${Math.round(finalX)}px`,
    top: `${Math.round(finalY)}px`,
  };

  return (
    <>
      <div
        ref={toolbarRef}
        className={`fd-toolbar ${flipDropdownUp ? 'fd-toolbar--flip-up' : ''}`}
        style={posStyle}
      >
        {/* ── 1. Drag Handle ── */}
        <div
          className="fd-toolbar__drag-handle"
          onMouseDown={handleDragStart}
          title="Geser posisi toolbar"
        >
          <GripVertical size={14} />
        </div>

        {/* ── 2. Template Button (4 Squares Grid Icon) ── */}
        <div className="fd-toolbar__group">
          <button
            className={`fd-toolbar__btn ${showTemplates ? 'is-active' : ''}`}
            title="Template Gambar"
            onClick={() => {
              setShowTemplates(!showTemplates);
              setShowWidthMenu(false);
              setShowStyleMenu(false);
              setShowMoreMenu(false);
              refreshTemplates();
            }}
          >
            <TemplateGridIcon size={16} />
          </button>

          {/* Template Dropdown (Screenshot 2) */}
          {showTemplates && (
            <div className="fd-toolbar__dropdown fd-toolbar__dropdown--templates">
              <button
                type="button"
                className="fd-tpl__action-btn"
                onClick={() => {
                  setShowTemplates(false);
                  setShowSaveModal(true);
                }}
              >
                Simpan Template Gambar Sebagai...
              </button>
              <button
                type="button"
                className="fd-tpl__action-btn fd-tpl__action-btn--highlight"
                onClick={handleResetStyle}
              >
                Terapkan Template Gambar Bawaan
              </button>

              <div className="fd-tpl__sep" />

              <div className="fd-tpl__scroll-list">
                {templates.length === 0 && (
                  <span className="fd-tpl__empty">Belum ada template</span>
                )}
                {templates.map((tpl) => (
                  <div key={tpl.id} className="fd-tpl__item">
                    <button
                      className="fd-tpl__apply-btn"
                      onClick={() => handleLoadTemplate(tpl)}
                    >
                      {tpl.name}
                    </button>
                    <button
                      className="fd-tpl__delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTemplate(tpl.id);
                      }}
                      title="Hapus"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 3. Pencil / Line Color Button with Underline ── */}
        <div className="fd-toolbar__group" title="Warna Garis">
          <div className="fd-toolbar__btn fd-toolbar__btn--color-wrap">
            <div className="fd-color-icon">
              <Pencil size={15} />
            </div>
            <span className="fd-color-underline" style={{ backgroundColor: strokeColor }} />
            <ColorPicker
              value={strokeColor}
              onChange={(c) => {
                if (c === 'transparent') {
                  onStyleChange(drawing.id, { strokeColor: 'transparent', color: 'transparent' });
                } else {
                  onStyleChange(drawing.id, { color: c, strokeColor: c });
                }
              }}
              size={30}
            />
          </div>
        </div>

        {/* ── 4. Text / Font Color Button with Underline ── */}
        <div className="fd-toolbar__group" title="Warna Teks">
          <div className="fd-toolbar__btn fd-toolbar__btn--color-wrap">
            <div className="fd-color-icon">
              <Type size={15} />
            </div>
            <span className="fd-color-underline" style={{ backgroundColor: textColor }} />
            <ColorPicker
              value={textColor}
              onChange={(c) => {
                onStyleChange(drawing.id, { textColor: c } as any);
              }}
              size={30}
            />
          </div>
        </div>

        {/* ── 5. Line Width (e.g. — 1px) ── */}
        <div className="fd-toolbar__group">
          <button
            className="fd-toolbar__btn fd-toolbar__btn--width"
            title="Ketebalan Garis"
            onClick={() => {
              setShowWidthMenu(!showWidthMenu);
              setShowStyleMenu(false);
              setShowTemplates(false);
              setShowMoreMenu(false);
            }}
          >
            <span className="fd-toolbar__width-line" style={{ height: Math.min(style.lineWidth || 1, 3) }} />
            <span className="fd-toolbar__width-text">{style.lineWidth || 1}px</span>
          </button>
          {showWidthMenu && (
            <div className="fd-toolbar__dropdown">
              {LINE_WIDTHS.map((w) => (
                <button
                  key={w}
                  className={`fd-toolbar__dropdown-item ${style.lineWidth === w ? 'is-active' : ''}`}
                  onClick={() => {
                    onStyleChange(drawing.id, { lineWidth: w });
                    setShowWidthMenu(false);
                  }}
                >
                  <span className="fd-toolbar__width-preview" style={{ height: Math.min(w, 4) }} />
                  <span>{w}px</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── 6. Line Style (— / -- / ···) ── */}
        <div className="fd-toolbar__group">
          <button
            className="fd-toolbar__btn"
            title="Tipe Garis"
            onClick={() => {
              setShowStyleMenu(!showStyleMenu);
              setShowWidthMenu(false);
              setShowTemplates(false);
              setShowMoreMenu(false);
            }}
          >
            <span className={`fd-toolbar__style-line fd-toolbar__style-line--${style.lineStyle || 'solid'}`} />
          </button>
          {showStyleMenu && (
            <div className="fd-toolbar__dropdown">
              {LINE_STYLES.map((s) => (
                <button
                  key={s.value}
                  className={`fd-toolbar__dropdown-item ${style.lineStyle === s.value ? 'is-active' : ''}`}
                  onClick={() => {
                    onStyleChange(drawing.id, { lineStyle: s.value });
                    setShowStyleMenu(false);
                  }}
                >
                  <span className={`fd-toolbar__style-line fd-toolbar__style-line--${s.value}`} />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── 7. Settings Gear Button ── */}
        <button
          className="fd-toolbar__btn"
          title="Pengaturan"
          onClick={() => {
            if (onOpenSettings) {
              onOpenSettings(drawing);
            } else if (isFibonacci) {
              setShowFibModal(true);
            }
          }}
        >
          <Settings size={15} />
        </button>

        {/* ── 8. Alert Alarm Clock Button ── */}
        <button
          className="fd-toolbar__btn"
          title="Tambah Peringatan"
          onClick={() => {}}
        >
          <AlarmClock size={15} />
        </button>

        {/* ── 9. Lock / Unlock Button ── */}
        <button
          className="fd-toolbar__btn"
          title={drawing.locked ? 'Buka Kunci' : 'Kunci'}
          onClick={() => onLock(drawing.id)}
        >
          {drawing.locked ? <Lock size={15} className="is-active" /> : <Unlock size={15} />}
        </button>

        {/* ── 10. Delete Button ── */}
        <button
          className="fd-toolbar__btn fd-toolbar__btn--danger"
          title="Hapus"
          onClick={() => onDelete(drawing.id)}
        >
          <Trash2 size={15} />
        </button>

        {/* ── 11. More Actions (...) Button ── */}
        <div className="fd-toolbar__group">
          <button
            className={`fd-toolbar__btn ${showMoreMenu ? 'is-active' : ''}`}
            title="Lainnya"
            onClick={() => {
              setShowMoreMenu(!showMoreMenu);
              setShowTemplates(false);
              setShowWidthMenu(false);
              setShowStyleMenu(false);
            }}
          >
            <MoreHorizontal size={15} />
          </button>

          {showMoreMenu && (
            <div className="fd-toolbar__dropdown fd-toolbar__dropdown--more">
              <button
                className="fd-toolbar__dropdown-item"
                onClick={() => {
                  onDuplicate(drawing.id);
                  setShowMoreMenu(false);
                }}
              >
                <Copy size={13} />
                <span>Duplikat</span>
              </button>
              <button
                className="fd-toolbar__dropdown-item"
                onClick={() => {
                  onHide(drawing.id);
                  setShowMoreMenu(false);
                }}
              >
                <EyeOff size={13} />
                <span>Sembunyikan</span>
              </button>
              <div className="fd-tpl__sep" />
              <button
                className="fd-toolbar__dropdown-item"
                onClick={() => {
                  handleResetStyle();
                  setShowMoreMenu(false);
                }}
              >
                <RotateCcw size={13} />
                <span>Reset Style Bawaan</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Sub-Dialog "Simpan Template Gambar" (Screenshot 2) ── */}
      {showSaveModal && (
        <div className="tv-submodal-overlay">
          <div className="tv-submodal-card">
            <div className="tv-submodal-header">
              <span className="tv-submodal-title">Simpan template gambar</span>
              <button
                type="button"
                className="tv-modal-close-btn"
                onClick={() => setShowSaveModal(false)}
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
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
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
                onClick={() => setShowSaveModal(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className={`tv-btn ${templateName.trim() ? 'tv-btn-save-active' : 'tv-btn-disabled'}`}
                onClick={handleSaveTemplate}
                disabled={!templateName.trim()}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fibonacci Settings Modal ── */}
      {showFibModal && (
        <FibonacciSettingsModal
          isOpen={showFibModal}
          onClose={() => setShowFibModal(false)}
          drawing={drawing}
          onSave={(id, changes) => onStyleChange(id, changes)}
        />
      )}
    </>
  );
}

