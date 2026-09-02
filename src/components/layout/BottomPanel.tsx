import { useCallback, useRef, useState, memo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { BottomPanelTab } from '@/types';
import DataManagementPanel from '@features/data/components/DataManagementPanel';
import DatabaseInfoPanel from '@features/database/DatabaseInfoPanel';
import { OrdersTab } from '@features/trading2/ui/OrdersTab';
import { PositionsTab } from '@features/trading2/ui/PositionsTab';
import { TradesTab } from '@features/trading2/ui/TradesTab';
import './BottomPanel.css';

interface BottomPanelProps {
  collapsed: boolean;
  height: number;
  onToggleCollapsed: () => void;
  onResize: (height: number) => void;
}

const TABS: { id: BottomPanelTab; label: string }[] = [
  { id: 'trades', label: 'Trades' },
  { id: 'positions', label: 'Positions' },
  { id: 'orders', label: 'Orders' },
];

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 300;

/**
 * Bottom dock panel: resizable via drag handle, collapsible to a
 * thin tab strip.
 */
function BottomPanel({
  collapsed,
  height,
  onToggleCollapsed,
  onResize,
}: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<BottomPanelTab>('trades');
  const dragStart = useRef<{ y: number; height: number } | null>(null);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (collapsed) return;
      dragStart.current = { y: e.clientY, height };

      const onMove = (ev: PointerEvent) => {
        if (!dragStart.current) return;
        const delta = dragStart.current.y - ev.clientY;
        const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragStart.current.height + delta));
        onResize(next);
      };
      const onUp = () => {
        dragStart.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [collapsed, height, onResize]
  );

  return (
    <section
      className={`bottom-panel ${collapsed ? 'is-collapsed' : ''}`}
      style={{ height: collapsed ? 'var(--bottompanel-collapsed-h)' : height }}
    >
      {!collapsed && (
        <div className="bottom-panel__resize-handle" onPointerDown={onResizePointerDown} />
      )}

      <div className="bottom-panel__tabbar">
        <div className="bottom-panel__tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`bottom-panel__tab ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                if (collapsed) onToggleCollapsed();
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          className="bottom-panel__toggle"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {!collapsed && (
        <div className="bottom-panel__content">
          {activeTab === 'trades' ? (
            <TradesTab />
          ) : activeTab === 'positions' ? (
            <PositionsTab />
          ) : activeTab === 'orders' ? (
            <OrdersTab />
          ) : (
            <TradesTab />
          )}
        </div>
      )}
    </section>
  );
}

export default memo(BottomPanel);
