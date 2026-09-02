import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, Copy, Trash2, Layers, List, ChevronRight, Eye, EyeOff, RefreshCw } from 'lucide-react';
import type { DrawingObject } from '@/features/drawing/engine/types';
import { ToolRegistry } from '@/features/drawing/tools/ToolRegistry';
import './ContextMenu.css';

const toolRegistry = new ToolRegistry();

function getDrawingLabel(d: DrawingObject): string {
  if (d.text && d.text.trim().length > 0) {
    const cleanText = d.text.trim();
    const truncated = cleanText.length > 20 ? cleanText.slice(0, 20) + '…' : cleanText;
    return `Text: "${truncated}"`;
  }
  const tool = toolRegistry.get(d.type);
  if (tool?.label) {
    return tool.label;
  }
  return d.type
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export interface ContextMenuProps {
  x: number;
  y: number;
  clickedPrice?: number | null;
  drawings?: DrawingObject[];
  showTradeHistory?: boolean;
  onToggleTradeHistory?: () => void;
  showNewsEvents?: boolean;
  onToggleNewsEvents?: () => void;
  onClose: () => void;
  onResetView: () => void;
  onRefreshLag?: () => void;
  onCopyPrice: (priceStr: string) => void;
  onRemoveAllDrawings: () => void;
  onRemoveAllIndicators: () => void;
  onSelectDrawing?: (id: string) => void;
  onDeleteDrawing?: (id: string) => void;
  clickedDrawingId?: string | null;
}

export default function ContextMenu({
  x,
  y,
  clickedPrice,
  drawings = [],
  showTradeHistory = true,
  onToggleTradeHistory,
  showNewsEvents = true,
  onToggleNewsEvents,
  onClose,
  onResetView,
  onRefreshLag,
  onCopyPrice,
  onRemoveAllDrawings,
  onRemoveAllIndicators,
  onSelectDrawing,
  onDeleteDrawing,
  clickedDrawingId,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isObjectListOpen, setIsObjectListOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const priceFormatted =
    clickedPrice !== undefined && clickedPrice !== null
      ? (clickedPrice > 50 ? clickedPrice.toFixed(2) : clickedPrice.toFixed(5))
      : null;

  const handleCopy = () => {
    if (priceFormatted) {
      navigator.clipboard.writeText(priceFormatted);
      onCopyPrice(priceFormatted);
    }
    onClose();
  };

  const menuWidth = 250;
  const submenuWidth = 250;
  const menuHeight = 270;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);
  const shouldFlipLeft = adjustedX + menuWidth + submenuWidth + 10 > window.innerWidth;

  return (
    <div
      ref={menuRef}
      className="chart-context-menu"
      style={{ left: adjustedX, top: adjustedY }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Delete clicked drawing — shown at top when right-clicking directly on an object */}
      {clickedDrawingId && onDeleteDrawing && (() => {
        const d = drawings.find((x) => x.id === clickedDrawingId);
        return d ? (
          <>
            <button
              className="chart-context-menu__item chart-context-menu__item--danger"
              onClick={() => { onDeleteDrawing(d.id); onClose(); }}
            >
              <Trash2 size={15} />
              <span>Hapus {getDrawingLabel(d)}</span>
            </button>
            <div className="chart-context-menu__divider" />
          </>
        ) : null;
      })()}
      <button className="chart-context-menu__item" onClick={() => { onResetView(); onClose(); }}>
        <RotateCcw size={15} />
        <span>Atur Ulang Tampilan Chart</span>
      </button>

      <button
        className="chart-context-menu__item"
        onClick={() => {
          if (onRefreshLag) {
            onRefreshLag();
          } else {
            window.dispatchEvent(new CustomEvent('refresh-chart-lag'));
            window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Chart context & memory refreshed (0 lag)' }));
          }
          onClose();
        }}
      >
        <RefreshCw size={15} />
        <span>Refresh Lag</span>
      </button>

      {priceFormatted && (
        <button className="chart-context-menu__item" onClick={handleCopy}>
          <Copy size={15} />
          <span>Salin Harga ({priceFormatted})</span>
        </button>
      )}

      {onToggleTradeHistory && (
        <button
          className="chart-context-menu__item"
          onClick={() => {
            onToggleTradeHistory();
            onClose();
          }}
        >
          {showTradeHistory ? <EyeOff size={15} /> : <Eye size={15} />}
          <span>{showTradeHistory ? 'Sembunyikan Riwayat Trade' : 'Tampilkan Riwayat Trade'}</span>
        </button>
      )}

      {onToggleNewsEvents && (
        <button
          className="chart-context-menu__item"
          onClick={() => {
            onToggleNewsEvents();
            onClose();
          }}
        >
          {showNewsEvents ? <EyeOff size={15} /> : <Eye size={15} />}
          <span>{showNewsEvents ? 'Sembunyikan Berita Ekonomi' : 'Tampilkan Berita Ekonomi'}</span>
        </button>
      )}

      <div className="chart-context-menu__divider" />

      {/* Object List Submenu Trigger */}
      <div
        className="chart-context-menu__submenu-trigger"
        onMouseEnter={() => setIsObjectListOpen(true)}
        onMouseLeave={() => setIsObjectListOpen(false)}
      >
        <button
          className="chart-context-menu__item chart-context-menu__item--has-submenu"
          onClick={() => setIsObjectListOpen((prev) => !prev)}
        >
          <div className="chart-context-menu__item-left">
            <List size={15} />
            <span>Daftar Objek Gambar</span>
          </div>
          <ChevronRight size={14} className="chart-context-menu__chevron" />
        </button>

        {isObjectListOpen && (
          <div
            className={`chart-context-menu__submenu ${shouldFlipLeft ? 'chart-context-menu__submenu--left' : ''}`}
          >
            {drawings && drawings.length > 0 ? (
              <div className="chart-context-menu__object-list">
                {drawings.map((d) => (
                  <div
                    key={d.id}
                    className="chart-context-menu__object-row"
                    onClick={() => {
                      onSelectDrawing?.(d.id);
                      onClose();
                    }}
                    title={`Pilih ${getDrawingLabel(d)}`}
                  >
                    <div className="chart-context-menu__object-info">
                      {d.locked && <span className="chart-context-menu__badge" title="Terkunci">🔒</span>}
                      {d.hidden && <span className="chart-context-menu__badge" title="Tersembunyi">👁</span>}
                      <span className="chart-context-menu__object-name">{getDrawingLabel(d)}</span>
                    </div>
                    <button
                      className="chart-context-menu__object-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteDrawing?.(d.id);
                      }}
                      title="Hapus gambar"
                      aria-label="Hapus gambar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="chart-context-menu__empty-item">
                Tidak ada objek gambar
              </div>
            )}
          </div>
        )}
      </div>

      <div className="chart-context-menu__divider" />

      <button className="chart-context-menu__item" onClick={() => { onRemoveAllDrawings(); onClose(); }}>
        <Trash2 size={15} />
        <span>Hapus Semua Gambar</span>
      </button>

      <button className="chart-context-menu__item" onClick={() => { onRemoveAllIndicators(); onClose(); }}>
        <Layers size={15} />
        <span>Hapus Semua Indikator</span>
      </button>
    </div>
  );
}
