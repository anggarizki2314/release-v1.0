import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { EconomicEvent } from './types';
import { getFlagForCurrency } from './newsApi';
import { CountryFlag } from './CountryFlag';
import { useEconomicNews } from './useEconomicNews';
import './NewsEventOverlay.css';

export interface NewsEventOverlayProps {
  chart: any;
  series: any;
  currentSymbol: string;
  candles?: any[];
  chartWidth: number;
  chartHeight: number;
  visible?: boolean;
}

function findLastIdx(candles: any[], timestamp: number): number {
  let low = 0;
  let high = candles.length - 1;
  let best = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (candles[mid].time <= timestamp) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

function getEventX(chart: any, timestamp: number, candles?: any[]): number | null {
  if (!chart) return null;
  const timeScale = chart.timeScale();
  if (!timeScale) return null;

  if (candles && candles.length > 0) {
    const leftIdx = findLastIdx(candles, timestamp);
    if (leftIdx >= 0 && leftIdx < candles.length) {
      if (candles[leftIdx].time === timestamp) {
        try {
          const logicalX = timeScale.logicalToCoordinate(leftIdx as any);
          if (logicalX !== null && typeof logicalX === 'number' && Number.isFinite(logicalX)) {
            return logicalX;
          }
        } catch {}
      }
    }
  }

  try {
    const directX = timeScale.timeToCoordinate(timestamp as any);
    if (directX !== null && typeof directX === 'number' && Number.isFinite(directX)) {
      return directX;
    }
  } catch {}

  if (candles && candles.length > 0) {
    const leftIdx = findLastIdx(candles, timestamp);
    if (leftIdx >= 0 && leftIdx < candles.length) {
      try {
        const logicalX = timeScale.logicalToCoordinate(leftIdx as any);
        if (logicalX !== null && typeof logicalX === 'number' && Number.isFinite(logicalX)) {
          return logicalX;
        }
      } catch {}
    }
  }

  return null;
}

export const NewsEventOverlay: React.FC<NewsEventOverlayProps> = ({
  chart,
  currentSymbol,
  candles,
  chartWidth,
  chartHeight,
  visible = true,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<EconomicEvent | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<EconomicEvent | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
  const [tick, setTick] = useState(0);

  const fromTime = candles && candles.length > 0 ? candles[0].time : null;
  const toTime = candles && candles.length > 0 ? candles[candles.length - 1].time : null;

  const { events } = useEconomicNews(currentSymbol, fromTime, toTime, visible);

  // Subscribe to chart scroll/zoom events to re-render coordinates smoothly
  useEffect(() => {
    if (!chart) return;
    const timeScale = chart.timeScale();
    let rafId: number | null = null;

    const handleRangeChange = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setTick((t) => (t + 1) % 1000000);
      });
    };

    timeScale.subscribeVisibleLogicalRangeChange(handleRangeChange);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      try {
        timeScale.unsubscribeVisibleLogicalRangeChange(handleRangeChange);
      } catch {}
    };
  }, [chart]);

  const activeEventsWithCoords = useMemo(() => {
    if (!visible || !chart || events.length === 0) return [];

    const result: Array<{ event: EconomicEvent; x: number }> = [];
    const minX = 0;
    const maxX = chartWidth;

    for (const ev of events) {
      const x = getEventX(chart, ev.timestamp, candles);
      if (x !== null && x >= minX && x <= maxX) {
        result.push({ event: ev, x });
      }
    }
    return result;
  }, [visible, chart, events, candles, chartWidth, chartHeight, tick]);

  const handleFlagClick = useCallback((ev: EconomicEvent, x: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(ev);
    setPopoverPos({ x: Math.min(chartWidth - 260, Math.max(10, x - 120)), y: chartHeight - 170 });
  }, [chartWidth, chartHeight]);

  const handleFlagMouseEnter = useCallback((ev: EconomicEvent, x: number) => {
    setHoveredEvent(ev);
    if (!selectedEvent) {
      setPopoverPos({ x: Math.min(chartWidth - 260, Math.max(10, x - 120)), y: chartHeight - 170 });
    }
  }, [selectedEvent, chartWidth, chartHeight]);

  const handleFlagMouseLeave = useCallback(() => {
    setHoveredEvent(null);
  }, []);

  const activeModalEvent = selectedEvent || hoveredEvent;

  if (!visible || activeEventsWithCoords.length === 0) return null;

  return (
    <div className="news-event-overlay" style={{ width: chartWidth, height: chartHeight }}>
      {/* Background click listener to dismiss modal */}
      {selectedEvent && (
        <div
          className="news-event-overlay__backdrop"
          onClick={() => { setSelectedEvent(null); setPopoverPos(null); }}
        />
      )}

      {/* Render all visible news flag markers */}
      {activeEventsWithCoords.map(({ event: ev, x }) => {
        const isSelected = selectedEvent?.id === ev.id;
        const isHovered = hoveredEvent?.id === ev.id;
        const isHighImpact = ev.impact === 'HIGH';
        const formattedUtc = new Date(ev.timestamp * 1000).toUTCString().replace('GMT', 'UTC');

        return (
          <div
            key={`${ev.id}-${ev.timestamp}-${ev.currency}`}
            className={`news-flag-marker ${isHighImpact ? 'is-high-impact' : 'is-med-impact'} ${isSelected || isHovered ? 'is-active' : ''}`}
            style={{ left: `${x}px`, bottom: '26px' }}
            onClick={(e) => handleFlagClick(ev, x, e)}
            onMouseEnter={() => handleFlagMouseEnter(ev, x)}
            onMouseLeave={handleFlagMouseLeave}
            title={`${ev.currency} • ${ev.event_name} (${formattedUtc})`}
          >
            <div className="news-flag-marker__badge">
              <CountryFlag countryOrCurrency={ev.country || ev.currency} size={15} />
              <span className="news-flag-marker__currency">{ev.currency}</span>
              <span className="news-flag-marker__dot" />
            </div>
            <div className="news-flag-marker__pin-point" />
          </div>
        );
      })}

      {/* Popover Event Card */}
      {activeModalEvent && popoverPos && (
        <div
          className="news-event-card"
          style={{ left: `${popoverPos.x}px`, top: `${popoverPos.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="news-event-card__header">
            <div className="news-event-card__country">
              <CountryFlag countryOrCurrency={activeModalEvent.country || activeModalEvent.currency} size={18} />
              <span className="news-event-card__currency">{activeModalEvent.currency}</span>
              <span className={`news-event-card__impact-badge ${activeModalEvent.impact === 'HIGH' ? 'is-high' : 'is-medium'}`}>
                {activeModalEvent.impact === 'HIGH' ? 'HIGH IMPACT' : 'MEDIUM'}
              </span>
            </div>
            {selectedEvent && (
              <button
                className="news-event-card__close"
                onClick={() => { setSelectedEvent(null); setPopoverPos(null); }}
              >
                ✕
              </button>
            )}
          </div>

          <div className="news-event-card__title">{activeModalEvent.event_name}</div>

          <div className="news-event-card__time">
            ⏱️ {new Date(activeModalEvent.timestamp * 1000).toUTCString().replace('GMT', 'UTC')}
          </div>

          {(activeModalEvent.actual || activeModalEvent.forecast || activeModalEvent.previous) && (
            <div className="news-event-card__stats">
              <div className="news-event-card__stat-item">
                <span className="news-event-card__stat-label">Actual</span>
                <span className="news-event-card__stat-val actual">{activeModalEvent.actual ?? '-'}</span>
              </div>
              <div className="news-event-card__stat-item">
                <span className="news-event-card__stat-label">Forecast</span>
                <span className="news-event-card__stat-val">{activeModalEvent.forecast ?? '-'}</span>
              </div>
              <div className="news-event-card__stat-item">
                <span className="news-event-card__stat-label">Previous</span>
                <span className="news-event-card__stat-val">{activeModalEvent.previous ?? '-'}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NewsEventOverlay;
