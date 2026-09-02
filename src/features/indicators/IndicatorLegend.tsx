import React, { useState } from 'react';
import { Eye, EyeOff, Trash2, Settings } from 'lucide-react';
import { useIndicatorStore } from './useIndicatorStore';
import { IndicatorSettingsModal } from './IndicatorSettingsModal';
import type { EmaIndicatorConfig } from './types';
import { isIndicatorVisibleOnTimeframe } from './types';
import './IndicatorLegend.css';

export interface IndicatorLegendProps {
  latestValues?: Record<string, number | string>;
  timeframe?: string;
}

export const IndicatorLegend: React.FC<IndicatorLegendProps> = ({ latestValues = {}, timeframe }) => {
  const { indicators, toggleIndicator, removeIndicator } = useIndicatorStore();
  const [selectedSettingsId, setSelectedSettingsId] = useState<string | null>(null);

  const overlayIndicators = indicators.filter((ind) => {
    if (!isIndicatorVisibleOnTimeframe(ind.visibility, timeframe)) return false;
    if (
      ind.type === 'EMA' ||
      ind.type === 'SESSIONS' ||
      ind.type === 'KILLZONES' ||
      ind.type === 'MACROS' ||
      ind.type === 'SESSION_OPENS'
    )
      return true;
    if (ind.type === 'QUARTERS' && (ind as any).plotType === 'overlay') return true;
    return false;
  });

  if (overlayIndicators.length === 0) return null;

  return (
    <>
      <div className="indicator-legend-container">
        {overlayIndicators.map((ind) => {
          const val = latestValues[ind.id];
          const isEma = ind.type === 'EMA';
          const emaConf = isEma ? (ind as EmaIndicatorConfig) : null;
          const activeEmas = emaConf?.emas ? emaConf.emas.filter((e) => e.enabled) : [];

          return (
            <div
              key={ind.id}
              className={`indicator-legend-item ${!ind.enabled ? 'is-disabled' : ''}`}
            >
              <span className="indicator-legend-name">{ind.name}</span>
              {ind.enabled && isEma && activeEmas.length > 0 ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginLeft: '2px' }}>
                  {activeEmas.map((emaLine) => {
                    const lineVal = latestValues[`${ind.id}_${emaLine.id}`];
                    if (lineVal === undefined) return null;
                    return (
                      <span
                        key={emaLine.id}
                        className="indicator-legend-val mono"
                        style={{ color: emaLine.color }}
                      >
                        {typeof lineVal === 'number'
                          ? lineVal.toFixed(lineVal > 100 ? 2 : 5)
                          : lineVal}
                      </span>
                    );
                  })}
                </div>
              ) : (
                val !== undefined && ind.enabled && (
                  <span className="indicator-legend-val mono" style={{ color: ind.color }}>
                    {typeof val === 'number'
                      ? val.toFixed(val > 100 ? 2 : (ind.type === 'RSI' ? 1 : 5))
                      : val}
                  </span>
                )
              )}

              <div className="indicator-legend-actions">
                <button
                  className="indicator-legend-btn"
                  onClick={() => toggleIndicator(ind.id)}
                  title={ind.enabled ? 'Sembunyikan' : 'Tampilkan'}
                >
                  {ind.enabled ? <Eye size={13} strokeWidth={1.7} /> : <EyeOff size={13} strokeWidth={1.7} />}
                </button>

                <button
                  className="indicator-legend-btn"
                  onClick={() => setSelectedSettingsId(ind.id)}
                  title="Pengaturan"
                >
                  <Settings size={13} strokeWidth={1.7} />
                </button>

                <button
                  className="indicator-legend-btn is-del"
                  onClick={() => removeIndicator(ind.id)}
                  title="Hapus"
                >
                  <Trash2 size={13} strokeWidth={1.7} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full Indicator Settings Pop-up Modal */}
      <IndicatorSettingsModal
        isOpen={!!selectedSettingsId}
        indicatorId={selectedSettingsId}
        onClose={() => setSelectedSettingsId(null)}
      />
    </>
  );
};

export default IndicatorLegend;
