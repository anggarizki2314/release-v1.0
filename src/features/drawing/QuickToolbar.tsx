import { useState } from 'react';
import {
  Move,
  Palette,
  Minus,
  Square,
  Lock,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import {
  QUICK_TOOLBAR_COLORS,
  LINE_WIDTHS,
  LINE_STYLES,
  type LineStyleType,
} from './types';
import './QuickToolbar.css';

interface QuickToolbarProps {
  visible: boolean;
  x?: number;
  y?: number;
  onColorChange?: (color: string) => void;
  onWidthChange?: (width: number) => void;
  onStyleChange?: (style: LineStyleType) => void;
  onLockToggle?: () => void;
  onDelete?: () => void;
}

export default function QuickToolbar({
  visible,
  x = 0,
  y = 0,
  onColorChange,
  onWidthChange,
  onStyleChange,
  onLockToggle,
  onDelete,
}: QuickToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [selectedColor, setSelectedColor] = useState(QUICK_TOOLBAR_COLORS[0]);
  const [selectedWidth, setSelectedWidth] = useState(LINE_WIDTHS[0]);
  const [selectedStyle, setSelectedStyle] = useState<LineStyleType>('solid');

  if (!visible) return null;

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setShowColorPicker(false);
    onColorChange?.(color);
  };

  const handleWidthSelect = (width: number) => {
    setSelectedWidth(width);
    onWidthChange?.(width);
  };

  const handleStyleSelect = (style: LineStyleType) => {
    setSelectedStyle(style);
    setShowStyleMenu(false);
    onStyleChange?.(style);
  };

  return (
    <div
      className="quick-toolbar"
      style={{ left: x, top: y }}
    >
      <button className="quick-toolbar__btn" title="Drag">
        <Move size={14} />
      </button>

      <div className="quick-toolbar__divider" />

      <div className="quick-toolbar__color-group">
        <button
          className="quick-toolbar__btn quick-toolbar__color-btn"
          title="Color"
          onClick={() => setShowColorPicker(!showColorPicker)}
        >
          <Palette size={14} />
          <span
            className="quick-toolbar__color-swatch"
            style={{ background: selectedColor }}
          />
        </button>

        {showColorPicker && (
          <div className="quick-toolbar__color-picker">
            <div className="quick-toolbar__color-grid">
              {QUICK_TOOLBAR_COLORS.map((color) => (
                <button
                  key={color}
                  className={`quick-toolbar__color-option ${selectedColor === color ? 'is-selected' : ''}`}
                  style={{ background: color }}
                  onClick={() => handleColorSelect(color)}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="quick-toolbar__divider" />

      <button
        className="quick-toolbar__btn quick-toolbar__width-btn"
        title="Line Width"
      >
        <span className="quick-toolbar__width-indicator" style={{ height: selectedWidth }} />
      </button>

      <div className="quick-toolbar__divider" />

      <div className="quick-toolbar__style-group">
        <button
          className="quick-toolbar__btn"
          title="Line Style"
          onClick={() => setShowStyleMenu(!showStyleMenu)}
        >
          {selectedStyle === 'solid' && <Minus size={14} />}
          {selectedStyle === 'dashed' && <Square size={14} />}
          {selectedStyle === 'dotted' && <span className="quick-toolbar__dotted-icon">●●●</span>}
        </button>

        {showStyleMenu && (
          <div className="quick-toolbar__style-menu">
            {LINE_STYLES.map((style) => (
              <button
                key={style.value}
                className={`quick-toolbar__style-option ${selectedStyle === style.value ? 'is-selected' : ''}`}
                onClick={() => handleStyleSelect(style.value)}
              >
                <span className={`quick-toolbar__style-preview quick-toolbar__style-preview--${style.value}`} />
                {style.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="quick-toolbar__divider" />

      <button
        className="quick-toolbar__btn"
        title="Lock"
        onClick={onLockToggle}
      >
        <Lock size={14} />
      </button>

      <button
        className="quick-toolbar__btn quick-toolbar__btn--danger"
        title="Delete"
        onClick={onDelete}
      >
        <Trash2 size={14} />
      </button>

      <button className="quick-toolbar__btn" title="More Options">
        <MoreHorizontal size={14} />
      </button>
    </div>
  );
}
