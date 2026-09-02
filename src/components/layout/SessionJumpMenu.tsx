import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useReplay } from '@features/replay';
import { activeChartBridge } from '@features/trading2/integration/ActiveChartBridge';
import {
  SESSION_JUMP_OPTIONS,
  calculateNextSessionJump,
  type SessionJumpType,
} from '@features/replay/sessionJumpHelper';
import './SessionJumpMenu.css';

interface SessionJumpMenuProps {
  newsEvents?: { timestamp: number; impact?: string }[];
}

export const SessionJumpMenu: React.FC<SessionJumpMenuProps> = ({ newsEvents = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { seekToTimestamp } = useReplay();

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelectJump = useCallback(
    (type: SessionJumpType, label: string) => {
      const activeChart = activeChartBridge.getChartState();
      const currentReplayTime =
        activeChart?.currentReplayTime ||
        Math.floor(Date.now() / 1000);

      const targetTime = calculateNextSessionJump(currentReplayTime, type, newsEvents);

      if (!targetTime) {
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: `Tidak ada target ${label} berikutnya dalam data`,
          })
        );
        setIsOpen(false);
        return;
      }

      seekToTimestamp(targetTime);

      const dateObj = new Date(targetTime * 1000);
      const timeStr = dateObj.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';

      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: `✓ Jump ke ${label}: ${timeStr}`,
        })
      );

      setIsOpen(false);
    },
    [seekToTimestamp, newsEvents]
  );

  const sessionOptions = SESSION_JUMP_OPTIONS.filter((o) => o.category === 'session');
  const macroOptions = SESSION_JUMP_OPTIONS.filter((o) => o.category === 'macro');
  const newsOptions = SESSION_JUMP_OPTIONS.filter((o) => o.category === 'news');
  const timeOptions = SESSION_JUMP_OPTIONS.filter((o) => o.category === 'time');

  return (
    <div className="topbar__jump-wrap" ref={menuRef}>
      <button
        className={`topbar__jump-btn ${isOpen ? 'is-active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Lompat ke Sesi Pembukaan Berikutnya"
        type="button"
      >
        <span>Jump Sesi</span>
        <span className="topbar__jump-chevron">▾</span>
      </button>

      {isOpen && (
        <div className="session-jump-menu">
          <div className="session-jump-section-title">SESI PASAR</div>
          {sessionOptions.map((opt) => (
            <button
              key={opt.type}
              className="session-jump-item"
              onClick={() => handleSelectJump(opt.type, opt.label)}
              type="button"
            >
              <span className="session-jump-item-label">{opt.label}</span>
              <span className="session-jump-item-time">{opt.timeInfo}</span>
            </button>
          ))}

          <div className="session-jump-divider" />
          <div className="session-jump-section-title">ICT MACROS (20-MIN WINDOWS)</div>
          {macroOptions.map((opt) => (
            <button
              key={opt.type}
              className="session-jump-item"
              onClick={() => handleSelectJump(opt.type, opt.label)}
              type="button"
            >
              <span className="session-jump-item-label">{opt.label}</span>
              <span className="session-jump-item-time">{opt.timeInfo}</span>
            </button>
          ))}

          <div className="session-jump-divider" />
          <div className="session-jump-section-title">BERITA & KALENDER</div>
          {newsOptions.map((opt) => (
            <button
              key={opt.type}
              className="session-jump-item"
              onClick={() => handleSelectJump(opt.type, opt.label)}
              type="button"
            >
              <span className="session-jump-item-label">{opt.label}</span>
              <span className="session-jump-item-time is-news">{opt.timeInfo}</span>
            </button>
          ))}

          <div className="session-jump-divider" />
          <div className="session-jump-section-title">TIMEFRAME & HARI</div>
          {timeOptions.map((opt) => (
            <button
              key={opt.type}
              className="session-jump-item"
              onClick={() => handleSelectJump(opt.type, opt.label)}
              type="button"
            >
              <span className="session-jump-item-label">{opt.label}</span>
              <span className="session-jump-item-time">{opt.timeInfo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SessionJumpMenu;
