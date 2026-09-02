/**
 * Color presets organized by category.
 * 100+ colors for quick selection.
 */

export interface ColorPreset {
  name: string;
  hex: string;
}

export interface ColorCategory {
  id: string;
  label: string;
  colors: ColorPreset[];
}

export const COLOR_CATEGORIES: ColorCategory[] = [
  // ── Grayscale ──
  {
    id: 'grayscale',
    label: 'Grayscale',
    colors: [
      { name: 'Black', hex: '#000000' },
      { name: 'Charcoal', hex: '#1a1a1a' },
      { name: 'Dark Gray', hex: '#333333' },
      { name: 'Gray', hex: '#666666' },
      { name: 'Light Gray', hex: '#999999' },
      { name: 'Silver', hex: '#cccccc' },
      { name: 'Smoke', hex: '#e0e0e0' },
      { name: 'White', hex: '#ffffff' },
    ],
  },
  // ── Red ──
  {
    id: 'red',
    label: 'Red',
    colors: [
      { name: 'Dark Red', hex: '#8b0000' },
      { name: 'Red', hex: '#ff0000' },
      { name: 'Crimson', hex: '#dc143c' },
      { name: 'Scarlet', hex: '#ff2400' },
      { name: 'Ruby', hex: '#e0115f' },
      { name: 'Cherry', hex: '#de3163' },
      { name: 'Rose', hex: '#ff007f' },
      { name: 'Coral', hex: '#ff7f50' },
      { name: 'Salmon', hex: '#fa8072' },
      { name: 'Pink', hex: '#ffc0cb' },
      { name: 'Hot Pink', hex: '#ff69b4' },
    ],
  },
  // ── Orange ──
  {
    id: 'orange',
    label: 'Orange',
    colors: [
      { name: 'Burnt Orange', hex: '#cc5500' },
      { name: 'Orange', hex: '#ff8c00' },
      { name: 'Amber', hex: '#ffbf00' },
      { name: 'Apricot', hex: '#fbceb1' },
      { name: 'Peach', hex: '#ffe5b4' },
    ],
  },
  // ── Yellow ──
  {
    id: 'yellow',
    label: 'Yellow',
    colors: [
      { name: 'Mustard', hex: '#ffdb58' },
      { name: 'Gold', hex: '#ffd700' },
      { name: 'Yellow', hex: '#ffff00' },
      { name: 'Lemon', hex: '#fff44f' },
      { name: 'Canary', hex: '#ffef00' },
    ],
  },
  // ── Green ──
  {
    id: 'green',
    label: 'Green',
    colors: [
      { name: 'Dark Green', hex: '#006400' },
      { name: 'Forest', hex: '#228b22' },
      { name: 'Emerald', hex: '#50c878' },
      { name: 'Green', hex: '#00ff00' },
      { name: 'Lime', hex: '#32cd32' },
      { name: 'Mint', hex: '#98ff98' },
      { name: 'Olive', hex: '#808000' },
      { name: 'Sea Green', hex: '#2e8b57' },
      { name: 'Jade', hex: '#00a86b' },
    ],
  },
  // ── Cyan ──
  {
    id: 'cyan',
    label: 'Cyan',
    colors: [
      { name: 'Dark Cyan', hex: '#008b8b' },
      { name: 'Teal', hex: '#008080' },
      { name: 'Turquoise', hex: '#40e0d0' },
      { name: 'Aqua', hex: '#00ffff' },
      { name: 'Sky Cyan', hex: '#87ceeb' },
    ],
  },
  // ── Blue ──
  {
    id: 'blue',
    label: 'Blue',
    colors: [
      { name: 'Navy', hex: '#000080' },
      { name: 'Royal Blue', hex: '#4169e1' },
      { name: 'Blue', hex: '#0000ff' },
      { name: 'Azure', hex: '#007fff' },
      { name: 'Sky Blue', hex: '#87cefa' },
      { name: 'Baby Blue', hex: '#89cff0' },
      { name: 'Steel Blue', hex: '#4682b4' },
      { name: 'Dodger Blue', hex: '#1e90ff' },
    ],
  },
  // ── Purple ──
  {
    id: 'purple',
    label: 'Purple',
    colors: [
      { name: 'Indigo', hex: '#4b0082' },
      { name: 'Purple', hex: '#800080' },
      { name: 'Violet', hex: '#ee82ee' },
      { name: 'Lavender', hex: '#e6e6fa' },
      { name: 'Magenta', hex: '#ff00ff' },
      { name: 'Orchid', hex: '#da70d6' },
    ],
  },
  // ── Brown ──
  {
    id: 'brown',
    label: 'Brown',
    colors: [
      { name: 'Brown', hex: '#8b4513' },
      { name: 'Coffee', hex: '#6f4e37' },
      { name: 'Chocolate', hex: '#d2691e' },
      { name: 'Tan', hex: '#d2b48c' },
      { name: 'Beige', hex: '#f5f5dc' },
      { name: 'Sand', hex: '#c2b280' },
    ],
  },
  // ── Trading-specific ──
  {
    id: 'trading',
    label: 'Trading',
    colors: [
      { name: 'Bull Green', hex: '#2fbf8f' },
      { name: 'Bear Red', hex: '#ef4a63' },
      { name: 'TV Bull', hex: '#089981' },
      { name: 'TV Bear', hex: '#f23645' },
      { name: 'Chart Accent', hex: '#4f86f7' },
      { name: 'Grid Line', hex: '#212836' },
      { name: 'Panel BG', hex: '#10141c' },
      { name: 'Text Primary', hex: '#d8dce3' },
      { name: 'Text Secondary', hex: '#838da0' },
      { name: 'Border', hex: '#212836' },
      { name: 'Warning', hex: '#dba85a' },
    ],
  },
  // ── Special ──
  {
    id: 'special',
    label: 'Special',
    colors: [
      { name: 'Transparent', hex: 'transparent' },
    ],
  },
];

// ─── Storage keys ──────────────────────────────────────────────────

const RECENT_KEY = 'fxreplay:recent-colors';
const FAVORITES_KEY = 'fxreplay:favorite-colors';
const PALETTES_KEY = 'fxreplay:color-palettes';

export interface ColorPalette {
  id: string;
  name: string;
  colors: string[];
  createdAt: number;
}

// ─── Recent Colors ─────────────────────────────────────────────────

export function getRecentColors(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function addRecentColor(hex: string): string[] {
  const current = getRecentColors();
  const filtered = current.filter((c) => c !== hex);
  const next = [hex, ...filtered].slice(0, 20);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
  return next;
}

// ─── Favorite Colors ───────────────────────────────────────────────

export function getFavoriteColors(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function toggleFavoriteColor(hex: string): string[] {
  const current = getFavoriteColors();
  const idx = current.indexOf(hex);
  const next = idx >= 0 ? current.filter((c) => c !== hex) : [hex, ...current];
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch {}
  return next;
}

// ─── Color Palettes ────────────────────────────────────────────────

export function getPalettes(): ColorPalette[] {
  try {
    const raw = localStorage.getItem(PALETTES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function savePalette(name: string, colors: string[]): ColorPalette[] {
  const current = getPalettes();
  const entry: ColorPalette = {
    id: `palette-${Date.now()}`,
    name,
    colors,
    createdAt: Date.now(),
  };
  const next = [...current, entry];
  try { localStorage.setItem(PALETTES_KEY, JSON.stringify(next)); } catch {}
  return next;
}

export function deletePalette(id: string): ColorPalette[] {
  const current = getPalettes().filter((p) => p.id !== id);
  try { localStorage.setItem(PALETTES_KEY, JSON.stringify(current)); } catch {}
  return current;
}

export function exportPalette(palette: ColorPalette): string {
  return JSON.stringify({ name: palette.name, colors: palette.colors }, null, 2);
}

export function importPalette(json: string): ColorPalette | null {
  try {
    const parsed = JSON.parse(json);
    if (!parsed.name || !Array.isArray(parsed.colors)) return null;
    return {
      id: `palette-${Date.now()}`,
      name: parsed.name,
      colors: parsed.colors,
      createdAt: Date.now(),
    };
  } catch {
    return null;
  }
}
