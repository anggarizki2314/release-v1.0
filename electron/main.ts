import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
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
      align-items: center;
      gap: 10px;
    }
    .status-text {
      font-size: 11.5px;
      color: #94a3b8;
      font-weight: 500;
      text-align: center;
      height: 15px;
      transition: opacity 0.2s ease;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .progress-track {
      width: 100%;
      height: 3.5px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 3px;
      overflow: hidden;
      position: relative;
    }
    .progress-bar {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      width: 40%;
      background: linear-gradient(90deg, #ef4444, #f87171, #ef4444);
      border-radius: 3px;
      box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
      animation: indeterminate 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }
    .version-tag {
      font-size: 10px;
      color: #5d6b82;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    @keyframes pulse {
      0% { transform: scale(0.97); }
      100% { transform: scale(1.03); }
    }
    @keyframes indeterminate {
      0% { left: -40%; width: 30%; }
      50% { left: 30%; width: 50%; }
      100% { left: 100%; width: 30%; }
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
      <div class="status-text" id="status-label">Memulai TradePro Engine...</div>
      <div class="progress-track">
        <div class="progress-bar"></div>
      </div>
      <div class="version-tag">v1.0</div>
    </div>
  </div>

  <script>
    const messages = [
      'Memulai TradePro Engine...',
      'Menghubungkan ke SQLite Database...',
      'Menyiapkan Market & Chart Datasets...',
      'Memuat Workspace & Analytics...',
      'Hampir siap...'
    ];
    let idx = 0;
    const label = document.getElementById('status-label');
    setInterval(() => {
      idx = (idx + 1) % messages.length;
      if (label) {
        label.style.opacity = '0';
        setTimeout(() => {
          label.textContent = messages[idx];
          label.style.opacity = '1';
        }, 150);
      }
    }, 900);
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
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
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

  const elapsed = Date.now() - splashStartTime;
  const minDisplayMs = 1800;
  const remainingWait = Math.max(0, minDisplayMs - elapsed);

  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.maximize();
      mainWindow.focus();
    }
    if (splashWindow && !splashWindow.isDestroyed()) {
      setTimeout(() => {
        splashWindow?.destroy();
        splashWindow = null;
      }, 150);
    }
  }, remainingWait);
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

