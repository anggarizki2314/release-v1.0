/**
 * TradePro AI Live Risk Guardian Engine
 * Performs real-time risk assessment, Stop Loss compliance checking,
 * revenge trading detection, and drawdown threshold monitoring (0ms local latency).
 */

import { useState, useEffect, useCallback } from 'react';
import { tradingEngine } from '../trading2/TradingEngineService';
import type { PositionModel } from '../trading2/position/PositionTypes';
import type { HistoryState } from '../trading2/store/TradingStoreTypes';
import type { AccountState } from '../trading2/account/AccountTypes';
import type { AnalyticsSession } from '../analytics/types';

export type RiskMood = 'SAFE' | 'WARNING' | 'DANGER';

export interface RiskViolation {
  id: string;
  type: 'NO_SL' | 'REVENGE_TRADING' | 'DRAWDOWN_WARN' | 'DRAWDOWN_CRITICAL' | 'LOSS_STREAK';
  severity: 'WARNING' | 'DANGER';
  title: string;
  message: string;
  actionHint?: string;
  positionId?: string;
}

export interface GuardianAssessment {
  mood: RiskMood;
  headline: string;
  advice: string;
  violations: RiskViolation[];
  openPositionsCount: number;
  positionsWithoutSlCount: number;
  slCompliancePercent: number;
  consecutiveLosses: number;
  secondsSinceLastLoss: number | null;
  isRevengeCoolingActive: boolean;
  cooldownRemainingSeconds: number;
  currentFloatingPnL: number;
  accountEquity: number;
  accountBalance: number;
  dailyDrawdownPercent: number;
  dailyDrawdownLimitPercent?: number;
}

const REVENGE_COOLDOWN_SECONDS = 90; // 1.5 minutes cooldown after a loss

export function assessTradingRisk(
  positions: ReadonlyArray<PositionModel>,
  history: ReadonlyArray<HistoryState>,
  account: AccountState,
  activeSession?: AnalyticsSession | null
): GuardianAssessment {
  const violations: RiskViolation[] = [];

  // 1. Check Stop Loss Compliance on Open Positions
  const totalOpen = positions.length;
  const withoutSl = positions.filter((p) => p.stopLoss == null || Number(p.stopLoss) <= 0);
  const withoutSlCount = withoutSl.length;
  const slCompliance = totalOpen > 0 ? ((totalOpen - withoutSlCount) / totalOpen) * 100 : 100;

  if (withoutSlCount > 0) {
    violations.push({
      id: 'no-sl-violation',
      type: 'NO_SL',
      severity: withoutSlCount >= 2 ? 'DANGER' : 'WARNING',
      title: `${withoutSlCount} Posisi Tanpa Stop Loss`,
      message: `Ada ${withoutSlCount} posisi terbuka yang floating tanpa pengaman Stop Loss (${withoutSl.map((p) => p.symbol).join(', ')}).`,
      actionHint: 'Pasang SL sekarang untuk membatasi kerugian tak terduga.',
      positionId: withoutSl[0]?.positionId,
    });
  }

  // 2. Check Loss Streak & Revenge Trading Tendency
  const sortedHistory = [...history].sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));
  let streak = 0;
  for (const t of sortedHistory) {
    if ((t.profit || 0) < 0) {
      streak++;
    } else {
      break;
    }
  }

  // Time since last loss
  const lastLoss = sortedHistory.find((t) => (t.profit || 0) < 0);
  let secondsSinceLastLoss: number | null = null;
  let isRevengeCoolingActive = false;
  let cooldownRemainingSeconds = 0;

  if (lastLoss && lastLoss.closedAt) {
    const diffSec = Math.floor((Date.now() - lastLoss.closedAt) / 1000);
    // If running in replay mode where closedAt might be in past replay time, handle gracefully
    secondsSinceLastLoss = Math.max(0, diffSec);

    // If a position was opened very quickly (< 90 seconds) after a loss
    if (totalOpen > 0) {
      const latestPos = positions[positions.length - 1];
      if (latestPos && latestPos.openedAt && lastLoss.closedAt) {
        const entryDiffSec = Math.abs(Math.floor((latestPos.openedAt - lastLoss.closedAt) / 1000));
        if (entryDiffSec < REVENGE_COOLDOWN_SECONDS) {
          violations.push({
            id: 'revenge-fast-entry',
            type: 'REVENGE_TRADING',
            severity: 'DANGER',
            title: 'Indikasi Revenge Trading!',
            message: `Order ${latestPos.symbol} dibuka hanya ${entryDiffSec} detik setelah trade loss sebelumnya.`,
            actionHint: 'Waspadai dorongan emosi balas dendam. Evaluasi ulang setup Anda.',
          });
        }
      }
    }

    if (diffSec >= 0 && diffSec < REVENGE_COOLDOWN_SECONDS) {
      isRevengeCoolingActive = true;
      cooldownRemainingSeconds = REVENGE_COOLDOWN_SECONDS - diffSec;
    }
  }

  if (streak >= 3) {
    violations.push({
      id: 'loss-streak-3',
      type: 'LOSS_STREAK',
      severity: 'DANGER',
      title: `${streak}x Loss Beruntun`,
      message: `Anda mengalami ${streak} kali kekalahan beruntun. Tingkat risiko emosional sedang sangat tinggi.`,
      actionHint: 'Sangat disarankan istirahat sejenak sebelum mengambil order baru.',
    });
  } else if (streak === 2) {
    violations.push({
      id: 'loss-streak-2',
      type: 'LOSS_STREAK',
      severity: 'WARNING',
      title: '2x Loss Beruntun',
      message: 'Perhatikan konfirmasi setup dan jangan menaikkan ukuran lot.',
      actionHint: 'Tetap disiplin pada trading plan.',
    });
  }

  // 3. Check Drawdown & Challenge Status
  let dailyDrawdownPercent = 0;
  let dailyLimitPercent: number | undefined = undefined;

  const challengeStatus = activeSession?.challengeStatus;
  const challengeRules = activeSession?.challengeRules;

  if (challengeStatus && challengeRules) {
    dailyLimitPercent = challengeRules.dailyLossPercent;
    const initialBal = activeSession?.initialBalance || account.balance || 10000;
    const currentDailyLoss = challengeStatus.dailyLossCurrent || 0;
    dailyDrawdownPercent = initialBal > 0 ? (currentDailyLoss / initialBal) * 100 : 0;

    if (dailyLimitPercent && dailyDrawdownPercent >= dailyLimitPercent * 0.75) {
      violations.push({
        id: 'dd-critical',
        type: 'DRAWDOWN_CRITICAL',
        severity: 'DANGER',
        title: 'Batas Drawdown Harian Kritis!',
        message: `Loss harian mencapai ${dailyDrawdownPercent.toFixed(1)}% (Batas Challenge: ${dailyLimitPercent}%).`,
        actionHint: 'Hindari entry baru agar akun tidak tereliminasi.',
      });
    } else if (dailyLimitPercent && dailyDrawdownPercent >= dailyLimitPercent * 0.5) {
      violations.push({
        id: 'dd-warning',
        type: 'DRAWDOWN_WARN',
        severity: 'WARNING',
        title: 'Drawdown Mendekati 50% Limit',
        message: `Loss harian sudah ${dailyDrawdownPercent.toFixed(1)}% dari batas ${dailyLimitPercent}%.`,
        actionHint: 'Perketat seleksi trade dan kurangi lot size.',
      });
    }
  } else {
    // Normal replay session: compare balance vs initial balance
    const initBal = activeSession?.initialBalance || account.balance;
    if (initBal > 0 && account.equity < initBal) {
      const dropPct = ((initBal - account.equity) / initBal) * 100;
      dailyDrawdownPercent = dropPct;
      if (dropPct >= 5) {
        violations.push({
          id: 'equity-drop-warn',
          type: 'DRAWDOWN_WARN',
          severity: dropPct >= 8 ? 'DANGER' : 'WARNING',
          title: `Floating Drawdown ${dropPct.toFixed(1)}%`,
          message: `Ekuitas akun turun ${dropPct.toFixed(1)}% dari modal awal ($${initBal.toLocaleString()}).`,
          actionHint: 'Pertahankan manajemen risiko ketat.',
        });
      }
    }
  }

  // Determine Overall Mood
  let mood: RiskMood = 'SAFE';
  let headline = 'Kondisi Sesi Optimal';
  let advice = 'Disiplin risiko terjaga baik. Pertahankan rencana trading Anda.';

  if (violations.some((v) => v.severity === 'DANGER')) {
    mood = 'DANGER';
    headline = violations.find((v) => v.severity === 'DANGER')?.title || 'Peringatan Risiko Tinggi!';
    advice = violations.find((v) => v.severity === 'DANGER')?.actionHint || 'Ambil jeda sejenak dan evaluasi posisi aktif Anda.';
  } else if (violations.length > 0) {
    mood = 'WARNING';
    headline = violations[0].title;
    advice = violations[0].actionHint || 'Periksa kembali parameter Stop Loss & ukuran lot Anda.';
  } else if (totalOpen > 0) {
    headline = `${totalOpen} Posisi Aktif Terproteksi`;
    advice = 'Semua order memiliki Stop Loss terpasang. Biarkan market bekerja sesuai probabilitas.';
  }

  return {
    mood,
    headline,
    advice,
    violations,
    openPositionsCount: totalOpen,
    positionsWithoutSlCount: withoutSlCount,
    slCompliancePercent: slCompliance,
    consecutiveLosses: streak,
    secondsSinceLastLoss,
    isRevengeCoolingActive,
    cooldownRemainingSeconds,
    currentFloatingPnL: account.floatingPnL,
    accountEquity: account.equity,
    accountBalance: account.balance,
    dailyDrawdownPercent,
    dailyDrawdownLimitPercent: dailyLimitPercent,
  };
}

/**
 * React Hook for binding UI to the real-time AI Risk Guardian assessment
 */
export function useAiRiskGuardian(activeSession?: AnalyticsSession | null): GuardianAssessment {
  const [assessment, setAssessment] = useState<GuardianAssessment>(() => {
    const positions = tradingEngine.getOpenPositions();
    const history = tradingEngine.getTradeHistory();
    const account = tradingEngine.accountEngine.getState();
    return assessTradingRisk(positions, history, account, activeSession);
  });

  const recompute = useCallback(() => {
    const positions = tradingEngine.getOpenPositions();
    const history = tradingEngine.getTradeHistory();
    const account = tradingEngine.accountEngine.getState();
    setAssessment(assessTradingRisk(positions, history, account, activeSession));
  }, [activeSession]);

  useEffect(() => {
    recompute();
    const unsubEngine = tradingEngine.subscribe(recompute);
    const unsubAccount = tradingEngine.accountEngine.subscribe(recompute);

    // Periodic check every 2 seconds for cooldown countdown
    const timer = setInterval(recompute, 2000);

    return () => {
      unsubEngine();
      unsubAccount();
      clearInterval(timer);
    };
  }, [recompute]);

  return assessment;
}
