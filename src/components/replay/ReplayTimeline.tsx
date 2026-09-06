import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { useReplay } from '@features/replay';
import { getReplayDerived } from '@features/replay/replayDerived';
import {
  calculateTimelineProgress,
  findNearestCandle,
  isTimelineValid,
} from '@features/replay/replayTimeline';
import { formatTimestampInTimezone, formatTimestampWithDayInTimezone, parseDateTimeInTimezone } from '@features/timezone';
import type { Candle } from '@/types';
import './ReplayTimeline.css';

interface ReplayTimelineProps {
  allCandles: Candle[];
  /** IANA timezone identifier for display formatting. */
  timezone: string;
}

/**
 * Professional replay timeline (Day 14).
 *
 * Shows:
 *  - Track with filled portion (start → current)
 *  - Start marker (clickable → jump to start)
 *  - End marker (clickable → jump to end)
 *  - Draggable thumb (current position)
 *  - Tooltip on hover/drag with timestamp
 *  - Jump-to-timestamp input
 *
 * All position calculations are timestamp-based, not index-based.
 * The nearest valid candle is always selected via binary search.
 *
 * Day 15: Uses selected timezone for all timestamp formatting.
 */
export default function ReplayTimeline({ allCandles, timezone }: ReplayTimelineProps) {
  const {
    replayState,
    seekToTimestamp,
    pause,
  } = useReplay();

  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hoverPercent, setHoverPercent] = useState<number | null>(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState('');
  const [jumpError, setJumpError] = useState('');
  const jumpInputRef = useRef<HTMLInputElement>(null);

  const { startTime, currentTime, endTime, progress, isActive } = useMemo(() => {
    const derived = getReplayDerived(allCandles, replayState);
    const s = derived.replayStartTime;
    const c = derived.currentReplayTime;
    const e = derived.replayEndTime;
    return {
      startTime: s,
      currentTime: c,
      endTime: e,
      progress: calculateTimelineProgress(s, c, e),
      isActive: replayState.isReplayMode && isTimelineValid(s, c, e),
    };
  }, [
    allCandles,
    replayState.replayStartIndex,
    replayState.currentReplayIndex,
    replayState.isReplayMode,
  ]);

  // ── Percent → timestamp → nearest candle → seekToTimestamp ──
  const seekToPercent = useCallback(
    (percent: number) => {
      if (!isActive || startTime === null || endTime === null) return;
      const clamped = Math.max(0, Math.min(100, percent));
      // Convert percent → timestamp → nearest candle
      const targetTime = startTime + (clamped / 100) * (endTime - startTime);
      const candle = findNearestCandle(allCandles, targetTime);
      if (candle) {
        seekToTimestamp(candle.time);
      }
    },
    [isActive, startTime, endTime, allCandles, seekToTimestamp]
  );

  // ── Click on track → seek ──
  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const track = trackRef.current;
      if (!track || !isActive) return;
      const rect = track.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      seekToPercent(percent);
    },
    [isActive, seekToPercent]
  );

  // ── Drag thumb ──
  const dragRef = useRef<{ startX: number; startPercent: number } | null>(null);

  const handleThumbPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isActive) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { startX: e.clientX, startPercent: progress * 100 };
      setDragging(true);

      // If playing, pause first to prevent timer conflicts.
      if (replayState.status === 'playing') {
        pause();
      }
    },
    [isActive, progress, replayState.status, pause]
  );

  const handleThumbPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || !trackRef.current) return;
      const track = trackRef.current;
      const rect = track.getBoundingClientRect();
      const deltaPx = e.clientX - dragRef.current.startX;
      const deltaPercent = (deltaPx / rect.width) * 100;
      const newPercent = dragRef.current.startPercent + deltaPercent;
      seekToPercent(newPercent);
    },
    [seekToPercent]
  );

  const handleThumbPointerUp = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
  }, []);

  // ── Hover tooltip ──
  const handleTrackMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (dragging) return;
      const track = trackRef.current;
      if (!track || !isActive) return;
      const rect = track.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      setHoverPercent(Math.max(0, Math.min(100, percent)));
    },
    [dragging, isActive]
  );

  const handleTrackMouseLeave = useCallback(() => {
    if (!dragging) setHoverPercent(null);
  }, [dragging]);

  // ── Tooltip timestamp ──
  const tooltipTimestamp = useMemo(() => {
    if (hoverPercent === null || startTime === null || endTime === null) return null;
    const targetTime = startTime + (hoverPercent / 100) * (endTime - startTime);
    const candle = findNearestCandle(allCandles, targetTime);
    return candle?.time ?? null;
  }, [hoverPercent, startTime, endTime, allCandles]);

  // ── Jump to start / end ──
  const handleJumpToStart = useCallback(() => {
    if (startTime !== null) seekToTimestamp(startTime);
  }, [startTime, seekToTimestamp]);

  const handleJumpToEnd = useCallback(() => {
    if (endTime !== null) seekToTimestamp(endTime);
  }, [endTime, seekToTimestamp]);

  // ── Jump to timestamp input ──
  const handleJumpSubmit = useCallback(() => {
    if (!jumpValue.trim()) {
      setJumpError('Masukkan timestamp (YYYY-MM-DD HH:MM)');
      return;
    }

    // Parse the input string in active display timezone
    let targetTime: number;
    try {
      targetTime = parseDateTimeInTimezone(jumpValue, timezone);
    } catch {
      setJumpError('Format: YYYY-MM-DD HH:MM');
      return;
    }

    // Validate range
    if (startTime !== null && targetTime < startTime) {
      setJumpError(`Sebelum start: ${formatTimestampInTimezone(startTime, timezone)}`);
      return;
    }
    if (endTime !== null && targetTime > endTime) {
      setJumpError(`Setelah end: ${formatTimestampInTimezone(endTime, timezone)}`);
      return;
    }

    const candle = findNearestCandle(allCandles, targetTime);
    if (candle) {
      seekToTimestamp(candle.time);
      setJumpOpen(false);
      setJumpValue('');
      setJumpError('');
    }
  }, [jumpValue, startTime, endTime, allCandles, seekToTimestamp, timezone]);

  // Open/close jump input
  const toggleJump = useCallback(() => {
    setJumpOpen((v) => {
      if (!v) {
        // Opening: pre-fill with current time
        if (currentTime !== null) {
          setJumpValue(formatTimestampInTimezone(currentTime, timezone));
        }
        setJumpError('');
      }
      return !v;
    });
  }, [currentTime, timezone]);

  // Close jump on Escape
  useEffect(() => {
    if (!jumpOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setJumpOpen(false);
        setJumpValue('');
        setJumpError('');
      } else if (e.key === 'Enter') {
        handleJumpSubmit();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [jumpOpen, handleJumpSubmit]);

  // Focus input when opened
  useEffect(() => {
    if (jumpOpen && jumpInputRef.current) {
      jumpInputRef.current.focus();
      jumpInputRef.current.select();
    }
  }, [jumpOpen]);

  // ── Render ──
  if (!isActive) return null;

  const progressPercent = progress * 100;

  return (
    <div className={`replay-timeline ${!isActive ? 'replay-timeline--hidden' : ''}`}>
      {/* Timestamp labels */}
      <div className="replay-timeline__labels">
        <span className="replay-timeline__label">
          {startTime !== null ? formatTimestampWithDayInTimezone(startTime, timezone) : '—'}
        </span>
        <span className="replay-timeline__label replay-timeline__label--current">
          {currentTime !== null ? formatTimestampWithDayInTimezone(currentTime, timezone) : '—'}
        </span>
        <span className="replay-timeline__label">
          {endTime !== null ? formatTimestampWithDayInTimezone(endTime, timezone) : '—'}
        </span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="replay-timeline__track"
        onClick={handleTrackClick}
        onMouseMove={handleTrackMouseMove}
        onMouseLeave={handleTrackMouseLeave}
      >
        {/* Filled portion */}
        <div
          className="replay-timeline__fill"
          style={{ width: `${progressPercent}%` }}
        />

        {/* Start marker */}
        <div
          className="replay-timeline__marker-start"
          onClick={(e) => { e.stopPropagation(); handleJumpToStart(); }}
          title="Jump to start"
        />

        {/* End marker */}
        <div
          className="replay-timeline__marker-end"
          onClick={(e) => { e.stopPropagation(); handleJumpToEnd(); }}
          title="Jump to end"
        />

        {/* Draggable thumb */}
        <div
          className={`replay-timeline__thumb ${dragging ? 'replay-timeline__thumb--dragging' : ''}`}
          style={{ left: `${progressPercent}%` }}
          onPointerDown={handleThumbPointerDown}
          onPointerMove={handleThumbPointerMove}
          onPointerUp={handleThumbPointerUp}
        />

        {/* Tooltip on hover */}
        {hoverPercent !== null && tooltipTimestamp !== null && !dragging && (
          <div
            className="replay-timeline__tooltip replay-timeline__tooltip--visible"
            style={{ left: `${hoverPercent}%`, transform: 'translateX(-50%)' }}
          >
            <span>{formatTimestampWithDayInTimezone(tooltipTimestamp, timezone)}</span>
          </div>
        )}

        {/* Tooltip while dragging */}
        {dragging && currentTime !== null && (
          <div
            className="replay-timeline__tooltip replay-timeline__tooltip--visible"
            style={{ left: `${progressPercent}%`, transform: 'translateX(-50%)' }}
          >
            <span>{formatTimestampWithDayInTimezone(currentTime, timezone)}</span>
          </div>
        )}

        {/* Jump button */}
        <button
          className="replay-timeline__jump-btn"
          onClick={(e) => { e.stopPropagation(); toggleJump(); }}
          title="Jump to timestamp"
        >
          <Calendar size={12} />
        </button>

        {/* Jump-to-timestamp input */}
        {jumpOpen && (
          <div className="replay-timeline__jump-wrap" onClick={(e) => e.stopPropagation()}>
            <input
              ref={jumpInputRef}
              className="replay-timeline__jump-input"
              type="text"
              placeholder="YYYY-MM-DD HH:MM"
              value={jumpValue}
              onChange={(e) => { setJumpValue(e.target.value); setJumpError(''); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJumpSubmit();
                if (e.key === 'Escape') { setJumpOpen(false); setJumpValue(''); setJumpError(''); }
              }}
              onBlur={() => {
                // Delay close so click on submit can fire
                setTimeout(() => { setJumpOpen(false); setJumpValue(''); setJumpError(''); }, 150);
              }}
            />
            {jumpError && (
              <div className="replay-timeline__tooltip replay-timeline__tooltip--visible" style={{ top: 'auto', bottom: 'calc(100% + 4px)' }}>
                <span>{jumpError}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
