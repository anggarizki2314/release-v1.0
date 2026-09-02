import { useState, useCallback, useRef, useEffect } from 'react';
import { Star } from 'lucide-react';
import { TOOL_CATEGORIES, type ToolCategory, type FlyoutSection } from './types';
import ToolIcon from './ToolIcon';
import './DrawingToolbar.css';

interface DrawingToolbarProps {
  activeTool?: string;
  magnetEnabled?: boolean;
  onToolSelect?: (toolId: string, category: ToolCategory) => void;
  onToggleMagnet?: () => void;
}

/**
 * TradingView-style icon-only drawing toolbar with 11 compact groups.
 */
export default function DrawingToolbar({
  activeTool = 'crosshair',
  magnetEnabled = false,
  onToolSelect,
  onToggleMagnet,
}: DrawingToolbarProps) {
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const toolbarRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close flyout on outside click
  useEffect(() => {
    if (!openCategoryId) return;
    const handleClick = (e: MouseEvent) => {
      if (
        toolbarRef.current?.contains(e.target as Node) ||
        flyoutRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpenCategoryId(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openCategoryId]);

  // Close on Escape
  useEffect(() => {
    if (!openCategoryId) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenCategoryId(null);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [openCategoryId]);

  const openCategory = useCallback((id: string) => {
    setOpenCategoryId((prev) => (prev === id ? null : id));
  }, []);

  const handleToolSelect = useCallback(
    (toolId: string, category: ToolCategory) => {
      setOpenCategoryId(null);
      onToolSelect?.(toolId, category);
    },
    [onToolSelect]
  );

  const toggleFavorite = useCallback((e: React.MouseEvent, toolId: string) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  }, []);

  const showTooltip = useCallback((text: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tooltipTimer.current = setTimeout(() => {
      setTooltip({ text, x: rect.right + 10, y: rect.top + rect.height / 2 });
    }, 300);
  }, []);

  const hideTooltip = useCallback(() => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltip(null);
  }, []);

  const openCategoryData = openCategoryId
    ? TOOL_CATEGORIES.find((c) => c.id === openCategoryId) ?? null
    : null;

  const isCategoryActive = useCallback(
    (cat: ToolCategory) => {
      if (cat.id === 'magnet') return Boolean(magnetEnabled);
      if (!activeTool) return false;
      if (cat.id === activeTool) return true;
      return cat.flyout.some((sec) => sec.tools.some((t) => t.id === activeTool));
    },
    [activeTool, magnetEnabled]
  );

  const handleCatClick = useCallback(
    (cat: ToolCategory) => {
      if (cat.id === 'magnet') {
        onToggleMagnet?.();
        return;
      }
      if (cat.isAction || cat.flyout.length === 0) {
        setOpenCategoryId(null);
        handleToolSelect(cat.id, cat);
      } else {
        openCategory(cat.id);
      }
    },
    [handleToolSelect, openCategory, onToggleMagnet]
  );

  const renderIcon = (icon: any, size = 22) => {
    if (!icon) return null;
    if (typeof icon === 'string') {
      return <ToolIcon id={icon} size={size} />;
    }
    const IconComp = icon;
    return <IconComp size={size} />;
  };

  const renderCatBtn = (cat: ToolCategory) => {
    const active = isCategoryActive(cat);
    const isOpen = openCategoryId === cat.id;
    return (
      <button
        key={cat.id}
        className={`drawing-toolbar__cat-btn ${
          active ? 'is-active' : ''
        } ${isOpen ? 'is-open' : ''} ${cat.isAction ? 'drawing-toolbar__cat-btn--action' : ''}`}
        onClick={() => handleCatClick(cat)}
        onMouseEnter={(e) => showTooltip(cat.label, e)}
        onMouseLeave={hideTooltip}
        title=""
        aria-label={cat.label}
      >
        {renderIcon(cat.icon, 22)}
      </button>
    );
  };

  const standardTools = TOOL_CATEGORIES.filter((c) => !c.isAction);
  const actionTools = TOOL_CATEGORIES.filter((c) => c.isAction);

  return (
    <div className="drawing-toolbar" ref={toolbarRef}>
      {/* ── Group category icons ── */}
      <div className="drawing-toolbar__categories">
        {standardTools.map(renderCatBtn)}
      </div>

      <div className="drawing-toolbar__divider" />

      {/* ── Action icons (Magnet & Delete) ── */}
      <div className="drawing-toolbar__actions">
        {actionTools.map(renderCatBtn)}
      </div>

      {/* ── Flyout Menu ── */}
      {openCategoryData && openCategoryData.flyout.length > 0 && (
        <div className="drawing-toolbar__flyout" ref={flyoutRef}>
          {openCategoryData.flyout.map((section: FlyoutSection, si: number) => (
            <div key={si}>
              {si > 0 && <div className="drawing-toolbar__flyout-divider" />}
              {section.label && (
                <div className="drawing-toolbar__flyout-header">{section.label}</div>
              )}
              {section.tools.map((tool) => {
                const isSelected = tool.id === activeTool;
                return (
                  <button
                    key={tool.id}
                    className={`drawing-toolbar__flyout-item ${
                      isSelected ? 'is-active' : ''
                    }`}
                    onClick={() => handleToolSelect(tool.id, openCategoryData)}
                  >
                    <ToolIcon id={tool.id} />
                    <span className="drawing-toolbar__flyout-item-label">{tool.label}</span>
                    {tool.shortcut && (
                      <span className="drawing-toolbar__flyout-item-shortcut">{tool.shortcut}</span>
                    )}
                    <span
                      className={`drawing-toolbar__flyout-item-fav ${
                        favorites.has(tool.id) ? 'is-fav' : ''
                      }`}
                      onClick={(e) => toggleFavorite(e, tool.id)}
                      title="Favorite"
                    >
                      <Star size={12} />
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ── Tooltip ── */}
      {tooltip && (
        <div className="drawing-toolbar__tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
