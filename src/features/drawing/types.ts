import {
  MousePointer2,
  TrendingUp,
  Shapes,
  GitCompare,
  Type,
  Brush,
  Ruler,
  Magnet,
  Settings,
  Trash2,
} from 'lucide-react';

// ─── Flyout tool item ──────────────────────────────────────────────

export interface FlyoutToolItem {
  id: string;
  label: string;
  shortcut?: string;
}

// ─── Flyout section (group of tools with optional header) ──────────

export interface FlyoutSection {
  label?: string;
  tools: FlyoutToolItem[];
}

// ─── Tool category (icon on the toolbar) ───────────────────────────

export interface ToolCategory {
  id: string;
  label: string;
  icon: any;
  flyout: FlyoutSection[];
  isAction?: boolean;
}

// ─── Quick Toolbar Colors ──────────────────────────────────────────

export const QUICK_TOOLBAR_COLORS = [
  '#2196F3',
  '#4CAF50',
  '#FF5722',
  '#9C27B0',
  '#FFC107',
  '#00BCD4',
  '#F44336',
  '#3F51B5',
];

// ─── Line Width Options ────────────────────────────────────────────

export const LINE_WIDTHS = [1, 2, 3, 4];

// ─── Line Style Options ────────────────────────────────────────────

export type LineStyleType = 'solid' | 'dashed' | 'dotted';

export const LINE_STYLES: { value: LineStyleType; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

// ─── Category data (11 Groups in exact TradingView order) ───────────

export const TOOL_CATEGORIES: ToolCategory[] = [
  // 1. CURSOR
  {
    id: 'cursor',
    label: 'Cursor',
    icon: 'group-cursor',
    flyout: [
      {
        label: 'CURSOR',
        tools: [
          { id: 'crosshair', label: 'Crosshair', shortcut: 'Alt+T' },
        ],
      },
    ],
  },
  // 2. TREND LINE
  {
    id: 'trend',
    label: 'Trend Line',
    icon: 'group-trend',
    flyout: [
      {
        label: 'TREND LINE',
        tools: [
          { id: 'trendline', label: 'Trendline', shortcut: 'Alt+T' },
          { id: 'ray', label: 'Ray', shortcut: 'Alt+R' },
          { id: 'extended-line', label: 'Extended Line', shortcut: 'Alt+E' },
          { id: 'info-line', label: 'Info Line', shortcut: 'Alt+I' },
          { id: 'horizontal-line', label: 'Horizontal Line', shortcut: 'Alt+H' },
          { id: 'horizontal-ray', label: 'Horizontal Ray', shortcut: 'Alt+J' },
          { id: 'vertical-line', label: 'Vertical Line', shortcut: 'Alt+V' },
          { id: 'cross-line', label: 'Cross Line', shortcut: 'Alt+C' },
          { id: 'channel', label: 'Channel' },
        ],
      },
    ],
  },
  // 3. SHAPES
  {
    id: 'shapes',
    label: 'Shapes',
    icon: 'group-shapes',
    flyout: [
      {
        label: 'SHAPES',
        tools: [
          { id: 'rectangle', label: 'Rectangle', shortcut: 'Alt+R' },
          { id: 'rotated-rectangle', label: 'Rotated Rectangle' },
          { id: 'circle', label: 'Circle' },
          { id: 'ellipse', label: 'Ellipse' },
          { id: 'triangle', label: 'Triangle' },
          { id: 'arc', label: 'Arc' },
          { id: 'curve', label: 'Curve' },
          { id: 'double-curve', label: 'Double Curve' },
          { id: 'polyline', label: 'Polyline' },
          { id: 'path', label: 'Path' },
        ],
      },
    ],
  },
  // 4. FIBONACCI
  {
    id: 'fibonacci',
    label: 'Fibonacci',
    icon: 'group-fibonacci',
    flyout: [
      {
        label: 'FIBONACCI',
        tools: [
          { id: 'fib-retracement', label: 'Fibonacci Retracement', shortcut: 'Alt+F' },
        ],
      },
    ],
  },
  // 5. BUY / SELL
  {
    id: 'buysell',
    label: 'Buy / Sell',
    icon: 'group-buysell',
    flyout: [
      {
        label: 'BUY / SELL',
        tools: [
          { id: 'long-position', label: 'Long Position' },
          { id: 'short-position', label: 'Short Position' },
        ],
      },
    ],
  },
  // 6. TEXT / ANNOTATION
  {
    id: 'text',
    label: 'Text / Annotation',
    icon: 'group-text',
    flyout: [
      {
        label: 'TEXT / ANNOTATION',
        tools: [
          { id: 'text', label: 'Text', shortcut: 'Alt+T' },
          { id: 'anchored-text', label: 'Anchored Text' },
          { id: 'note', label: 'Note' },
          { id: 'anchored-note', label: 'Anchored Note' },
          { id: 'callout', label: 'Callout' },
          { id: 'balloon', label: 'Balloon' },
          { id: 'price-label', label: 'Price Label' },
        ],
      },
    ],
  },
  // 7. BRUSH
  {
    id: 'brush',
    label: 'Brush',
    icon: 'group-brush',
    flyout: [
      {
        label: 'BRUSH',
        tools: [
          { id: 'brush', label: 'Brush' },
          { id: 'highlighter', label: 'Highlighter' },
        ],
      },
    ],
  },
  // 8. MEASUREMENT
  {
    id: 'measurement',
    label: 'Measurement',
    icon: 'group-measurement',
    flyout: [
      {
        label: 'MEASUREMENT',
        tools: [
          { id: 'price-range', label: 'Price Range' },
          { id: 'date-range', label: 'Date Range' },
          { id: 'date-price-range', label: 'Date & Price Range' },
        ],
      },
    ],
  },
  // 9. MAGNET
  {
    id: 'magnet',
    label: 'Magnet',
    icon: 'group-magnet',
    isAction: true,
    flyout: [],
  },
  // 10. MANAGEMENT
  {
    id: 'management',
    label: 'Management',
    icon: 'group-management',
    flyout: [
      {
        label: 'MANAGEMENT',
        tools: [
          { id: 'lock', label: 'Lock Drawing' },
          { id: 'visibility', label: 'Visibility' },
          { id: 'settings', label: 'Drawing Settings' },
        ],
      },
    ],
  },
  // 11. DELETE
  {
    id: 'delete',
    label: 'Delete',
    icon: 'group-delete',
    isAction: true,
    flyout: [],
  },
];
