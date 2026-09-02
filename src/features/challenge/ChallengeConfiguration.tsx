import React, { useState } from 'react';
import { Shield, Info, ArrowLeft, Play, AlertCircle } from 'lucide-react';
import type { SessionConfig } from '../sessionWizard/CreateSessionWizard';
import './ChallengeConfiguration.css';

export interface ChallengeParams {
  dailyLossPercent: number;
  maxLossPercent: number;
  profitTargetPercent: number;
  minimumTradingDays: number;
}

interface ChallengeConfigurationProps {
  sessionConfig: SessionConfig;
  onBack: () => void;
  onStartSession: (params: ChallengeParams) => void;
}

export const ChallengeConfiguration: React.FC<ChallengeConfigurationProps> = ({
  sessionConfig,
  onBack,
  onStartSession,
}) => {
  const [dailyLossPercent, setDailyLossPercent] = useState(5.0);
  const [maxLossPercent, setMaxLossPercent] = useState(10.0);
  const [profitTargetPercent, setProfitTargetPercent] = useState(8.0);
  const [minimumTradingDays, setMinimumTradingDays] = useState(3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartSession({
      dailyLossPercent,
      maxLossPercent,
      profitTargetPercent,
      minimumTradingDays,
    });
  };

  return (
    <div className="challenge-backdrop">
      <div className="challenge-modal">
        {/* Header */}
        <div className="challenge-modal__header">
          <div className="challenge-modal__title-wrap">
            <Shield size={22} className="challenge-modal__icon" />
            <div>
              <h2>CHALLENGE EVALUATION CONFIGURATION</h2>
              <p className="challenge-modal__sub">
                Set prop firm risk & profit target rules for session: <strong>{sessionConfig.name}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="challenge-modal__body">
          {/* Rule 1: Daily Loss */}
          <div className="challenge-field-card">
            <div className="challenge-field-card__header">
              <label className="challenge-field-label">Maximum Daily Loss (%)</label>
              <div className="challenge-tooltip" title="Maximum allowed loss limit within a single trading day before challenge failure.">
                <Info size={14} />
              </div>
            </div>
            <div className="challenge-input-wrap">
              <input
                type="number"
                className="challenge-input"
                value={dailyLossPercent}
                onChange={(e) => setDailyLossPercent(parseFloat(e.target.value) || 0)}
                step={0.5}
                min={1}
                max={20}
                required
              />
              <span className="challenge-unit">%</span>
            </div>
            <span className="challenge-calc-text">
              Limit Amount: ${((sessionConfig.initialBalance * dailyLossPercent) / 100).toLocaleString('en-US')}
            </span>
          </div>

          {/* Rule 2: Max Overall Loss */}
          <div className="challenge-field-card">
            <div className="challenge-field-card__header">
              <label className="challenge-field-label">Maximum Overall Drawdown (%)</label>
              <div className="challenge-tooltip" title="Maximum cumulative drawdown limit from initial balance.">
                <Info size={14} />
              </div>
            </div>
            <div className="challenge-input-wrap">
              <input
                type="number"
                className="challenge-input"
                value={maxLossPercent}
                onChange={(e) => setMaxLossPercent(parseFloat(e.target.value) || 0)}
                step={0.5}
                min={1}
                max={30}
                required
              />
              <span className="challenge-unit">%</span>
            </div>
            <span className="challenge-calc-text">
              Limit Amount: ${((sessionConfig.initialBalance * maxLossPercent) / 100).toLocaleString('en-US')}
            </span>
          </div>

          {/* Rule 3: Minimum Trading Days */}
          <div className="challenge-field-card">
            <div className="challenge-field-card__header">
              <label className="challenge-field-label">Minimum Trading Days</label>
              <div className="challenge-tooltip" title="Minimum number of active trading days required to complete challenge.">
                <Info size={14} />
              </div>
            </div>
            <div className="challenge-input-wrap">
              <input
                type="number"
                className="challenge-input"
                value={minimumTradingDays}
                onChange={(e) => setMinimumTradingDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
                min={0}
                max={30}
                required
              />
              <span className="challenge-unit">hari</span>
            </div>
            <span className="challenge-calc-text">
              Target minimum: {minimumTradingDays} hari aktif trading
            </span>
          </div>

          {/* Rule 4: Profit Target */}
          <div className="challenge-field-card">
            <div className="challenge-field-card__header">
              <label className="challenge-field-label">Profit Target (%)</label>
              <div className="challenge-tooltip" title="Target net profit required to successfully pass the challenge.">
                <Info size={14} />
              </div>
            </div>
            <div className="challenge-input-wrap">
              <input
                type="number"
                className="challenge-input"
                value={profitTargetPercent}
                onChange={(e) => setProfitTargetPercent(parseFloat(e.target.value) || 0)}
                step={0.5}
                min={1}
                max={50}
                required
              />
              <span className="challenge-unit">%</span>
            </div>
            <span className="challenge-calc-text">
              Target Amount: ${((sessionConfig.initialBalance * profitTargetPercent) / 100).toLocaleString('en-US')}
            </span>
          </div>

          {/* Notice Banner */}
          <div className="challenge-notice">
            <AlertCircle size={16} className="challenge-notice-icon" />
            <span>
              Real-time drawdown enforcement active. Breach will trigger instant challenge status update.
            </span>
          </div>

          {/* Actions */}
          <div className="challenge-modal__footer">
            <button type="button" className="challenge-btn-secondary" onClick={onBack}>
              <ArrowLeft size={15} />
              <span>Back</span>
            </button>

            <button type="submit" className="challenge-btn-primary">
              <Play size={15} fill="currentColor" />
              <span>Enter Session Replay</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
