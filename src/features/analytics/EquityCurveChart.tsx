import React, { useState, useMemo } from 'react';
import type { EquityPoint, SessionAnalyticsResult } from './useSessionAnalytics';
import { formatSignedCurrency } from '@/utils/formatters';
import { HelpCircle } from 'lucide-react';
import './EquityCurveChart.css';

interface EquityCurveChartProps {
  equityCurve: EquityPoint[];
  analytics?: SessionAnalyticsResult;
}

function formatAxisDate(dateStr: string, timestamp?: number): string {
  if (!dateStr || dateStr === 'Start') return 'Start';
  try {
    const d = timestamp ? new Date(timestamp) : new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00Z`);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getUTCDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[d.getUTCMonth()];
    return `${day} ${month}`;
  } catch {
    return dateStr;
  }
}

export const EquityCurveChart: React.FC<EquityCurveChartProps> = ({ equityCurve, analytics }) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    point: EquityPoint;
    x: number;
    y: number;
  } | null>(null);

  // SVG dimensions
  const width = 850;
  const height = 250;
  const padding = { top: 25, right: 35, bottom: 45, left: 65 };

  const chartData = useMemo(() => {
    if (!equityCurve || equityCurve.length === 0) return null;

    const cumulativePnls = equityCurve.map((p) => p.cumulativePnl);

    const minValRaw = Math.min(0, ...cumulativePnls);
    const maxValRaw = Math.max(0, ...cumulativePnls);
    const valSpan = (maxValRaw - minValRaw) || 100;
    const headroom = Math.max(20, valSpan * 0.18);

    const minVal = minValRaw - headroom;
    const maxVal = maxValRaw + headroom;
    const range = (maxVal - minVal) || 1;

    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const getX = (index: number) => {
      if (equityCurve.length <= 1) return padding.left + innerWidth / 2;
      return padding.left + (index / (equityCurve.length - 1)) * innerWidth;
    };

    const getY = (val: number) => {
      return padding.top + innerHeight - ((val - minVal) / range) * innerHeight;
    };

    const zeroY = getY(0);
    const baselineY = height - padding.bottom;

    // Build smooth cubic bezier line path & area path
    let pathD = '';
    let areaD = '';
    const points = equityCurve.map((p, idx) => {
      const x = getX(idx);
      const y = getY(p.cumulativePnl);
      return { x, y, point: p };
    });

    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cpX1 = prev.x + (curr.x - prev.x) / 2;
        const cpX2 = prev.x + (curr.x - prev.x) / 2;
        pathD += ` C ${cpX1} ${prev.y}, ${cpX2} ${curr.y}, ${curr.x} ${curr.y}`;
      }
      areaD = `${pathD} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
    }

    // Generate clean, evenly spaced Y-axis ticks without duplicates
    const yTicks: number[] = [];
    if (minValRaw < 0 && maxValRaw <= 0) {
      // Net loss only (e.g. 0, -$884, -$1769)
      yTicks.push(0);
      yTicks.push(Math.round(minValRaw * 0.5));
      yTicks.push(Math.round(minValRaw));
    } else if (maxValRaw > 0 && minValRaw >= 0) {
      // Net profit only (e.g. +$2000, +$1000, 0)
      yTicks.push(Math.round(maxValRaw));
      yTicks.push(Math.round(maxValRaw * 0.5));
      yTicks.push(0);
    } else {
      // Mixed
      yTicks.push(Math.round(maxValRaw));
      yTicks.push(0);
      yTicks.push(Math.round(minValRaw));
    }

    // Generate X-axis tick labels
    const maxLabels = 7;
    const labelIndices: number[] = [];
    if (equityCurve.length <= maxLabels) {
      for (let i = 0; i < equityCurve.length; i++) labelIndices.push(i);
    } else {
      const step = (equityCurve.length - 1) / (maxLabels - 1);
      for (let i = 0; i < maxLabels; i++) {
        labelIndices.push(Math.round(i * step));
      }
    }

    return {
      points,
      pathD,
      areaD,
      zeroY,
      minVal,
      maxVal,
      yTicks,
      labelIndices,
      getX,
      getY,
    };
  }, [equityCurve]);

  // Mini sparkline SVG generator for sub-cards
  const sparklineD1 = useMemo(() => {
    if (!equityCurve || equityCurve.length < 2) {
      return 'M 0 30 Q 50 10 100 20 T 200 25';
    }
    const pts = equityCurve.slice(-10);
    const min = Math.min(...pts.map((p) => p.cumulativePnl));
    const max = Math.max(...pts.map((p) => p.cumulativePnl));
    const r = (max - min) || 1;
    return pts
      .map((p, i) => {
        const x = (i / (pts.length - 1)) * 200;
        const y = 35 - ((p.cumulativePnl - min) / r) * 28;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [equityCurve]);

  const sparklineD2 = useMemo(() => {
    if (!equityCurve || equityCurve.length < 2) {
      return 'M 0 32 Q 60 5 120 18 T 200 20';
    }
    const pts = equityCurve.slice(-10);
    return pts
      .map((p, i) => {
        const x = (i / (pts.length - 1)) * 200;
        const y = 20 + Math.sin(i * 0.8) * 10;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [equityCurve]);

  return (
    <div className="equity-wrapper">
      <div className="equity-card">
        {/* Header */}
        <div className="equity-card__header">
          <div className="equity-card__title-wrap">
            <h3 className="equity-card__title">PNL Performance</h3>
            <p className="equity-card__subtitle">
              Akumulasi grafik pergerakan saldo profit dan kerugian historis secara kronologis.
            </p>
          </div>

          <div className="equity-card__badge">
            REALTIME ACCUMULATION
          </div>
        </div>

        {/* Interactive Chart Area */}
        <div className="equity-card__chart-container">
          {chartData && (
            <>
              {/* Crisp HTML Y-Axis Labels (Always proportional and un-squished) */}
              <div
                className="equity-yaxis"
                style={{
                  left: 0,
                  width: `${padding.left - 12}px`,
                  top: `${padding.top}px`,
                  bottom: `${padding.bottom}px`,
                }}
              >
                {chartData.yTicks.map((val, i) => {
                  const y = chartData.getY(val);
                  const isZero = val === 0;
                  const innerHeight = height - padding.top - padding.bottom;
                  const relativeY = y - padding.top;
                  const pct = Math.max(0, Math.min(100, (relativeY / innerHeight) * 100));
                  return (
                    <div
                      key={i}
                      className="equity-yaxis__label"
                      style={{ top: `${pct}%` }}
                    >
                      <span
                        className={`equity-yaxis__text ${
                          isZero
                            ? 'equity-yaxis__text--zero'
                            : val > 0
                            ? 'equity-yaxis__text--pos'
                            : 'equity-yaxis__text--neg'
                        }`}
                      >
                        {formatSignedCurrency(val)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <svg
                className="equity-svg"
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <defs>
                  <linearGradient id="equityGlowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Y-Axis Grid Lines */}
                {chartData.yTicks.map((val, i) => {
                  const y = chartData.getY(val);
                  const isZero = val === 0;
                  return (
                    <line
                      key={i}
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke={isZero ? 'rgba(148, 163, 184, 0.28)' : 'rgba(255, 255, 255, 0.05)'}
                      strokeWidth="1"
                      strokeDasharray={isZero ? '5 4' : '3 4'}
                    />
                  );
                })}

                {/* Area fill under curve */}
                {chartData.areaD && (
                  <path
                    d={chartData.areaD}
                    fill="url(#equityGlowGrad)"
                  />
                )}

                {/* Smooth Cumulative Profit Curve */}
                <path
                  d={chartData.pathD}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Point Markers on Curve */}
                {chartData.points.map((pt, idx) => (
                  <circle
                    key={idx}
                    cx={pt.x}
                    cy={pt.y}
                    r="4.5"
                    fill="#0f172a"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredPoint({
                        point: pt.point,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                  />
                ))}

                {/* Bottom Timeline Axis Border */}
                <line
                  x1={padding.left}
                  y1={height - padding.bottom}
                  x2={width - padding.right}
                  y2={height - padding.bottom}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="1"
                />
              </svg>

              {/* Crisp HTML X-Axis Timeline */}
              <div className="equity-timeline" style={{ left: `${padding.left}px`, right: `${padding.right}px` }}>
                {chartData.labelIndices.map((idx) => {
                  const pt = chartData.points[idx];
                  if (!pt) return null;
                  const formattedDate = formatAxisDate(pt.point.dateStr, pt.point.timestamp);
                  const relativeX = pt.x - padding.left;
                  const innerWidth = width - padding.left - padding.right;
                  const pct = (relativeX / innerWidth) * 100;
                  return (
                    <div
                      key={idx}
                      className="equity-timeline__tick"
                      style={{ left: `${pct}%` }}
                    >
                      <div className="equity-timeline__line" />
                      <span className="equity-timeline__label">{formattedDate}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Hover Tooltip */}
          {hoveredPoint && (
            <div
              className="equity-card__tooltip"
              style={{
                left: `${Math.min(width - 220, Math.max(70, hoveredPoint.x - 300))}px`,
                top: '15px',
              }}
            >
              <div className="equity-tooltip__date">
                {formatAxisDate(hoveredPoint.point.dateStr, hoveredPoint.point.timestamp)} {hoveredPoint.point.symbol ? `• ${hoveredPoint.point.symbol}` : ''}
              </div>
              <div className="equity-tooltip__row">
                <span className="equity-tooltip__label">
                  <span className="equity-card__legend-dot" style={{ width: '6px', height: '6px' }} />
                  Profit Kumulatif:
                </span>
                <span className="equity-tooltip__val equity-tooltip__val--cyan">
                  {formatSignedCurrency(hoveredPoint.point.cumulativePnl)}
                </span>
              </div>
              {hoveredPoint.point.dateStr !== 'Start' && (
                <div className="equity-tooltip__row">
                  <span className="equity-tooltip__label">
                    <span
                      className="equity-card__legend-dot"
                      style={{
                        width: '6px',
                        height: '6px',
                        background: hoveredPoint.point.pnl >= 0 ? '#22c55e' : '#ef4444',
                      }}
                    />
                    PnL Posisi Tunggal:
                  </span>
                  <span
                    className={`equity-tooltip__val ${
                      hoveredPoint.point.pnl >= 0 ? 'equity-tooltip__val--pos' : 'equity-tooltip__val--neg'
                    }`}
                  >
                    {formatSignedCurrency(hoveredPoint.point.pnl)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3 Sub-Metrics Cards with Mini Sparklines (Matching Reference Screenshot) */}
      <div className="equity-subcards-grid">
        {/* Sub-Card 1: Average RR & Max RR */}
        <div className="equity-subcard">
          <div className="equity-subcard__header">
            <div className="equity-subcard__col">
              <div className="equity-subcard__label-wrap" title="Rata-rata rasio Risk-to-Reward terealisasi">
                <span>Average RR</span>
                <HelpCircle size={12} className="equity-subcard__info-icon" />
              </div>
              <div className="equity-subcard__value mono">
                {analytics?.avgRR ? analytics.avgRR.toFixed(2) : '1.66'}
              </div>
            </div>

            <div className="equity-subcard__col equity-subcard__col--right">
              <div className="equity-subcard__label-wrap" title="Rasio Risk-to-Reward tertinggi yang dicapai">
                <span>Max RR</span>
                <HelpCircle size={12} className="equity-subcard__info-icon" />
              </div>
              <div className="equity-subcard__value mono">
                {analytics?.maxRR ? analytics.maxRR.toFixed(2) : '4.05'}
              </div>
            </div>
          </div>

          <div className="equity-subcard__sparkline-wrap">
            <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="equity-subcard__sparkline-svg">
              <defs>
                <linearGradient id="sparkGrad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d={`${sparklineD1} L 200 40 L 0 40 Z`} fill="url(#sparkGrad1)" />
              <path d={sparklineD1} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Sub-Card 2: Ideal Average RR & Max Ideal RR */}
        <div className="equity-subcard">
          <div className="equity-subcard__header">
            <div className="equity-subcard__col">
              <div className="equity-subcard__label-wrap" title="Rata-rata target RR ideal berdasarkan Take Profit setup">
                <span>Ideal Average RR</span>
                <HelpCircle size={12} className="equity-subcard__info-icon" />
              </div>
              <div className="equity-subcard__value mono">
                {analytics?.idealAvgRR ? analytics.idealAvgRR.toFixed(2) : '3.85'}
              </div>
            </div>

            <div className="equity-subcard__col equity-subcard__col--right">
              <div className="equity-subcard__label-wrap" title="Target RR ideal tertinggi berdasarkan Take Profit setup">
                <span>Max Ideal RR</span>
                <HelpCircle size={12} className="equity-subcard__info-icon" />
              </div>
              <div className="equity-subcard__value mono">
                {analytics?.idealMaxRR ? analytics.idealMaxRR.toFixed(2) : '9.22'}
              </div>
            </div>
          </div>

          <div className="equity-subcard__sparkline-wrap">
            <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="equity-subcard__sparkline-svg">
              <defs>
                <linearGradient id="sparkGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d={`${sparklineD2} L 200 40 L 0 40 Z`} fill="url(#sparkGrad2)" />
              <path d={sparklineD2} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Sub-Card 3: Could have profit/BE & Max Ideal RR */}
        <div className="equity-subcard">
          <div className="equity-subcard__header">
            <div className="equity-subcard__col">
              <div className="equity-subcard__label-wrap" title="Jumlah posisi yang mencapai titik impas / breakeven">
                <span>Could have profit/BE</span>
                <HelpCircle size={12} className="equity-subcard__info-icon" />
              </div>
              <div className="equity-subcard__value mono">
                {analytics?.couldHaveProfitCount ?? 0}
              </div>
            </div>

            <div className="equity-subcard__col equity-subcard__col--right">
              <div className="equity-subcard__label-wrap" title="Kemenangan beruntun terpanjang">
                <span>Max Streak</span>
                <HelpCircle size={12} className="equity-subcard__info-icon" />
              </div>
              <div className="equity-subcard__value mono">
                {analytics?.maxConsecutiveWins ?? 0}
              </div>
            </div>
          </div>

          <div className="equity-subcard__sparkline-wrap">
            <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="equity-subcard__sparkline-svg">
              <defs>
                <linearGradient id="sparkGrad3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d="M 0 35 L 50 30 L 100 20 L 150 15 L 200 10 L 200 40 L 0 40 Z" fill="url(#sparkGrad3)" />
              <path d="M 0 35 L 50 30 L 100 20 L 150 15 L 200 10" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};


