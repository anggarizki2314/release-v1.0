import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles,
  X,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  ExternalLink,
  Key,
  CheckCircle2,
  Eye,
  EyeOff,
  Settings2,
  Server,
  Layers,
  Send,
  User,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import type { HistoryState } from '../trading2/store/TradingStoreTypes';
import type { AnalyticsSession } from './types';
import {
  getStoredApiKey,
  saveApiKey,
  getStoredModel,
  saveModel,
  AVAILABLE_MODELS,
  getAiProvider,
  saveAiProvider,
  getStored9RouterUrl,
  save9RouterUrl,
  getStored9RouterApiKey,
  save9RouterApiKey,
  getStored9RouterModel,
  save9RouterModel,
  fetch9RouterModels,
  generateTradeReview,
  generateSessionAudit,
  sendAIChatMessage,
  buildAiSystemContext,
  type Detected9RouterModel,
  type ChatMessage,
  type AiProvider,
} from '../ai/geminiService';
import './AICoachModal.css';

interface AICoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'trade' | 'session';
  trade?: HistoryState | null;
  session?: AnalyticsSession | null;
  analytics?: any | null;
  onAppendNote?: (text: string) => void;
}

export const AICoachModal: React.FC<AICoachModalProps> = ({
  isOpen,
  onClose,
  mode,
  trade,
  session,
  analytics,
  onAppendNote,
}) => {
  const [provider, setProvider] = useState<AiProvider>(() => getAiProvider());
  const [apiKey, setApiKey] = useState<string>('');
  const [inputKey, setInputKey] = useState<string>('');
  const [showKeyText, setShowKeyText] = useState<boolean>(false);
  const [currentModel, setCurrentModel] = useState<string>('gemini-3.6-flash');
  const [showKeyCard, setShowKeyCard] = useState<boolean>(false);

  // 9Router states
  const [routerUrl, setRouterUrl] = useState<string>(() => getStored9RouterUrl());
  const [routerKey, setRouterKey] = useState<string>(() => getStored9RouterApiKey());
  const [selected9RouterModel, setSelected9RouterModel] = useState<string>(() => getStored9RouterModel());
  const [detectedCombos, setDetectedCombos] = useState<Detected9RouterModel[]>([]);
  const [detectingCombos, setDetectingCombos] = useState<boolean>(false);
  const [awaitingComboSelection, setAwaitingComboSelection] = useState<boolean>(false);
  const [showModelMenu, setShowModelMenu] = useState<boolean>(false);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setShowModelMenu(false);
      }
    };
    if (showModelMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showModelMenu]);

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);

  // Dynamic realistic progress animation for modal loading bar
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (loading) {
      setLoadingProgress(8);
      timer = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev < 25) {
            return prev + Math.floor(Math.random() * 4 + 3);
          } else if (prev < 55) {
            return prev + Math.floor(Math.random() * 3 + 2);
          } else if (prev < 82) {
            return prev + Math.floor(Math.random() * 2 + 1);
          } else if (prev < 94) {
            return prev + 1;
          }
          return prev;
        });
      }, 150);
    } else {
      setLoadingProgress(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [loading]);

  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [appended, setAppended] = useState<boolean>(false);

  // Interactive Chat States
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [sendingChat, setSendingChat] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new chat message
  useEffect(() => {
    if (chatMessages.length > 1) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, sendingChat]);

  // Unique storage key for persisting chat per trade or session
  const getChatStorageKey = useCallback((): string | null => {
    if (mode === 'trade') {
      const id = trade?.tradeId || (trade as any)?.ticket || (trade ? `${trade.symbol}_${trade.openedAt}` : null);
      return id ? `tradepro_ai_chat_trade_${id}` : null;
    }
    if (mode === 'session') {
      const id = session?.id || session?.name;
      return id ? `tradepro_ai_chat_session_${id}` : null;
    }
    return null;
  }, [mode, trade?.tradeId, (trade as any)?.ticket, trade?.symbol, trade?.openedAt, session?.id, session?.name]);

  // Unique storage key for tracking last audited trade count in this session
  const getTradeCountStorageKey = useCallback((): string | null => {
    if (mode === 'session') {
      const id = session?.id || session?.name;
      return id ? `tradepro_ai_trade_count_session_${id}` : null;
    }
    return null;
  }, [mode, session?.id, session?.name]);

  const [lastTradeCount, setLastTradeCount] = useState<number>(0);

  // Persist chat messages whenever they change
  useEffect(() => {
    const storageKey = getChatStorageKey();
    if (storageKey && chatMessages.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(chatMessages));
      } catch (e) {
        console.warn('[AICoachModal] Failed to persist chat history:', e);
      }
    }
  }, [chatMessages, getChatStorageKey]);

  // Load key & model on open, restore chat if previously saved
  useEffect(() => {
    if (isOpen) {
      const activeProv = getAiProvider();
      setProvider(activeProv);
      const storedKey = getStoredApiKey();
      const storedGeminiModel = getStoredModel();
      const storedRouterUrl = getStored9RouterUrl();
      const storedRouterKey = getStored9RouterApiKey();
      setApiKey(storedKey);
      setInputKey(storedKey);
      setRouterUrl(storedRouterUrl);
      setRouterKey(storedRouterKey);

      setCurrentModel(storedGeminiModel);
      setAppended(false);
      setCopied(false);

      // 1. Check if a conversation was previously saved for this trade/session
      const storageKey = getChatStorageKey();
      let restoredMessages: ChatMessage[] = [];
      if (storageKey) {
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              restoredMessages = parsed;
            }
          }
        } catch (e) {
          console.warn('[AICoachModal] Failed to restore chat history:', e);
        }
      }

      if (restoredMessages.length > 0) {
        setChatMessages(restoredMessages);
        setResult(restoredMessages[0]?.content || '');
        setLoading(false);
        setDetectingCombos(false);
        setAwaitingComboSelection(false);
        setError(null);
        setShowKeyCard(false);

        // Restore or initialize last audited trade count
        const countKey = getTradeCountStorageKey();
        if (countKey) {
          try {
            const savedCount = localStorage.getItem(countKey);
            if (savedCount !== null) {
              const num = parseInt(savedCount, 10);
              if (!isNaN(num)) setLastTradeCount(num);
            } else {
              const cur = analytics?.trades?.length ?? analytics?.totalTrades ?? session?.totalTrades ?? 0;
              setLastTradeCount(cur);
              localStorage.setItem(countKey, cur.toString());
            }
          } catch {}
        }

        // Populate detected combos in background for header switcher
        if (activeProv === '9router') {
          fetch9RouterModels(storedRouterUrl)
            .then((list) => {
              if (list && list.length > 0) setDetectedCombos(list);
            })
            .catch(() => {});
        }
        return;
      }

      // 2. If no saved chat, determine flow
      if (activeProv === 'gemini') {
        setAwaitingComboSelection(false);
        setDetectingCombos(false);
        if (storedKey) {
          setShowKeyCard(false);
          runAnalysis(storedKey, storedGeminiModel, 'gemini');
        } else {
          setShowKeyCard(true);
          setLoading(false);
          setResult(null);
          setChatMessages([]);
          setError(null);
        }
      } else {
        // activeProv === '9router'
        if (!storedRouterKey) {
          setShowKeyCard(true);
          setLoading(false);
          setDetectingCombos(false);
          setAwaitingComboSelection(false);
          setResult(null);
          setChatMessages([]);
          setError(null);
          return;
        }

        // Detect 9Router combos FIRST before connecting
        setLoading(true);
        setDetectingCombos(true);
        setShowKeyCard(false);
        setError(null);

        fetch9RouterModels(storedRouterUrl)
          .then((list) => {
            setDetectingCombos(false);
            const models = list || [];
            setDetectedCombos(models);
            const combos = models.filter((c) => c.isCombo);

            if (combos.length > 1) {
              // 2 or more combos: let user choose combo FIRST before connecting
              setLoading(false);
              setAwaitingComboSelection(true);
            } else if (combos.length === 1) {
              // Exactly 1 combo: auto-select and connect immediately
              const singleCombo = combos[0].id;
              setSelected9RouterModel(singleCombo);
              save9RouterModel(singleCombo);
              setAwaitingComboSelection(false);
              runAnalysis(storedRouterKey, singleCombo, '9router');
            } else {
              // 0 combos detected (fallback to saved model or opencode2)
              const fallback = getStored9RouterModel() || 'opencode2';
              setAwaitingComboSelection(false);
              runAnalysis(storedRouterKey, fallback, '9router');
            }
          })
          .catch((err) => {
            console.warn('[AICoachModal] 9Router combo detection error:', err);
            setDetectingCombos(false);
            setAwaitingComboSelection(false);
            runAnalysis(storedRouterKey, getStored9RouterModel() || 'opencode2', '9router');
          });
      }
    } else {
      // On modal close, preserve chatMessages in state/localStorage, only reset input fields
      setChatInput('');
      setSendingChat(false);
      setLoading(false);
      setDetectingCombos(false);
      setAwaitingComboSelection(false);
      setShowKeyCard(false);
    }
  }, [isOpen, trade?.tradeId, session?.id, getChatStorageKey]);

  const runAnalysis = useCallback(
    async (keyToUse: string, modelToUse?: string, providerToUse?: AiProvider) => {
      setAwaitingComboSelection(false);
      setDetectingCombos(false);
      const activeProv = providerToUse || provider;
      const activeModel = modelToUse || (activeProv === '9router' ? (selected9RouterModel || getStored9RouterModel()) : currentModel);

      if (activeProv === 'gemini') {
        const trimmedKey = keyToUse.trim();
        if (!trimmedKey) {
          setError('Google Gemini API Key belum diisi. Silakan masukkan API Key Anda.');
          setShowKeyCard(true);
          return;
        }
      } else if (activeProv === '9router') {
        const trimmedKey = keyToUse.trim();
        if (!trimmedKey) {
          setError('9Router API Key belum diisi. Salin API Key dari dasbor 9Router di http://localhost:20128.');
          setShowKeyCard(true);
          return;
        }
      }

      setLoading(true);
      setError(null);

      try {
        let textResult = '';
        if (mode === 'trade' && trade) {
          textResult = await generateTradeReview(trade, keyToUse, activeModel, activeProv);
        } else if (mode === 'session' && session) {
          textResult = await generateSessionAudit(session, analytics, keyToUse, activeModel, activeProv);
        } else {
          throw new Error('Data trade atau session tidak ditemukan untuk dianalisis.');
        }
        setLoadingProgress(100);
        await new Promise((r) => setTimeout(r, 260));
        setResult(textResult);
        setChatMessages([{ role: 'assistant', content: textResult }]);
        setShowKeyCard(false);

        // Record initial trade count after analysis
        const initialCount = mode === 'session'
          ? (analytics?.trades?.length ?? analytics?.totalTrades ?? session?.totalTrades ?? 0)
          : 1;
        setLastTradeCount(initialCount);
        const countKey = getTradeCountStorageKey();
        if (countKey) {
          try {
            localStorage.setItem(countKey, initialCount.toString());
          } catch {}
        }
      } catch (err: any) {
        console.error('[AICoachModal] Analysis failed:', err);
        setError(err?.message || `Gagal memperoleh respon dari ${activeProv === '9router' ? '9Router' : 'Gemini AI'}.`);
        setShowKeyCard(true);
      } finally {
        setLoading(false);
      }
    },
    [mode, trade, session, analytics, currentModel, provider, selected9RouterModel, getTradeCountStorageKey]
  );

  const handleSendChat = async (e?: React.SyntheticEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    const trimmed = chatInput.trim();
    if (!trimmed || sendingChat || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    setChatInput('');
    setSendingChat(true);

    try {
      const activeProv = provider;
      const keyToUse = activeProv === 'gemini' ? (apiKey || inputKey) : (routerKey || getStored9RouterApiKey());
      const modelToUse = activeProv === '9router' ? selected9RouterModel : currentModel;
      const systemContext = buildAiSystemContext(mode, trade, session, analytics);

      const currentTradeCount = mode === 'session'
        ? (analytics?.trades?.length ?? analytics?.totalTrades ?? session?.totalTrades ?? 0)
        : 1;

      // Behind Prompt HANYA ditambahkan jika data trade bertambah (currentTradeCount > lastTradeCount)
      const hasNewTrades = currentTradeCount > lastTradeCount;

      let behindPrompt = '';
      if (hasNewTrades) {
        const prevCount = lastTradeCount;
        if (prevCount === 0) {
          behindPrompt = mode === 'session'
            ? `\n\n[Behind Prompt - Instruksi AI Coach]: BACA dan telaah data sesi backtest trader di atas terlebih dahulu. Jawab pertanyaan di atas dengan WAJIB merujuk data konkret sesi ini (seperti nomor trade spesifik #..., angka winrate, net PnL, kepatuhan SL, rasio lot, serta Catatan / Confluence yang ditulis trader pada log trade). Jangan berikan nasihat umum/klise tanpa bukti data dari sesi ini.`
            : `\n\n[Behind Prompt - Instruksi AI Coach]: BACA data trade ini terlebih dahulu (Entry, Exit, SL, TP, PnL, Lot, Durasi, serta Catatan / Confluence dari trader). Jawab pertanyaan di atas dengan merujuk data faktual dan confluence trade tersebut secara spesifik.`;
        } else {
          const tradeDiff = currentTradeCount - prevCount;
          const rangeText = tradeDiff === 1
            ? `trade terbaru (#${currentTradeCount})`
            : `trade-trade terbaru (#${prevCount + 1} s/d #${currentTradeCount})`;
          behindPrompt = `\n\n[Behind Prompt - Update Data Trade Baru]: Terdeteksi penambahan ${tradeDiff} data trade baru dalam sesi ini (Total trade sekarang: ${currentTradeCount}, sebelumnya: ${prevCount}). BACA dan telaah ${rangeText} serta perubahan statistik sesi ini terlebih dahulu. Evaluasi hasil eksekusi, PnL, kepatuhan SL, dan catatan / confluence entry trader pada trade baru tersebut!`;
        }
      }

      // Behind Prompt: hanya disematkan di belakang pertanyaan jika ada penambahan trade baru
      const messagesForAi = nextHistory.map((m, idx) => {
        if (idx === nextHistory.length - 1 && m.role === 'user' && behindPrompt) {
          return { role: m.role, content: `${m.content}${behindPrompt}` };
        }
        return m;
      });

      const reply = await sendAIChatMessage(messagesForAi, activeProv, keyToUse, modelToUse, systemContext);
      setChatMessages([...nextHistory, { role: 'assistant', content: reply }]);

      if (hasNewTrades || currentTradeCount < lastTradeCount) {
        setLastTradeCount(currentTradeCount);
        const countKey = getTradeCountStorageKey();
        if (countKey) {
          try {
            localStorage.setItem(countKey, currentTradeCount.toString());
          } catch {}
        }
      }
    } catch (chatErr: any) {
      console.error('[AICoachModal] Chat error:', chatErr);
      setChatMessages([
        ...nextHistory,
        {
          role: 'assistant',
          content: `⚠️ Maaf, gagal memperoleh jawaban (${chatErr?.message || 'Gangguan koneksi'}). Silakan coba tanyakan kembali.`,
        },
      ]);
    } finally {
      setSendingChat(false);
    }
  };

  const handleChangeProvider = (newProv: AiProvider) => {
    setProvider(newProv);
    saveAiProvider(newProv);
    if (newProv === 'gemini') {
      setCurrentModel(getStoredModel());
    } else {
      const storedM = getStored9RouterModel();
      setSelected9RouterModel(storedM);
      fetch9RouterModels(routerUrl)
        .then((list) => {
          if (list && list.length > 0) setDetectedCombos(list);
        })
        .catch(() => {});
    }
  };

  const handleSaveAndRetry = () => {
    if (provider === 'gemini') {
      const trimmed = inputKey.trim();
      if (!trimmed) return;
      saveApiKey(trimmed);
      setApiKey(trimmed);
      saveModel(currentModel);
      runAnalysis(trimmed, currentModel, 'gemini');
    } else {
      save9RouterUrl(routerUrl);
      save9RouterApiKey(routerKey);
      save9RouterModel(selected9RouterModel);
      runAnalysis(routerKey, selected9RouterModel, '9router');
    }
  };

  const handleSelectGeminiModel = (modelId: string) => {
    saveModel(modelId);
    setCurrentModel(modelId);
    if (apiKey) {
      runAnalysis(apiKey, modelId, 'gemini');
    }
  };

  const handleSelect9RouterModel = (modelId: string) => {
    setAwaitingComboSelection(false);
    setSelected9RouterModel(modelId);
    save9RouterModel(modelId);
    const keyToUse = routerKey || getStored9RouterApiKey();
    if (keyToUse) {
      runAnalysis(keyToUse, modelId, '9router');
    }
  };

  const handleSelectAndConnect = (comboId: string) => {
    setAwaitingComboSelection(false);
    setSelected9RouterModel(comboId);
    save9RouterModel(comboId);
    const keyToUse = routerKey || getStored9RouterApiKey();
    if (keyToUse) {
      runAnalysis(keyToUse, comboId, '9router');
    }
  };

  const handleResetAndReanalyze = () => {
    const storageKey = getChatStorageKey();
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        console.warn('[AICoachModal] Failed to remove chat key:', e);
      }
    }
    const countKey = getTradeCountStorageKey();
    if (countKey) {
      try {
        localStorage.removeItem(countKey);
      } catch (e) {
        console.warn('[AICoachModal] Failed to remove trade count key:', e);
      }
    }
    setLastTradeCount(0);
    setChatMessages([]);
    setResult(null);
    setError(null);
    setAwaitingComboSelection(false);
    const keyToUse = provider === 'gemini' ? (apiKey || inputKey) : (routerKey || getStored9RouterApiKey());
    const modelToUse = provider === '9router' ? selected9RouterModel : currentModel;
    runAnalysis(keyToUse, modelToUse, provider);
  };

  const handleCopy = () => {
    if (chatMessages.length === 0 && !result) return;
    const fullText =
      chatMessages.length > 0
        ? chatMessages
            .map((m) => `[${m.role === 'user' ? 'USER' : 'AI COACH'}]:\n${m.content}`)
            .join('\n\n---\n\n')
        : result || '';
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAppendToJournal = () => {
    if (!result || !onAppendNote) return;
    onAppendNote(result);
    setAppended(true);
    setTimeout(() => setAppended(false), 3000);
  };

  if (!isOpen) return null;

  // Simple, clean markdown-to-elements renderer
  const renderFormattedResult = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) {
        elements.push(<div key={`blank-${index}`} style={{ height: '8px' }} />);
        return;
      }

      if (trimmed.startsWith('### ')) {
        const title = trimmed.replace('### ', '');
        elements.push(
          <h3 key={`h3-${index}`}>
            {title}
          </h3>
        );
      } else if (trimmed.startsWith('## ')) {
        const title = trimmed.replace('## ', '');
        elements.push(
          <h2 key={`h2-${index}`} style={{ fontSize: '15px', fontWeight: 600, margin: '14px 0 6px 0', color: '#f8fafc' }}>
            {title}
          </h2>
        );
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const bulletText = trimmed.substring(2);
        elements.push(
          <li key={`li-${index}`} style={{ listStyleType: 'disc', marginLeft: '16px', marginBottom: '4px' }}>
            {formatBoldText(bulletText)}
          </li>
        );
      } else if (/^\d+\.\s/.test(trimmed)) {
        elements.push(
          <div key={`num-${index}`} style={{ marginLeft: '16px', marginBottom: '6px' }}>
            {formatBoldText(trimmed)}
          </div>
        );
      } else {
        elements.push(
          <p key={`p-${index}`} style={{ margin: '4px 0' }}>
            {formatBoldText(trimmed)}
          </p>
        );
      }
    });

    return <div className="ai-modal-result">{elements}</div>;
  };

  const formatBoldText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="ai-modal-overlay" onClick={onClose}>
      <div className="ai-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="ai-modal-header">
          <div className="ai-modal-title-wrap">
            <div className="ai-modal-badge-icon">
              {provider === '9router' ? <Server size={18} /> : <Sparkles size={18} />}
            </div>
            <div>
              <h2 className="ai-modal-title">
                {mode === 'trade'
                  ? `${provider === '9router' ? '9Router' : 'Gemini'} AI Trade Review`
                  : `${provider === '9router' ? '9Router' : 'Gemini'} AI Session Audit & Risk Diagnostic`}
              </h2>
              <p className="ai-modal-subtitle">
                {mode === 'trade'
                  ? `Evaluasi & feedback mendalam trade ${trade?.symbol || ''} (${trade?.direction || ''})`
                  : `Audit habit, psikologi, dan statistik sesi "${session?.name || ''}"`}
              </p>
            </div>
          </div>

          <div className="ai-modal-header-actions">
            {/* Model / Combo Dropdown Menu */}
            <div ref={modelMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="ai-modal-model-pill"
                onClick={() => setShowModelMenu(!showModelMenu)}
                title="Pilih model atau profil combo"
              >
                <span>{provider === '9router' ? (selected9RouterModel || 'opencode2') : currentModel}</span>
                <ChevronDown
                  size={13}
                  style={{
                    opacity: 0.7,
                    transform: showModelMenu ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
                  }}
                />
              </button>

              {showModelMenu && (
                <div
                  className="ai-model-popup-menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    width: '280px',
                    maxHeight: '380px',
                    overflowY: 'auto',
                    backgroundColor: '#161822',
                    border: '1px solid #282d3c',
                    borderRadius: '8px',
                    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
                    padding: '8px',
                    zIndex: 9999,
                    animation: 'fadeIn 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      padding: '4px 8px 8px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#8490a5',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                      marginBottom: '6px',
                    }}
                  >
                    <span>Model / Combo</span>
                    {provider === '9router' && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          setDetectingCombos(true);
                          const list = await fetch9RouterModels(routerUrl);
                          setDetectedCombos(list || []);
                          setDetectingCombos(false);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          fontSize: '10px',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontWeight: 500,
                        }}
                        title="Pindai ulang daftar combo 9Router"
                      >
                        <RefreshCw size={10} className={detectingCombos ? 'spin' : ''} />
                        <span>Refresh</span>
                      </button>
                    )}
                  </div>

                  {/* Provider Switcher Tabs */}
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleChangeProvider('9router')}
                      style={{
                        flex: 1,
                        padding: '5px 8px',
                        fontSize: '11.5px',
                        fontWeight: provider === '9router' ? 600 : 500,
                        borderRadius: '6px',
                        border: `1px solid ${provider === '9router' ? '#3b82f6' : '#282d3c'}`,
                        background: provider === '9router' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                        color: provider === '9router' ? '#93c5fd' : '#94a3b8',
                        cursor: 'pointer',
                      }}
                    >
                      9Router
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeProvider('gemini')}
                      style={{
                        flex: 1,
                        padding: '5px 8px',
                        fontSize: '11.5px',
                        fontWeight: provider === 'gemini' ? 600 : 500,
                        borderRadius: '6px',
                        border: `1px solid ${provider === 'gemini' ? '#3b82f6' : '#282d3c'}`,
                        background: provider === 'gemini' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                        color: provider === 'gemini' ? '#93c5fd' : '#94a3b8',
                        cursor: 'pointer',
                      }}
                    >
                      Gemini
                    </button>
                  </div>

                  {provider === '9router' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Profil Combo
                      </div>

                      {(detectedCombos.filter((c) => c.isCombo).length > 0
                        ? detectedCombos.filter((c) => c.isCombo)
                        : [
                            { id: 'opencode2', isCombo: true },
                            { id: 'm', isCombo: true },
                          ]
                      ).map((item) => {
                        const isSelected = selected9RouterModel === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              handleSelect9RouterModel(item.id);
                              setShowModelMenu(false);
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: isSelected ? '1px solid #3b82f6' : '1px solid transparent',
                              background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                              color: isSelected ? '#ffffff' : '#cbd5e1',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', fontWeight: isSelected ? 600 : 400 }}>{item.id}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  fontSize: '10px',
                                  color: '#8490a5',
                                  background: 'rgba(255,255,255,0.05)',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                Combo
                              </span>
                              {isSelected && <Check size={14} style={{ color: '#60a5fa' }} />}
                            </div>
                          </button>
                        );
                      })}

                      {/* Standalone models if available */}
                      {detectedCombos.filter((c) => !c.isCombo).length > 0 && (
                        <>
                          <div
                            style={{
                              padding: '8px 8px 4px 8px',
                              fontSize: '10px',
                              fontWeight: 700,
                              color: '#64748b',
                              textTransform: 'uppercase',
                              borderTop: '1px solid rgba(255,255,255,0.06)',
                              marginTop: '4px',
                            }}
                          >
                            Model Upstream 9Router
                          </div>
                          {detectedCombos
                            .filter((c) => !c.isCombo)
                            .slice(0, 15)
                            .map((item) => {
                              const isSelected = selected9RouterModel === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    handleSelect9RouterModel(item.id);
                                    setShowModelMenu(false);
                                  }}
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    border: isSelected ? '1px solid #06b6d4' : '1px solid transparent',
                                    background: isSelected ? 'rgba(6, 182, 212, 0.16)' : 'transparent',
                                    color: isSelected ? '#ffffff' : '#cbd5e1',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontSize: '12px',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <span style={{ fontFamily: 'monospace' }}>{item.id}</span>
                                  {isSelected && <Check size={13} style={{ color: '#22d3ee' }} />}
                                </button>
                              );
                            })}
                        </>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Pilihan Model Gemini
                      </div>
                      {AVAILABLE_MODELS.map((m) => {
                        const isSelected = currentModel === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              handleSelectGeminiModel(m.id);
                              setShowModelMenu(false);
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: isSelected ? '1px solid #8b5cf6' : '1px solid transparent',
                              background: isSelected ? 'rgba(139, 92, 246, 0.16)' : 'transparent',
                              color: isSelected ? '#ffffff' : '#cbd5e1',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '12.5px', fontWeight: isSelected ? 700 : 500 }}>{m.name}</div>
                              <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>{m.desc}</div>
                            </div>
                            {isSelected && <Check size={14} style={{ color: '#c4b5fd' }} />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Settings Link at bottom */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '6px', paddingTop: '6px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowModelMenu(false);
                        setShowKeyCard(true);
                      }}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                      }}
                    >
                      <Settings2 size={12} />
                      <span>Konfigurasi Endpoint & Key...</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowKeyCard(!showKeyCard)}
              title="Pengaturan 9Router & API"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '6px',
              }}
            >
              <Settings2 size={16} />
            </button>

            <button className="ai-modal-close-btn" onClick={onClose} title="Tutup">
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Body */}
        <main className="ai-modal-body">
          {/* Key Input / Settings Card (Displayed when no key, on error, or when toggled) */}
          {showKeyCard && (
            <div className="ai-modal-key-card">
              {/* Provider switcher tabs */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                <button
                  type="button"
                  onClick={() => handleChangeProvider('gemini')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: `1px solid ${provider === 'gemini' ? '#3b82f6' : '#282d3c'}`,
                    background: provider === 'gemini' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    color: provider === 'gemini' ? '#93c5fd' : '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  <Sparkles size={14} />
                  <span>Google Gemini</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleChangeProvider('9router')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: `1px solid ${provider === '9router' ? '#3b82f6' : '#282d3c'}`,
                    background: provider === '9router' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    color: provider === '9router' ? '#93c5fd' : '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  <Server size={14} />
                  <span>9Router (Gateway)</span>
                </button>
              </div>

              {provider === 'gemini' ? (
                <>
                  <div className="ai-modal-key-card-header">
                    <h4 className="ai-modal-key-card-title">
                      <Key size={15} style={{ color: '#94a3b8' }} />
                      <span>Input Ulang Google Gemini API Key & Model</span>
                    </h4>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#3b82f6',
                        fontSize: '11.5px',
                        textDecoration: 'none',
                        fontWeight: 500,
                      }}
                    >
                      <span>Ambil API Key Gratis di Google</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  {/* Model Selection Pills */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Pilih Model Gemini:</span>
                    <div className="ai-modal-model-pills">
                      {AVAILABLE_MODELS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={`ai-modal-model-btn ${currentModel === m.id ? 'is-selected' : ''}`}
                          onClick={() => handleSelectGeminiModel(m.id)}
                          title={m.desc}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input Key Field with Show/Hide */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type={showKeyText ? 'text' : 'password'}
                        className="ai-modal-key-input"
                        style={{ width: '100%', boxSizing: 'border-box', paddingRight: '36px' }}
                        placeholder="Tempelkan API Key Gemini (AIzaSy...)"
                        value={inputKey}
                        onChange={(e) => setInputKey(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveAndRetry();
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeyText(!showKeyText)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title={showKeyText ? 'Sembunyikan' : 'Lihat'}
                      >
                        {showKeyText ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>

                    <button
                      type="button"
                      className="ai-action-btn ai-action-btn--primary"
                      onClick={handleSaveAndRetry}
                      disabled={loading || !inputKey.trim()}
                      style={{ flexShrink: 0 }}
                    >
                      <Sparkles size={13} />
                      <span>Simpan & Analisis</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="ai-modal-key-card-header">
                    <h4 className="ai-modal-key-card-title">
                      <Server size={15} style={{ color: '#22d3ee' }} />
                      <span>Konfigurasi 9Router Endpoint & Key</span>
                    </h4>
                    <a
                      href="http://localhost:20128"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#22d3ee',
                        fontSize: '11.5px',
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                    >
                      <span>Buka Dasbor 9Router</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  {/* 9Router URL Input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>9Router Base URL:</span>
                    <input
                      type="text"
                      className="ai-modal-key-input"
                      style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' }}
                      placeholder="http://localhost:20128/v1"
                      value={routerUrl}
                      onChange={(e) => setRouterUrl(e.target.value)}
                    />
                  </div>

                  {/* 9Router API Key Input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>9Router API Key:</span>
                    <input
                      type="password"
                      className="ai-modal-key-input"
                      style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' }}
                      placeholder="Masukkan API Key dari dasbor 9Router (http://localhost:20128)..."
                      value={routerKey}
                      onChange={(e) => setRouterKey(e.target.value)}
                    />
                  </div>

                  {/* 9Router Combo Selection Pills */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Pilih Profil Combo 9Router:</span>
                      <button
                        type="button"
                        onClick={async () => {
                          const list = await fetch9RouterModels(routerUrl);
                          if (list && list.length > 0) setDetectedCombos(list);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#22d3ee',
                          fontSize: '11px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 600,
                        }}
                        title="Pindai ulang daftar combo di 9Router"
                      >
                        <RefreshCw size={11} />
                        <span>Deteksi Ulang</span>
                      </button>
                    </div>

                    {detectedCombos.length > 0 ? (
                      <div className="ai-modal-model-pills" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {detectedCombos.map((item) => {
                          const isSelected = selected9RouterModel === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={`ai-modal-model-btn ${isSelected ? 'is-selected' : ''}`}
                              onClick={() => {
                                setSelected9RouterModel(item.id);
                                save9RouterModel(item.id);
                              }}
                              style={{
                                borderColor: isSelected ? '#06b6d4' : undefined,
                                background: isSelected ? 'rgba(6, 182, 212, 0.25)' : undefined,
                                color: isSelected ? '#67e8f9' : undefined,
                              }}
                              title={item.isCombo ? `Profil Combo: ${item.id}` : `Model: ${item.id}`}
                            >
                              {item.isCombo ? `⚡ ${item.id}` : `🤖 ${item.id}`}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <input
                        type="text"
                        className="ai-modal-key-input"
                        style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' }}
                        placeholder="opencode2"
                        value={selected9RouterModel}
                        onChange={(e) => {
                          setSelected9RouterModel(e.target.value);
                          save9RouterModel(e.target.value);
                        }}
                      />
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button
                      type="button"
                      className="ai-action-btn ai-action-btn--primary"
                      onClick={handleSaveAndRetry}
                      disabled={loading}
                      style={{
                        background: 'linear-gradient(135deg, #0891b2 0%, #0284c7 100%)',
                        boxShadow: '0 4px 12px rgba(8, 145, 178, 0.3)',
                      }}
                    >
                      <Server size={13} />
                      <span>Simpan & Hubungkan 9Router</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Loading State with Progress Bar & Percentage */}
          {loading ? (
            <div className="ai-modal-loading">
              <div className="ai-modal-loading-icon-wrap">
                <Sparkles size={20} className="ai-modal-loading-icon" />
              </div>

              <div className="ai-modal-loading-title">
                {detectingCombos
                  ? 'Mendeteksi Gateway 9Router...'
                  : mode === 'trade'
                  ? 'Menganalisis Eksekusi Trade...'
                  : 'Mengaudit Sesi Trading...'}
              </div>

              {/* Garis Persenan & Status Card */}
              <div className="ai-modal-progress-card">
                <div className="ai-modal-progress-meta">
                  <span className="ai-modal-progress-step">
                    {detectingCombos
                      ? (loadingProgress < 50 ? 'Menghubungi endpoint localhost:20128...' : 'Membaca profil combo aktif...')
                      : loadingProgress >= 100
                      ? 'Analisis selesai! Menampilkan hasil...'
                      : loadingProgress < 25
                      ? 'Membaca log order & parameter trading...'
                      : loadingProgress < 55
                      ? (mode === 'trade' ? 'Mengevaluasi Risk:Reward & timing eksekusi...' : 'Menganalisis winrate & drawdown sesi...')
                      : loadingProgress < 85
                      ? 'Memindai pola statistik & bias psikologi...'
                      : 'Menyusun evaluasi komprehensif AI Coach...'}
                  </span>
                  <span className="ai-modal-progress-pct">
                    {Math.min(100, Math.round(loadingProgress))}%
                  </span>
                </div>

                {/* Garis Persenan Track & Animated Fill */}
                <div className="ai-modal-progress-track">
                  <div
                    className="ai-modal-progress-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, loadingProgress))}%`,
                      background:
                        provider === '9router'
                          ? 'linear-gradient(90deg, #0284c7, #06b6d4, #38bdf8)'
                          : 'linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa)',
                    }}
                  />
                </div>
              </div>

              <div className="ai-modal-loading-sub">
                {detectingCombos
                  ? 'Memeriksa endpoint 9Router di http://localhost:20128 untuk mendeteksi profil combo aktif.'
                  : mode === 'trade'
                  ? 'Mengevaluasi kalkulasi harga entry, timing eksekusi, Risk-to-Reward, dan visual chart screenshot.'
                  : 'Memindai pola statistik, drawdown, habit trading, dan kemungkinan bias psikologi.'}
              </div>

              <div className="ai-modal-loading-engine-pill">
                <span className="ai-modal-engine-dot" />
                <span>
                  {provider === '9router'
                    ? `9Router Gateway (${selected9RouterModel || 'combo'})`
                    : `Google Gemini (${currentModel})`}
                </span>
              </div>
            </div>
          ) : awaitingComboSelection && !error ? (
            /* Combo Selection Screen (when 2 or more combos detected, pick first before connecting) */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 24px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: '#1e222e',
                  border: '1px solid #2a3040',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  marginBottom: '16px',
                }}
              >
                <Server size={22} />
              </div>

              <h3 style={{ fontSize: '15.5px', fontWeight: 600, color: '#f8fafc', margin: '0 0 8px 0' }}>
                Pilih Profil Combo 9Router
              </h3>

              <p style={{ fontSize: '12.5px', color: '#8490a5', margin: '0 0 24px 0', maxWidth: '440px', lineHeight: 1.5 }}>
                Terdeteksi <strong style={{ color: '#e2e8f0' }}>{detectedCombos.filter((c) => c.isCombo).length} profil combo aktif</strong> di 9Router Anda.
                Pilih salah satu combo untuk memulai analisis {mode === 'trade' ? 'trade ini' : 'sesi ini'}:
              </p>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {detectedCombos.filter((c) => c.isCombo).map((combo) => {
                  const isCurrent = selected9RouterModel === combo.id;
                  return (
                    <button
                      key={combo.id}
                      type="button"
                      onClick={() => handleSelectAndConnect(combo.id)}
                      style={{
                        padding: '12px 22px',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: `1px solid ${isCurrent ? '#3b82f6' : '#282d3c'}`,
                        background: isCurrent ? 'rgba(59, 130, 246, 0.15)' : '#181b24',
                        color: isCurrent ? '#ffffff' : '#cbd5e1',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = isCurrent ? '#3b82f6' : '#3d4458';
                        e.currentTarget.style.background = isCurrent ? 'rgba(59, 130, 246, 0.2)' : '#1f2330';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isCurrent ? '#3b82f6' : '#282d3c';
                        e.currentTarget.style.background = isCurrent ? 'rgba(59, 130, 246, 0.15)' : '#181b24';
                      }}
                    >
                      <span>{combo.id}</span>
                      {isCurrent && (
                        <span
                          style={{
                            fontSize: '9.5px',
                            background: '#2563eb',
                            color: '#ffffff',
                            borderRadius: '4px',
                            padding: '1px 6px',
                            fontWeight: 600,
                            marginLeft: '4px',
                          }}
                        >
                          TERAKHIR
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : error ? (
            /* Error State with friendly message & retry button */
            <div className="ai-modal-error-wrap">
              <div className="ai-modal-error">
                <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Gagal Melakukan Analisis ({provider === '9router' ? '9Router' : currentModel}):</strong>
                  <p style={{ margin: '4px 0 0 0' }}>{error}</p>
                  {error.toLowerCase().includes('fetch') && (
                    <p style={{ margin: '6px 0 0 0', fontSize: '11.5px', color: '#fca5a5', opacity: 0.85 }}>
                      💡 Tip: Pastikan {provider === '9router' ? 'daemon 9Router aktif di port yang sesuai' : 'koneksi internet aktif dan API key valid'}.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : result || chatMessages.length > 0 ? (
            <div className="ai-modal-chat-stream">
              {chatMessages.map((msg, idx) => {
                if (idx === 0 && msg.role === 'assistant') {
                  return (
                    <div key={idx} className="ai-modal-result-initial">
                      {renderFormattedResult(msg.content)}
                    </div>
                  );
                }
                if (msg.role === 'user') {
                  return (
                    <div key={idx} className="ai-chat-bubble ai-chat-bubble--user">
                      <div className="ai-chat-bubble-avatar">
                        <User size={12} />
                        <span>Anda</span>
                      </div>
                      <div className="ai-chat-bubble-content">{msg.content}</div>
                    </div>
                  );
                }
                return (
                  <div key={idx} className="ai-chat-bubble ai-chat-bubble--assistant">
                    <div className="ai-chat-bubble-avatar">
                      <Sparkles size={12} />
                      <span>AI Coach</span>
                    </div>
                    <div className="ai-chat-bubble-content">
                      {renderFormattedResult(msg.content)}
                    </div>
                  </div>
                );
              })}

              {sendingChat && (
                <div className="ai-chat-bubble ai-chat-bubble--assistant">
                  <div className="ai-chat-bubble-avatar">
                    <Sparkles size={12} />
                    <span>AI Coach sedang mengetik...</span>
                  </div>
                  <div className="ai-chat-bubble-content ai-chat-typing">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          ) : null}
        </main>

        {/* Interactive Chat Bar */}
        {(result || chatMessages.length > 0) && !showKeyCard && !loading && (
          <form
            className="ai-modal-chat-bar"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat(e);
            }}
          >
            <input
              type="text"
              className="ai-modal-chat-input"
              placeholder="Tanyakan analisis lanjutan seputar trade / sesi ini..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChat();
                }
              }}
              disabled={sendingChat || loading}
            />
            <button
              type="button"
              onClick={() => handleSendChat()}
              className="ai-modal-chat-send-btn"
              disabled={!chatInput.trim() || sendingChat || loading}
              title="Kirim pesan ke AI Coach"
            >
              {sendingChat ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
              <span>Kirim</span>
            </button>
          </form>
        )}

        {/* Footer */}
        <footer className="ai-modal-footer">
          <div className="ai-modal-footer-left">
            <span>Powered by {provider === '9router' ? '9Router Gateway' : 'Google Gemini'}</span>
            <span style={{ opacity: 0.4 }}>•</span>
            <button
              type="button"
              onClick={() => setShowKeyCard(!showKeyCard)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '11.5px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              <Settings2 size={12} />
              <span>{showKeyCard ? 'Tutup Pengaturan' : 'Ganti Engine / Model'}</span>
            </button>
          </div>

          <div className="ai-modal-footer-right">
            {/* Always provide Reset / Analisis Ulang when error or result exists */}
            {(error || result || chatMessages.length > 0) && (
              <button
                type="button"
                className="ai-action-btn ai-action-btn--secondary"
                onClick={handleResetAndReanalyze}
                disabled={loading || sendingChat}
                title="Hapus riwayat percakapan ini dan buat analisis baru dari awal"
              >
                <RotateCcw size={14} />
                <span>Analisis Ulang</span>
              </button>
            )}

            {result && (
              <>
                <button
                  type="button"
                  className="ai-action-btn ai-action-btn--secondary"
                  onClick={handleCopy}
                  title="Salin hasil analisis ke clipboard"
                >
                  {copied ? <Check size={14} style={{ color: '#4ade80' }} /> : <Copy size={14} />}
                  <span>{copied ? 'Tersalin!' : 'Salin'}</span>
                </button>

                {mode === 'trade' && onAppendNote && (
                  <button
                    type="button"
                    className="ai-action-btn ai-action-btn--secondary"
                    onClick={handleAppendToJournal}
                    title="Simpan insight AI ini ke catatan journal trade"
                  >
                    {appended ? <CheckCircle2 size={14} style={{ color: '#4ade80' }} /> : <Sparkles size={14} />}
                    <span>{appended ? 'Tersimpan!' : 'Simpan ke Note'}</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              className="ai-action-btn ai-action-btn--primary"
              onClick={onClose}
            >
              Tutup
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
