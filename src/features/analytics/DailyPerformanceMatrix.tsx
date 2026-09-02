import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, Grid } from 'lucide-react';
import type { SessionAnalyticsResult } from './useSessionAnalytics';
import './DailyPerformanceMatrix.css';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface DailyPerformanceMatrixProps {
  analytics: SessionAnalyticsResult;
}

export const DailyPerformanceMatrix: React.FC<DailyPerformanceMatrixProps> = ({ analytics }) => {
  const [viewMode, setViewMode] = useState<'pnl' | 'trades'>('pnl');
  
  // Find default year and month from trades or current date
  const defaultDate = useMemo(() => {
    if (analytics.trades.length > 0) {
      const lastTrade = analytics.trades[analytics.trades.length - 1];
      const time = lastTrade.closedAt || lastTrade.openedAt || Date.now();
      return new Date(time);
    }
    return new Date();
  }, [analytics.trades]);

  const [selectedYear, setSelectedYear] = useState<number>(defaultDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(defaultDate.getMonth());

  // Generate Year options (from trades or default list)
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(selectedYear);
    years.add(new Date().getFullYear());
    analytics.trades.forEach((t) => {
      const d = new Date(t.closedAt || t.openedAt || Date.now());
      years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [analytics.trades, selectedYear]);

  // Calendar cells for the selected month/year
  const calendarCells = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const startingDayOfWeek = firstDay.getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    const cells: Array<{
      dayNum: number | null;
      dateStr: string;
      pnl: number;
      tradesCount: number;
      isGreen: boolean;
      isRed: boolean;
      isToday: boolean;
    }> = [];

    // Empty leading padding cells
    for (let i = 0; i < startingDayOfWeek; i++) {
      cells.push({
        dayNum: null,
        dateStr: '',
        pnl: 0,
        tradesCount: 0,
        isGreen: false,
        isRed: false,
        isToday: false,
      });
    }

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === selectedYear && today.getMonth() === selectedMonth;

    let greenDaysCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const mm = String(selectedMonth + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dateStr = `${selectedYear}-${mm}-${dd}`;

      const dayData = analytics.dailyMatrix.get(dateStr);
      const pnl = dayData?.pnl ?? 0;
      const tradesCount = dayData?.tradesCount ?? 0;
      const isGreen = pnl > 0.001;
      const isRed = pnl < -0.001;

      if (isGreen) greenDaysCount++;

      cells.push({
        dayNum: day,
        dateStr,
        pnl,
        tradesCount,
        isGreen,
        isRed,
        isToday: isCurrentMonth && today.getDate() === day,
      });
    }

    return { cells, greenDaysCount };
  }, [selectedYear, selectedMonth, analytics.dailyMatrix]);

  return (
    <div className="daily-matrix">
      {/* Header with Title & Controls (Matching Reference Screenshot 2) */}
      <div className="daily-matrix__header">
        <div className="daily-matrix__title-wrap">
          <CalendarIcon size={18} className="daily-matrix__icon" />
          <div>
            <h3 className="daily-matrix__title">Performance by Daily</h3>
            <p className="daily-matrix__subtitle">
              Visualisasi performa harian berdasarkan akumulasi Profit/Loss pada SQLite database.
            </p>
          </div>
        </div>

        <div className="daily-matrix__controls">
          {/* Toggle Net P&L / Jumlah Trade */}
          <div className="daily-matrix__pill-toggle">
            <button
              className={`daily-matrix__pill-btn ${viewMode === 'pnl' ? 'is-active' : ''}`}
              onClick={() => setViewMode('pnl')}
            >
              Net P&L
            </button>
            <button
              className={`daily-matrix__pill-btn ${viewMode === 'trades' ? 'is-active' : ''}`}
              onClick={() => setViewMode('trades')}
            >
              Jumlah Trade
            </button>
          </div>

          {/* Month Selector */}
          <select
            className="daily-matrix__select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={idx} value={idx}>
                {name}
              </option>
            ))}
          </select>

          {/* Year Selector */}
          <select
            className="daily-matrix__select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar Matrix Grid */}
      <div className="daily-matrix__cal">
        <div className="daily-matrix__weekdays">
          {WEEKDAYS.map((wd) => (
            <span key={wd}>{wd}</span>
          ))}
        </div>

        <div className="daily-matrix__grid">
          {calendarCells.cells.map((cell, idx) => {
            if (!cell.dayNum) {
              return <div key={idx} className="daily-cell daily-cell--empty" />;
            }

            const cellClass = `daily-cell ${
              cell.isGreen ? 'daily-cell--green' : cell.isRed ? 'daily-cell--red' : ''
            }`;

            return (
              <div key={idx} className={cellClass}>
                <div className="daily-cell__top">
                  <span className="daily-cell__num">{String(cell.dayNum).padStart(2, '0')}</span>
                  {cell.isToday && <span className="daily-cell__today-badge">Today</span>}
                </div>

                {cell.tradesCount > 0 ? (
                  <div className="daily-cell__content">
                    {viewMode === 'pnl' ? (
                      <>
                        <span className={`daily-cell__val ${cell.isGreen ? 'daily-cell__val--pos' : 'daily-cell__val--neg'}`}>
                          {cell.pnl >= 0 ? '+' : ''}${cell.pnl.toFixed(0)}
                        </span>
                        <span className="daily-cell__trades">{cell.tradesCount} trades</span>
                      </>
                    ) : (
                      <>
                        <span className="daily-cell__val" style={{ color: '#22d3ee' }}>
                          {cell.tradesCount}
                        </span>
                        <span className="daily-cell__trades">trades</span>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Matrix Legend */}
      <div className="daily-matrix__legend">
        <div className="daily-matrix__legend-items">
          <div className="daily-matrix__legend-item">
            <span className="daily-matrix__dot daily-matrix__dot--green" />
            <span>Green Day (Profit)</span>
          </div>
          <div className="daily-matrix__legend-item">
            <span className="daily-matrix__dot daily-matrix__dot--red" />
            <span>Red Day (Loss)</span>
          </div>
          <div className="daily-matrix__legend-item">
            <span className="daily-matrix__dot daily-matrix__dot--none" />
            <span>No Trades</span>
          </div>
        </div>

        <div className="daily-matrix__green-count">
          Total Hari Hijau Bulan Ini: <strong>{calendarCells.greenDaysCount} Hari</strong>
        </div>
      </div>

      {/* Performance by Month (Matching Reference Screenshot 2 bottom section) */}
      <div className="monthly-section">
        <div className="monthly-section__header">
          <div className="monthly-section__title-wrap">
            <Grid size={16} color="#22d3ee" />
            <h4 className="monthly-section__title">Performance by Month</h4>
          </div>

          <div className="monthly-section__toolbar">
            <div className="monthly-section__radio-group">
              <label className="monthly-section__radio">
                <input type="radio" name="gainType" defaultChecked />
                <span>Accum. Sessions Gains %</span>
              </label>
              <label className="monthly-section__radio">
                <input type="radio" name="gainType" />
                <span>Overall Gain %</span>
              </label>
            </div>


          </div>
        </div>

        <div className="monthly-table-wrap">
          <table className="monthly-table">
            <thead>
              <tr>
                <th>Year</th>
                {MONTH_SHORT.map((m) => (
                  <th key={m}>{m}</th>
                ))}
                <th>YTD</th>
              </tr>
            </thead>
            <tbody>
              {availableYears.map((yr) => {
                const yrData = analytics.monthlyMatrix.find((m) => m.year === yr);
                const ytdPct = yrData?.ytdPercent ?? 0;
                const isYtdPos = ytdPct > 0;
                const isYtdNeg = ytdPct < 0;

                return (
                  <tr key={yr}>
                    <td>
                      <span className="monthly-table__year-badge">{yr}</span>
                    </td>
                    {MONTH_SHORT.map((_, mIdx) => {
                      const mData = yrData?.months[mIdx];
                      if (!mData || mData.tradesCount === 0) {
                        return <td key={mIdx}>-</td>;
                      }
                      const pct = mData.percent;
                      const isPos = pct > 0;
                      const isNeg = pct < 0;
                      const cellClass = isPos
                        ? 'monthly-table__cell--pos'
                        : isNeg
                        ? 'monthly-table__cell--neg'
                        : '';
                      return (
                        <td key={mIdx} className={cellClass}>
                          {isPos ? '+' : ''}
                          {pct.toFixed(2)}%
                        </td>
                      );
                    })}
                    <td className={isYtdPos ? 'monthly-table__ytd--pos' : isYtdNeg ? 'monthly-table__ytd--neg' : ''}>
                      {isYtdPos ? '+' : ''}
                      {ytdPct.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
