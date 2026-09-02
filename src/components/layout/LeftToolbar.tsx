import React, { useState, useCallback, useEffect, memo } from 'react';
import { Layers, Upload, FileUp, FolderUp } from 'lucide-react';
import { DrawingToolbar, ComingSoonToast } from '@features/drawing';
import type { ToolCategory } from '@features/drawing/types';
import { useImportData } from '@features/data';
import './LeftToolbar.css';

// Tools that are actually implemented in the Drawing Engine
const IMPLEMENTED_TOOLS = new Set([
  'crosshair', 'pointer',
  // Lines & Rays
  'trendline', 'ray', 'extended-line', 'info-line',
  'horizontal-line', 'horizontal-ray', 'vertical-line', 'cross-line', 'channel',
  // Arrows
  'arrow', 'arrow-marker', 'arrow-up', 'arrow-down',
  // Shapes
  'rectangle', 'rotated-rectangle', 'circle', 'ellipse', 'triangle', 'arc',
  'polyline', 'brush', 'highlighter', 'path', 'curve', 'double-curve',
  // Text & Annotations
  'text', 'anchored-text', 'note', 'anchored-note', 'callout', 'balloon', 'price-label',
  // Position & Pattern
  'long-position', 'short-position', 'forecast', 'bars-pattern',
  // Measurements
  'price-range', 'date-range', 'date-price-range',
  // Fibonacci & Gann
  'fib-retracement', 'fib-extension', 'fib-channel', 'fib-time-zone', 'fib-timezone', 'fib-fan',
  'gann-box', 'gann-fan',
]);

// Tools that are actions (no flyout or management actions), handled elsewhere
const ACTION_TOOLS = new Set(['favorite', 'magnet', 'settings', 'delete', 'lock', 'visibility']);

interface LeftToolbarProps {
  activeTool: string;
  magnetEnabled?: boolean;
  onSelectTool: (tool: string) => void;
  onToggleMagnet?: () => void;
  onOpenSessions?: () => void;
  onSymbolsImported?: () => void;
}

function LeftToolbar({
  activeTool,
  magnetEnabled,
  onSelectTool,
  onToggleMagnet,
  onOpenSessions,
  onSymbolsImported,
}: LeftToolbarProps) {
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [importMenuOpen, setImportMenuOpen] = useState(false);

  const { state, runImportFiles, runImportFolder } = useImportData(onSymbolsImported);

  useEffect(() => {
    if (state.status === 'done') {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Import data berhasil!' }));
    } else if (state.status === 'error') {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: `Import error: ${state.message}` }));
    }
  }, [state]);

  const handleToolSelect = useCallback(
    (toolId: string, _category: ToolCategory) => {
      onSelectTool(toolId);
      if (!IMPLEMENTED_TOOLS.has(toolId) && !ACTION_TOOLS.has(toolId)) {
        const toolName = toolId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        setToastMessage(`${toolName} Coming Soon`);
        setToastVisible(true);
      }
    },
    [onSelectTool]
  );

  const handleCloseToast = useCallback(() => {
    setToastVisible(false);
  }, []);

  return (
    <nav className="left-toolbar">
      {/* System Actions: Sessions & Import Data */}
      <div className="left-toolbar__system-group">
        {onOpenSessions && (
          <button
            className="left-toolbar__btn"
            onClick={onOpenSessions}
            title="Sessions / New Session"
          >
            <Layers size={22} />
          </button>
        )}

        <div
          tabIndex={0}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setImportMenuOpen(false);
          }}
        >
          <button
            className="left-toolbar__btn"
            onClick={() => setImportMenuOpen((v) => !v)}
            title="Import Data"
            disabled={state.status === 'importing'}
          >
            <Upload size={22} />
          </button>

          {importMenuOpen && (
            <div className="left-toolbar__menu">
              <button
                className="left-toolbar__menu-item"
                onClick={() => { setImportMenuOpen(false); runImportFiles(); }}
              >
                <FileUp size={14} />
                Import File CSV
              </button>
              <button
                className="left-toolbar__menu-item"
                onClick={() => { setImportMenuOpen(false); runImportFolder(); }}
              >
                <FolderUp size={14} />
                Import Folder
              </button>
            </div>
          )}
        </div>
      </div>

      <DrawingToolbar
        activeTool={activeTool}
        magnetEnabled={magnetEnabled}
        onToolSelect={handleToolSelect}
        onToggleMagnet={onToggleMagnet}
      />
      <ComingSoonToast message={toastMessage} visible={toastVisible} onClose={handleCloseToast} />
    </nav>
  );
}

export default memo(LeftToolbar);
