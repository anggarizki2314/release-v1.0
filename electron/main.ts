import { app, BrowserWindow, ipcMain, dialog, shell, net } from 'electron';
import path from 'path';
import {
  initDatabase,
  listSymbolSummaries,
  listDatasetsForSymbol,
  deleteSymbol,
  deleteDataset,
  deleteTimeframe,
  getCandles,
  getCandlesBefore,
  getCandlesFrom,
  getCandlesRange,

  getSetting,

  setSetting,
  getDatabaseStats,
  getDatabaseInfo,
  vacuumDatabase,
  analyzeDatabase,
  getDatabaseHealth,
  listDatasetStats,
  listSymbolDetailStats,
  listImportLogs,
  listBacktestSessionsDb,
  saveBacktestSessionDb,
  updateBacktestSessionDb,
  updateReplayStateDb,
  updateTradingStateDb,
  getBacktestSessionDb,
  deleteBacktestSessionDb,
  saveTradingStateJsonDb,
  loadTradingStateJsonDb,
  getEconomicEventsRangeDb,
  getEconomicEventsStatsDb,
} from './database/db';
import { importFiles, importFolder } from './data/importer';
import { downloadDukascopyHistoricalData, downloadMissingRanges, type DukascopyDownloadParams } from './data/dukascopyDownloader';
import { downloadDukascopyNews, type NewsDownloadParams } from './data/dukascopyNewsDownloader';
import { detectDataGaps } from './data/dataGapDetector';
import { validateSymbolAvailability } from './data/dukascopyValidatorService';
import { rebuildDerivedTimeframes, backfillMissingDerivedTimeframes } from './data/derivedTimeframes';
import {
  checkLicenseStatus,
  activateLicenseOnline,
  getHardwareId,
  deactivateLicenseLocal,
} from './services/licenseService';

const isDev = process.env.NODE_ENV === 'development';

let splashWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let isAppReadySent = false;
let splashStartTime = 0;

const SPLASH_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; user-select: none; }
    html, body {
      width: 100%;
      height: 100%;
      background: #14171f;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      overflow: hidden;
    }
    .splash-card {
      width: 100%;
      height: 100%;
      background: #14171f;
      border: 1px solid rgba(255, 255, 255, 0.12);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 30px 24px 22px 24px;
      box-shadow: none;
      position: relative;
    }
    .logo-mark {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);
      animation: pulse 2.4s ease-in-out infinite alternate;
      margin-top: 4px;
    }
    .logo-mark svg {
      width: 30px;
      height: 30px;
      stroke: #ffffff;
      stroke-width: 2.6;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .brand-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 6px;
    }
    .brand-title {
      font-size: 21px;
      font-weight: 800;
      letter-spacing: -0.4px;
      color: #f8fafc;
    }
    .status-section {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .status-meta {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 16px;
    }
    .status-text {
      font-size: 11.5px;
      color: #94a3b8;
      font-weight: 500;
      text-align: left;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 215px;
      transition: opacity 0.15s ease;
    }
    .status-percent {
      font-size: 12px;
      font-weight: 700;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #f87171;
      text-align: right;
      flex-shrink: 0;
    }
    .progress-track {
      width: 100%;
      height: 5px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 4px;
      overflow: hidden;
      position: relative;
    }
    .progress-bar {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #dc2626, #ef4444, #f87171);
      border-radius: 4px;
      box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);
      position: relative;
      overflow: hidden;
    }
    .progress-bar::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.45), transparent);
      animation: shimmer 1.5s infinite;
    }
    .version-tag {
      font-size: 10px;
      color: #5d6b82;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-align: center;
      margin-top: 2px;
    }
    @keyframes pulse {
      0% { transform: scale(0.97); }
      100% { transform: scale(1.03); }
    }
    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
  </style>
</head>
<body>
  <div class="splash-card">
    <div class="logo-mark">
      <svg viewBox="0 0 24 24">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
        <polyline points="17 6 23 6 23 12"></polyline>
      </svg>
    </div>
    
    <div class="brand-section">
      <div class="brand-title">TradePro</div>
    </div>

    <div class="status-section">
      <div class="status-meta">
        <div class="status-text" id="status-label">Memulai TradePro Engine...</div>
        <div class="status-percent" id="status-percent">0%</div>
      </div>
      <div class="progress-track">
        <div class="progress-bar" id="progress-bar"></div>
      </div>
      <div class="version-tag">v4.0.0</div>
    </div>
  </div>

  <script>
    const { ipcRenderer } = require('electron');
    const bar = document.getElementById('progress-bar');
    const label = document.getElementById('status-label');
    const percent = document.getElementById('status-percent');

    const steps = [
      { min: 0, text: 'Memulai TradePro Engine...' },
      { min: 25, text: 'Menghubungkan ke SQLite Database...' },
      { min: 52, text: 'Menyiapkan Market & Chart Datasets...' },
      { min: 78, text: 'Memuat Workspace & Analytics...' },
      { min: 96, text: 'Aplikasi siap!' }
    ];

    function setPct(val) {
      const rounded = Math.min(100, Math.max(0, Math.round(val)));
      if (bar) bar.style.width = rounded + '%';
      if (percent) percent.textContent = rounded + '%';
      
      let stepText = steps[0].text;
      for (let i = steps.length - 1; i >= 0; i--) {
        if (rounded >= steps[i].min) {
          stepText = steps[i].text;
          break;
        }
      }
      if (label && label.textContent !== stepText) {
        label.textContent = stepText;
      }
    }

    let progress = 0;
    let isFinished = false;
    const startTime = performance.now();

    // Natural progression ticker while full database and dashboard initialize
    const ticker = setInterval(() => {
      if (isFinished) return;
      if (progress < 25) {
        progress += 2.0;
      } else if (progress < 55) {
        progress += 1.4;
      } else if (progress < 80) {
        progress += 0.9;
      } else if (progress < 88) {
        progress += 0.4;
      } else if (progress < 95) {
        progress += 0.12;
      }
      setPct(progress);
    }, 35);

    function sweepTo100AndOpen() {
      if (isFinished) return;
      isFinished = true;
      clearInterval(ticker);

      let cur = Math.max(progress, 88);
      const finishTimer = setInterval(() => {
        cur += 4;
        if (cur >= 100) {
          cur = 100;
          clearInterval(finishTimer);
          setPct(100);
          // Open immediately upon reaching 100%!
          setTimeout(() => {
            ipcRenderer.send('splash:done');
          }, 50);
          return;
        }
        setPct(cur);
      }, 16);
    }

    // Fired ONLY after full startup init (SQLite + sessions + symbols + React render) finishes!
    ipcRenderer.on('app:ready', () => {
      sweepTo100AndOpen();
    });

    // Safety fallback: if app:ready not received within 15s, sweep anyway
    setTimeout(() => {
      if (!isFinished) {
        sweepTo100AndOpen();
      }
    }, 15000);
  </script>
</body>
</html>`;

function createSplashWindow() {
  splashStartTime = Date.now();
  isAppReadySent = false;

  splashWindow = new BrowserWindow({
    width: 320,
    height: 320,
    frame: false,
    transparent: false,
    resizable: false,
    show: true,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#14171f',
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
    },
  });

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(SPLASH_HTML)}`);

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function revealMainWindow() {
  if (isAppReadySent) return;
  isAppReadySent = true;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.maximize();
    mainWindow.show();
    mainWindow.focus();
  }
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.destroy();
    splashWindow = null;
  }
}

function createWindow() {
  const iconPath = path.join(__dirname, '../build/icon.ico');

  mainWindow = new BrowserWindow({
    title: 'TradePro',
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#121418',
    show: false,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDev,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  if (isDev) {
    // Only in development: F12 or Ctrl+Shift+I to toggle DevTools
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
        mainWindow?.webContents.toggleDevTools();
        event.preventDefault();
      }
    });
  } else {
    // In production: block all inspect / devtools shortcuts completely
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (
        input.key === 'F12' ||
        (input.control && input.shift && ['i', 'j', 'c'].includes(input.key.toLowerCase())) ||
        (input.control && input.key.toLowerCase() === 'u')
      ) {
        event.preventDefault();
      }
    });
  }

  // Safety fallback: Only reveal if renderer never signals within 25 seconds
  setTimeout(() => {
    if (!isAppReadySent) {
      revealMainWindow();
    }
  }, 25000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.on('app:ready', () => {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('app:ready');
  } else {
    revealMainWindow();
  }
});

ipcMain.on('splash:done', () => {
  revealMainWindow();
});

app.commandLine.appendSwitch('js-flags', '--expose-gc --max-old-space-size=512');

app.whenReady().then(() => {
  // Local SQLite DB lives in the app's userData folder — never touches network.
  initDatabase(app.getPath('userData'));
  createSplashWindow();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (isAppReadySent && process.platform !== 'darwin') {
    app.quit();
  }
});

// Basic app-info IPC handler used by the renderer's status bar (day-1 placeholder).
ipcMain.handle('app:getVersion', () => app.getVersion());

// Memory trim IPC handler
ipcMain.handle('app:trimMemory', () => {
  if ((global as any).gc) {
    try {
      (global as any).gc();
    } catch {}
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.session.clearCache();
    } catch {}
  }
  return true;
});

// --- Data system (day 3) ---
// File dialogs must run in the main process; the renderer only ever
// receives paths back, never raw file contents.
ipcMain.handle('dialog:selectCsvFiles', async () => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih file CSV',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('dialog:selectCsvFolder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih folder data',
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('data:importFiles', (_event: Electron.IpcMainInvokeEvent, filePaths: string[]) =>
  importFiles(filePaths)
);
ipcMain.handle('data:importFolder', (_event: Electron.IpcMainInvokeEvent, folderPath: string) =>
  importFolder(folderPath)
);
ipcMain.handle('data:listSymbols', () => listSymbolSummaries());

// --- Data management (day 3) ---
ipcMain.handle('data:listDatasets', (_event: Electron.IpcMainInvokeEvent, symbolId: number) =>
  listDatasetsForSymbol(symbolId)
);
ipcMain.handle('data:deleteSymbol', async (_event: Electron.IpcMainInvokeEvent, symbolId: number) => {
  try {
    deleteSymbol(symbolId);
    return true;
  } catch (e: any) {
    console.error('Error deleting symbol:', e);
    throw new Error(e.message || 'Failed to delete symbol');
  }
});

ipcMain.handle('data:deleteTimeframe', async (_event: Electron.IpcMainInvokeEvent, symbolId: number, timeframe: string) => {
  try {
    deleteTimeframe(symbolId, timeframe);
    return true;
  } catch (e: any) {
    console.error('Error deleting timeframe:', e);
    throw new Error(e.message || 'Failed to delete timeframe');
  }
});

// --- Day 19: Per-dataset delete (metadata only, candles preserved) ---
ipcMain.handle('data:deleteDataset', (_event: Electron.IpcMainInvokeEvent, datasetId: number) => {
  deleteDataset(datasetId);
  return true;
});

// --- Chart data (day 4) ---
ipcMain.handle(
  'data:getCandles',
  (_event: Electron.IpcMainInvokeEvent, symbolId: number, timeframe: string, limit?: number) => {
    console.log('[DATA FORENSIC 3] IPC data:getCandles received in Main Process:', { symbolId, timeframe, limit });
    const result = getCandles(symbolId, timeframe, limit);
    console.log('[DATA FORENSIC 3] IPC data:getCandles returning rows count:', result.length);
    return result;
  }
);

// --- Chart pagination (day 5) — older candles as the chart is panned back ---
ipcMain.handle(
  'data:getCandlesBefore',
  (
    _event: Electron.IpcMainInvokeEvent,
    symbolId: number,
    timeframe: string,
    beforeTime: number,
    limit?: number
  ) => getCandlesBefore(symbolId, timeframe, beforeTime, limit)
);

ipcMain.handle(
  'data:getCandlesFrom',
  (
    _event: Electron.IpcMainInvokeEvent,
    symbolId: number,
    timeframe: string,
    fromTime: number,
    limit?: number
  ) => getCandlesFrom(symbolId, timeframe, fromTime, limit)
);

ipcMain.handle(
  'data:getCandlesRange',
  (
    _event: Electron.IpcMainInvokeEvent,
    symbolId: number,
    timeframe: string,
    fromTime: number,
    toTime?: number | null
  ) => getCandlesRange(symbolId, timeframe, fromTime, toTime)
);



// --- App settings / UI state persistence (day 4 bugfix) ---
// Generic key/value store — currently used for "last selected
// symbol + timeframe", but not hardcoded to that use case.
ipcMain.handle('settings:get', (_event: Electron.IpcMainInvokeEvent, key: string) =>
  getSetting(key)
);
ipcMain.handle(
  'settings:set',
  (_event: Electron.IpcMainInvokeEvent, key: string, value: string) => {
    setSetting(key, value);
    return true;
  }
);

// --- Day 20: Database Maintenance & Statistics ---
ipcMain.handle('app:openDataFolder', async () => {
  try {
    const dbInfo = getDatabaseInfo();
    if (dbInfo?.dbPath) {
      shell.showItemInFolder(path.resolve(dbInfo.dbPath));
      return true;
    }
    const userData = app.getPath('userData');
    await shell.openPath(userData);
    return true;
  } catch (err) {
    console.error('[Main] Failed to open data folder:', err);
    try {
      const userData = app.getPath('userData');
      await shell.openPath(userData);
      return true;
    } catch {}
    return false;
  }
});
ipcMain.handle('db:getStats', () => getDatabaseStats());
ipcMain.handle('db:getInfo', () => getDatabaseInfo());
ipcMain.handle('db:vacuum', () => vacuumDatabase());
ipcMain.handle('db:analyze', () => analyzeDatabase());
ipcMain.handle('db:getHealth', () => getDatabaseHealth());
ipcMain.handle('db:listDatasetStats', () => listDatasetStats());
ipcMain.handle('db:listSymbolStats', () => listSymbolDetailStats());
ipcMain.handle('db:listImportLogs', (_event: Electron.IpcMainInvokeEvent, limit?: number) =>
  listImportLogs(limit)
);

// --- Backtest Sessions Persistence ---
ipcMain.handle('session:list', () => listBacktestSessionsDb());
ipcMain.handle('session:save', (_e, sessionData: any) => saveBacktestSessionDb(sessionData));
ipcMain.handle('session:update', (_e, id: string, updates: any) => updateBacktestSessionDb(id, updates));
ipcMain.handle('session:updateReplayState', (_e, id: string, index: number | null, time: number | null) =>
  updateReplayStateDb(id, index, time)
);
ipcMain.handle('session:updateTradingState', (_e, id: string, balance: number, equity: number) =>
  updateTradingStateDb(id, balance, equity)
);
ipcMain.handle('session:saveTradingState', (_e, id: string, stateJson: string) =>
  saveTradingStateJsonDb(id, stateJson)
);
ipcMain.handle('session:loadTradingState', (_e, id: string) =>
  loadTradingStateJsonDb(id)
);
ipcMain.handle('session:resume', (_e, id: string) => getBacktestSessionDb(id));
ipcMain.handle('session:delete', (_e, id: string) => deleteBacktestSessionDb(id));

// --- Dukascopy Downloader & Validation Engine ---
ipcMain.handle('dukascopy:download', async (event, params: DukascopyDownloadParams) => {
  return downloadDukascopyHistoricalData(params, (progress) => {
    event.sender.send('dukascopy:progress', progress);
  });
});

ipcMain.handle('dukascopy:downloadMissingRanges', async (event, params: any) => {
  return downloadMissingRanges(params, (progress) => {
    event.sender.send('dukascopy:progress', progress);
  });
});

ipcMain.handle('dukascopy:validateSymbolAvailability', async (_e, params: any) => {
  console.log('[IPC][Main] dukascopy:validateSymbolAvailability invoked for symbol:', params.symbol);
  return validateSymbolAvailability(params);
});

ipcMain.handle('data:detectGaps', async (_e, symbolId: any, timeframe?: string, fromTime?: number, toTime?: number) => {
  const numId = Number(symbolId);
  return detectDataGaps(numId, timeframe ?? 'M1', fromTime, toTime);
});

ipcMain.handle('data:rebuildDerivedTimeframes', async (event, symbolId: number, fromTime?: number, toTime?: number) => {
  return rebuildDerivedTimeframes(symbolId, fromTime, toTime, undefined, (progress) => {
    event.sender.send('data:derivedProgress', progress);
  });
});

ipcMain.handle('data:generateCustomTimeframe', async (event, symbolId: number, timeframe: string) => {
  return rebuildDerivedTimeframes(symbolId, undefined, undefined, [timeframe], (progress) => {
    event.sender.send('data:derivedProgress', progress);
  });
});

ipcMain.handle('data:backfillMissingDerivedTimeframes', async (event, symbolId: number, options?: { force?: boolean }) => {
  return backfillMissingDerivedTimeframes(symbolId, {
    ...options,
    onProgress: (progress) => {
      event.sender.send('data:derivedProgress', progress);
    },
  });
});

// --- Economic News Calendar Engine ---
ipcMain.handle('news:download', async (event, params: NewsDownloadParams) => {
  return downloadDukascopyNews(params, (progress) => {
    event.sender.send('news:progress', progress);
  });
});

ipcMain.handle('news:getRange', async (_e, params: { currencies: string[]; fromTime: number; toTime: number; minImpact?: string }) => {
  return getEconomicEventsRangeDb(params.currencies, params.fromTime, params.toTime, params.minImpact);
});

ipcMain.handle('news:getStats', async () => {
  return getEconomicEventsStatsDb();
});

// --- Commercial License Engine ---
ipcMain.handle('license:check', async () => {
  return checkLicenseStatus();
});

ipcMain.handle('license:activate', async (_e, serialKey: string) => {
  return activateLicenseOnline(serialKey);
});

ipcMain.handle('license:getHwid', async () => {
  return getHardwareId();
});

ipcMain.handle('license:deactivate', async () => {
  return deactivateLicenseLocal();
});

// --- Gemini AI Bridge Engine ---
ipcMain.handle('ai:geminiRequest', async (_event, params: { prompt: string; images?: string[]; apiKey: string; model: string }) => {
  const { prompt, images = [], apiKey, model } = params;
  const trimmedKey = (apiKey || '').trim();
  if (!trimmedKey) throw new Error('API Key Gemini tidak boleh kosong.');

  let targetModel = model || 'gemini-3.6-flash';
  if (targetModel === 'gemini-1.5-flash' || targetModel === 'gemini-1.5-pro' || targetModel === 'gemini-2.0-flash' || targetModel === 'gemini-flash-latest') {
    targetModel = 'gemini-3.6-flash';
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${trimmedKey}`;

  const parts: any[] = [{ text: prompt }];
  for (const imgUrl of images) {
    const match = imgUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      parts.push({
        inlineData: {
          mimeType: match[1],
          data: match[2],
        },
      });
    }
  }

  const response = await net.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2500,
      },
    }),
  });

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      if (data?.error?.message) errorMsg = data.error.message;
    } catch {
      errorMsg = response.statusText || errorMsg;
    }

    if (response.status === 400 && errorMsg.toLowerCase().includes('api key')) {
      throw new Error('API Key Gemini tidak valid. Mohon periksa atau masukkan ulang API Key.');
    } else if (response.status === 429) {
      throw new Error('Limit kuota gratis Gemini tercapai sementara. Coba ganti model ke Gemini 1.5 Flash atau tunggu sebentar.');
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Google Gemini tidak memberikan respon teks.');
  return text;
});

// --- OpenAI / 9Router Bridge Engine ---
ipcMain.handle('ai:openAiRequest', async (_event, params: { url: string; apiKey?: string; model: string; messages: any[] }) => {
  const { url, apiKey = '', model, messages } = params;
  let targetUrl = (url || '').trim();
  if (!targetUrl) targetUrl = 'http://localhost:20128/v1';
  if (!targetUrl.endsWith('/chat/completions')) {
    targetUrl = targetUrl.replace(/\/+$/, '') + '/chat/completions';
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey && apiKey.trim()) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }

  let targetModel = (model || '').trim();
  if (
    !targetModel ||
    targetModel === 'claude-3-5-sonnet' ||
    targetModel === 'default' ||
    targetModel.startsWith('gemini-')
  ) {
    targetModel = 'opencode2';
  }

  const response = await net.fetch(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: targetModel,
      messages,
      temperature: 0.3,
      stream: false,
    }),
  });

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      if (data?.error?.message) errorMsg = data.error.message;
    } catch {
      errorMsg = response.statusText || errorMsg;
    }
    throw new Error(errorMsg);
  }

  const rawText = await response.text();
  const trimmed = rawText.trim();
  if (!trimmed) throw new Error('9Router tidak memberikan respon teks.');

  // 1. Try standard OpenAI JSON (stripping any trailing SSE markers like data: [DONE])
  let jsonCandidate = trimmed.replace(/\s*data:\s*\[DONE\]\s*$/i, '').trim();
  if (jsonCandidate.startsWith('{')) {
    const lastBrace = jsonCandidate.lastIndexOf('}');
    if (lastBrace > 0) {
      jsonCandidate = jsonCandidate.substring(0, lastBrace + 1);
    }
    try {
      const data = JSON.parse(jsonCandidate);
      const text =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.text ||
        data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && typeof text === 'string') return text;
    } catch {
      // Fall through to SSE chunk parser
    }
  }

  // 2. Fallback to parse SSE chunks if 9Router streamed response
  let fullContent = '';
  const lines = trimmed.split('\n');
  for (const line of lines) {
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
      // ignore chunk parsing errors
    }
  }

  if (fullContent) return fullContent;
  throw new Error('9Router tidak memberikan respon teks.');
});

ipcMain.handle('ai:fetchModels', async (_event, params: { url?: string; apiKey?: string }) => {
  let targetUrl = (params?.url || '').trim() || 'http://localhost:20128/v1';
  const apiKey = (params?.apiKey || '').trim();
  let modelsUrl = targetUrl.replace(/\/+$/, '');
  if (modelsUrl.endsWith('/chat/completions')) {
    modelsUrl = modelsUrl.replace(/\/chat\/completions$/, '/models');
  } else if (!modelsUrl.endsWith('/models')) {
    modelsUrl = `${modelsUrl}/models`;
  }

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const tryFetch = async (endpoint: string) => {
    const res = await net.fetch(endpoint, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : null;
  };

  try {
    const list = await tryFetch(modelsUrl);
    if (list) return list;
  } catch {}

  if (modelsUrl.includes('localhost')) {
    try {
      const altUrl = modelsUrl.replace('localhost', '127.0.0.1');
      const list = await tryFetch(altUrl);
      if (list) return list;
    } catch {}
  }

  return [];
});


