import { contextBridge, ipcRenderer } from 'electron';

// Whitelisted, typed bridge between renderer (React) and main process.
// Renderer never gets direct Node/Electron access — everything goes
// through this explicit API surface. Data-import methods only ever
// return small summary objects (never raw candle arrays) so the
// renderer's React state stays light regardless of file size.
const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  trimMemory: (): Promise<boolean> => ipcRenderer.invoke('app:trimMemory'),
  notifyAppReady: (): void => { ipcRenderer.send('app:ready'); },

  selectCsvFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:selectCsvFiles'),
  selectCsvFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectCsvFolder'),
  importFiles: (filePaths: string[]): Promise<unknown[]> =>
    ipcRenderer.invoke('data:importFiles', filePaths),
  importFolder: (folderPath: string): Promise<unknown[]> =>
    ipcRenderer.invoke('data:importFolder', folderPath),
  listSymbols: (): Promise<unknown[]> => ipcRenderer.invoke('data:listSymbols'),
  listDatasets: (symbolId: number): Promise<unknown[]> =>
    ipcRenderer.invoke('data:listDatasets', symbolId),
  deleteSymbol: (symbolId: number): Promise<boolean> =>
    ipcRenderer.invoke('data:deleteSymbol', symbolId),
  deleteTimeframe: (symbolId: number, timeframe: string): Promise<boolean> =>
    ipcRenderer.invoke('data:deleteTimeframe', symbolId, timeframe),
  deleteDataset: (datasetId: number): Promise<boolean> =>
    ipcRenderer.invoke('data:deleteDataset', datasetId),
  getCandles: (symbolId: number, timeframe: string, limit?: number): Promise<unknown[]> =>
    ipcRenderer.invoke('data:getCandles', symbolId, timeframe, limit),
  getCandlesBefore: (
    symbolId: number,
    timeframe: string,
    beforeTime: number,
    limit?: number
  ): Promise<unknown[]> =>
    ipcRenderer.invoke('data:getCandlesBefore', symbolId, timeframe, beforeTime, limit),
  getCandlesFrom: (
    symbolId: number,
    timeframe: string,
    fromTime: number,
    limit?: number
  ): Promise<unknown[]> =>
    ipcRenderer.invoke('data:getCandlesFrom', symbolId, timeframe, fromTime, limit),
  getCandlesRange: (
    symbolId: number,
    timeframe: string,
    fromTime: number,
    toTime?: number | null
  ): Promise<unknown[]> =>
    ipcRenderer.invoke('data:getCandlesRange', symbolId, timeframe, fromTime, toTime),


  getSetting: (key: string): Promise<string | null> => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string): Promise<boolean> =>
    ipcRenderer.invoke('settings:set', key, value),

  // Day 20: Database maintenance & statistics
  openDataFolder: (): Promise<boolean> => ipcRenderer.invoke('app:openDataFolder'),
  getDbStats: (): Promise<unknown> => ipcRenderer.invoke('db:getStats'),
  getDbInfo: (): Promise<unknown> => ipcRenderer.invoke('db:getInfo'),
  vacuumDb: (): Promise<boolean> => ipcRenderer.invoke('db:vacuum'),
  analyzeDb: (): Promise<boolean> => ipcRenderer.invoke('db:analyze'),
  getDbHealth: (): Promise<unknown> => ipcRenderer.invoke('db:getHealth'),
  listDatasetStats: (): Promise<unknown[]> => ipcRenderer.invoke('db:listDatasetStats'),
  listSymbolStats: (): Promise<unknown[]> => ipcRenderer.invoke('db:listSymbolStats'),
  listImportLogs: (limit?: number): Promise<unknown[]> =>
    ipcRenderer.invoke('db:listImportLogs', limit),

  // Backtest Sessions persistence
  listBacktestSessions: (): Promise<any[]> => ipcRenderer.invoke('session:list'),
  saveBacktestSession: (sessionData: any): Promise<boolean> =>
    ipcRenderer.invoke('session:save', sessionData),
  updateBacktestSession: (id: string, updates: any): Promise<boolean> =>
    ipcRenderer.invoke('session:update', id, updates),
  updateReplayState: (id: string, index: number | null, time: number | null): Promise<boolean> =>
    ipcRenderer.invoke('session:updateReplayState', id, index, time),
  updateTradingState: (id: string, balance: number, equity: number): Promise<boolean> =>
    ipcRenderer.invoke('session:updateTradingState', id, balance, equity),
  saveTradingState: (id: string, stateJson: string): Promise<boolean> =>
    ipcRenderer.invoke('session:saveTradingState', id, stateJson),
  loadTradingState: (id: string): Promise<string | null> =>
    ipcRenderer.invoke('session:loadTradingState', id),
  resumeBacktestSession: (id: string): Promise<any> =>
    ipcRenderer.invoke('session:resume', id),
  deleteBacktestSession: (id: string): Promise<boolean> =>
    ipcRenderer.invoke('session:delete', id),

  // Dukascopy Downloader Engine
  downloadDukascopy: (params: unknown): Promise<unknown> =>
    ipcRenderer.invoke('dukascopy:download', params),
  downloadMissingRanges: (params: unknown): Promise<unknown> =>
    ipcRenderer.invoke('dukascopy:downloadMissingRanges', params),
  validateSymbolAvailability: (params: { symbolId: number; symbol: string; timeframe?: string; fromTime?: number; toTime?: number }): Promise<any> =>
    ipcRenderer.invoke('dukascopy:validateSymbolAvailability', params),
  detectDataGaps: (symbolId: number, timeframe?: string, fromTime?: number, toTime?: number): Promise<unknown> =>
    ipcRenderer.invoke('data:detectGaps', symbolId, timeframe, fromTime, toTime),
  onDukascopyProgress: (callback: (progress: unknown) => void) => {
    const subscription = (_e: unknown, data: unknown) => callback(data);
    ipcRenderer.on('dukascopy:progress', subscription);
    return () => {
      ipcRenderer.removeListener('dukascopy:progress', subscription);
    };
  },
  // Derived Timeframe Engine
  rebuildDerivedTimeframes: (symbolId: number, fromTime?: number, toTime?: number): Promise<unknown> =>
    ipcRenderer.invoke('data:rebuildDerivedTimeframes', symbolId, fromTime, toTime),
  generateCustomTimeframe: (symbolId: number, timeframe: string): Promise<unknown> =>
    ipcRenderer.invoke('data:generateCustomTimeframe', symbolId, timeframe),
  backfillMissingDerivedTimeframes: (symbolId: number, options?: { force?: boolean }): Promise<unknown> =>
    ipcRenderer.invoke('data:backfillMissingDerivedTimeframes', symbolId, options),
  onDerivedProgress: (callback: (progress: unknown) => void) => {
    const subscription = (_e: unknown, data: unknown) => callback(data);
    ipcRenderer.on('data:derivedProgress', subscription);
    return () => {
      ipcRenderer.removeListener('data:derivedProgress', subscription);
    };
  },

  // Economic News Calendar
  downloadEconomicNews: (params: { startDate: string; endDate: string; currencies?: string[]; includeMediumImpact?: boolean }): Promise<any> =>
    ipcRenderer.invoke('news:download', params),
  getEconomicNewsRange: (params: { currencies: string[]; fromTime: number; toTime: number; minImpact?: string }): Promise<any[]> =>
    ipcRenderer.invoke('news:getRange', params),
  getEconomicNewsStats: (): Promise<{ totalEvents: number; countByCurrency: Record<string, number>; minTime: number | null; maxTime: number | null }> =>
    ipcRenderer.invoke('news:getStats'),
  onNewsProgress: (callback: (progress: any) => void) => {
    const subscription = (_e: unknown, data: any) => callback(data);
    ipcRenderer.on('news:progress', subscription);
    return () => {
      ipcRenderer.removeListener('news:progress', subscription);
    };
  },

  // Commercial License Engine
  checkLicense: (): Promise<{ isLicensed: boolean; serialKey?: string; hwid: string; activatedAt?: string; message?: string }> =>
    ipcRenderer.invoke('license:check'),
  activateLicense: (serialKey: string): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke('license:activate', serialKey),
  getHardwareId: (): Promise<string> =>
    ipcRenderer.invoke('license:getHwid'),
  deactivateLicense: (): Promise<boolean> =>
    ipcRenderer.invoke('license:deactivate'),
};

contextBridge.exposeInMainWorld('forexReplay', api);

export type ForexReplayApi = typeof api;
