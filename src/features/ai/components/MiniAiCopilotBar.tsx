/**
 * TradePro AI Live Copilot Bar
 * Floating, draggable real-time risk guardian and AI trading companion.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Shield,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
  Send,
  RefreshCw,
  Clock,
  Brain,
  Minus,
  MessageSquare,
  Activity,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { useAiRiskGuardian, type RiskMood } from '../AiRiskGuardianEngine';
import {
  sendAIChatMessage,
  getAiProvider,
  getStoredApiKey,
  getStored9RouterApiKey,
  getStoredModel,
  getStored9RouterModel,
  type ChatMessage,
} from '../geminiService';
import { tradingEngine } from '../../trading2/TradingEngineService';
import type { AnalyticsSession } from '../../analytics/types';
import './MiniAiCopilotBar.css';

interface MiniAiCopilotBarProps {
  activeSession?: AnalyticsSession | null;
  onClose?: () => void;
}

export const MiniAiCopilotBar: React.FC<MiniAiCopilotBarProps> = ({ activeSession, onClose }) => {
  const assessment = useAiRiskGuardian(activeSession);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'guardian' | 'chat'>('guardian');

  // Interactive Mini Chat States (Isolated per session)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [fetchingAdvice, setFetchingAdvice] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const sessionKey = activeSession?.id || 'default';

  // Restore and isolate chat & advice per session ID (or default)
  useEffect(() => {
    const chatKey = `tradepro_copilot_chat_${sessionKey}`;
    const adviceKey = `tradepro_copilot_advice_${sessionKey}`;
    try {
      const savedChat = localStorage.getItem(chatKey);
      if (savedChat) {
        const parsed = JSON.parse(savedChat);
        if (Array.isArray(parsed)) {
          // Auto-clean any hallucinated error replies or error banners
          const cleaned = parsed.filter(
            (m) =>
              !(
                m.role === 'assistant' &&
                (m.content.startsWith('⚠️') ||
                  m.content.startsWith('9Router error.') ||
                  m.content.includes('Gagal menghubungi') ||
                  m.content.includes('Coach mati'))
              )
          );
          setChatMessages(cleaned);
        } else {
          setChatMessages([]);
        }
      } else {
        setChatMessages([]);
      }
      const savedAdvice = localStorage.getItem(adviceKey);
      setAiAdvice(savedAdvice || null);
    } catch {
      setChatMessages([]);
      setAiAdvice(null);
    }
  }, [sessionKey]);

  const [lastTradeCount, setLastTradeCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`tradepro_copilot_trade_count_${sessionKey}`);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const handleResetChat = () => {
    setChatMessages([]);
    setLastTradeCount(0);
    try {
      localStorage.removeItem(`tradepro_copilot_chat_${sessionKey}`);
      localStorage.removeItem(`tradepro_copilot_trade_count_${sessionKey}`);
    } catch {}
  };

  // Persist chat per session
  useEffect(() => {
    const chatKey = `tradepro_copilot_chat_${sessionKey}`;
    try {
      if (chatMessages.length > 0) {
        localStorage.setItem(chatKey, JSON.stringify(chatMessages));
      }
    } catch {}
  }, [chatMessages, sessionKey]);

  // Persist advice per session
  useEffect(() => {
    if (!aiAdvice) return;
    const adviceKey = `tradepro_copilot_advice_${sessionKey}`;
    try {
      localStorage.setItem(adviceKey, aiAdvice);
    } catch {}
  }, [aiAdvice, sessionKey]);

  // Floating Draggable Position
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      return {
        x: Math.max(20, window.innerWidth - 380),
        y: 65,
      };
    }
    return { x: 900, y: 65 };
  });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, textarea, a')) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: pos.x,
      startY: pos.y,
    };

    const handlePointerMove = (ev: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = ev.clientX - dragStartRef.current.mouseX;
      const dy = ev.clientY - dragStartRef.current.mouseY;
      const maxX = Math.max(10, window.innerWidth - (isExpanded ? 390 : 320));
      const maxY = Math.max(10, window.innerHeight - (isExpanded ? 460 : 60));
      const newX = Math.max(10, Math.min(maxX, dragStartRef.current.startX + dx));
      const newY = Math.max(10, Math.min(maxY, dragStartRef.current.startY + dy));
      setPos({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isAiThinking]);

  // Request fresh AI advice on demand
  const handleFetchAiLiveAdvice = async () => {
    if (fetchingAdvice) return;
    setFetchingAdvice(true);

    try {
      const openPositions = tradingEngine.getOpenPositions();
      const account = tradingEngine.accountEngine.getState();
      const provider = getAiProvider();
      const apiKey = provider === 'gemini' ? getStoredApiKey() : getStored9RouterApiKey();
      const model = provider === 'gemini' ? getStoredModel() : getStored9RouterModel();

      const openSummary = openPositions.length === 0
        ? 'Tidak ada posisi terbuka.'
        : openPositions.map((p) => `- ${p.direction} ${p.symbol} (${p.volume} Lot), Entry: ${p.entryPrice}, SL: ${p.stopLoss || 'TIDAK ADA SL'}, TP: ${p.takeProfit || 'Tidak ada'}`).join('\n');

      const prompt = `Anda adalah TradePro AI Live Copilot. Berikan review dan nasihat kilat (maksimal 2 kalimat langsung ke intinya) untuk trader yang sedang aktif di chart saat ini.
Status Akun:
- Saldo: $${account.balance.toFixed(2)} | Floating PnL: $${account.floatingPnL.toFixed(2)}
- Posisi Terbuka: ${openPositions.length}
${openSummary}
- Mood Risiko: ${assessment.mood} (${assessment.headline})
Fokuskan pada: kepatuhan Stop Loss, disiplin lot, dan ketenangan psikologi. Gunakan gaya mentor santai tapi tegas dalam Bahasa Indonesia.`;

      const reply = await sendAIChatMessage(
        [{ role: 'user', content: prompt }],
        provider,
        apiKey,
        model
      );
      setAiAdvice(reply);
    } catch (err: any) {
      console.warn('[MiniAiCopilotBar] Live advice failed:', err);
      setAiAdvice('Tetap patuhi trading plan dan selalu gunakan Stop Loss di setiap transaksi.');
    } finally {
      setFetchingAdvice(false);
    }
  };

  // Quick Send Chat
  const handleSendChat = async (e?: React.SyntheticEvent, customPrompt?: string) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    const query = (customPrompt || chatInput).trim();
    if (!query || isAiThinking) return;

    const userMsg: ChatMessage = { role: 'user', content: query };
    const nextMsgs = [...chatMessages, userMsg];
    setChatMessages(nextMsgs);
    setChatInput('');
    setIsAiThinking(true);

    try {
      const provider = getAiProvider();
      const apiKey = provider === 'gemini' ? getStoredApiKey() : getStored9RouterApiKey();
      const model = provider === 'gemini' ? getStoredModel() : getStored9RouterModel();

      const openPositions = tradingEngine.getOpenPositions();
      const account = tradingEngine.accountEngine.getState();
      const history = tradingEngine.getTradeHistory();

      const openSummary = openPositions.length === 0
        ? 'Tidak ada posisi terbuka saat ini.'
        : openPositions.map((p) => `- ${p.direction} ${p.symbol} (${p.volume} Lot), Entry: ${p.entryPrice}, SL: ${p.stopLoss || 'TIDAK ADA SL'}, TP: ${p.takeProfit || 'Tidak ada'}`).join('\n');

      const recentClosedSummary = history.length === 0
        ? 'Belum ada trade yang ditutup.'
        : history.slice(-5).map((t, i) => `- Trade #${Math.max(1, history.length - 4 + i)}: ${t.direction} ${t.symbol} (${t.volume} Lot), PnL: ${t.profit >= 0 ? '+' : ''}$${t.profit.toFixed(2)}, SL: ${t.stopLoss || 'No SL'}`).join('\n');

      const systemContext = `Anda adalah TradePro AI Live Copilot & Risk Guardian yang mendampingi trader secara real-time di chart screen.
Tugas Anda:
1. Menjawab pertanyaan trader secara lugas, bersahabat, taktis, dan solutif dalam Bahasa Indonesia.
2. Membantu trader mengontrol risiko, kepatuhan Stop Loss, ukuran lot, dan menjaga psikologi agar tidak tilt/revenge trading.
3. Selalu mengacu pada kondisi riil trading akun trader di bawah ini:

KONDISI AKUN REAL-TIME:
- Saldo Akun: $${account.balance.toFixed(2)} | Equity: $${account.equity.toFixed(2)}
- Floating PnL Saat Ini: ${account.floatingPnL >= 0 ? '+' : ''}$${account.floatingPnL.toFixed(2)}
- Margin Digunakan: $${(account.usedMargin ?? 0).toFixed(2)} | Free Margin: $${account.freeMargin.toFixed(2)}
- Mood Risiko Guardian: ${assessment.mood} (${assessment.headline})
- Posisi Terbuka (${openPositions.length}):
${openSummary}
- Trade Terakhir Ditutup:
${recentClosedSummary}
${activeSession ? `- Sesi Aktif: "${activeSession.name}" (${activeSession.symbol}, Mode: ${activeSession.mode})` : ''}

Pedoman:
- Jawab pertanyaan santai/umum trader (seperti sapaan, evaluasi setup, tips) dengan ramah dan profesional.
- Jika trader menanyakan kondisi akun atau posisinya, gunakan data faktual di atas.`;

      const currentTradeCount = history.length;
      const hasNewTrades = currentTradeCount > lastTradeCount && lastTradeCount > 0;

      let behindPrompt = '';
      if (hasNewTrades) {
        const prevCount = lastTradeCount;
        const tradeDiff = currentTradeCount - prevCount;
        const rangeText = tradeDiff === 1
          ? `trade terbaru (#${currentTradeCount})`
          : `trade-trade terbaru (#${prevCount + 1} s/d #${currentTradeCount})`;
        behindPrompt = `\n\n[Behind Prompt - Update Data Trade Baru]: Terdeteksi penambahan ${tradeDiff} data trade baru (Total trade sekarang: ${currentTradeCount}, sebelumnya: ${prevCount}). BACA data posisi aktif, floating PnL, Stop Loss, dan ${rangeText} terlebih dahulu. Jawab dengan mengacu kondisi faktual akun/posisi trader saat ini.`;
      }

      const sanitizedMsgs = nextMsgs.filter(
        (m) =>
          !(
            m.role === 'assistant' &&
            (m.content.startsWith('⚠️') ||
              m.content.startsWith('9Router error.') ||
              m.content.includes('Gagal menghubungi') ||
              m.content.includes('Coach mati'))
          )
      );

      const messagesForAi = sanitizedMsgs.map((m, idx) => {
        if (idx === sanitizedMsgs.length - 1 && m.role === 'user' && behindPrompt) {
          return { role: m.role, content: `${m.content}${behindPrompt}` };
        }
        return m;
      });

      const reply = await sendAIChatMessage(messagesForAi, provider, apiKey, model, systemContext);
      setChatMessages([...nextMsgs, { role: 'assistant', content: reply }]);

      if (hasNewTrades || currentTradeCount !== lastTradeCount) {
        setLastTradeCount(currentTradeCount);
        try {
          localStorage.setItem(`tradepro_copilot_trade_count_${sessionKey}`, currentTradeCount.toString());
        } catch {}
      }
    } catch (err: any) {
      setChatMessages([
        ...nextMsgs,
        { role: 'assistant', content: `⚠️ Gagal menghubungi AI Coach (${err?.message || 'Koneksi terganggu'}).` },
      ]);
    } finally {
      setIsAiThinking(false);
    }
  };

  const getMoodBadgeClass = (mood: RiskMood) => {
    switch (mood) {
      case 'DANGER':
        return 'copilot-mood--danger';
      case 'WARNING':
        return 'copilot-mood--warning';
      case 'SAFE':
      default:
        return 'copilot-mood--safe';
    }
  };

  return (
    <div
      className={`mini-copilot-container ${isExpanded ? 'is-expanded' : 'is-collapsed'} ${getMoodBadgeClass(assessment.mood)}`}
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      onPointerDown={handlePointerDown}
    >
      {/* ─── Compact Pill Bar (Always Visible) ─── */}
      <div className="mini-copilot-pill">
        <div className="mini-copilot-drag-handle" title="Tahan dan seret untuk memindahkan">
          <div className="mini-copilot-orb">
            <span className="mini-copilot-pulse" />
            {assessment.mood === 'SAFE' && <CheckCircle2 size={13} className="copilot-icon-safe" />}
            {assessment.mood === 'WARNING' && <AlertTriangle size={13} className="copilot-icon-warn" />}
            {assessment.mood === 'DANGER' && <AlertOctagon size={13} className="copilot-icon-danger" />}
          </div>
        </div>

        <div className="mini-copilot-info" onClick={() => setIsExpanded(!isExpanded)} title="Klik untuk membuka AI Guardian">
          <div className="mini-copilot-label">
            <Sparkles size={11} className="copilot-sparkle" />
            <span className="copilot-title">AI Copilot</span>
            <span className={`copilot-status-chip ${getMoodBadgeClass(assessment.mood)}`}>
              {assessment.mood === 'SAFE' && 'Optimal'}
              {assessment.mood === 'WARNING' && 'Perhatian'}
              {assessment.mood === 'DANGER' && 'Waspada!'}
            </span>
          </div>
          <div className="mini-copilot-headline">{assessment.headline}</div>
        </div>

        {assessment.openPositionsCount > 0 && (
          <div
            className={`mini-copilot-pnl ${assessment.currentFloatingPnL >= 0 ? 'is-positive' : 'is-negative'}`}
            title="Floating PnL Posisi Aktif"
          >
            {assessment.currentFloatingPnL >= 0 ? '+' : ''}${assessment.currentFloatingPnL.toFixed(2)}
          </div>
        )}

        <div className="mini-copilot-actions">
          <button
            type="button"
            className="mini-copilot-btn-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Kecilkan' : 'Buka Dashboard'}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {onClose && (
            <button
              type="button"
              className="mini-copilot-btn-close"
              onClick={onClose}
              title="Sembunyikan Copilot Bar"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ─── Expanded Dashboard Card ─── */}
      {isExpanded && (
        <div className="mini-copilot-card">
          {/* Card Tabs */}
          <div className="mini-copilot-tabs">
            <button
              type="button"
              className={`copilot-tab-btn ${activeTab === 'guardian' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('guardian')}
            >
              <Shield size={13} />
              <span>Risk Guardian</span>
            </button>
            <button
              type="button"
              className={`copilot-tab-btn ${activeTab === 'chat' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare size={13} />
              <span>Tanya Coach</span>
            </button>
          </div>

          {/* TAB 1: Live Risk Guardian */}
          {activeTab === 'guardian' && (
            <div className="copilot-tab-content">
              {/* Violations / Alert Banners */}
              {assessment.violations.length > 0 ? (
                <div className="copilot-violations-list">
                  {assessment.violations.map((v) => (
                    <div key={v.id} className={`copilot-violation-card is-${v.severity.toLowerCase()}`}>
                      <div className="violation-header">
                        {v.severity === 'DANGER' ? <AlertOctagon size={14} /> : <AlertTriangle size={14} />}
                        <strong>{v.title}</strong>
                      </div>
                      <p className="violation-message">{v.message}</p>
                      {v.actionHint && <p className="violation-hint">💡 {v.actionHint}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="copilot-clean-state">
                  <CheckCircle2 size={24} className="copilot-icon-safe" />
                  <div className="clean-title">Semua Parameter Aman</div>
                  <div className="clean-subtitle">
                    {assessment.openPositionsCount > 0
                      ? `${assessment.openPositionsCount} posisi terlindungi Stop Loss 100%.`
                      : 'Belum ada posisi terbuka. Tunggu konfirmasi setup terbaik Anda.'}
                  </div>
                </div>
              )}

              {/* Metrics Grid */}
              <div className="copilot-metrics-grid">
                <div className="copilot-metric-box">
                  <span className="metric-label">Disiplin SL</span>
                  <span className={`metric-value ${assessment.positionsWithoutSlCount > 0 ? 'is-danger' : 'is-safe'}`}>
                    {assessment.openPositionsCount === 0 ? '100%' : `${assessment.slCompliancePercent.toFixed(0)}%`}
                  </span>
                </div>
                <div className="copilot-metric-box">
                  <span className="metric-label">Posisi Aktif</span>
                  <span className="metric-value">{assessment.openPositionsCount}</span>
                </div>
                <div className="copilot-metric-box">
                  <span className="metric-label">Streak Loss</span>
                  <span className={`metric-value ${assessment.consecutiveLosses >= 2 ? 'is-danger' : ''}`}>
                    {assessment.consecutiveLosses}x
                  </span>
                </div>
              </div>

              {/* Revenge Trading Radar */}
              {assessment.isRevengeCoolingActive && (
                <div className="copilot-cooldown-bar">
                  <Clock size={13} className="cooldown-icon" />
                  <span>
                    Waktu Jeda Pasca-Loss: <strong>{assessment.cooldownRemainingSeconds}s</strong>
                  </span>
                </div>
              )}

              {/* Live AI Advice */}
              <div className="copilot-advice-section">
                <div className="advice-header">
                  <div className="advice-title">
                    <Brain size={13} />
                    <span>Nasihat AI Coach</span>
                  </div>
                  <button
                    type="button"
                    className="advice-refresh-btn"
                    onClick={handleFetchAiLiveAdvice}
                    disabled={fetchingAdvice}
                    title="Minta analisis real-time terkini"
                  >
                    <RefreshCw size={11} className={fetchingAdvice ? 'is-spinning' : ''} />
                    <span>{fetchingAdvice ? 'Menganalisis...' : 'Update'}</span>
                  </button>
                </div>
                <p className="advice-text">{aiAdvice || assessment.advice}</p>
              </div>
            </div>
          )}

          {/* TAB 2: Mini Chat With Coach */}
          {activeTab === 'chat' && (
            <div className="copilot-chat-content">
              {/* Chat Sub-Header: Active Engine info + Reset button */}
              <div className="copilot-chat-header">
                <span className="copilot-engine-badge">
                  {getAiProvider() === '9router' ? (
                    <>
                      <Zap size={11} className="engine-icon-router" />
                      <span>9Router ({getStored9RouterModel()})</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={11} className="engine-icon-gemini" />
                      <span>Gemini</span>
                    </>
                  )}
                </span>
                {chatMessages.length > 0 && (
                  <button
                    type="button"
                    className="copilot-btn-reset-chat"
                    onClick={handleResetChat}
                    title="Bersihkan riwayat chat sesi ini"
                  >
                    <RotateCcw size={10} />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Quick Prompt Chips */}
              <div className="copilot-quick-chips">
                <button
                  type="button"
                  className="quick-chip"
                  onClick={() => handleSendChat(undefined, 'Bagaimana manajemen risiko posisi terbuka saya saat ini?')}
                >
                  🛡️ Cek Risiko
                </button>
                <button
                  type="button"
                  className="quick-chip"
                  onClick={() => handleSendChat(undefined, 'Gua baru aja kena loss, kasih nasihat psikologi agar gak tilt.')}
                >
                  🧘 Nasihat Psikologi
                </button>
                <button
                  type="button"
                  className="quick-chip"
                  onClick={() => handleSendChat(undefined, 'Evaluasi apakah saya ada indikasi overtrading di sesi ini?')}
                >
                  ⚡ Cek Overtrading
                </button>
              </div>

              {/* Messages Body */}
              <div className="copilot-chat-body" ref={chatScrollRef}>
                {chatMessages.length === 0 ? (
                  <div className="chat-empty-hint">
                    <Sparkles size={20} className="sparkle-hint-icon" />
                    <p>Tanyakan apa saja seputar kondisi trading Anda sekarang ke AI Coach!</p>
                  </div>
                ) : (
                  chatMessages.map((m, idx) => (
                    <div key={idx} className={`copilot-chat-bubble is-${m.role}`}>
                      <div className="bubble-role">{m.role === 'user' ? 'Anda' : 'AI Coach'}</div>
                      <div className="bubble-text">{m.content}</div>
                    </div>
                  ))
                )}
                {isAiThinking && (
                  <div className="copilot-chat-bubble is-assistant is-thinking">
                    <span className="thinking-dot" />
                    <span className="thinking-dot" />
                    <span className="thinking-dot" />
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <form
                className="copilot-chat-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat(e);
                }}
              >
                <input
                  type="text"
                  placeholder="Ketik pertanyaan ke AI Coach..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                  disabled={isAiThinking}
                  className="copilot-chat-input"
                />
                <button
                  type="button"
                  onClick={() => handleSendChat()}
                  disabled={!chatInput.trim() || isAiThinking}
                  className="copilot-chat-send"
                  title="Kirim Pesan"
                >
                  <Send size={13} />
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
