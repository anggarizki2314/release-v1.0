import React from 'react';

interface PnlSparklineProps {
  data?: number[];
  width?: number | string;
  height?: number;
  color?: string;
  gradientId?: string;
  isPositive?: boolean;
}

export const PnlSparkline: React.FC<PnlSparklineProps> = ({
  data = [1000, 1020, 1010, 1050, 1040, 1080, 1120, 1110, 1150, 1200, 1180, 1250, 1300, 1280, 1350, 1420],
  width = '100%',
  height = 70,
  color,
  gradientId = 'sparkline-grad',
  isPositive = true,
}) => {
  if (!data || data.length < 2) {
    data = [100, 105, 102, 110, 108, 115, 120];
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const strokeColor = color ?? (isPositive ? '#22C55E' : '#EF4444');
  const svgWidth = 400;
  const svgHeight = height;
  const padding = 6;

  // Compute normalized points
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * (svgWidth - padding * 2) + padding;
    const y = svgHeight - padding - ((val - min) / range) * (svgHeight - padding * 2);
    return { x, y };
  });

  // Construct smooth cubic bezier path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const cpX1 = curr.x + (next.x - curr.x) / 2;
    const cpY1 = curr.y;
    const cpX2 = curr.x + (next.x - curr.x) / 2;
    const cpY2 = next.y;
    pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
  }

  const areaD = `${pathD} L ${points[points.length - 1].x} ${svgHeight} L ${points[0].x} ${svgHeight} Z`;

  return (
    <div style={{ width, height, overflow: 'hidden' }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.35} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        {/* Gradient Area Fill */}
        <path d={areaD} fill={`url(#${gradientId})`} />
        {/* Glowing Line */}
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0px 2px 6px ${strokeColor}66)` }}
        />
      </svg>
    </div>
  );
};
