import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import './ColorPicker.css';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  size?: number;
  width?: number;
  height?: number;
  align?: 'left' | 'right' | 'auto';
}

export const TV_PALETTE_ROWS: string[][] = [
  // Row 0: Monochrome (White to Black)
  ['#ffffff', '#d1d4dc', '#b2b5be', '#9598a1', '#787b86', '#5d606b', '#434651', '#2a2e39', '#1e222d', '#000000'],
  // Row 1: Vivid Primary
  ['#f23645', '#ff9800', '#ffeb3b', '#22ab94', '#00bcd4', '#2962ff', '#673ab7', '#9c27b0', '#e91e63', '#00e676'],
  // Row 2: Pastel Light Tints
  ['#fccbcd', '#ffe0b2', '#fff9c4', '#c8e6c9', '#b2ebf2', '#bbdefb', '#d1c4e9', '#e1bee7', '#f8bbd0', '#b9f6ca'],
  // Row 3: Soft Tints
  ['#f89ca1', '#ffcc80', '#fff59d', '#a5d6a7', '#80deea', '#90caf9', '#b39ddb', '#ce93d8', '#f48fb1', '#69f0ae'],
  // Row 4: Medium
  ['#f4606a', '#ffb74d', '#fff176', '#81c784', '#4dd0e1', '#64b5f6', '#9575cd', '#ba68c8', '#f06292', '#00e676'],
  // Row 5: Saturated
  ['#ea2738', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#1e88e5', '#5e35b1', '#8e24aa', '#d81b60', '#00c853'],
  // Row 6: Deep Shades
  ['#b31926', '#e65100', '#f57f17', '#1b5e20', '#006064', '#0d47a1', '#311b92', '#4a148c', '#880e4f', '#1b5e20'],
  // Row 7: Darkest Tones
  ['#5c0d13', '#7a2800', '#854600', '#0d3810', '#003336', '#062047', '#180e47', '#250a47', '#420626', '#0a290c'],
];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '');
  if (h.length === 3) return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) };
  if (h.length === 6) return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  return null;
}

function parseColorWithAlpha(value: string): { hex: string; alpha: number } {
  if (!value) return { hex: '#ffffff', alpha: 100 };
  if (value === 'transparent') return { hex: '#ffffff', alpha: 0 };
  const rgbaMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
    const hex = '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return { hex, alpha: Math.round(a * 100) };
  }
  if (value.startsWith('#')) {
    return { hex: value.toLowerCase(), alpha: 100 };
  }
  return { hex: value.toLowerCase(), alpha: 100 };
}

export default function ColorPicker({
  value,
  onChange,
  size = 32,
  width,
  height,
  align = 'auto',
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'left' | 'right'>('left');
  const parsed = parseColorWithAlpha(value);
  const [currentHex, setCurrentHex] = useState(parsed.hex);
  const [opacity, setOpacity] = useState(parsed.alpha);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customHexInput, setCustomHexInput] = useState(parsed.hex);
  const wrapRef = useRef<HTMLDivElement>(null);

  const btnW = width ?? size;
  const btnH = height ?? size;

  useEffect(() => {
    const p = parseColorWithAlpha(value);
    setCurrentHex(p.hex);
    setOpacity(p.alpha);
    setCustomHexInput(p.hex);
  }, [value]);

  // Determine smart alignment when opening
  useEffect(() => {
    if (!open) return;
    if (align === 'left') {
      setPlacement('left');
      return;
    }
    if (align === 'right') {
      setPlacement('right');
      return;
    }
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      if (window.innerWidth - rect.left < 250) {
        setPlacement('right');
      } else {
        setPlacement('left');
      }
    }
  }, [open, align]);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCustomInput(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const emitColor = useCallback((hex: string, alpha: number) => {
    if (alpha === 0) {
      onChange('transparent');
    } else if (alpha === 100) {
      onChange(hex);
    } else {
      const rgb = hexToRgb(hex);
      if (rgb) {
        onChange(`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha / 100})`);
      } else {
        onChange(hex);
      }
    }
  }, [onChange]);

  const handleSelectColor = (hex: string) => {
    setCurrentHex(hex);
    setCustomHexInput(hex);
    emitColor(hex, opacity);
  };

  const handleOpacityChange = (newOpacity: number) => {
    setOpacity(newOpacity);
    emitColor(currentHex, newOpacity);
  };

  const handleCustomHexSubmit = () => {
    let h = customHexInput.trim();
    if (!h.startsWith('#')) h = '#' + h;
    if (/^#[0-9a-fA-F]{6}$/.test(h) || /^#[0-9a-fA-F]{3}$/.test(h)) {
      handleSelectColor(h);
      setShowCustomInput(false);
    }
  };

  const displayBg = opacity === 0 ? 'transparent' : opacity === 100 ? currentHex : `rgba(${hexToRgb(currentHex)?.r || 255}, ${hexToRgb(currentHex)?.g || 255}, ${hexToRgb(currentHex)?.b || 255}, ${opacity / 100})`;

  return (
    <div className="color-picker" ref={wrapRef}>
      {/* ── Trigger Button ── */}
      <button
        type="button"
        className={`color-picker__swatch ${open ? 'is-active' : ''}`}
        style={{ width: btnW, height: btnH }}
        onClick={() => setOpen(!open)}
        title={currentHex}
      >
        <span
          className="color-picker__swatch-inner"
          style={{ backgroundColor: displayBg }}
        />
      </button>

      {/* ── TradingView Color Palette Popup ── */}
      {open && (
        <div className={`color-picker__popup tv-color-popup align-${placement}`}>
          {/* Color Matrix (10 columns x 8 rows) */}
          <div className="tv-color-grid">
            {TV_PALETTE_ROWS.map((row, rowIdx) => (
              <div key={rowIdx} className="tv-color-row">
                {row.map((colorHex, colIdx) => {
                  const isSelected = currentHex.toLowerCase() === colorHex.toLowerCase();
                  return (
                    <button
                      key={colIdx}
                      type="button"
                      className={`tv-color-cell ${isSelected ? 'is-selected' : ''}`}
                      style={{ backgroundColor: colorHex }}
                      onClick={() => handleSelectColor(colorHex)}
                      title={colorHex}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="tv-color-divider" />

          {/* Bottom Actions: Custom Color + Transparency Slider */}
          <div className="tv-color-bottom">
            <div className="tv-color-custom-row">
              <button
                type="button"
                className={`tv-color-plus-btn ${showCustomInput ? 'is-active' : ''}`}
                onClick={() => setShowCustomInput(!showCustomInput)}
                title="Tambah warna kustom"
              >
                <Plus size={14} />
              </button>

              {showCustomInput && (
                <div className="tv-color-custom-input-wrap">
                  <input
                    type="text"
                    className="tv-color-hex-input"
                    placeholder="#ffffff"
                    value={customHexInput}
                    onChange={(e) => setCustomHexInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCustomHexSubmit();
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="tv-color-hex-ok-btn"
                    onClick={handleCustomHexSubmit}
                  >
                    Ok
                  </button>
                </div>
              )}
            </div>

            <div className="tv-color-trans-label">Transparansi</div>

            <div className="tv-color-slider-row">
              <div className="tv-color-slider-track-wrap">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  className="tv-color-slider"
                  value={opacity}
                  onChange={(e) => handleOpacityChange(Number(e.target.value))}
                  style={{
                    background: `linear-gradient(to right, transparent, ${currentHex})`,
                  }}
                />
              </div>
              <span className="tv-color-slider-val">{opacity}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
