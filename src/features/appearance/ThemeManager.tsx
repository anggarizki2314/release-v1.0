import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import type { ThemeObject, SavedTheme } from './types';
import { DEFAULT_THEME } from './presets';

const STORAGE_KEY = 'fxreplay:theme';
const SAVED_THEMES_KEY = 'fxreplay:saved-themes';

// ─── Load from localStorage ────────────────────────────────────────

function loadTheme(): ThemeObject {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_THEME.theme, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_THEME.theme };
}

function loadSavedThemes(): SavedTheme[] {
  try {
    const raw = localStorage.getItem(SAVED_THEMES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveTheme(t: ThemeObject) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); } catch {}
}

function saveSavedThemes(list: SavedTheme[]) {
  try { localStorage.setItem(SAVED_THEMES_KEY, JSON.stringify(list)); } catch {}
}

// ─── Context ───────────────────────────────────────────────────────

export interface ThemeContextType {
  theme: ThemeObject;
  updateTheme: (patch: Partial<ThemeObject>) => void;
  updateThemePath: <K extends keyof ThemeObject>(
    key: K,
    patch: Partial<ThemeObject[K]>
  ) => void;
  setTheme: (theme: ThemeObject) => void;
  resetTheme: () => void;
  savedThemes: SavedTheme[];
  saveCustomTheme: (name: string) => void;
  loadCustomTheme: (id: string) => void;
  deleteCustomTheme: (id: string) => void;
  exportTheme: () => string;
  importTheme: (json: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function isDarkTheme(theme: ThemeObject): boolean {
  if (!theme || !theme.app || !theme.app.background) return true;
  const bg = theme.app.background;
  if (bg.startsWith('#')) {
    const hex = bg.replace('#', '');
    const r = parseInt(hex.substring(0, 2) || '0', 16);
    const g = parseInt(hex.substring(2, 4) || '0', 16);
    const b = parseInt(hex.substring(4, 6) || '0', 16);
    return 0.299 * r + 0.587 * g + 0.114 * b < 128;
  }
  return true;
}

function hexToRgba(hex: string, alphaPercent: number): string {
  if (!hex) return `rgba(79, 134, 247, ${alphaPercent / 100})`;
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(79, 134, 247, ${alphaPercent / 100})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alphaPercent / 100})`;
}

// ─── Provider ──────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeObject>(loadTheme);
  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>(loadSavedThemes);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save to localStorage (debounced)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTheme(theme);
    }, 300);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [theme]);

  // Auto-save custom themes list
  useEffect(() => { saveSavedThemes(savedThemes); }, [savedThemes]);

  // Apply app theme to CSS variables (realtime)
  useEffect(() => {
    const root = document.documentElement;
    const isLight = !isDarkTheme(theme);
    root.classList.toggle('theme-light', isLight);
    root.classList.toggle('theme-dark', !isLight);

    const s = (k: string, v: string) => root.style.setProperty(k, v);
    s('--bg-app', theme.app.background);
    s('--bg-panel', theme.app.sidebar);
    s('--bg-panel-alt', isLight ? '#f0f3fa' : (theme.app.toolbar || '#181d28'));
    s('--bg-elevated', theme.app.popup || (isLight ? '#ffffff' : '#1e222d'));
    s('--bg-hover', theme.app.hover || (isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)'));
    s('--bg-active', isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)');
    s('--border-subtle', isLight ? '#e0e3eb' : (theme.app.border || '#2a2e39'));
    s('--border-strong', isLight ? '#cbd5e1' : '#3b4252');
    s('--divider-color', isLight ? '#e0e3eb' : (theme.app.border || '#2a2e39'));
    s('--text-primary', theme.text.primary);
    s('--text-secondary', theme.text.secondary);
    s('--text-muted', theme.text.muted);
    s('--accent', theme.app.accent);
    s('--accent-soft', theme.app.accent + '26');
    s('--accent-bg', theme.app.accent + '14');
    s('--accent-strong', theme.app.accent);
    s('--bull', theme.candle.bull.body);
    s('--bear', theme.candle.bear.body);
    s('--shadow-panel', isLight ? '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)' : '0 1px 2px rgba(0, 0, 0, 0.35), 0 8px 24px rgba(0, 0, 0, 0.28)');
    s('--shadow-float', isLight ? '0 4px 16px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)' : `0 4px 16px ${theme.app.shadow}`);

    const activeBorderColor = theme.border?.visible !== false
      ? hexToRgba(theme.border?.color || theme.app.accent || '#4f86f7', theme.border?.opacity ?? 25)
      : 'transparent';
    s('--active-pane-border-color', activeBorderColor);
  }, [theme]);

  const updateTheme = useCallback((patch: Partial<ThemeObject>) => {
    setThemeState((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateThemePath = useCallback(
    <K extends keyof ThemeObject>(key: K, patch: Partial<ThemeObject[K]>) => {
      setThemeState((prev) => ({ ...prev, [key]: { ...(prev[key] as any), ...patch } }));
    },
    []
  );

  const setTheme = useCallback((t: ThemeObject) => {
    setThemeState(() => ({ ...t }));
  }, []);

  const resetTheme = useCallback(() => {
    setThemeState(() => ({ ...DEFAULT_THEME.theme }));
  }, []);

  const saveCustomTheme = useCallback((name: string) => {
    const entry: SavedTheme = {
      id: `custom-${Date.now()}`,
      name,
      theme: { ...theme },
      createdAt: Date.now(),
    };
    setSavedThemes((prev) => [...prev, entry]);
  }, [theme]);

  const loadCustomTheme = useCallback((id: string) => {
    const found = savedThemes.find((s) => s.id === id);
    if (found) setThemeState(() => ({ ...found.theme }));
  }, [savedThemes]);

  const deleteCustomTheme = useCallback((id: string) => {
    setSavedThemes((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const exportTheme = useCallback(() => {
    return JSON.stringify({ name: 'Custom', theme }, null, 2);
  }, [theme]);

  const importTheme = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json);
      const imported = parsed.theme ?? parsed;
      setThemeState(() => ({ ...DEFAULT_THEME.theme, ...imported }));
    } catch {
      console.error('Invalid theme JSON');
    }
  }, []);

  const value: ThemeContextType = {
    theme,
    updateTheme,
    updateThemePath,
    setTheme,
    resetTheme,
    savedThemes,
    saveCustomTheme,
    loadCustomTheme,
    deleteCustomTheme,
    exportTheme,
    importTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ─── Hook ──────────────────────────────────────────────────────────

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
