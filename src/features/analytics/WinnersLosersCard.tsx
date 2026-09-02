import React from 'react';
import type { SessionAnalyticsResult } from './useSessionAnalytics';
import { HelpCircle } from 'lucide-react';
import './WinnersLosersCard.css';

interface WinnersLosersCardProps {
  analytics: SessionAnalyticsResult;
}

export const WinnersLosersCard: React.FC<WinnersLosersCardProps> = ({ analytics }) => {
  return (
    <div className="wl-section">
      <h3 className="wl-section__title">Winners and Losers</h3>

      <div className="wl-grid">
        {/* Winners Card */}
        <div className="wl-card wl-card--winners">
          <div className="wl-card__header">
            <h4 className="wl-card__title">Winners</h4>
          </div>

          <div className="wl-card__body">
            <div className="wl-card__row">
              <div className="wl-card__label-wrap" title="Jumlah total trade yang ditutup dengan profit bersih">
                <span>Total winners</span>
                <HelpCircle size={13} className="wl-card__info-icon" />
              </div>
              <span className="wl-card__val mono">{analytics.winningTrades}</span>
            </div>

            <div className="wl-card__row">
              <div className="wl-card__label-wrap" title="Persentase profit terbesar dari satu trade">
                <span>Best win</span>
                <HelpCircle size={13} className="wl-card__info-icon" />
              </div>
              <span className="wl-card__val mono wl-card__val--green">
                {analytics.bestWinPercent > 0 ? `${analytics.bestWinPercent.toFixed(2)}%` : '0.00%'}
              </span>
            </div>

            <div className="wl-card__row">
              <div className="wl-card__label-wrap" title="Rata-rata persentase profit dari seluruh trade menang">
                <span>Average win</span>
                <HelpCircle size={13} className="wl-card__info-icon" />
              </div>
              <span className="wl-card__val mono wl-card__val--green">
                {analytics.avgWinPercent > 0 ? `${analytics.avgWinPercent.toFixed(2)}%` : '0.00%'}
              </span>
            </div>

            <div className="wl-card__row">
              <div className="wl-card__label-wrap" title="Rata-rata waktu menahan posisi (holding time) untuk trade menang">
                <span>Average duration</span>
                <HelpCircle size={13} className="wl-card__info-icon" />
              </div>
              <span className="wl-card__val mono">{analytics.avgWinDuration}</span>
            </div>

            <div className="wl-card__row">
              <div className="wl-card__label-wrap" title="Jumlah kemenangan beruntun terpanjang tanpa kalah">
                <span>Max consecutive wins</span>
                <HelpCircle size={13} className="wl-card__info-icon" />
              </div>
              <span className="wl-card__val mono">{analytics.maxConsecutiveWins}</span>
            </div>

            <div className="wl-card__row">
              <div className="wl-card__label-wrap" title="Rata-rata jumlah kemenangan beruntun">
                <span>Avg consecutive wins</span>
                <HelpCircle size={13} className="wl-card__info-icon" />
              </div>
              <span className="wl-card__val mono">{analytics.avgConsecutiveWins}</span>
            </div>
          </div>
        </div>

        {/* Losers Card */}
        <div className="wl-card wl-card--losers">
          <div className="wl-card__header">
            <h4 className="wl-card__title">Losers</h4>
          </div>

          <div className="wl-card__body">
            <div className="wl-card__row">
              <div className="wl-card__label-wrap" title="Jumlah total trade yang ditutup dengan kerugian">
                <span>Total losers</span>
                <HelpCircle size={13} className="wl-card__info-icon" />
              </div>
              <span className="wl-card__val mono">{analytics.losingTrades}</span>
            </div>

            <div className="wl-card__row">
              <div className="wl-card__label-wrap" title="Persentase kerugian terbesar dari satu trade">
                <span>Worst loss</span>
                <HelpCircle size={13} className="wl-card__info-icon" />
              </div>
              <span className="wl-card__val mono wl-card__val--red">
                {analytics.worstLossPercent > 0 ? `${analytics.worstLossPercent.toFixed(2)}%` : '0.00%'}
              </span>
            </div>

            <div className="wl-card__row">
              <div className="wl-card__label-wrap" title="Rata-rata persentase kerugian dari seluruh trade kalah">
                <span>Average loss</span>
                <HelpCircle size={13} className="wl-card__info-icon" />
              </div>
              <span className="wl-card__val mono wl-card__val--red">
                {analytics.avgLossPercent > 0 ? `${analytics.avgLossPercent.toFixed(2)}%` : '0.00%'}
              </span>
            </div>

            <div className="wl-card__row">
              <div className="wl-card__label-wrap" title="Rata-rata waktu menahan posisi untuk trade kalah">
                <span>Average duration</span>
                <HelpCircle size={13} className="wl-card__info-icon" />
              </div>
              <span className="wl-card__val mono">{analytics.avgLossDuration}</span>
            </div>

            <div className="wl-card__row">
              <div className="wl-card__label-wrap" title="Jumlah kerugian beruntun terpanjang">
                <span>Max consecutive losses</span>
                <HelpCircle size={13} className="wl-card__info-icon" />
              </div>
              <span className="wl-card__val mono">{analytics.maxConsecutiveLosses}</span>
            </div>

            <div className="wl-card__row">
              <div className="wl-card__label-wrap" title="Rata-rata jumlah kerugian beruntun">
                <span>Avg consecutive losses</span>
                <HelpCircle size={13} className="wl-card__info-icon" />
              </div>
              <span className="wl-card__val mono">{analytics.avgConsecutiveLosses}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
