import React from 'react';
import type { SessionAnalyticsResult } from './useSessionAnalytics';
import { formatSignedCurrency } from '@/utils/formatters';
import './TradeDistributionChart.css';

interface TradeDistributionChartProps {
  analytics: SessionAnalyticsResult;
}

export const TradeDistributionChart: React.FC<TradeDistributionChartProps> = ({ analytics }) => {
  const total = analytics.totalTrades;
  const buyPct = total > 0 ? (analytics.buyTradesCount / total) * 100 : 0;
  const sellPct = total > 0 ? (analytics.sellTradesCount / total) * 100 : 0;

  const winPct = analytics.winRate;
  const lossPct = analytics.lossRate;

  // Donut 1 (Buy/Sell) math
  const r1 = 65;
  const circ1 = 2 * Math.PI * r1;
  const buyStroke = (buyPct / 100) * circ1;

  // Donut 2 (Win/Loss Concentric) math
  const rOuter = 65;
  const circOuter = 2 * Math.PI * rOuter;
  const winStroke = (winPct / 100) * circOuter;

  const rInner = 45;
  const circInner = 2 * Math.PI * rInner;
  const lossStroke = (lossPct / 100) * circInner;

  // Triangular Radar Graph Generator for Session Breakdown (Asia, London, New York)
  // Triangle vertices: Asia = Top (70, 20), London = Bottom-Left (25, 110), NY = Bottom-Right (115, 110), Center = (70, 75)
  const renderTriangularRadar = (
    valAsia: number,
    valLondon: number,
    valNY: number,
    maxVal: number,
    color: string
  ) => {
    const center = { x: 70, y: 75 };
    const pAsia = { x: 70, y: 20 };
    const pLondon = { x: 25, y: 110 };
    const pNY = { x: 115, y: 110 };

    const normAsia = maxVal > 0 ? Math.min(1, Math.max(0, valAsia / maxVal)) : 0;
    const normLondon = maxVal > 0 ? Math.min(1, Math.max(0, valLondon / maxVal)) : 0;
    const normNY = maxVal > 0 ? Math.min(1, Math.max(0, valNY / maxVal)) : 0;

    const ptA = {
      x: center.x + (pAsia.x - center.x) * normAsia,
      y: center.y + (pAsia.y - center.y) * normAsia,
    };
    const ptL = {
      x: center.x + (pLondon.x - center.x) * normLondon,
      y: center.y + (pLondon.y - center.y) * normLondon,
    };
    const ptNY = {
      x: center.x + (pNY.x - center.x) * normNY,
      y: center.y + (pNY.y - center.y) * normNY,
    };

    const polyPoints = `${ptA.x},${ptA.y} ${ptL.x},${ptL.y} ${ptNY.x},${ptNY.y}`;

    return (
      <svg className="radar-svg" viewBox="0 0 140 140">
        {/* Background Guide Grid Triangle */}
        <polygon
          points={`${pAsia.x},${pAsia.y} ${pLondon.x},${pLondon.y} ${pNY.x},${pNY.y}`}
          fill="none"
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth="1"
        />
        <line x1={center.x} y1={center.y} x2={pAsia.x} y2={pAsia.y} stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />
        <line x1={center.x} y1={center.y} x2={pLondon.x} y2={pLondon.y} stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />
        <line x1={center.x} y1={center.y} x2={pNY.x} y2={pNY.y} stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />

        {/* Vertex Labels */}
        <text x="70" y="13" textAnchor="middle" fill="#cbd5e1" fontSize="9.5" fontWeight="700">
          Asia
        </text>
        <text x="18" y="124" textAnchor="middle" fill="#cbd5e1" fontSize="9.5" fontWeight="700">
          London
        </text>
        <text x="122" y="124" textAnchor="middle" fill="#cbd5e1" fontSize="9.5" fontWeight="700">
          New York
        </text>

        {/* Data Shape */}
        <polygon
          points={polyPoints}
          fill={color}
          fillOpacity="0.25"
          stroke={color}
          strokeWidth="2.5"
        />

        {/* Data Markers */}
        <circle cx={ptA.x} cy={ptA.y} r="3.5" fill={color} stroke="#181b22" strokeWidth="1" />
        <circle cx={ptL.x} cy={ptL.y} r="3.5" fill={color} stroke="#181b22" strokeWidth="1" />
        <circle cx={ptNY.x} cy={ptNY.y} r="3.5" fill={color} stroke="#181b22" strokeWidth="1" />
      </svg>
    );
  };

  const sAsia = analytics.sessionBreakdown.Asia;
  const sLondon = analytics.sessionBreakdown.London;
  const sNY = analytics.sessionBreakdown['New York'];

  return (
    <div className="trade-distrib">
      {/* Top Row: Donut Charts (Matching Reference Screenshot 4) */}
      <div className="trade-distrib__donuts-row">
        {/* Donut 1: Total Trades (Buy vs Sell) */}
        <div className="distrib-card">
          <h4 className="distrib-card__title">Total Trades</h4>
          <div className="distrib-card__chart-wrap">
            <svg className="distrib-donut-svg" viewBox="0 0 160 160">
              {/* Background Track */}
              <circle
                cx="80"
                cy="80"
                r={r1}
                fill="none"
                stroke="#242c3d"
                strokeWidth="14"
              />
              {/* Buy Stroke (Cyan) */}
              <circle
                cx="80"
                cy="80"
                r={r1}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="14"
                strokeDasharray={`${buyStroke} ${circ1}`}
                strokeLinecap="round"
              />
            </svg>

            <div className="distrib-donut__tooltip">
              Buy: {analytics.buyTradesCount} trade ({buyPct.toFixed(0)}%)
            </div>
          </div>
        </div>

        {/* Donut 2: Win Rate Overview */}
        <div className="distrib-card">
          <h4 className="distrib-card__title">Win Rate Overview</h4>
          <div className="distrib-card__chart-wrap">
            <svg className="distrib-donut-svg" viewBox="0 0 160 160">
              {/* Outer Track (Win Rate) */}
              <circle
                cx="80"
                cy="80"
                r={rOuter}
                fill="none"
                stroke="#0f172a"
                strokeWidth="10"
              />
              <circle
                cx="80"
                cy="80"
                r={rOuter}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="10"
                strokeDasharray={`${winStroke} ${circOuter}`}
                strokeLinecap="round"
              />

              {/* Inner Track (Loss Rate) */}
              <circle
                cx="80"
                cy="80"
                r={rInner}
                fill="none"
                stroke="#0f172a"
                strokeWidth="8"
              />
              <circle
                cx="80"
                cy="80"
                r={rInner}
                fill="none"
                stroke="#a855f7"
                strokeWidth="8"
                strokeDasharray={`${lossStroke} ${circInner}`}
                strokeLinecap="round"
              />
            </svg>

            <div className="distrib-donut__center-label">
              <span className="distrib-donut__center-val" style={{ color: '#22d3ee' }}>
                {winPct.toFixed(0)}%
              </span>
              <span className="distrib-donut__center-sub" style={{ color: '#c084fc' }}>
                {lossPct.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row: Performance by Session Radar Graphs (Asia, London, New York) */}
      <div className="session-perf-section">
        <h4 className="session-perf-section__title">Performance by Session</h4>

        <div className="session-radars-grid">
          {/* Radar 1: Win Rate */}
          <div className="radar-card">
            <span className="radar-card__title">Win Rate</span>
            <div className="radar-svg-wrap">
              {renderTriangularRadar(sAsia.winRate, sLondon.winRate, sNY.winRate, 100, '#22d3ee')}
            </div>
          </div>

          {/* Radar 2: Total Trades */}
          <div className="radar-card">
            <span className="radar-card__title">Total Trades</span>
            <div className="radar-svg-wrap">
              {renderTriangularRadar(
                sAsia.tradesCount,
                sLondon.tradesCount,
                sNY.tradesCount,
                Math.max(1, sAsia.tradesCount, sLondon.tradesCount, sNY.tradesCount),
                '#38bdf8'
              )}
            </div>
          </div>

          {/* Radar 3: Avg RR */}
          <div className="radar-card">
            <span className="radar-card__title">Avg RR</span>
            <div className="radar-svg-wrap">
              {renderTriangularRadar(
                sAsia.avgRR,
                sLondon.avgRR,
                sNY.avgRR,
                Math.max(1, sAsia.avgRR, sLondon.avgRR, sNY.avgRR),
                '#818cf8'
              )}
            </div>
          </div>

          {/* Radar 4: Profit */}
          <div className="radar-card">
            <span className="radar-card__title">Profit</span>
            <div className="radar-svg-wrap">
              {renderTriangularRadar(
                Math.max(0, sAsia.netProfit),
                Math.max(0, sLondon.netProfit),
                Math.max(0, sNY.netProfit),
                Math.max(1, sAsia.netProfit, sLondon.netProfit, sNY.netProfit),
                '#22c55e'
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Performance by Pair Breakdown */}
      {analytics.pairBreakdown.length > 0 && (
        <div className="pair-breakdown-card">
          <h4 className="session-perf-section__title" style={{ marginBottom: '14px' }}>
            Performance by Pair Breakdown
          </h4>
          <table className="pair-table">
            <thead>
              <tr>
                <th>Pair Symbol</th>
                <th>Trades Count</th>
                <th>Win Rate</th>
                <th>Profit Factor</th>
                <th>Net Profit ($)</th>
              </tr>
            </thead>
            <tbody>
              {analytics.pairBreakdown.map((p) => {
                const isPos = p.netProfit >= 0;
                return (
                  <tr key={p.symbol}>
                    <td>
                      <span className="pair-badge">{p.symbol}</span>
                    </td>
                    <td>{p.tradesCount} Trades</td>
                    <td>{p.winRate.toFixed(1)}%</td>
                    <td>{p.profitFactor.toFixed(2)}</td>
                    <td style={{ color: isPos ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                      {formatSignedCurrency(p.netProfit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
