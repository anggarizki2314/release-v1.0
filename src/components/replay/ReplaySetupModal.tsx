import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Play, AlertCircle, Layers } from 'lucide-react';
import { useReplay } from '@features/replay';
import { useTimezone, subtractCalendarDays } from '@features/timezone';
import './ReplaySetupModal.css';

interface ReplaySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Helper: format UNIX timestamp (seconds) to YYYY-MM-DD in UTC */
function formatUtcDateString(timestampSec: number): string {
  if (!timestampSec) return '';
  const d = new Date(timestampSec * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getUTCFullYear();
  const month = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  return `${year}-${month}-${day}`;
}

/** Helper: format UNIX timestamp (seconds) to human-readable date display in UTC */
function formatDisplayDate(timestampSec: number): string {
  if (!timestampSec) return '—';
  return new Date(timestampSec * 1000).toLocaleDateString('id-ID', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ReplaySetupModal({ isOpen, onClose }: ReplaySetupModalProps) {
  const { masterCandles = [], createReplaySession } = useReplay();
  const { timezone } = useTimezone();

  // Master candles bounds
  const earliestCandleTime = useMemo(
    () => (masterCandles && masterCandles.length > 0 ? masterCandles[0].time : 0),
    [masterCandles]
  );
  const latestCandleTime = useMemo(
    () => (masterCandles && masterCandles.length > 0 ? masterCandles[masterCandles.length - 1].time : 0),
    [masterCandles]
  );

  // Form states
  const [startDateStr, setStartDateStr] = useState<string>('');
  const [bufferDays, setBufferDays] = useState<number>(3);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize form when modal opens or masterCandles change
  useEffect(() => {
    if (isOpen && masterCandles && masterCandles.length > 0) {
      if (!startDateStr) {
        setStartDateStr(formatUtcDateString(earliestCandleTime));
      }
      setErrorMsg(null);
    }
  }, [isOpen, masterCandles, earliestCandleTime, startDateStr]);

  const previewBufferStartStr = useMemo(() => {
    if (!startDateStr || bufferDays <= 0) return null;
    try {
      return subtractCalendarDays(startDateStr, bufferDays);
    } catch {
      return null;
    }
  }, [startDateStr, bufferDays]);

  if (!isOpen) return null;

  // Validation
  const validate = (): boolean => {
    if (masterCandles.length === 0) {
      setErrorMsg('Belum ada data candle yang dimuat.');
      return false;
    }
    if (!startDateStr) {
      setErrorMsg('Tanggal Start Date wajib dipilih.');
      return false;
    }
    const startSec = Math.floor(new Date(`${startDateStr}T00:00:00Z`).getTime() / 1000);
    if (startSec + 86400 < earliestCandleTime || startSec > latestCandleTime) {
      setErrorMsg(`Tanggal Replay Start (${startDateStr}) berada di luar rentang data master yang tersedia.`);
      return false;
    }
    setErrorMsg(null);
    return true;
  };

  const handleStartBacktest = async () => {
    if (!validate()) return;
    try {
      if (createReplaySession) {
        await createReplaySession(startDateStr, bufferDays, timezone || 'UTC');
      }
      onClose();
    } catch (err) {
      console.error('[Replay Start Error]', err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="replay-modal-overlay">
      <div className="replay-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="replay-modal-header">
          <div className="replay-modal-title">
            <Calendar size={18} className="replay-modal-icon" />
            <h3>Replay Start Date Gate</h3>
          </div>
        </div>

        {/* Master Data Info */}
        <div className="replay-modal-info">
          <div className="replay-modal-info-item">
            <span className="replay-modal-info-label">Total Data Master:</span>
            <span className="replay-modal-info-value mono">{masterCandles.length} candles</span>
          </div>
          <div className="replay-modal-info-item">
            <span className="replay-modal-info-label">Rentang Data Tersedia:</span>
            <span className="replay-modal-info-value">
              {formatDisplayDate(earliestCandleTime)} — {formatDisplayDate(latestCandleTime)}
            </span>
          </div>
        </div>

        {/* Form Body */}
        <div className="replay-modal-body">
          {errorMsg && (
            <div className="replay-modal-error">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="replay-modal-field">
            <label htmlFor="replay-start-date">Replay Start Date (Mulai Replay):</label>
            <input
              id="replay-start-date"
              type="date"
              value={startDateStr}
              min={formatUtcDateString(earliestCandleTime)}
              max={formatUtcDateString(latestCandleTime)}
              onChange={(e) => {
                setStartDateStr(e.target.value);
                setErrorMsg(null);
              }}
            />
            <span className="replay-modal-help">
              Replay akan dimulai pada candle pertama jam 00:00:00 UTC (atau pembukaan pasar berikutnya).
            </span>
          </div>

          <div className="replay-modal-field">
            <label htmlFor="replay-buffer">
              <Layers size={14} style={{ display: 'inline', marginRight: 6 }} />
              Buffer History (Hari Kalender Histori Context):
            </label>
            <input
              id="replay-buffer"
              type="number"
              min={0}
              max={30}
              value={bufferDays}
              onChange={(e) => setBufferDays(Math.max(0, Number(e.target.value)))}
            />
            <span className="replay-modal-help">
              Menyediakan {bufferDays} hari histori sebelum Start Date sebagai konteks indikator. Step backward tidak dapat melewati Start Date.
            </span>
          </div>

          {startDateStr && (
            <div className="replay-modal-preview-card">
              <div className="replay-modal-preview-title">Ringkasan Setup:</div>
              <div className="replay-modal-preview-row">
                <span className="replay-modal-preview-label">📜 Histori Awal di Chart:</span>
                <span className="replay-modal-preview-value">
                  {bufferDays > 0 && previewBufferStartStr
                    ? `${previewBufferStartStr} s/d sebelum ${startDateStr} (${bufferDays} hari)`
                    : 'Tanpa buffer (0 hari)'}
                </span>
              </div>
              <div className="replay-modal-preview-row">
                <span className="replay-modal-preview-label">🚀 Titik Mulai Replay:</span>
                <span className="replay-modal-preview-value replay-modal-preview-value--highlight">
                  {startDateStr} (00:00 UTC)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="replay-modal-footer">
          <button
            className="replay-modal-btn replay-modal-btn--primary"
            onClick={handleStartBacktest}
            disabled={masterCandles.length === 0}
          >
            <Play size={15} />
            Konfirmasi & Mulai Replay
          </button>
        </div>
      </div>
    </div>
  );
}
