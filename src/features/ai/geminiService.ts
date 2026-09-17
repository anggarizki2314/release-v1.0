/**
 * Gemini AI Service for TradePro
 * Zero external dependencies — uses native fetch directly to Google Gemini REST API v1beta.
 */

import type { HistoryState } from '../trading2/store/TradingStoreTypes';
import type { AnalyticsSession } from '../analytics/types';

export const AI_PROVIDERS = {
  GEMINI: 'gemini',
  NINE_ROUTER: '9router',
} as const;

export type AiProvider = typeof AI_PROVIDERS[keyof typeof AI_PROVIDERS];

export const GEMINI_STORAGE_KEYS = {
  API_KEY: 'tradepro_gemini_api_key',
  MODEL: 'tradepro_gemini_model',
} as const;

export const AI_STORAGE_KEYS = {
  PROVIDER: 'tradepro_ai_provider',
  GEMINI_API_KEY: 'tradepro_gemini_api_key',
  GEMINI_MODEL: 'tradepro_gemini_model',
  NINE_ROUTER_URL: 'tradepro_9router_url',
  NINE_ROUTER_API_KEY: 'tradepro_9router_api_key',
  NINE_ROUTER_MODEL: 'tradepro_9router_model',
} as const;

export const AVAILABLE_MODELS = [
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', desc: 'Rekomendasi Utama — Paling Cepat, Stabil & Bebas Antrean (1.500 RPD Gratis)' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini Flash Lite', desc: 'Versi Ringan — Eksekusi Kilat & Hemat Kuota' },
  { id: 'gemini-flash-latest', name: 'Gemini Flash (Latest)', desc: 'Model Standar Flash' },
  { id: 'gemini-pro-latest', name: 'Gemini Pro (Latest)', desc: 'Penalaran Mendalam Tingkat Lanjut' },
] as const;

export const NINE_ROUTER_PRESETS = [
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', desc: 'Analisis logika & psikologi tingkat dewa' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', desc: 'Reasoning cerdas tanpa batas kuota' },
  { id: 'deepseek-chat', name: 'DeepSeek V3', desc: 'Eksekusi super cepat & hemat' },
  { id: 'gpt-4o', name: 'GPT-4o', desc: 'Model multimodal flagship OpenAI' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', desc: 'Routing otomatis Google tanpa antrean' },
] as const;

export type GeminiModelId = typeof AVAILABLE_MODELS[number]['id'];

export function getAiProvider(): AiProvider {
  try {
    const p = localStorage.getItem(AI_STORAGE_KEYS.PROVIDER);
    return p === '9router' ? '9router' : 'gemini';
  } catch {
    return 'gemini';
  }
}

export function saveAiProvider(provider: AiProvider): void {
  try {
    localStorage.setItem(AI_STORAGE_KEYS.PROVIDER, provider);
  } catch (e) {
    console.error('[AiService] Failed to save provider:', e);
  }
}

export function getStoredApiKey(): string {
  try {
    return localStorage.getItem(AI_STORAGE_KEYS.GEMINI_API_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function saveApiKey(key: string): void {
  try {
    localStorage.setItem(AI_STORAGE_KEYS.GEMINI_API_KEY, key.trim());
  } catch (e) {
    console.error('[GeminiService] Failed to save API key:', e);
  }
}

export function getStoredModel(): string {
  try {
    const m = localStorage.getItem(AI_STORAGE_KEYS.GEMINI_MODEL);
    // Auto-migrate legacy/deprecated models to latest supported stable model
    if (!m || m === 'gemini-1.5-flash' || m === 'gemini-1.5-pro' || m === 'gemini-2.0-flash' || m === 'gemini-flash-latest') {
      return 'gemini-3.6-flash';
    }
    return m;
  } catch {
    return 'gemini-3.6-flash';
  }
}

export function saveModel(model: string): void {
  try {
    localStorage.setItem(AI_STORAGE_KEYS.GEMINI_MODEL, model);
  } catch (e) {
    console.error('[GeminiService] Failed to save model:', e);
  }
}

export function getStored9RouterUrl(): string {
  try {
    return localStorage.getItem(AI_STORAGE_KEYS.NINE_ROUTER_URL)?.trim() || 'http://localhost:20128/v1';
  } catch {
    return 'http://localhost:20128/v1';
  }
}

export function save9RouterUrl(url: string): void {
  try {
    localStorage.setItem(AI_STORAGE_KEYS.NINE_ROUTER_URL, url.trim());
  } catch (e) {
    console.error('[AiService] Failed to save 9Router URL:', e);
  }
}

export function getStored9RouterApiKey(): string {
  try {
    return localStorage.getItem(AI_STORAGE_KEYS.NINE_ROUTER_API_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function save9RouterApiKey(key: string): void {
  try {
    localStorage.setItem(AI_STORAGE_KEYS.NINE_ROUTER_API_KEY, key.trim());
  } catch (e) {
    console.error('[AiService] Failed to save 9Router API Key:', e);
  }
}

export function getStored9RouterModel(): string {
  try {
    const m = localStorage.getItem(AI_STORAGE_KEYS.NINE_ROUTER_MODEL)?.trim();
    if (!m || m === 'claude-3-5-sonnet' || m === 'default') {
      localStorage.setItem(AI_STORAGE_KEYS.NINE_ROUTER_MODEL, 'opencode2');
      return 'opencode2';
    }
    return m;
  } catch {
    return 'opencode2';
  }
}

export function save9RouterModel(model: string): void {
  try {
    localStorage.setItem(AI_STORAGE_KEYS.NINE_ROUTER_MODEL, model.trim() || 'opencode2');
  } catch (e) {
    console.error('[AiService] Failed to save 9Router Model:', e);
  }
}

export interface Detected9RouterModel {
  id: string;
  isCombo: boolean;
}

export async function fetch9RouterModels(urlOverride?: string, apiKeyOverride?: string): Promise<Detected9RouterModel[]> {
  const baseUrl = (urlOverride || getStored9RouterUrl()).trim() || 'http://localhost:20128/v1';
  const apiKey = (apiKeyOverride !== undefined ? apiKeyOverride : getStored9RouterApiKey()).trim();

  // 1. If running in Electron, use native IPC bridge (100% reliable, bypasses CORS/DNS)
  if (typeof window !== 'undefined' && (window as any).forexReplay?.getModelsList) {
    try {
      const data = await (window as any).forexReplay.getModelsList({ url: baseUrl, apiKey });
      if (Array.isArray(data) && data.length > 0) {
        return data
          .map((m: any) => ({
            id: String(m.id || ''),
            isCombo: m.owned_by === 'combo',
          }))
          .filter((m: Detected9RouterModel) => Boolean(m.id));
      }
    } catch (ipcErr) {
      console.warn('[9Router] IPC getModelsList error, falling back to direct fetch:', ipcErr);
    }
  }

  // 2. Direct browser fetch fallback
  let modelsUrl = baseUrl.replace(/\/+$/, '');
  if (modelsUrl.endsWith('/chat/completions')) {
    modelsUrl = modelsUrl.replace(/\/chat\/completions$/, '/models');
  } else if (!modelsUrl.endsWith('/models')) {
    modelsUrl = `${modelsUrl}/models`;
  }

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const res = await fetch(modelsUrl, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.data) && data.data.length > 0) {
        return data.data
          .map((m: any) => ({
            id: String(m.id || ''),
            isCombo: m.owned_by === 'combo',
          }))
          .filter((m: Detected9RouterModel) => Boolean(m.id));
      }
    }
  } catch (err) {
    // Try 127.0.0.1
    if (modelsUrl.includes('localhost')) {
      try {
        const altUrl = modelsUrl.replace('localhost', '127.0.0.1');
        const altRes = await fetch(altUrl);
        if (altRes.ok) {
          const data = await altRes.json();
          if (Array.isArray(data?.data) && data.data.length > 0) {
            return data.data
              .map((m: any) => ({
                id: String(m.id || ''),
                isCombo: m.owned_by === 'combo',
              }))
              .filter((m: Detected9RouterModel) => Boolean(m.id));
          }
        }
      } catch {}
    }
    console.warn('[9Router] Failed to fetch models list:', err);
  }

  // Fallback combos if offline or initializing
  return [
    { id: 'opencode2', isCombo: true },
    { id: 'm', isCombo: true },
  ];
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  if (!dataUrl) return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

/**
 * Direct call to Gemini API generateContent endpoint
 */
async function callGeminiApi(
  prompt: string,
  images: string[] = [],
  apiKeyOverride?: string,
  modelOverride?: string
): Promise<string> {
  const apiKey = (apiKeyOverride || getStoredApiKey()).trim();
  if (!apiKey) {
    throw new Error('Google Gemini API Key belum diisi. Silakan masukkan API Key Anda.');
  }

  let model = modelOverride || getStoredModel();
  if (model === 'gemini-1.5-flash' || model === 'gemini-1.5-pro' || model === 'gemini-2.0-flash') {
    model = 'gemini-flash-latest';
  }

  // If running in Electron and handler is registered, use native main process bridge
  if (typeof window !== 'undefined' && (window as any).forexReplay?.geminiRequest) {
    try {
      return await (window as any).forexReplay.geminiRequest({
        prompt,
        images,
        apiKey,
        model,
      });
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('No handler registered') || msg.includes('fetch failed')) {
        // Electron main handler threw or had connection issue, seamlessly fallback to direct fetch below!
        console.warn('[GeminiService] Electron main bridge issue, using direct fetch fallback:', msg);
      } else {
        if (msg.includes('API Key') || msg.includes('API_KEY')) {
          throw new Error('API Key Gemini tidak valid. Mohon periksa atau ganti API Key Anda.');
        } else if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
          throw new Error('Limit kuota gratis Gemini tercapai untuk model ini. Coba gunakan Gemini Flash (Latest).');
        }
        throw new Error(msg);
      }
    }
  }

  // Direct fetch execution (supports browser and hot-reloading dev mode)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const parts: any[] = [{ text: prompt }];

  for (const imgUrl of images) {
    const parsed = parseDataUrl(imgUrl);
    if (parsed) {
      parts.push({
        inlineData: {
          mimeType: parsed.mimeType,
          data: parsed.data,
        },
      });
    }
  }

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2500,
    },
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (netErr: any) {
    throw new Error(`Koneksi ke Google Gemini terputus (${netErr?.message || 'Network error'}). Periksa koneksi internet Anda.`);
  }

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    try {
      const errData = await response.json();
      if (errData?.error?.message) {
        errorMsg = errData.error.message;
      }
    } catch {
      errorMsg = response.statusText || errorMsg;
    }

    if (response.status === 400 && errorMsg.toLowerCase().includes('api key')) {
      throw new Error('API Key Gemini tidak valid. Mohon periksa kembali API Key Anda.');
    } else if (response.status === 429) {
      throw new Error('Limit kuota gratis Gemini tercapai untuk saat ini. Mohon tunggu sejenak atau gunakan model Gemini Flash (Latest).');
    }

    throw new Error(`Gemini API Error: ${errorMsg}`);
  }

  const result = await response.json();
  const textContent = result?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error('Gemini tidak memberikan respon teks. Silakan coba kembali.');
  }

  return textContent;
}

function cleanAndExtractOpenAiText(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) throw new Error('9Router tidak memberikan respon teks.');

  // 1. Try standard OpenAI JSON (handling any trailing `data: [DONE]` from 9Router)
  let jsonCandidate = trimmed.replace(/\s*data:\s*\[DONE\]\s*$/i, '').trim();
  if (jsonCandidate.startsWith('{')) {
    const lastBrace = jsonCandidate.lastIndexOf('}');
    if (lastBrace > 0) {
      jsonCandidate = jsonCandidate.substring(0, lastBrace + 1);
    }
    try {
      const result = JSON.parse(jsonCandidate);
      const textContent =
        result?.choices?.[0]?.message?.content ||
        result?.choices?.[0]?.text ||
        result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textContent && typeof textContent === 'string') return textContent;
    } catch {
      // Fall through to SSE chunk parser
    }
  }

  // 2. Fallback to parse SSE chunks if 9Router streamed response
  let fullContent = '';
  for (const line of trimmed.split('\n')) {
    const l = line.trim();
    if (!l || l.includes('[DONE]')) continue;
    const jsonStr = l.startsWith('data:') ? l.slice(5).trim() : l;
    if (!jsonStr.startsWith('{')) continue;
    try {
      const chunk = JSON.parse(jsonStr);
      const piece =
        chunk?.choices?.[0]?.delta?.content ||
        chunk?.choices?.[0]?.message?.content ||
        chunk?.choices?.[0]?.text ||
        '';
      fullContent += piece;
    } catch {
      // ignore chunk parse errors
    }
  }

  if (fullContent) return fullContent;
  throw new Error('9Router tidak memberikan respon teks. Silakan periksa koneksi 9Router.');
}

/**
 * Direct call to 9Router / OpenAI-compatible endpoint
 */
export async function call9RouterApi(
  prompt: string,
  images: string[] = [],
  urlOverride?: string,
  apiKeyOverride?: string,
  modelOverride?: string
): Promise<string> {
  const url = (urlOverride || getStored9RouterUrl()).trim() || 'http://localhost:20128/v1';
  const apiKey = (apiKeyOverride !== undefined ? apiKeyOverride : getStored9RouterApiKey()).trim();
  let model = (modelOverride || getStored9RouterModel()).trim() || 'opencode2';
  if (
    !model ||
    model === 'claude-3-5-sonnet' ||
    model === 'default' ||
    model.startsWith('gemini-')
  ) {
    model = 'opencode2';
  }

  // Construct standard OpenAI chat completions messages payload
  const messages: any[] = [];
  if (images.length > 0) {
    const userParts: any[] = [{ type: 'text', text: prompt }];
    for (const imgUrl of images) {
      userParts.push({
        type: 'image_url',
        image_url: { url: imgUrl },
      });
    }
    messages.push({ role: 'user', content: userParts });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  // 1. If running in Electron, use native IPC bridge (bypasses Windows fetch IPv6/DNS issues)
  if (typeof window !== 'undefined' && (window as any).forexReplay?.openAiRequest) {
    try {
      return await (window as any).forexReplay.openAiRequest({
        url,
        apiKey,
        model,
        messages,
      });
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (
        msg.includes('No handler registered') ||
        msg.includes('fetch failed') ||
        msg.includes('anthropic')
      ) {
        console.warn('[9Router] Electron main bridge fallback to direct fetch:', msg);
      } else {
        throw new Error(`9Router Error: ${msg}`);
      }
    }
  }

  // 2. Direct browser fetch fallback
  let targetUrl = url;
  if (!targetUrl.endsWith('/chat/completions')) {
    targetUrl = targetUrl.replace(/\/+$/, '') + '/chat/completions';
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        stream: false,
      }),
    });
  } catch (netErr: any) {
    throw new Error(`Gagal menghubungi 9Router di ${targetUrl} (${netErr?.message || 'Network error'}). Pastikan 9Router sedang berjalan.`);
  }

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    try {
      const errData = await response.json();
      if (errData?.error?.message) {
        errorMsg = errData.error.message;
      }
    } catch {
      errorMsg = response.statusText || errorMsg;
    }
    throw new Error(`9Router Error: ${errorMsg}`);
  }

  const rawText = await response.text();
  return cleanAndExtractOpenAiText(rawText);
}

/**
 * Test 9Router connection
 */
export async function test9RouterConnection(
  url?: string,
  apiKey?: string,
  model?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await call9RouterApi(
      'Ping! Jawab sangat singkat: "Koneksi 9Router Berhasil!"',
      [],
      url,
      apiKey,
      model
    );
    return { success: true, message: res.trim() };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal terhubung ke 9Router.' };
  }
}

/**
 * Test Gemini API connection & key validity
 */
export async function testGeminiApiKey(
  apiKey: string,
  model: string = 'gemini-3.6-flash'
): Promise<{ success: boolean; message: string }> {
  try {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      return { success: false, message: 'API Key tidak boleh kosong.' };
    }

    const res = await callGeminiApi('Ping! Jawab singkat: "Koneksi Gemini API Berhasil!"', [], trimmedKey, model);
    return { success: true, message: res.trim() };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal terhubung ke Google Gemini API.' };
  }
}

/**
 * Extract clean trader note/confluence, filtering out automated tags like (SL Hit) or (TP Hit)
 */
export function extractCleanConfluence(comment: string | null | undefined): string {
  if (!comment) return '';
  const trimmed = comment.trim();
  if (
    trimmed === 'SL Hit' ||
    trimmed === 'SL' ||
    trimmed === 'TP Hit' ||
    trimmed === 'TP' ||
    trimmed === 'MANUAL_CLOSE' ||
    trimmed === 'MANUAL'
  ) {
    return '';
  }
  return trimmed.replace(/\s*\((SL Hit|TP Hit|Manual Close)\)$/i, '').trim();
}

/**
 * Generate deep review for an individual trade (with multimodal screenshot support)
 */
export async function generateTradeReview(
  trade: HistoryState,
  apiKeyOverride?: string,
  modelOverride?: string,
  providerOverride?: AiProvider
): Promise<string> {
  const images: string[] = [];
  if (trade.screenshots && trade.screenshots.length > 0) {
    for (const ss of trade.screenshots) {
      if (ss.dataUrl) images.push(ss.dataUrl);
    }
  }

  const durationSec = Math.max(0, Math.floor(((trade.closedAt || 0) - (trade.openedAt || 0)) / 1000));
  const durationStr = durationSec < 60 ? `${durationSec} detik` : `${Math.floor(durationSec / 60)} menit`;
  const pnlStr = `${trade.profit >= 0 ? '+' : ''}$${trade.profit.toFixed(2)}`;
  const reasonStr = trade.closeReason ? trade.closeReason : trade.profit >= 0 ? 'TP / Profit' : 'SL / Cut Loss';
  const cleanConfluence = extractCleanConfluence(trade.comment);
  const confluenceText = cleanConfluence || trade.comment || '(Trader tidak menuliskan catatan/confluence)';

  const prompt = `Anda adalah "TradePro Senior AI Coach", seorang prop trader kawakan dan risk manager institusional kelas dunia.
Tugas Anda: Analisis dan berikan feedback kritis, mendalam, dan membangun atas trade berikut ini.

INFORMASI TRADE:
- Simbol / Pair: ${trade.symbol}
- Tipe Aksi: ${trade.direction} (${trade.volume} Lot)
- Harga Entry: ${trade.entryPrice}
- Harga Exit: ${trade.exitPrice}
- Stop Loss: ${trade.stopLoss ?? 'Tidak ada'} | Take Profit: ${trade.takeProfit ?? 'Tidak ada'}
- Durasi Posisi Terbuka: ${durationStr}
- Hasil Akhir: ${pnlStr} (Tutup karena: ${reasonStr})
- Catatan / Confluence Entry dari Trader: "${confluenceText}"
${images.length > 0 ? `\n* CATATAN: Screenshot chart terlampir. Analisis struktur candlestick, level key support/resistance, pola harga, dan letak entry/exit pada gambar chart tersebut.` : ''}

INSTRUKSI FORMAT OUTPUT (Gunakan Bahasa Indonesia profesional, tegas, dan suportif):
Berikan output dengan format markdown berikut:

### 🎯 Nilai Eksekusi & Grade: [Pilih salah satu: Grade A / B / C / D / F]
(Berikan ringkasan 1-2 kalimat mengapa trade ini layak mendapatkan grade tersebut).

### 🔍 Analisis Teknikal & Timing
(Analisis harga entry, apakah mengejar market/FOMO, kesesuaian Risk-to-Reward, dan bacaan struktur harga${images.length > 0 ? ' berdasarkan screenshot chart' : ''}).

### 🧠 Evaluasi Psikologi & Disiplin
(Komentari catatan trader, konsistensi terhadap rencana, apakah ada indikasi takut/serakah/impulsif).

### 💡 Rekomendasi Konkret untuk Trade Selanjutnya
(1-2 langkah taktis praktis yang harus dihindari atau dipertahankan trader).`;

  const provider = providerOverride || getAiProvider();
  if (provider === '9router') {
    const routerModel = (modelOverride && !modelOverride.startsWith('gemini-')) ? modelOverride : 'opencode2';
    return call9RouterApi(prompt, images, undefined, apiKeyOverride, routerModel);
  }
  return callGeminiApi(prompt, images, apiKeyOverride, modelOverride);
}

/**
 * Generate holistic audit for an entire backtest session
 */
export async function generateSessionAudit(
  session: AnalyticsSession,
  analytics: any,
  apiKeyOverride?: string,
  modelOverride?: string,
  providerOverride?: AiProvider
): Promise<string> {
  const trades: HistoryState[] = analytics?.trades || [];
  const totalTrades = analytics?.totalTrades ?? session.totalTrades ?? trades.length;
  const winRate = (analytics?.winRate ?? session.winRate ?? 0).toFixed(1);
  const profitFactor = (analytics?.profitFactor ?? session.profitFactor ?? 0).toFixed(2);
  const netProfit = (analytics?.netProfit ?? session.netProfit ?? 0).toFixed(2);
  const maxDrawdown = Math.abs(analytics?.maxDrawdown ?? analytics?.maxDrawdownDollar ?? 0).toFixed(2);
  const maxDrawdownPct = (analytics?.maxDrawdownPercent ?? 0).toFixed(1);

  // Stop Loss compliance calculation
  const tradesWithSL = trades.filter(t => t.stopLoss != null && Number(t.stopLoss) > 0).length;
  const tradesWithoutSL = totalTrades - tradesWithSL;
  const slCompliancePct = totalTrades > 0 ? ((tradesWithSL / totalTrades) * 100).toFixed(1) : '0';
  const tradesHitSL = trades.filter(t => t.closeReason === 'SL').length;
  const tradesHitTP = trades.filter(t => t.closeReason === 'TP').length;
  const tradesManualClose = trades.filter(t => !t.closeReason || t.closeReason === 'MANUAL').length;

  // Summary sample trades for context with explicit Stop Loss & Take Profit
  const sampleTrades = trades.slice(-35).map((t, idx) => {
    const isWin = (t.profit || 0) > 0;
    const durSec = Math.max(0, Math.floor(((t.closedAt || 0) - (t.openedAt || 0)) / 1000));
    const durStr = durSec < 60 ? `${durSec}s` : `${Math.floor(durSec / 60)}m ${durSec % 60}s`;
    const slText = (t.stopLoss != null && Number(t.stopLoss) > 0) ? `SL: ${t.stopLoss}` : '⚠️ TANPA SL (NO SL)';
    const tpText = (t.takeProfit != null && Number(t.takeProfit) > 0) ? `TP: ${t.takeProfit}` : 'Tanpa TP';
    const userConf = extractCleanConfluence(t.comment);
    const confStr = userConf ? ` | Confluence: "${userConf}"` : '';
    return `#${idx + 1}: ${t.direction} ${t.symbol} | Lot ${t.volume} | Entry: ${t.entryPrice} -> Exit: ${t.exitPrice} | ${slText} | ${tpText} | PnL: ${isWin ? '+' : ''}$${(t.profit || 0).toFixed(2)} (${t.closeReason || 'CLOSED'}) | Durasi: ${durStr}${confStr}`;
  }).join('\n');

  const prompt = `Anda adalah "TradePro Chief Risk Officer & AI Trading Coach" untuk prop firm global.
Tugas Anda: Lakukan audit komprehensif atas sesi latihan backtest trading berikut dan deteksi kebocoran psikologi/kebiasaan trader.

PROFIL SESI BACKTEST:
- Nama Sesi: ${session.name}
- Instrumen / Pair: ${session.symbol}
- Mode: ${session.mode === 'challenge' ? 'Prop Firm Challenge' : 'Normal Replay'}
- Modal Awal: $${session.initialBalance?.toLocaleString() || '10,000'}
- Saldo Akhir: $${(session.currentBalance || (session.initialBalance + parseFloat(netProfit)))?.toLocaleString()}
- Total Trade: ${totalTrades} (Menang: ${analytics?.winningTrades ?? 0}, Kalah: ${analytics?.losingTrades ?? 0})
- Win Rate: ${winRate}%
- Profit Factor: ${profitFactor}
- Net PnL: $${netProfit}
- Max Drawdown: -$${maxDrawdown} (${maxDrawdownPct}%)
- Kepatuhan Stop Loss (SL Compliance): ${tradesWithSL}/${totalTrades} trade (${slCompliancePct}%) memasang SL${tradesWithoutSL > 0 ? ` (⚠️ PERINGATAN: Ada ${tradesWithoutSL} trade dieksekusi TANPA Stop Loss!)` : ' (100% disiplin pasang SL)'}
- Alasan Penutupan Posisi: Hit TP: ${tradesHitTP}, Hit SL: ${tradesHitSL}, Tutup Manual: ${tradesManualClose}

DAFTAR SAMPEL TRADE TERBARU DALAM SESI INI:
${sampleTrades || '(Belum ada data trade)'}

INSTRUKSI AUDIT (Gunakan Bahasa Indonesia profesional, objektif, berwibawa layaknya evaluator prop firm):
Berikan hasil audit dalam format markdown berikut:

### 📊 Ringkasan Eksekutif Sesi
(2-3 kalimat evaluasi objektif mengenai disiplin eksekusi, RR, dan konsistensi risiko)

### 🔍 Analisis Habit & Psikologi Trading
- **Kepatuhan Stop Loss**: (Evaluasi kedisiplinan proteksi modal)
- **Manajemen Ukuran Lot**: (Deteksi apakah ada over-leveraging atau lot tidak konsisten)
- **Pola Emosi & Revenge Trading**: (Apakah ada indikasi tergesa-gesa entry setelah loss)
- **Trade Terbaik vs Terburuk**: (Sebutkan trade nomor berapa dan alasannya)

### 🎯 3 Aturan Wajib untuk Sesi Berikutnya
(Tulis 3 checklist konkret yang TIDAK BOLEH dilanggar oleh trader pada sesi backtest berikutnya).`;

  const provider = providerOverride || getAiProvider();
  if (provider === '9router') {
    const routerModel = (modelOverride && !modelOverride.startsWith('gemini-')) ? modelOverride : 'opencode2';
    return call9RouterApi(prompt, [], undefined, apiKeyOverride, routerModel);
  }
  return callGeminiApi(prompt, [], apiKeyOverride, modelOverride);
}

/**
 * Build rich system prompt context containing full trade or session database logs
 * so AI never forgets context or hallucinates that it cannot see user's data.
 */
export function buildAiSystemContext(
  mode: 'trade' | 'session',
  trade?: HistoryState | null,
  session?: AnalyticsSession | null,
  analytics?: any | null
): string {
  if (mode === 'trade' && trade) {
    const durationSec = Math.max(0, Math.floor(((trade.closedAt || 0) - (trade.openedAt || 0)) / 1000));
    const durationStr = durationSec < 60 ? `${durationSec} detik` : `${Math.floor(durationSec / 60)} menit`;
    const pnlStr = `${trade.profit >= 0 ? '+' : ''}$${trade.profit.toFixed(2)}`;
    const slStr = (trade.stopLoss != null && Number(trade.stopLoss) > 0) ? `${trade.stopLoss}` : 'TIDAK MEMASANG STOP LOSS (NO SL)';
    const tpStr = (trade.takeProfit != null && Number(trade.takeProfit) > 0) ? `${trade.takeProfit}` : 'Tidak memasang TP';

    return `Anda adalah "TradePro Senior AI Coach & Risk Officer", mentor trading yang tertanam langsung di software TradePro milik trader.

================================================================================
ATURAN UTAMA & BEHIND PROMPT (TRADE REVIEW):
================================================================================
1. WAJIB BACA & BONGKAR DATA TRADE INI TERLEBIH DAHULU:
   Setiap kali trader bertanya atau meminta review, Anda HARUS membaca dan meninjau data trade aktual di bawah ini terlebih dahulu sebelum merangkai jawaban.
2. DILARANG MEMBERI NASIHAT UMUM/KLISE TANPA DATA:
   Jawaban Anda HARUS selalu mengutip data faktual trade ini: Entry (${trade.entryPrice}), Exit (${trade.exitPrice}), Lot (${trade.volume}), PnL (${pnlStr}), SL (${slStr}), dan Durasi (${durationStr}).
3. DATA INI ADALAH FAKTA VALID DARI DATABASE:
   Data di bawah ini dicatat langsung dari platform TradePro. Jangan pernah berkata "saya tidak bisa melihat chart atau order Anda".

DATA RIIL ORDER / TRADE INI:
- Simbol / Pair: ${trade.symbol}
- Arah Posisi: ${trade.direction}
- Lot Size: ${trade.volume} Lot
- Entry Price: ${trade.entryPrice}
- Exit Price: ${trade.exitPrice}
- Stop Loss: ${slStr}
- Take Profit: ${tpStr}
- Hasil PnL: ${pnlStr}
- Alasan Penutupan: ${trade.closeReason || 'MANUAL'}
- Durasi Posisi: ${durationStr}
- Catatan / Confluence Entry: "${extractCleanConfluence(trade.comment) || trade.comment || '(Tidak ada catatan / confluence)'}"`;
  }

  if (mode === 'session' && session) {
    const trades: HistoryState[] = analytics?.trades || [];
    const winRate = (analytics?.winRate ?? session.winRate ?? 0).toFixed(1);
    const profitFactor = (analytics?.profitFactor ?? session.profitFactor ?? 0).toFixed(2);
    const netProfit = (analytics?.netProfit ?? session.netProfit ?? 0).toFixed(2);
    const totalTrades = trades.length || session.totalTrades || 0;
    const winningTrades = analytics?.winningTrades ?? session.winningTrades ?? trades.filter(t => (t.profit || 0) > 0).length;
    const losingTrades = analytics?.losingTrades ?? session.losingTrades ?? trades.filter(t => (t.profit || 0) < 0).length;
    const breakevenTrades = analytics?.breakevenTrades ?? trades.filter(t => (t.profit || 0) === 0).length;
    const tradesWithSL = trades.filter(t => t.stopLoss != null && Number(t.stopLoss) > 0).length;
    const tradesWithoutSL = totalTrades - tradesWithSL;
    const slCompliancePct = totalTrades > 0 ? ((tradesWithSL / totalTrades) * 100).toFixed(1) : '0';
    const maxDrawdown = Math.abs(analytics?.maxDrawdown ?? analytics?.maxDrawdownDollar ?? 0).toFixed(2);
    const maxDrawdownPct = (analytics?.maxDrawdownPercent ?? 0).toFixed(1);
    const avgRR = analytics?.avgRR ? `1:${analytics.avgRR.toFixed(2)}` : '-';
    const avgWin = analytics?.avgWin ? `$${analytics.avgWin.toFixed(2)}` : '-';
    const avgLoss = analytics?.avgLoss ? `-$${Math.abs(analytics.avgLoss).toFixed(2)}` : '-';
    const largestWin = analytics?.largestWin ? `$${analytics.largestWin.toFixed(2)}` : '-';
    const largestLoss = analytics?.largestLoss ? `-$${Math.abs(analytics.largestLoss).toFixed(2)}` : '-';
    const streakLoss = analytics?.maxConsecutiveLosses ?? 0;
    const streakWin = analytics?.maxConsecutiveWins ?? 0;
    const buyTrades = analytics?.buyTradesCount ?? trades.filter(t => t.direction === 'BUY').length;
    const sellTrades = analytics?.sellTradesCount ?? trades.filter(t => t.direction === 'SELL').length;
    const buyWinRate = analytics?.buyWinRate != null ? `${analytics.buyWinRate.toFixed(1)}%` : '-';
    const sellWinRate = analytics?.sellWinRate != null ? `${analytics.sellWinRate.toFixed(1)}%` : '-';

    let pairSummary = '';
    if (analytics?.pairBreakdowns && analytics.pairBreakdowns.length > 0) {
      pairSummary = '\n- Breakdown Pair:\n' + analytics.pairBreakdowns
        .map((p: any) => `  * ${p.symbol}: ${p.tradesCount} trade (Winrate ${p.winRate.toFixed(1)}%, Net PnL ${p.netProfit >= 0 ? '+' : ''}$${p.netProfit.toFixed(2)}, PF ${p.profitFactor.toFixed(2)})`)
        .join('\n');
    }

    let challengeSummary = '';
    if (session.mode === 'challenge' && (session.challengeRules || session.challengeStatus)) {
      const rules = session.challengeRules;
      const status = session.challengeStatus;
      const isTargetPassed = status && rules && status.targetCurrent >= status.targetLimit;
      const isDailyFailed = status && rules && status.dailyLossCurrent >= status.dailyLossLimit;
      const isMaxFailed = status && rules && status.maxLossCurrent >= status.maxLossLimit;
      const challengeState = (isDailyFailed || isMaxFailed) ? '❌ GAGAL' : isTargetPassed ? '✅ LOLOS' : '⏳ BERJALAN';

      challengeSummary = `\n- Status Challenge Prop Firm:
  * Target Profit: ${rules?.profitTargetPercent ?? 10}% (Tercapai: $${status?.targetCurrent?.toFixed(2) ?? '0'} / $${status?.targetLimit?.toFixed(2) ?? '0'})
  * Batas Max Daily Loss: ${rules?.dailyLossPercent ?? 5}% (Loss Hari Ini: $${status?.dailyLossCurrent?.toFixed(2) ?? '0'} / $${status?.dailyLossLimit?.toFixed(2) ?? '0'})
  * Batas Max Drawdown: ${rules?.maxLossPercent ?? 10}% (Loss Kumulatif: $${status?.maxLossCurrent?.toFixed(2) ?? '0'} / $${status?.maxLossLimit?.toFixed(2) ?? '0'})
  * Status: ${challengeState}`;
    }

    const tradesList = trades.map((t, idx) => {
      const isWin = (t.profit || 0) > 0;
      const isLoss = (t.profit || 0) < 0;
      const statusText = isWin ? 'WIN' : isLoss ? 'LOSS' : 'BE';
      const durSec = Math.max(0, Math.floor(((t.closedAt || 0) - (t.openedAt || 0)) / 1000));
      const durStr = durSec < 60 ? `${durSec}s` : `${Math.floor(durSec / 60)}m ${durSec % 60}s`;
      const sl = (t.stopLoss != null && Number(t.stopLoss) > 0) ? `SL: ${t.stopLoss}` : '⚠️ TANPA SL (NO SL)';
      const tp = (t.takeProfit != null && Number(t.takeProfit) > 0) ? `TP: ${t.takeProfit}` : 'Tanpa TP';
      const userConf = extractCleanConfluence(t.comment);
      const confStr = userConf ? ` | Confluence: "${userConf}"` : '';
      return `Trade #${idx + 1} [${statusText}]: ${t.direction} ${t.symbol} | Lot ${t.volume} | Entry ${t.entryPrice} -> Exit ${t.exitPrice} | ${sl} | ${tp} | PnL: ${isWin ? '+' : ''}$${(t.profit || 0).toFixed(2)} [Exit: ${t.closeReason || 'MANUAL'}] | Durasi: ${durStr}${confStr}`;
    }).join('\n');

    return `Anda adalah "TradePro Senior AI Coach & Chief Risk Officer", mentor trading yang tertanam langsung di software TradePro milik trader.

================================================================================
ATURAN UTAMA & BEHIND PROMPT ANALYTICS:
================================================================================
1. WAJIB BACA & ANALISIS DATA SESI TERLEBIH DAHULU:
   Setiap kali trader bertanya, meminta evaluasi, mencari solusi, atau berdiskusi apa pun di Analytics, Anda HARUS membaca dan meneliti data statistik serta log trade sesi ini TERLEBIH DAHULU sebelum menjawab.
2. DILARANG MEMBERIKAN JAWABAN UMUM / KLISE TANPA DATA:
   - Dilarang memberikan nasihat mengambang (misal: "Anda harus disiplin", "gunakan RR 1:2", "kendalikan emosi") tanpa menghubungkannya langsung ke data sesi ini.
   - Setiap jawaban Anda WAJIB mengutip angka faktual dan trade riil dari sesi ini:
     * Rujuk nomor trade spesifik (misal: "Pada Trade #2 dan #5...", "Di Trade #1 BUY lot 0.21...").
     * Rujuk angka statistik sesi (Winrate ${winRate}%, Net PnL $${netProfit}, Drawdown -$${maxDrawdown}, Kepatuhan SL ${slCompliancePct}%).
     * Analisis disparitas performa BUY (${buyWinRate}) vs SELL (${sellWinRate}), atau breakdown pair jika multi-pair.
3. DATA INI ADALAH FAKTA VALID DARI DATABASE:
   Semua data di bawah ini adalah rekaman platform TradePro. Jangan pernah berkata "saya tidak bisa melihat chart atau data Anda". Anda memiliki akses penuh ke data database di bawah ini.
4. ANALISIS CATATAN & CONFLUENCE ENTRY TRADER:
   - Perhatikan keterangan "Confluence: ..." pada setiap trade di bawah. Jika trader mencatat alasan entry / confluence analisanya (misal: FVG, CHoCH, Break of Structure, Sweep Liquidity, Rejection SnR, Trendline, dsb.), jadikan itu rujukan penting:
     * Evaluasi apakah setup confluence tersebut tervalidasi atau gagal di market.
     * Evaluasi apakah trader konsisten mengeksekusi sesuai confluence-nya atau menyimpang (FOMO / impulsif).
     * Berikan feedback tajam mengenai kualitas confluence trader pada trade yang menang maupun kalah.
5. GAYA BICARA:
   Mentor trading senior prop firm: objektif, lugas, jujur, solutif, kritis terhadap kebiasaan buruk (over-lot, revenge trading, no SL), dan selalu berbahasa Indonesia dengan natural.

DATA LENGKAP STATISTIK SESI BACKTEST:
- Sesi: "${session.name}" (${session.symbol})
- Mode: ${session.mode === 'challenge' ? 'Prop Firm Challenge' : 'Normal Replay'}
- Saldo: Awal $${session.initialBalance || 10000} | Hasil Bersih $${netProfit}
- Total Trade: ${totalTrades} (Menang: ${winningTrades}, Kalah: ${losingTrades}${breakevenTrades > 0 ? `, BE: ${breakevenTrades}` : ''})
- Win Rate: ${winRate}% | Profit Factor: ${profitFactor} | Net PnL: $${netProfit}
- Max Drawdown: -$${maxDrawdown} (${maxDrawdownPct}%)
- Disiplin Stop Loss: ${tradesWithSL}/${totalTrades} trade memakai SL (${slCompliancePct}%). ${tradesWithoutSL > 0 ? `⚠️ PERINGATAN: ${tradesWithoutSL} trade dieksekusi TANPA Stop Loss!` : '✅ Semua trade diproteksi Stop Loss.'}
- Rata-rata Risk-Reward (RR): ${avgRR}
- Rata-rata Win: ${avgWin} | Rata-rata Loss: ${avgLoss}
- Win Terbesar: ${largestWin} | Loss Terbesar: ${largestLoss}
- Streak Loss Terpanjang: ${streakLoss}x berturut-turut | Streak Win: ${streakWin}x
- Eksekusi BUY: ${buyTrades} trade (Winrate: ${buyWinRate}) | SELL: ${sellTrades} trade (Winrate: ${sellWinRate})${pairSummary}${challengeSummary}

LOG LENGKAP SELURUH TRADE DALAM SESI INI:
${tradesList || '(Belum ada log trade)'}`;
  }

  return 'Anda adalah TradePro AI Coach. Bantu trader menganalisis performa trading secara objektif dan mendalam.';
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Send interactive multi-turn chat message to the configured AI provider (9Router or Gemini)
 */
export async function sendAIChatMessage(
  messages: ChatMessage[],
  providerOverride?: AiProvider,
  apiKeyOverride?: string,
  modelOverride?: string,
  systemContext?: string
): Promise<string> {
  const provider = providerOverride || getAiProvider();

  if (provider === '9router') {
    const url = getStored9RouterUrl();
    const apiKey = apiKeyOverride !== undefined ? apiKeyOverride : getStored9RouterApiKey();
    const rawModel = (modelOverride || getStored9RouterModel()).trim();
    const model = (!rawModel || rawModel === 'default' || rawModel === 'claude-3-5-sonnet' || rawModel.startsWith('gemini-'))
      ? 'opencode2'
      : rawModel;

    const formattedMessages: any[] = [];
    if (systemContext && systemContext.trim()) {
      formattedMessages.push({
        role: 'system',
        content: systemContext.trim(),
      });
    }
    for (const m of messages) {
      if (
        m.role === 'assistant' &&
        (m.content.startsWith('⚠️') ||
          m.content.startsWith('9Router error.') ||
          m.content.includes('Gagal menghubungi') ||
          m.content.includes('Coach mati'))
      ) {
        continue;
      }
      const text = m.content.trim();
      if (!text) continue;
      const role = m.role === 'assistant' ? 'assistant' : 'user';

      if (formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role === role && role === 'user') {
        formattedMessages[formattedMessages.length - 1].content += `\n\n${text}`;
      } else {
        formattedMessages.push({
          role,
          content: text,
        });
      }
    }

    // 1. If running in Electron, use native IPC bridge
    if (typeof window !== 'undefined' && (window as any).forexReplay?.openAiRequest) {
      try {
        return await (window as any).forexReplay.openAiRequest({
          url,
          apiKey,
          model,
          messages: formattedMessages,
        });
      } catch (err: any) {
        console.warn('[9Router Chat] Electron bridge fallback to direct fetch:', err);
      }
    }

    // 2. Direct browser fetch fallback
    let targetUrl = url;
    if (!targetUrl.endsWith('/chat/completions')) {
      targetUrl = targetUrl.replace(/\/+$/, '') + '/chat/completions';
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: formattedMessages,
          temperature: 0.4,
          stream: false,
        }),
      });
    } catch (netErr: any) {
      throw new Error(`Gagal menghubungi 9Router (${netErr?.message || 'Network error'}). Pastikan 9Router sedang berjalan.`);
    }

    if (!response.ok) {
      let errorMsg = `HTTP Error ${response.status}`;
      try {
        const errData = await response.json();
        if (errData?.error?.message) errorMsg = errData.error.message;
      } catch {
        errorMsg = response.statusText || errorMsg;
      }
      throw new Error(`9Router Error: ${errorMsg}`);
    }

    const rawText = await response.text();
    return cleanAndExtractOpenAiText(rawText);
  }

  // Provider = Gemini
  const apiKey = (apiKeyOverride || getStoredApiKey()).trim();
  if (!apiKey) {
    throw new Error('Google Gemini API Key belum diisi.');
  }
  const model = modelOverride || getStoredModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Filter out any error bubbles from assistant
  const filtered = messages.filter(
    (m) =>
      !(
        m.role === 'assistant' &&
        (m.content.startsWith('⚠️') ||
          m.content.startsWith('9Router error.') ||
          m.content.includes('Gagal menghubungi') ||
          m.content.includes('Coach mati'))
      )
  );

  // Gemini strictly requires alternating roles: user -> model -> user -> model...
  // Merge consecutive same-role turns into one combined turn so Gemini never throws HTTP 400
  const validContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  for (const m of filtered) {
    const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
    const text = m.content.trim();
    if (!text) continue;

    if (validContents.length > 0 && validContents[validContents.length - 1].role === role) {
      validContents[validContents.length - 1].parts[0].text += `\n\n${text}`;
    } else {
      validContents.push({
        role,
        parts: [{ text }],
      });
    }
  }

  // Ensure first turn is always from user
  while (validContents.length > 0 && validContents[0].role !== 'user') {
    validContents.shift();
  }

  if (validContents.length === 0) {
    throw new Error('Pesan pertanyaan tidak boleh kosong.');
  }

  const requestBody: any = {
    contents: validContents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2500,
    },
  };

  if (systemContext && systemContext.trim()) {
    requestBody.system_instruction = {
      parts: [{ text: systemContext.trim() }],
    };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch (netErr: any) {
    throw new Error(`Koneksi ke Gemini terputus (${netErr?.message || 'Network error'}).`);
  }

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    try {
      const errData = await response.json();
      if (errData?.error?.message) errorMsg = errData.error.message;
    } catch {
      errorMsg = response.statusText || errorMsg;
    }
    throw new Error(`Gemini Error: ${errorMsg}`);
  }

  const result = await response.json();
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini tidak memberikan respon teks.');
  return text;
}
