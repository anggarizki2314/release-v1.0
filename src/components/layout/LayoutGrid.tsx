import { CSSProperties, useState, useCallback, useRef } from 'react';
import { useWorkspace, PANE_COUNT } from '@features/workspace/WorkspaceManager';
import type { LayoutMode } from '@features/workspace/types';
import PaneContainer from './PaneContainer';
import type { SymbolInfo } from '@/types';
import type { AnalyticsSession } from '@features/analytics/types';

interface LayoutGridProps {
  symbols: SymbolInfo[];
  timezone: string;
  activeTool: string;
  magnetEnabled?: boolean;
  onActiveToolChange: (tool: string) => void;
  style?: CSSProperties;
  activeSession?: AnalyticsSession | null;
}

const getGridDimensions = (mode: LayoutMode) => {
  if (mode === '1') return { cols: 1, rows: 1 };
  if (mode === '2v') return { cols: 2, rows: 1 };
  if (mode === '2h') return { cols: 1, rows: 2 };
  if (['3l', '3r', '4'].includes(mode)) return { cols: 2, rows: 2 };
  if (['3t', '3b', '6'].includes(mode)) return { cols: 3, rows: 2 };
  if (mode === '8') return { cols: 4, rows: 2 };
  return { cols: 1, rows: 1 };
};

const GRID_CONTAINER_STYLES: Record<LayoutMode, CSSProperties> = {
  '1':  { display: 'grid', gridTemplateColumns: '1fr',          gridTemplateRows: '1fr',       width: '100%', height: '100%' },
  '2v': { display: 'grid', gridTemplateColumns: '1fr 1fr',      gridTemplateRows: '1fr',       width: '100%', height: '100%' },
  '2h': { display: 'grid', gridTemplateColumns: '1fr',          gridTemplateRows: '1fr 1fr',   width: '100%', height: '100%' },
  '3l': { display: 'grid', gridTemplateColumns: '1fr 1fr',      gridTemplateRows: '1fr 1fr',   width: '100%', height: '100%' },
  '3r': { display: 'grid', gridTemplateColumns: '1fr 1fr',      gridTemplateRows: '1fr 1fr',   width: '100%', height: '100%' },
  '3t': { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',  gridTemplateRows: '1fr 1fr',   width: '100%', height: '100%' },
  '3b': { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',  gridTemplateRows: '1fr 1fr',   width: '100%', height: '100%' },
  '4':  { display: 'grid', gridTemplateColumns: '1fr 1fr',      gridTemplateRows: '1fr 1fr',   width: '100%', height: '100%' },
  '6':  { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',  gridTemplateRows: '1fr 1fr',   width: '100%', height: '100%' },
  '8':  { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gridTemplateRows: '1fr 1fr', width: '100%', height: '100%' },
};

function getPaneStyle(mode: LayoutMode, index: number, isVisible: boolean): CSSProperties {
  if (!isVisible) {
    return { display: 'none' };
  }

  const base: CSSProperties = { width: '100%', height: '100%', position: 'relative' };

  if (mode === '3l') {
    if (index === 0) return { ...base, gridColumn: '1', gridRow: '1 / span 2' };
    if (index === 1) return { ...base, gridColumn: '2', gridRow: '1' };
    if (index === 2) return { ...base, gridColumn: '2', gridRow: '2' };
  } else if (mode === '3r') {
    if (index === 0) return { ...base, gridColumn: '1', gridRow: '1' };
    if (index === 1) return { ...base, gridColumn: '1', gridRow: '2' };
    if (index === 2) return { ...base, gridColumn: '2', gridRow: '1 / span 2' };
  } else if (mode === '3t') {
    if (index === 0) return { ...base, gridColumn: '1 / span 3', gridRow: '1' };
    if (index === 1) return { ...base, gridColumn: '1', gridRow: '2' };
    if (index === 2) return { ...base, gridColumn: '2', gridRow: '2' };
    if (index === 3) return { ...base, gridColumn: '3', gridRow: '2' };
  } else if (mode === '3b') {
    if (index === 0) return { ...base, gridColumn: '1', gridRow: '1' };
    if (index === 1) return { ...base, gridColumn: '2', gridRow: '1' };
    if (index === 2) return { ...base, gridColumn: '3', gridRow: '1' };
    if (index === 3) return { ...base, gridColumn: '1 / span 3', gridRow: '2' };
  }

  return base;
}

export default function LayoutGrid({
  symbols,
  timezone,
  activeTool,
  magnetEnabled,
  onActiveToolChange,
  style,
  activeSession,
}: LayoutGridProps) {
  const { workspace } = useWorkspace();
  const { layoutMode, panes } = workspace;

  const [currentMode, setCurrentMode] = useState<LayoutMode>(layoutMode);
  const [colSizes, setColSizes] = useState<number[]>(() => {
    const dims = getGridDimensions(layoutMode);
    return Array(dims.cols).fill(100 / dims.cols);
  });
  const [rowSizes, setRowSizes] = useState<number[]>(() => {
    const dims = getGridDimensions(layoutMode);
    return Array(dims.rows).fill(100 / dims.rows);
  });

  if (layoutMode !== currentMode) {
    const dims = getGridDimensions(layoutMode);
    setColSizes(Array(dims.cols).fill(100 / dims.cols));
    setRowSizes(Array(dims.rows).fill(100 / dims.rows));
    setCurrentMode(layoutMode);
  }

  const containerRef = useRef<HTMLDivElement>(null);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent, type: 'col' | 'row', index: number) => {
      e.preventDefault();
      const startPos = type === 'col' ? e.clientX : e.clientY;
      const startSizes = type === 'col' ? [...colSizes] : [...rowSizes];
      
      const onMove = (ev: PointerEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const totalSize = type === 'col' ? rect.width : rect.height;
        const currentPos = type === 'col' ? ev.clientX : ev.clientY;
        
        const deltaPx = currentPos - startPos;
        const deltaPct = (deltaPx / totalSize) * 100;
        
        const newSizes = [...startSizes];
        const minPct = 5;
        
        let newCurrent = startSizes[index] + deltaPct;
        let newNext = startSizes[index + 1] - deltaPct;
        
        if (newCurrent < minPct) {
          newCurrent = minPct;
          newNext = startSizes[index] + startSizes[index + 1] - minPct;
        } else if (newNext < minPct) {
          newNext = minPct;
          newCurrent = startSizes[index] + startSizes[index + 1] - minPct;
        }
        
        newSizes[index] = newCurrent;
        newSizes[index + 1] = newNext;
        
        if (type === 'col') setColSizes(newSizes);
        else setRowSizes(newSizes);
      };
      
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [colSizes, rowSizes]
  );

  const visibleCount = PANE_COUNT[layoutMode] ?? 1;

  const gridStyle: CSSProperties = {
    ...(GRID_CONTAINER_STYLES[layoutMode] ?? GRID_CONTAINER_STYLES['1']),
    ...style,
    position: 'relative',
    gridTemplateColumns: colSizes.length > 0 ? colSizes.map(c => `${c}%`).join(' ') : '1fr',
    gridTemplateRows: rowSizes.length > 0 ? rowSizes.map(r => `${r}%`).join(' ') : '1fr',
  };

  return (
    <div ref={containerRef} style={gridStyle}>
      {panes.map((pane, index) => {
        const isVisible = index < visibleCount;
        const paneStyle = getPaneStyle(layoutMode, index, isVisible);

        return (
          <PaneContainer
            key={pane.paneId}
            paneId={pane.paneId}
            symbols={symbols}
            timezone={timezone}
            activeTool={activeTool}
            magnetEnabled={magnetEnabled}
            onActiveToolChange={onActiveToolChange}
            activeSession={activeSession}
            style={paneStyle}
          />
        );
      })}

      {/* Column Resizers */}
      {colSizes.slice(0, -1).map((_, i) => {
        const leftPct = colSizes.slice(0, i + 1).reduce((a, b) => a + b, 0);
        return (
          <div
            key={`col-resizer-${i}`}
            onPointerDown={(e) => onResizePointerDown(e, 'col', i)}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${leftPct}%`,
              width: '10px',
              transform: 'translateX(-50%)',
              cursor: 'col-resize',
              zIndex: 50,
              backgroundColor: 'transparent',
            }}
          />
        );
      })}

      {/* Row Resizers */}
      {rowSizes.slice(0, -1).map((_, i) => {
        const topPct = rowSizes.slice(0, i + 1).reduce((a, b) => a + b, 0);
        return (
          <div
            key={`row-resizer-${i}`}
            onPointerDown={(e) => onResizePointerDown(e, 'row', i)}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${topPct}%`,
              height: '10px',
              transform: 'translateY(-50%)',
              cursor: 'row-resize',
              zIndex: 50,
              backgroundColor: 'transparent',
            }}
          />
        );
      })}
    </div>
  );
}
