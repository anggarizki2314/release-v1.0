/**
 * Drawing Template Service — saves & loads style presets per drawing tool type.
 * Also manages per-tool default styles and factory default reset.
 *
 * Storage:
 *   - localStorage['app_drawing_templates'] for user presets
 *   - localStorage['app_drawing_default_styles'] for per-tool default style memory
 */

import type { DrawingStyle } from '../engine/types';

export interface DrawingTemplate {
  id: string;
  name: string;
  toolType: string;
  style: Partial<DrawingStyle>;
  text?: string;
}

const PRESETS_KEY = 'app_drawing_templates';
const DEFAULT_STYLES_KEY = 'app_drawing_default_styles';

// ─── Template Presets ─────────────────────────────────────────────────

function readAllPresets(): DrawingTemplate[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DrawingTemplate[];
    // Filter out any previously seeded templates
    const clean = Array.isArray(parsed) ? parsed.filter((t) => !t.id.startsWith('seed_tpl_')) : [];
    if (clean.length !== parsed.length) {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(clean));
    }
    return clean;
  } catch {
    return [];
  }
}

function writeAllPresets(templates: DrawingTemplate[]): void {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(templates));
}

export function getTemplatesForTool(toolType: string): DrawingTemplate[] {
  return readAllPresets().filter((t) => t.toolType === toolType);
}

export function saveTemplate(name: string, toolType: string, style: Partial<DrawingStyle>, text?: string): DrawingTemplate {
  const tpl: DrawingTemplate = {
    id: `tpl_${Date.now()}`,
    name: name.trim() || 'Preset',
    toolType,
    style: { ...style },
    text: text !== undefined ? text : undefined,
  };
  writeAllPresets([...readAllPresets(), tpl]);
  return tpl;
}

export function deleteTemplate(id: string): void {
  writeAllPresets(readAllPresets().filter((t) => t.id !== id));
}

// ─── Tool Default Style Memory ────────────────────────────────────────

export function getSavedToolDefaultStyle(toolType: string): Partial<DrawingStyle> | null {
  try {
    const raw = localStorage.getItem(DEFAULT_STYLES_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    const saved = map[toolType];
    if (saved) {
      const clean = { ...saved };
      delete (clean as any).text;
      return clean;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveToolDefaultStyle(toolType: string, style: Partial<DrawingStyle>): void {
  try {
    const raw = localStorage.getItem(DEFAULT_STYLES_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const cleanStyle = { ...style };
    delete (cleanStyle as any).text;
    map[toolType] = { ...(map[toolType] || {}), ...cleanStyle };
    delete (map[toolType] as any).text;
    localStorage.setItem(DEFAULT_STYLES_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

export function clearToolDefaultStyle(toolType: string): void {
  try {
    const raw = localStorage.getItem(DEFAULT_STYLES_KEY);
    if (!raw) return;
    const map = JSON.parse(raw);
    delete map[toolType];
    localStorage.setItem(DEFAULT_STYLES_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

export function getFactoryDefaultStyle(toolType: string): DrawingStyle {
  const isShape =
    toolType === 'rectangle' ||
    toolType === 'rotated-rectangle' ||
    toolType === 'circle' ||
    toolType === 'ellipse' ||
    toolType === 'triangle' ||
    toolType === 'curve' ||
    toolType === 'double-curve' ||
    toolType === 'arc';

  const isPosition =
    toolType === 'long-position' ||
    toolType === 'short-position';

  return {
    color: '#4f86f7',
    lineWidth: 2,
    lineStyle: 'solid',
    opacity: 100,
    fillOpacity: 20,
    fontSize: 14,
    fontFamily: 'var(--font-ui)',
    fillEnabled: isShape ? true : undefined,
    fillColor: isShape ? 'rgba(41, 98, 255, 0.2)' : undefined,
    fill: isShape ? 'rgba(41, 98, 255, 0.2)' : undefined,
    tpColor: isPosition ? '#00897b' : undefined,
    slColor: isPosition ? '#00838f' : undefined,
  };
}
