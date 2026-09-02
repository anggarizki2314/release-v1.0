/**
 * ToolIcon — SVG icon for each drawing tool and toolbar group.
 *
 * All icons use a monoline 20×20 viewBox with stroke-based rendering (approx 1.8px stroke width).
 * Stroke cap: round, color inherits from parent.
 * Styled precisely to match TradingView's compact visual design.
 */

interface ToolIconProps {
  id: string;
  className?: string;
  size?: number;
}

const S = 20;

function Icon({ children, className, size = 18 }: { children: React.ReactNode; className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${S} ${S}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

// ─── Icon map ──────────────────────────────────────────────────────

const icons: Record<string, (size?: number) => JSX.Element> = {
  // ═══════════════════════════════════════════════════════════════════
  // 11 MAIN GROUP ICONS (Left Toolbar Bar)
  // ═══════════════════════════════════════════════════════════════════

  // 1. CURSOR (Group Icon)
  'group-cursor': (sz) => (
    <Icon size={sz}>
      <line x1="10" y1="2" x2="10" y2="7" />
      <line x1="10" y1="13" x2="10" y2="18" />
      <line x1="2" y1="10" x2="7" y2="10" />
      <line x1="13" y1="10" x2="18" y2="10" />
    </Icon>
  ),

  // 2. TREND LINE (Group Icon: 45° line with 2 endpoint dots)
  'group-trend': (sz) => (
    <Icon size={sz}>
      <circle cx="4.5" cy="15.5" r="1.8" />
      <circle cx="15.5" cy="4.5" r="1.8" />
      <line x1="5.8" y1="14.2" x2="14.2" y2="5.8" />
    </Icon>
  ),

  // 3. SHAPES (Group Icon: Hollow rectangle)
  'group-shapes': (sz) => (
    <Icon size={sz}>
      <rect x="3" y="4" width="14" height="12" rx="1" />
    </Icon>
  ),

  // 4. FIBONACCI (Group Icon: 0 --- o / --- 0.618 / 1 --- o)
  'group-fibonacci': (sz) => (
    <Icon size={sz}>
      {/* Top line: 0 ───── o */}
      <text x="2" y="6.8" fill="currentColor" stroke="none" fontSize="4.8" fontWeight="700" fontFamily="var(--font-mono, monospace, sans-serif)">0</text>
      <line x1="5.5" y1="5.5" x2="14.5" y2="5.5" strokeWidth={1.5} />
      <circle cx="16.2" cy="5.5" r="1.3" />

      {/* Middle line: ─── 0.618 */}
      <line x1="2" y1="10.5" x2="7.5" y2="10.5" strokeWidth={1.5} />
      <text x="8.5" y="12" fill="currentColor" stroke="none" fontSize="4.5" fontWeight="700" fontFamily="var(--font-mono, monospace, sans-serif)">0.618</text>

      {/* Bottom line: 1 ───── o */}
      <text x="2" y="16.8" fill="currentColor" stroke="none" fontSize="4.8" fontWeight="700" fontFamily="var(--font-mono, monospace, sans-serif)">1</text>
      <line x1="5.5" y1="15.5" x2="14.5" y2="15.5" strokeWidth={1.5} />
      <circle cx="16.2" cy="15.5" r="1.3" />
    </Icon>
  ),

  // 5. BUY / SELL (Group Icon: Stacked L on top in green, S on bottom in red)
  'group-buysell': (sz = 18) => (
    <svg width={sz} height={sz} viewBox="0 0 20 20" fill="none">
      <text x="10" y="8" fill="#2fbf8f" fontSize="9.5" fontWeight="800" textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-mono, monospace, sans-serif)">L</text>
      <text x="10" y="14.5" fill="#ef4a63" fontSize="9.5" fontWeight="800" textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-mono, monospace, sans-serif)">S</text>
    </svg>
  ),

  // 6. TEXT / ANNOTATION (Group Icon: Monoline T)
  'group-text': (sz) => (
    <Icon size={sz}>
      <line x1="4" y1="5" x2="16" y2="5" />
      <line x1="10" y1="5" x2="10" y2="16" />
    </Icon>
  ),

  // 7. BRUSH (Group Icon: Stylized angled pen / brush)
  'group-brush': (sz) => (
    <Icon size={sz}>
      <path d="M14 3l3 3-9 9H5v-3l9-9z" />
      <path d="M12 5l3 3" />
    </Icon>
  ),

  // 8. MEASUREMENT (Group Icon: Vertical ruler span arrow)
  'group-measurement': (sz) => (
    <Icon size={sz}>
      <line x1="3" y1="3" x2="17" y2="3" />
      <line x1="3" y1="17" x2="17" y2="17" />
      <line x1="10" y1="4" x2="10" y2="16" />
      <polyline points="7.5,6.5 10,4 12.5,6.5" />
      <polyline points="7.5,13.5 10,16 12.5,13.5" />
    </Icon>
  ),

  // 9. MAGNET (Group Icon: Downward horseshoe magnet with pole dividers)
  'group-magnet': (sz) => (
    <Icon size={sz}>
      <path d="M4 15.5 V9 A6 6 0 0 1 16 9 V15.5 A1.5 1.5 0 0 1 13 15.5 V9 A3 3 0 0 0 7 9 V15.5 A1.5 1.5 0 0 1 4 15.5 Z" />
      <line x1="4" y1="12.5" x2="7" y2="12.5" strokeWidth={1.5} />
      <line x1="13" y1="12.5" x2="16" y2="12.5" strokeWidth={1.5} />
    </Icon>
  ),

  // 10. MANAGEMENT (Group Icon: Settings / Cog)
  'group-management': (sz) => (
    <Icon size={sz}>
      <circle cx="10" cy="10" r="2.8" />
      <path d="M16 12.5a1.2 1.2 0 0 0 .2 1.3l.1.1a1.5 1.5 0 0 1-2.1 2.1l-.1-.1a1.2 1.2 0 0 0-1.3-.2 1.2 1.2 0 0 0-.7 1.1V17a1.5 1.5 0 0 1-3 0v-.2a1.2 1.2 0 0 0-.7-1.1 1.2 1.2 0 0 0-1.3.2l-.1.1a1.5 1.5 0 0 1-2.1-2.1l.1-.1a1.2 1.2 0 0 0 .2-1.3 1.2 1.2 0 0 0-1.1-.7H4a1.5 1.5 0 0 1 0-3h.2a1.2 1.2 0 0 0 1.1-.7 1.2 1.2 0 0 0-.2-1.3l-.1-.1a1.5 1.5 0 0 1 2.1-2.1l.1.1a1.2 1.2 0 0 0 1.3.2 1.2 1.2 0 0 0 .7-1.1V4a1.5 1.5 0 0 1 3 0v.2a1.2 1.2 0 0 0 .7 1.1 1.2 1.2 0 0 0 1.3-.2l.1-.1a1.5 1.5 0 0 1 2.1 2.1l-.1.1a1.2 1.2 0 0 0-.2 1.3 1.2 1.2 0 0 0 1.1.7H17a1.5 1.5 0 0 1 0 3h-.2a1.2 1.2 0 0 0-1.1.7z" />
    </Icon>
  ),

  // 11. DELETE (Group Icon: Trash bin)
  'group-delete': (sz) => (
    <Icon size={sz}>
      <polyline points="3 6 5 6 17 6" />
      <path d="M6 6v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" />
      <path d="M8 6V4a1.5 1.5 0 0 1 1.5-1.5h1A1.5 1.5 0 0 1 12 4v2" />
      <line x1="8.5" y1="9.5" x2="8.5" y2="14.5" strokeWidth={1.3} />
      <line x1="11.5" y1="9.5" x2="11.5" y2="14.5" strokeWidth={1.3} />
    </Icon>
  ),

  // ═══════════════════════════════════════════════════════════════════
  // FLYOUT TOOL ICONS
  // ═══════════════════════════════════════════════════════════════════

  // ── 1. Cursor Tools ──
  'crosshair': (sz) => (
    <Icon size={sz}>
      <line x1="10" y1="2" x2="10" y2="7" />
      <line x1="10" y1="13" x2="10" y2="18" />
      <line x1="2" y1="10" x2="7" y2="10" />
      <line x1="13" y1="10" x2="18" y2="10" />
    </Icon>
  ),

  // ── 2. Trend & Line Tools ──
  'trendline': (sz) => (
    <Icon size={sz}>
      <circle cx="4" cy="16" r="1.5" />
      <circle cx="16" cy="4" r="1.5" />
      <line x1="5.1" y1="14.9" x2="14.9" y2="5.1" />
    </Icon>
  ),
  'ray': (sz) => (
    <Icon size={sz}>
      <circle cx="4" cy="16" r="1.5" />
      <line x1="5.1" y1="14.9" x2="17" y2="3" />
      <polyline points="13,3 17,3 17,7" />
    </Icon>
  ),
  'extended-line': (sz) => (
    <Icon size={sz}>
      <line x1="2" y1="18" x2="18" y2="2" />
      <circle cx="7" cy="13" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="13" cy="7" r="1.5" fill="currentColor" stroke="none" />
    </Icon>
  ),
  'info-line': (sz) => (
    <Icon size={sz}>
      <line x1="3" y1="17" x2="17" y2="3" />
      <circle cx="10" cy="10" r="2.8" strokeWidth={1.2} />
      <line x1="10" y1="9" x2="10" y2="11.5" strokeWidth={1.3} />
    </Icon>
  ),
  'horizontal-line': (sz) => (
    <Icon size={sz}>
      <line x1="2" y1="10" x2="18" y2="10" />
    </Icon>
  ),
  'horizontal-ray': (sz) => (
    <Icon size={sz}>
      <circle cx="4" cy="10" r="1.5" />
      <line x1="5.5" y1="10" x2="18" y2="10" />
      <polyline points="15,7 18,10 15,13" />
    </Icon>
  ),
  'vertical-line': (sz) => (
    <Icon size={sz}>
      <line x1="10" y1="2" x2="10" y2="18" />
    </Icon>
  ),
  'cross-line': (sz) => (
    <Icon size={sz}>
      <line x1="2" y1="10" x2="18" y2="10" />
      <line x1="10" y1="2" x2="10" y2="18" />
    </Icon>
  ),
  'channel': (sz) => (
    <Icon size={sz}>
      <line x1="3" y1="6" x2="17" y2="6" />
      <line x1="3" y1="14" x2="17" y2="14" />
      <line x1="3" y1="10" x2="17" y2="10" strokeDasharray="2 2" strokeWidth={1.2} />
    </Icon>
  ),

  // ── 3. Shapes Tools ──
  'rectangle': (sz) => (
    <Icon size={sz}>
      <rect x="3" y="5" width="14" height="10" rx="1" />
    </Icon>
  ),
  'rotated-rectangle': (sz) => (
    <Icon size={sz}>
      <rect x="3" y="5" width="14" height="10" rx="1" transform="rotate(-15 10 10)" />
    </Icon>
  ),
  'circle': (sz) => (
    <Icon size={sz}>
      <circle cx="10" cy="10" r="6.8" />
    </Icon>
  ),
  'ellipse': (sz) => (
    <Icon size={sz}>
      <ellipse cx="10" cy="10" rx="7.5" ry="4.8" />
    </Icon>
  ),
  'triangle': (sz) => (
    <Icon size={sz}>
      <polygon points="10,3.5 17.5,16.5 2.5,16.5" />
    </Icon>
  ),
  'arc': (sz) => (
    <Icon size={sz}>
      <path d="M3 15 Q10 2 17 15" />
    </Icon>
  ),
  'curve': (sz) => (
    <Icon size={sz}>
      <path d="M3 15 C3 6, 17 6, 17 15" />
    </Icon>
  ),
  'double-curve': (sz) => (
    <Icon size={sz}>
      <path d="M3 10 C3 4, 10 4, 10 10 C10 16, 17 16, 17 10" />
    </Icon>
  ),
  'polyline': (sz) => (
    <Icon size={sz}>
      <polyline points="3,14 7,6 12,12 17,4" />
      <circle cx="3" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="7" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="4" r="1" fill="currentColor" stroke="none" />
    </Icon>
  ),
  'path': (sz) => (
    <Icon size={sz}>
      <path d="M3 15 Q7 3 10 10 Q13 17 17 5" />
      <circle cx="3" cy="15" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="17" cy="5" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  ),

  // ── 4. Fibonacci Tools ──
  'fib-retracement': (sz) => (
    <Icon size={sz}>
      {/* Top line: 0 ───── o */}
      <text x="2" y="6.8" fill="currentColor" stroke="none" fontSize="4.8" fontWeight="700" fontFamily="var(--font-mono, monospace, sans-serif)">0</text>
      <line x1="5.5" y1="5.5" x2="14.5" y2="5.5" strokeWidth={1.5} />
      <circle cx="16.2" cy="5.5" r="1.3" />

      {/* Middle line: ─── 0.618 */}
      <line x1="2" y1="10.5" x2="7.5" y2="10.5" strokeWidth={1.5} />
      <text x="8.5" y="12" fill="currentColor" stroke="none" fontSize="4.5" fontWeight="700" fontFamily="var(--font-mono, monospace, sans-serif)">0.618</text>

      {/* Bottom line: 1 ───── o */}
      <text x="2" y="16.8" fill="currentColor" stroke="none" fontSize="4.8" fontWeight="700" fontFamily="var(--font-mono, monospace, sans-serif)">1</text>
      <line x1="5.5" y1="15.5" x2="14.5" y2="15.5" strokeWidth={1.5} />
      <circle cx="16.2" cy="15.5" r="1.3" />
    </Icon>
  ),
  'fib-extension': (sz) => (
    <Icon size={sz}>
      <line x1="3" y1="5" x2="17" y2="5" strokeDasharray="2 2" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="15" x2="17" y2="15" strokeDasharray="2 2" />
      <polyline points="3,5 3,15 17,15" strokeWidth={1.2} />
    </Icon>
  ),
  'fib-channel': (sz) => (
    <Icon size={sz}>
      <line x1="3" y1="4" x2="17" y2="8" />
      <line x1="3" y1="10" x2="17" y2="14" />
      <line x1="3" y1="16" x2="17" y2="12" strokeDasharray="2 2" />
    </Icon>
  ),
  'fib-timezone': (sz) => (
    <Icon size={sz}>
      <line x1="4" y1="3" x2="4" y2="17" />
      <line x1="8" y1="3" x2="8" y2="17" />
      <line x1="12" y1="3" x2="12" y2="17" />
      <line x1="16" y1="3" x2="16" y2="17" />
      <line x1="3" y1="7" x2="17" y2="13" strokeWidth={1.4} />
    </Icon>
  ),
  'fib-fan': (sz) => (
    <Icon size={sz}>
      <line x1="3" y1="4" x2="17" y2="4" />
      <line x1="3" y1="4" x2="17" y2="10" strokeDasharray="2 2" />
      <line x1="3" y1="4" x2="17" y2="16" />
    </Icon>
  ),
  'gann-box': (sz) => (
    <Icon size={sz}>
      <rect x="3" y="3" width="14" height="14" rx="1" />
      <line x1="3" y1="3" x2="17" y2="17" />
      <line x1="17" y1="3" x2="3" y2="17" />
    </Icon>
  ),
  'gann-fan': (sz) => (
    <Icon size={sz}>
      <line x1="3" y1="3" x2="17" y2="3" />
      <line x1="3" y1="3" x2="17" y2="8" />
      <line x1="3" y1="3" x2="17" y2="13" />
      <line x1="3" y1="3" x2="17" y2="17" />
    </Icon>
  ),

  // ── 5. Buy / Sell Position Tools ──
  'long-position': (sz = 18) => (
    <svg width={sz} height={sz} viewBox="0 0 20 20" fill="none">
      <text x="6" y="14" fill="#2fbf8f" fontSize="13" fontWeight="800" textAnchor="middle" fontFamily="var(--font-mono, monospace, sans-serif)">L</text>
      <rect x="11" y="5" width="6" height="10" rx="1" fill="rgba(47,191,143,0.25)" stroke="#2fbf8f" strokeWidth="1.2" />
    </svg>
  ),
  'short-position': (sz = 18) => (
    <svg width={sz} height={sz} viewBox="0 0 20 20" fill="none">
      <text x="6" y="14" fill="#ef4a63" fontSize="13" fontWeight="800" textAnchor="middle" fontFamily="var(--font-mono, monospace, sans-serif)">S</text>
      <rect x="11" y="5" width="6" height="10" rx="1" fill="rgba(239,74,99,0.25)" stroke="#ef4a63" strokeWidth="1.2" />
    </svg>
  ),

  // ── 6. Text & Annotation Tools ──
  'text': (sz) => (
    <Icon size={sz}>
      <line x1="4" y1="5" x2="16" y2="5" />
      <line x1="10" y1="5" x2="10" y2="16" />
    </Icon>
  ),
  'anchored-text': (sz) => (
    <Icon size={sz}>
      <line x1="3" y1="5" x2="13" y2="5" />
      <line x1="8" y1="5" x2="8" y2="15" />
      <line x1="15" y1="16" x2="15" y2="4" strokeWidth={1.2} />
      <circle cx="15" cy="4" r="1.5" fill="currentColor" stroke="none" />
    </Icon>
  ),
  'note': (sz) => (
    <Icon size={sz}>
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <line x1="6" y1="7" x2="14" y2="7" strokeWidth={1.2} />
      <line x1="6" y1="10" x2="14" y2="10" strokeWidth={1.2} />
      <line x1="6" y1="13" x2="11" y2="13" strokeWidth={1.2} />
    </Icon>
  ),
  'anchored-note': (sz) => (
    <Icon size={sz}>
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <line x1="5" y1="5" x2="11" y2="5" strokeWidth={1} />
      <line x1="5" y1="8" x2="11" y2="8" strokeWidth={1} />
      <circle cx="15" cy="15" r="2.2" fill="currentColor" stroke="none" opacity={0.6} />
    </Icon>
  ),
  'callout': (sz) => (
    <Icon size={sz}>
      <rect x="2" y="3" width="16" height="11" rx="2" />
      <polyline points="6,14 8,18 12,14" />
      <line x1="6" y1="7" x2="14" y2="7" strokeWidth={1.2} />
      <line x1="6" y1="10" x2="14" y2="10" strokeWidth={1.2} />
    </Icon>
  ),
  'balloon': (sz) => (
    <Icon size={sz}>
      <ellipse cx="10" cy="8" rx="7" ry="5.5" />
      <polyline points="8,13 6,17 10,14" />
      <line x1="6" y1="6.5" x2="14" y2="6.5" strokeWidth={1} />
      <line x1="6" y1="9.5" x2="14" y2="9.5" strokeWidth={1} />
    </Icon>
  ),
  'price-label': (sz) => (
    <Icon size={sz}>
      <rect x="2" y="5" width="16" height="10" rx="2" />
      <text x="6" y="13" fontSize="7.5" fill="currentColor" stroke="none" fontWeight="700" fontFamily="var(--font-mono, monospace)">$</text>
    </Icon>
  ),

  // ── 7. Brush Tools ──
  'brush': (sz) => (
    <Icon size={sz}>
      <path d="M3 16 L9 10 Q11 8 13 10 L16 13" strokeWidth={1.8} />
      <circle cx="4" cy="15" r="1.5" fill="currentColor" stroke="none" />
    </Icon>
  ),
  'highlighter': (sz) => (
    <Icon size={sz}>
      <path d="M3 17 L10 10 L14 14 L7 17 Z" fill="currentColor" opacity={0.3} />
      <line x1="10" y1="10" x2="14" y2="14" strokeWidth={1.8} />
      <line x1="14" y1="14" x2="17" y2="17" strokeWidth={1.8} />
    </Icon>
  ),

  // ── 8. Measurement Tools ──
  'price-range': (sz) => (
    <Icon size={sz}>
      <line x1="10" y1="3" x2="10" y2="17" strokeWidth={1.4} />
      <line x1="6" y1="3" x2="14" y2="3" strokeWidth={1.6} />
      <line x1="6" y1="17" x2="14" y2="17" strokeWidth={1.6} />
      <polyline points="7.5,6 10,3.5 12.5,6" strokeWidth={1.4} />
      <polyline points="7.5,14 10,16.5 12.5,14" strokeWidth={1.4} />
    </Icon>
  ),
  'date-range': (sz) => (
    <Icon size={sz}>
      <line x1="3" y1="10" x2="17" y2="10" strokeWidth={1.4} />
      <line x1="3" y1="6" x2="3" y2="14" strokeWidth={1.6} />
      <line x1="17" y1="6" x2="17" y2="14" strokeWidth={1.6} />
      <polyline points="6,7.5 3.5,10 6,12.5" strokeWidth={1.4} />
      <polyline points="14,7.5 16.5,10 14,12.5" strokeWidth={1.4} />
    </Icon>
  ),
  'date-price-range': (sz) => (
    <Icon size={sz}>
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <line x1="3" y1="10" x2="17" y2="10" strokeDasharray="2 2" strokeWidth={1} />
      <line x1="10" y1="3" x2="10" y2="17" strokeDasharray="2 2" strokeWidth={1} />
    </Icon>
  ),

  // ── 9. Magnet Action ──
  'magnet': (sz) => (
    <Icon size={sz}>
      <path d="M4 15.5 V9 A6 6 0 0 1 16 9 V15.5 A1.5 1.5 0 0 1 13 15.5 V9 A3 3 0 0 0 7 9 V15.5 A1.5 1.5 0 0 1 4 15.5 Z" />
      <line x1="4" y1="12.5" x2="7" y2="12.5" strokeWidth={1.5} />
      <line x1="13" y1="12.5" x2="16" y2="12.5" strokeWidth={1.5} />
    </Icon>
  ),

  // ── 10. Management Actions ──
  'lock': (sz) => (
    <Icon size={sz}>
      <rect x="5" y="9" width="10" height="8" rx="1.5" />
      <path d="M7 9 V6 A3 3 0 0 1 13 6 V9" />
    </Icon>
  ),
  'visibility': (sz) => (
    <Icon size={sz}>
      <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" />
      <circle cx="10" cy="10" r="2.8" />
    </Icon>
  ),
  'settings': (sz) => (
    <Icon size={sz}>
      <circle cx="10" cy="10" r="2.8" />
      <path d="M16 12.5a1.2 1.2 0 0 0 .2 1.3l.1.1a1.5 1.5 0 0 1-2.1 2.1l-.1-.1a1.2 1.2 0 0 0-1.3-.2 1.2 1.2 0 0 0-.7 1.1V17a1.5 1.5 0 0 1-3 0v-.2a1.2 1.2 0 0 0-.7-1.1 1.2 1.2 0 0 0-1.3.2l-.1.1a1.5 1.5 0 0 1-2.1-2.1l.1-.1a1.2 1.2 0 0 0 .2-1.3 1.2 1.2 0 0 0-1.1-.7H4a1.5 1.5 0 0 1 0-3h.2a1.2 1.2 0 0 0 1.1-.7 1.2 1.2 0 0 0-.2-1.3l-.1-.1a1.5 1.5 0 0 1 2.1-2.1l.1.1a1.2 1.2 0 0 0 1.3.2 1.2 1.2 0 0 0 .7-1.1V4a1.5 1.5 0 0 1 3 0v.2a1.2 1.2 0 0 0 .7 1.1 1.2 1.2 0 0 0 1.3-.2l.1-.1a1.5 1.5 0 0 1 2.1 2.1l-.1.1a1.2 1.2 0 0 0-.2 1.3 1.2 1.2 0 0 0 1.1.7H17a1.5 1.5 0 0 1 0 3h-.2a1.2 1.2 0 0 0-1.1.7z" />
    </Icon>
  ),

  // ── 11. Delete Action ──
  'delete': (sz) => (
    <Icon size={sz}>
      <polyline points="3 6 5 6 17 6" />
      <path d="M6 6v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" />
      <path d="M8 6V4a1.5 1.5 0 0 1 1.5-1.5h1A1.5 1.5 0 0 1 12 4v2" />
      <line x1="8.5" y1="9.5" x2="8.5" y2="14.5" strokeWidth={1.3} />
      <line x1="11.5" y1="9.5" x2="11.5" y2="14.5" strokeWidth={1.3} />
    </Icon>
  ),
};

export default function ToolIcon({ id, className, size = 18 }: ToolIconProps) {
  const renderer = icons[id];
  if (!renderer) return <span className={className} style={{ width: size, height: size, display: 'inline-block' }} />;
  return <span className={className}>{renderer(size)}</span>;
}
