import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FastForward,
  GripVertical,
  Clock,
  ChevronDown,
  Calendar,
  Square,
} from 'lucide-react';
import IconButton from '@components/common/IconButton';
import { TIMEFRAME_OPTIONS, type Timeframe } from '@/types';
import { useReplay } from '@features/replay';
import ReplaySetupModal from '@components/replay/ReplaySetupModal';
import { REPLAY_DEBUG } from '@/config/debug';
import './FloatingReplayBar.css';

import { useWorkspace } from '@features/workspace';
import SessionJumpMenu from './SessionJumpMenu';

const SPEEDS = [0.5, 1, 2, 5, 10, 20];

interface FloatingReplayBarProps {
  chartTimeframe: Timeframe;
  paneId?: string;
}

/**
 * Floating, draggable replay control.
 */
export default function FloatingReplayBar({ chartTimeframe, paneId }: FloatingReplayBarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { updatePaneTimeframe } = useWorkspace();

  const {
    replayState,
    startReplaySelection,
    cancelReplaySelection,
    exitReplayMode,
    play,
    pause,
    setSpeed,
    nextCandle,
    prevCandle,
    skipForward,
    replayTimeframe,
    autoFollow,
    setReplayTimeframe,
    toggleAutoFollow,
  } = useReplay();

  const [tfMenuOpen, setTfMenuOpen] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);

  const isSelecting = replayState.status === 'selecting';
  const isPlaying = replayState.status === 'playing';
  const isControlDisabled = isSelecting;

  // Auto Follow Synchronization:
  // When active pane changes, sync Replay Timeframe to match active pane's chartTimeframe.
  // This preserves each pane's independent timeframe isolation while keeping replay stepping in sync.
  useEffect(() => {
    if (autoFollow && chartTimeframe && chartTimeframe !== replayTimeframe) {
      setReplayTimeframe(chartTimeframe as Timeframe);
    }
  }, [paneId, chartTimeframe, autoFollow, replayTimeframe, setReplayTimeframe]);

  const handleManualTfSelect = useCallback(
    (tf: Timeframe) => {
      setReplayTimeframe(tf);
      if (autoFollow && paneId) {
        updatePaneTimeframe(paneId, tf);
      }
      setTfMenuOpen(false);
    },
    [autoFollow, paneId, setReplayTimeframe, updatePaneTimeframe]
  );

  const handleToggleAutoFollow = useCallback(() => {
    toggleAutoFollow();
  }, [toggleAutoFollow]);

  const handleNextCandle = useCallback(() => {
    nextCandle(replayTimeframe);
  }, [nextCandle, replayTimeframe]);

  const handlePrevCandle = useCallback(() => {
    prevCandle(replayTimeframe);
  }, [prevCandle, replayTimeframe]);

  // Select Replay Start Point button: click candle on chart or cancel selection
  const handleSelectStartPoint = useCallback(() => {
    if (isSelecting) {
      cancelReplaySelection();
    } else {
      startReplaySelection();
    }
  }, [isSelecting, cancelReplaySelection, startReplaySelection]);

  // Play/Pause — wired to replay engine.
  const handlePlayPause = useCallback(() => {
    if (REPLAY_DEBUG) {
      console.log('[REPLAY FORENSIC 1] PLAY/PAUSE BUTTON CLICKED', {
        currentStatus: replayState.status,
        isReplayMode: replayState.isReplayMode,
        speedIndex,
        speed: SPEEDS[speedIndex],
        currentReplayIndex: replayState.currentReplayIndex,
        replayStartIndex: replayState.replayStartIndex,
      });
    }

    if (replayState.status === 'playing') {
      if (REPLAY_DEBUG) console.log('[REPLAY FORENSIC 1.1] Triggering pause()');
      pause();
    } else {
      if (REPLAY_DEBUG) console.log('[REPLAY FORENSIC 1.2] Triggering play() with speed:', SPEEDS[speedIndex]);
      play(SPEEDS[speedIndex]);
    }
  }, [replayState.status, replayState.isReplayMode, replayState.currentReplayIndex, replayState.replayStartIndex, play, pause, speedIndex]);

  // Fast Forward — skip 10 candles.
  const handleSkipForward = useCallback(() => {
    skipForward(10);
  }, [skipForward]);

  // Keyboard Shortcut: Space to Toggle Play/Pause, ArrowRight/Left to step candles
  useEffect(() => {
    if (isControlDisabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('input') ||
          target.closest('textarea'))
      ) {
        return;
      }

      if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        e.stopPropagation();
        handlePlayPause();
      } else if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        handleNextCandle();
      } else if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        handlePrevCandle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isControlDisabled, handlePlayPause, handleNextCandle, handlePrevCandle]);

  // Speed dropdown — select speed and apply to running playback.
  const handleSpeedSelect = useCallback(
    (speed: number) => {
      const idx = SPEEDS.indexOf(speed);
      if (idx !== -1) setSpeedIndex(idx);
      setSpeed(speed);
      setSpeedMenuOpen(false);
    },
    [setSpeed]
  );

  // Drag support.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragState = useRef<{ dx: number; dy: number } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    dragState.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };

    const onMove = (ev: PointerEvent) => {
      if (!dragState.current) return;
      setPos({
        x: ev.clientX - dragState.current.dx,
        y: ev.clientY - dragState.current.dy,
      });
    };
    const onUp = () => {
      dragState.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, []);

  const style = pos ? { left: pos.x, top: pos.y, bottom: 'auto', transform: 'none' } : undefined;
  const replayTfLabel =
    TIMEFRAME_OPTIONS.find((o) => o.value === replayTimeframe)?.label ?? replayTimeframe;

  if (collapsed) {
    return (
      <div className="replay-bar replay-bar--collapsed" style={style} ref={barRef}>
        <button
          className="replay-bar__collapsed-btn"
          onClick={() => setCollapsed(false)}
          aria-label="Expand replay control"
          title="Expand replay control"
        >
          <Clock size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="replay-bar" style={style} ref={barRef}>
      {/* Replay Date Range Setup Modal Trigger */}
      <IconButton
        icon={<Calendar size={15} />}
        label="Setup date range"
        size="sm"
        onClick={() => window.dispatchEvent(new CustomEvent('open-replay-setup-modal'))}
      />

      <IconButton icon={<SkipBack size={15} />} label="Previous candle (←)" size="sm" disabled={isControlDisabled} onClick={handlePrevCandle} />

      {/* Play/Pause — wired to replay engine */}
      <button
        className="replay-bar__play"
        onClick={handlePlayPause}
        disabled={isControlDisabled}
        aria-label={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        data-tooltip={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      >
        {isPlaying ? <Pause size={17} /> : <Play size={17} />}
      </button>

      <IconButton icon={<SkipForward size={15} />} label="Next candle (→)" size="sm" disabled={isControlDisabled} onClick={handleNextCandle} />
      <IconButton icon={<FastForward size={15} />} label="Fast forward" size="sm" disabled={isControlDisabled} onClick={handleSkipForward} />

      {/* Quick Session Jump Menu */}
      <SessionJumpMenu />

      {/* Stop Replay — Exit Replay Mode */}
      <IconButton icon={<Square size={14} />} label="Stop replay" size="sm" disabled={isControlDisabled} onClick={exitReplayMode} />

      <div
        className="replay-bar__speed-wrap"
        tabIndex={0}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setSpeedMenuOpen(false);
        }}
      >
        <button
          className="replay-bar__speed-value mono"
          onClick={() => setSpeedMenuOpen((v) => !v)}
          aria-expanded={speedMenuOpen}
          data-tooltip="Replay speed — pilih kecepatan playback"
          disabled={isControlDisabled}
        >
          {SPEEDS[speedIndex]}x
          <ChevronDown size={12} />
        </button>

        {speedMenuOpen && (
          <div className="replay-bar__speed-menu">
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                className={`replay-bar__speed-menu-item mono ${
                  speed === SPEEDS[speedIndex] ? 'is-active' : ''
                }`}
                onClick={() => handleSpeedSelect(speed)}
              >
                {speed}x
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="replay-bar__divider" />

      <div
        className="replay-bar__tf-wrap"
        tabIndex={0}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setTfMenuOpen(false);
        }}
      >
        <button
          className="replay-bar__tf-value mono"
          onClick={() => setTfMenuOpen((v) => !v)}
          aria-expanded={tfMenuOpen}
          data-tooltip="Replay TF — timeframe yang dipakai mesin replay untuk memajukan candle"
        >
          {replayTfLabel}
          <ChevronDown size={12} />
        </button>

        {tfMenuOpen && (
          <div className="replay-bar__tf-menu">
            {TIMEFRAME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`replay-bar__tf-menu-item mono ${
                  opt.value === replayTimeframe ? 'is-active' : ''
                }`}
                onClick={() => handleManualTfSelect(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={autoFollow}
        className={`replay-bar__toggle ${autoFollow ? 'is-on' : ''}`}
        onClick={handleToggleAutoFollow}
        data-tooltip="Auto Follow Timeframe: Replay TF otomatis mengikuti Chart TF saat aktif"
      >
        <span className="replay-bar__toggle-track">
          <span className="replay-bar__toggle-thumb" />
          <span className="replay-bar__toggle-label">{autoFollow ? 'ON' : 'OFF'}</span>
        </span>
      </button>

      <div className="replay-bar__divider" />

      <button
        className="replay-bar__collapse"
        onClick={() => setCollapsed(true)}
        aria-label="Collapse replay control"
        data-tooltip="Collapse"
      >
        <Clock size={14} />
      </button>

      <div
        className="replay-bar__draghandle"
        onPointerDown={onPointerDown}
        title="Drag to move"
      >
        <GripVertical size={14} />
      </div>
    </div>
  );
}
