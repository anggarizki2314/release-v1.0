import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Download, Upload, RotateCcw, Plus } from 'lucide-react';
import { useTheme } from './ThemeManager';
import { THEME_PRESETS } from './presets';
import ColorPicker from './ColorPicker';
import './AppearancePanel.css';

interface AppearancePanelProps {
  onClose?: () => void;
  isEmbedded?: boolean;
}

export default function AppearancePanel({ onClose, isEmbedded = false }: AppearancePanelProps) {
  const {
    theme, updateTheme, updateThemePath,
    setTheme, resetTheme,
    savedThemes, saveCustomTheme, loadCustomTheme, deleteCustomTheme,
    exportTheme, importTheme,
  } = useTheme();

  // Store onClose in ref to prevent stale closures when theme re-renders
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Handle ESC keypress to close dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCloseClick = useCallback(() => {
    onCloseRef.current?.();
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCloseRef.current?.();
    }
  }, []);

  const [activeTab, setActiveTab] = useState<'app' | 'theme' | 'chart' | 'candle' | 'grid' | 'crosshair' | 'scale' | 'watermark'>('app');
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    const json = exportTheme();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'theme.json'; a.click();
    URL.revokeObjectURL(url);
  }, [exportTheme]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') importTheme(reader.result);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [importTheme]);

  const handleSave = useCallback(() => {
    if (!saveName.trim()) return;
    saveCustomTheme(saveName.trim());
    setSaveName('');
    setShowSave(false);
  }, [saveName, saveCustomTheme]);

  const tabs = [
    { id: 'app' as const, label: 'App' },
    { id: 'theme' as const, label: 'Presets' },
    { id: 'chart' as const, label: 'Chart' },
    { id: 'candle' as const, label: 'Candle' },
    { id: 'grid' as const, label: 'Grid' },
    { id: 'crosshair' as const, label: 'Crosshair' },
    { id: 'scale' as const, label: 'Scale' },
    { id: 'watermark' as const, label: 'Watermark' },
  ];

  if (isEmbedded) {
    return (
      <div className="appearance-panel-embedded">
        {/* Tabs */}
        <div className="appearance-panel__tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`appearance-panel__tab ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="appearance-panel__content">
          {activeTab === 'app' && (
            <Section>
              <SectionTitle>Application</SectionTitle>
              <Row label="Background">
                <ColorPicker value={theme.app.background} onChange={(c) => updateThemePath('app', { background: c })} />
              </Row>
              <Row label="Sidebar">
                <ColorPicker value={theme.app.sidebar} onChange={(c) => updateThemePath('app', { sidebar: c })} />
              </Row>
              <Row label="Toolbar">
                <ColorPicker value={theme.app.toolbar} onChange={(c) => updateThemePath('app', { toolbar: c })} />
              </Row>
              <Row label="Panel">
                <ColorPicker value={theme.app.panel} onChange={(c) => updateThemePath('app', { panel: c })} />
              </Row>
              <Row label="Popup">
                <ColorPicker value={theme.app.popup} onChange={(c) => updateThemePath('app', { popup: c })} />
              </Row>
              <SectionTitle>Colors</SectionTitle>
              <Row label="Accent">
                <ColorPicker value={theme.app.accent} onChange={(c) => updateThemePath('app', { accent: c })} />
              </Row>
            </Section>
          )}

          {activeTab === 'theme' && (
            <Section>
              <SectionTitle>Theme Presets</SectionTitle>
              <div className="appearance-panel__presets">
                {THEME_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    className={`appearance-panel__preset ${theme.app.background === p.theme.app.background ? 'is-active' : ''}`}
                    onClick={() => setTheme(p.theme)}
                  >
                    <div className="appearance-panel__preset-preview">
                      <span style={{ background: p.theme.app.background }} />
                      <span style={{ background: p.theme.candle.bull.body }} />
                      <span style={{ background: p.theme.candle.bear.body }} />
                    </div>
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {activeTab === 'chart' && (
            <Section>
              <SectionTitle>Chart Background</SectionTitle>
              <Row label="Background">
                <ColorPicker value={theme.chart.background} onChange={(c) => updateThemePath('chart', { background: c })} />
              </Row>
              <SectionTitle>Active Chart Border</SectionTitle>
              <Row label="Show Border">
                <Toggle checked={theme.border?.visible ?? true} onChange={(v) => updateThemePath('border', { visible: v })} />
              </Row>
              <Row label="Border Color">
                <ColorPicker value={theme.border?.color || '#4f86f7'} onChange={(c) => updateThemePath('border', { color: c })} />
              </Row>
              <Row label="Border Opacity (%)">
                <Slider value={theme.border?.opacity ?? 25} min={0} max={100} onChange={(v) => updateThemePath('border', { opacity: v })} />
              </Row>
            </Section>
          )}

          {activeTab === 'candle' && (
            <Section>
              <SectionTitle>Candlestick Colors</SectionTitle>
              <Row label="Bull Body">
                <ColorPicker value={theme.candle.bull.body} onChange={(c) => updateThemePath('candle', { bull: { ...theme.candle.bull, body: c } })} />
              </Row>
              <Row label="Bear Body">
                <ColorPicker value={theme.candle.bear.body} onChange={(c) => updateThemePath('candle', { bear: { ...theme.candle.bear, body: c } })} />
              </Row>
            </Section>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="appearance-panel" onClick={handleBackdropClick}>
      <div className="appearance-panel__inner">
        {/* Header */}
        <div className="appearance-panel__header">
          <h2>Appearance</h2>
          <button className="appearance-panel__close" onClick={handleCloseClick} aria-label="Close settings"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="appearance-panel__tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`appearance-panel__tab ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="appearance-panel__content">
          {activeTab === 'app' && (
            <Section>
              <SectionTitle>Application</SectionTitle>
              <Row label="Background">
                <ColorPicker value={theme.app.background} onChange={(c) => updateThemePath('app', { background: c })} />
              </Row>
              <Row label="Sidebar">
                <ColorPicker value={theme.app.sidebar} onChange={(c) => updateThemePath('app', { sidebar: c })} />
              </Row>
              <Row label="Toolbar">
                <ColorPicker value={theme.app.toolbar} onChange={(c) => updateThemePath('app', { toolbar: c })} />
              </Row>
              <Row label="Panel">
                <ColorPicker value={theme.app.panel} onChange={(c) => updateThemePath('app', { panel: c })} />
              </Row>
              <Row label="Popup">
                <ColorPicker value={theme.app.popup} onChange={(c) => updateThemePath('app', { popup: c })} />
              </Row>
              <SectionTitle>Colors</SectionTitle>
              <Row label="Accent">
                <ColorPicker value={theme.app.accent} onChange={(c) => updateThemePath('app', { accent: c })} />
              </Row>
              <Row label="Hover">
                <ColorPicker value={theme.app.hover} onChange={(c) => updateThemePath('app', { hover: c })} />
              </Row>
              <Row label="Border">
                <ColorPicker value={theme.app.border} onChange={(c) => updateThemePath('app', { border: c })} />
              </Row>
              <SectionTitle>Text</SectionTitle>
              <Row label="Primary">
                <ColorPicker value={theme.text.primary} onChange={(c) => updateThemePath('text', { primary: c })} />
              </Row>
              <Row label="Secondary">
                <ColorPicker value={theme.text.secondary} onChange={(c) => updateThemePath('text', { secondary: c })} />
              </Row>
              <Row label="Muted">
                <ColorPicker value={theme.text.muted} onChange={(c) => updateThemePath('text', { muted: c })} />
              </Row>
              <SectionTitle>Buttons</SectionTitle>
              <Row label="Primary">
                <ColorPicker value={theme.button.primary} onChange={(c) => updateThemePath('button', { primary: c })} />
              </Row>
              <Row label="Primary Text">
                <ColorPicker value={theme.button.primaryText} onChange={(c) => updateThemePath('button', { primaryText: c })} />
              </Row>
              <Row label="Secondary">
                <ColorPicker value={theme.button.secondary} onChange={(c) => updateThemePath('button', { secondary: c })} />
              </Row>
              <Row label="Secondary Text">
                <ColorPicker value={theme.button.secondaryText} onChange={(c) => updateThemePath('button', { secondaryText: c })} />
              </Row>
            </Section>
          )}

          {activeTab === 'theme' && (
            <Section>
              <SectionTitle>Built-in Presets</SectionTitle>
              <div className="appearance-panel__preset-grid">
                {THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    className="appearance-panel__preset-btn"
                    onClick={() => setTheme(preset.theme)}
                  >
                    <div className="appearance-panel__preset-preview">
                      <div style={{ background: preset.theme.chart.background, height: 8 }} />
                      <div style={{ display: 'flex', height: 6 }}>
                        <div style={{ background: preset.theme.candle.bull.body, flex: 1 }} />
                        <div style={{ background: preset.theme.candle.bear.body, flex: 1 }} />
                      </div>
                    </div>
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>

              <SectionTitle>Saved Themes</SectionTitle>
              {savedThemes.length === 0 && <p className="appearance-panel__empty">No saved themes yet.</p>}
              {savedThemes.map((st) => (
                <div key={st.id} className="appearance-panel__saved-row">
                  <button className="appearance-panel__saved-btn" onClick={() => loadCustomTheme(st.id)}>
                    {st.name}
                  </button>
                  <button className="appearance-panel__saved-del" onClick={() => deleteCustomTheme(st.id)}>
                    <X size={12} />
                  </button>
                </div>
              ))}

              {showSave ? (
                <div className="appearance-panel__save-row">
                  <input
                    className="appearance-panel__save-input"
                    placeholder="Theme name..."
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                    autoFocus
                  />
                  <button className="appearance-panel__save-confirm" onClick={handleSave}>Save</button>
                  <button className="appearance-panel__save-cancel" onClick={() => setShowSave(false)}>Cancel</button>
                </div>
              ) : (
                <button className="appearance-panel__action-btn" onClick={() => setShowSave(true)}>
                  <Plus size={14} /> Save Current Theme
                </button>
              )}

              <div className="appearance-panel__actions">
                <button className="appearance-panel__action-btn" onClick={handleExport}><Download size={14} /> Export</button>
                <button className="appearance-panel__action-btn" onClick={handleImport}><Upload size={14} /> Import</button>
                <button className="appearance-panel__action-btn appearance-panel__action-btn--danger" onClick={resetTheme}><RotateCcw size={14} /> Restore Default</button>
              </div>
              <input ref={fileInputRef} type="file" accept=".json" hidden onChange={handleFileChange} />
            </Section>
          )}

          {activeTab === 'chart' && (
            <Section>
              <SectionTitle>Background</SectionTitle>
              <Row label="Background Color">
                <ColorPicker value={theme.chart.background} onChange={(c) => updateThemePath('chart', { background: c })} />
              </Row>
              <Row label="Use Gradient">
                <Toggle checked={theme.chart.useGradient} onChange={(v) => updateThemePath('chart', { useGradient: v })} />
              </Row>
              {theme.chart.useGradient && (
                <>
                  <Row label="Gradient Top">
                    <ColorPicker value={theme.chart.backgroundGradientFrom} onChange={(c) => updateThemePath('chart', { backgroundGradientFrom: c })} />
                  </Row>
                  <Row label="Gradient Bottom">
                    <ColorPicker value={theme.chart.backgroundGradientTo} onChange={(c) => updateThemePath('chart', { backgroundGradientTo: c })} />
                  </Row>
                </>
              )}
              <SectionTitle>Active Chart Border</SectionTitle>
              <Row label="Show Border">
                <Toggle checked={theme.border?.visible ?? true} onChange={(v) => updateThemePath('border', { visible: v })} />
              </Row>
              <Row label="Border Color">
                <ColorPicker value={theme.border?.color || '#4f86f7'} onChange={(c) => updateThemePath('border', { color: c })} />
              </Row>
              <Row label="Border Opacity (%)">
                <Slider value={theme.border?.opacity ?? 25} min={0} max={100} onChange={(v) => updateThemePath('border', { opacity: v })} />
              </Row>
            </Section>
          )}

          {activeTab === 'candle' && (
            <Section>
              <SectionTitle>Bull Candle</SectionTitle>
              <Row label="Body">
                <ColorPicker value={theme.candle.bull.body} onChange={(c) => updateThemePath('candle', { bull: { ...theme.candle.bull, body: c } })} />
              </Row>
              <Row label="Border">
                <ColorPicker value={theme.candle.bull.border} onChange={(c) => updateThemePath('candle', { bull: { ...theme.candle.bull, border: c } })} />
              </Row>
              <Row label="Wick">
                <ColorPicker value={theme.candle.bull.wick} onChange={(c) => updateThemePath('candle', { bull: { ...theme.candle.bull, wick: c } })} />
              </Row>
              <SectionTitle>Bear Candle</SectionTitle>
              <Row label="Body">
                <ColorPicker value={theme.candle.bear.body} onChange={(c) => updateThemePath('candle', { bear: { ...theme.candle.bear, body: c } })} />
              </Row>
              <Row label="Border">
                <ColorPicker value={theme.candle.bear.border} onChange={(c) => updateThemePath('candle', { bear: { ...theme.candle.bear, border: c } })} />
              </Row>
              <Row label="Wick">
                <ColorPicker value={theme.candle.bear.wick} onChange={(c) => updateThemePath('candle', { bear: { ...theme.candle.bear, wick: c } })} />
              </Row>
            </Section>
          )}

          {activeTab === 'grid' && (
            <Section>
              <Row label="Show Vertical Grid">
                <Toggle checked={theme.grid.visible} onChange={(v) => updateThemePath('grid', { visible: v })} />
              </Row>
              <Row label="Grid Color">
                <ColorPicker value={theme.grid.color} onChange={(c) => updateThemePath('grid', { color: c })} />
              </Row>
              <Row label="Grid Opacity">
                <Slider value={theme.grid.opacity} min={0} max={100} onChange={(v) => updateThemePath('grid', { opacity: v })} />
              </Row>
            </Section>
          )}

          {activeTab === 'crosshair' && (
            <Section>
              <Row label="Show Crosshair">
                <Toggle checked={theme.crosshair.visible} onChange={(v) => updateThemePath('crosshair', { visible: v })} />
              </Row>
              <Row label="Color">
                <ColorPicker value={theme.crosshair.color} onChange={(c) => updateThemePath('crosshair', { color: c })} />
              </Row>
              <Row label="Style">
                <Select
                  value={theme.crosshair.style}
                  options={[{ value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' }]}
                  onChange={(v) => updateThemePath('crosshair', { style: v as any })}
                />
              </Row>
              <Row label="Width">
                <Slider value={theme.crosshair.width} min={1} max={4} onChange={(v) => updateThemePath('crosshair', { width: v })} />
              </Row>
            </Section>
          )}

          {activeTab === 'scale' && (
            <Section>
              <SectionTitle>Price Scale</SectionTitle>
              <Row label="Text Color">
                <ColorPicker value={theme.scale.price.text} onChange={(c) => updateThemePath('scale', { price: { ...theme.scale.price, text: c } })} />
              </Row>
              <Row label="Background">
                <ColorPicker value={theme.scale.price.background} onChange={(c) => updateThemePath('scale', { price: { ...theme.scale.price, background: c } })} />
              </Row>
              <Row label="Border">
                <ColorPicker value={theme.scale.price.border} onChange={(c) => updateThemePath('scale', { price: { ...theme.scale.price, border: c } })} />
              </Row>
              <SectionTitle>Time Scale</SectionTitle>
              <Row label="Text Color">
                <ColorPicker value={theme.scale.time.text} onChange={(c) => updateThemePath('scale', { time: { ...theme.scale.time, text: c } })} />
              </Row>
              <Row label="Background">
                <ColorPicker value={theme.scale.time.background} onChange={(c) => updateThemePath('scale', { time: { ...theme.scale.time, background: c } })} />
              </Row>
              <Row label="Border">
                <ColorPicker value={theme.scale.time.border} onChange={(c) => updateThemePath('scale', { time: { ...theme.scale.time, border: c } })} />
              </Row>
              <SectionTitle>Chart Border</SectionTitle>
              <Row label="Show Border">
                <Toggle checked={theme.border?.visible ?? true} onChange={(v) => updateThemePath('border', { visible: v })} />
              </Row>
              <Row label="Border Color">
                <ColorPicker value={theme.border?.color || '#4f86f7'} onChange={(c) => updateThemePath('border', { color: c })} />
              </Row>
              <Row label="Border Opacity (%)">
                <Slider value={theme.border?.opacity ?? 25} min={0} max={100} onChange={(v) => updateThemePath('border', { opacity: v })} />
              </Row>
            </Section>
          )}

          {activeTab === 'watermark' && (
            <Section>
              <Row label="Show Symbol">
                <Toggle checked={theme.watermark.showSymbol} onChange={(v) => updateThemePath('watermark', { showSymbol: v })} />
              </Row>
              <Row label="Show Timeframe">
                <Toggle checked={theme.watermark.showTimeframe} onChange={(v) => updateThemePath('watermark', { showTimeframe: v })} />
              </Row>
              <Row label="Color">
                <ColorPicker value={theme.watermark.color} onChange={(c) => updateThemePath('watermark', { color: c })} />
              </Row>
              <Row label="Opacity">
                <Slider value={theme.watermark.opacity} min={0} max={100} onChange={(v) => updateThemePath('watermark', { opacity: v })} />
              </Row>
              <SectionTitle>Session Separator</SectionTitle>
              <Row label="Show Separator">
                <Toggle checked={theme.session.visible} onChange={(v) => updateThemePath('session', { visible: v })} />
              </Row>
              <Row label="Color">
                <ColorPicker value={theme.session.color} onChange={(c) => updateThemePath('session', { color: c })} />
              </Row>
              <Row label="Style">
                <Select
                  value={theme.session.style}
                  options={[{ value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' }, { value: 'dotted', label: 'Dotted' }]}
                  onChange={(v) => updateThemePath('session', { style: v as any })}
                />
              </Row>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reusable sub-components ───────────────────────────────────────

function Section({ children }: { children: React.ReactNode }) {
  return <div className="appearance-panel__section">{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="appearance-panel__section-title">{children}</div>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="appearance-panel__row">
      <span className="appearance-panel__row-label">{label}</span>
      <span className="appearance-panel__row-control">{children}</span>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`appearance-panel__toggle ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
    >
      <span className="appearance-panel__toggle-thumb" />
    </button>
  );
}

function Slider({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="appearance-panel__slider-wrap">
      <input
        type="range"
        className="appearance-panel__slider"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
      />
      <span className="appearance-panel__slider-value">{value}</span>
    </div>
  );
}

function Select({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <select className="appearance-panel__select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
