/// <reference types="vite/client" />

interface Window {
  forexReplay: {
    getVersion: () => Promise<string>;
    trimMemory?: () => Promise<boolean>;
    notifyAppReady?: () => void;
    selectCsvFiles: () => Promise<string[]>;
    selectCsvFolder: () => Promise<string | null>;
    importFiles: (filePaths: string[]) => Promise<import('./types').ImportFileResult[]>;
    importFolder: (folderPath: string) => Promise<import('./types').ImportFileResult[]>;
    listSymbols: () => Promise<import('./types').SymbolInfo[]>;
    listDatasets: (symbolId: number) => Promise<import('./types').DatasetInfo[]>;
    deleteSymbol: (symbolId: number) => Promise<boolean>;
    deleteTimeframe: (symbolId: number, timeframe: string) => Promise<boolean>;
    deleteDataset: (datasetId: number) => Promise<boolean>;
    getCandles: (
      symbolId: number,
      timeframe: string,
      limit?: number
    ) => Promise<import('./types').Candle[]>;
    getCandlesBefore: (
      symbolId: number,
      timeframe: string,
      beforeTime: number,
      limit?: number
    ) => Promise<import('./types').Candle[]>;
    getCandlesFrom: (
      symbolId: number,
      timeframe: string,
      fromTime: number,
      limit?: number
    ) => Promise<import('./types').Candle[]>;
    getCandlesRange: (
      symbolId: number,
      timeframe: string,
      fromTime: number,
      toTime?: number | null
    ) => Promise<import('./types').Candle[]>;


    getSetting: (key: string) => Promise<string | null>;
    setSetting: (key: string, value: string) => Promise<boolean>;

    // Derived Timeframe Engine
    rebuildDerivedTimeframes: (symbolId: number, fromTime?: number, toTime?: number) => Promise<unknown>;
    generateCustomTimeframe: (symbolId: number, timeframe: string) => Promise<unknown>;
    backfillMissingDerivedTimeframes: (symbolId: number, options?: { force?: boolean }) => Promise<unknown>;

    // Day 20: Database maintenance & statistics
    openDataFolder: () => Promise<boolean>;
    getDbStats: () => Promise<import('./types').DatabaseStats>;
    getDbInfo: () => Promise<import('./types').DatabaseInfo>;
    vacuumDb: () => Promise<boolean>;
    analyzeDb: () => Promise<boolean>;
    getDbHealth: () => Promise<import('./types').DatabaseHealth>;
    listDatasetStats: () => Promise<import('./types').DatasetStatsInfo[]>;
    listSymbolStats: () => Promise<import('./types').SymbolDetailStats[]>;
    listImportLogs: (limit?: number) => Promise<import('./types').ImportLogRecord[]>;

    // Day 21: Drawing persistence
    loadDrawings: (symbolId: number, timeframe: string) => Promise<any[]>;
    saveDrawings: (symbolId: number, timeframe: string, drawings: any[]) => Promise<boolean>;
    clearDrawings: (symbolId: number, timeframe: string) => Promise<boolean>;

    // Day 21: Drawing style defaults & templates
    getDrawingStyleDefaults: () => Promise<any[]>;
    setDrawingStyleDefault: (drawingType: string, styleJson: string) => Promise<boolean>;
    removeDrawingStyleDefault: (drawingType: string) => Promise<boolean>;
    listDrawingTemplates: () => Promise<any[]>;
    saveDrawingTemplate: (params: { id: string; name: string; drawingType: string; styleJson: string }) => Promise<boolean>;
    deleteDrawingTemplate: (id: string) => Promise<boolean>;

    // Backtest Sessions persistence
    listBacktestSessions: () => Promise<any[]>;
    saveBacktestSession: (sessionData: any) => Promise<boolean>;
    updateBacktestSession: (id: string, updates: any) => Promise<boolean>;
    updateReplayState: (id: string, index: number | null, time: number | null) => Promise<boolean>;
    updateTradingState: (id: string, balance: number, equity: number) => Promise<boolean>;
    saveTradingState: (id: string, stateJson: string) => Promise<boolean>;
    loadTradingState: (id: string) => Promise<string | null>;
    resumeBacktestSession: (id: string) => Promise<any>;
    deleteBacktestSession: (id: string) => Promise<boolean>;

    // Dukascopy Downloader Engine
    downloadDukascopy: (params: {
      symbol: string;
      startDate: string;
      endDate: string;
      timeframe: string;
    }) => Promise<{ success: boolean; rowsInserted: number; symbol: string }>;
    onDukascopyProgress: (callback: (progress: {
      status: 'downloading' | 'processing' | 'completed' | 'error';
      currentDay: number;
      totalDays: number;
      percent: number;
      message: string;
      rowsInserted?: number;
    }) => void) => () => void;

    // Economic News Calendar Engine
    downloadEconomicNews: (params: {
      startDate: string;
      endDate: string;
      currencies?: string[];
      includeMediumImpact?: boolean;
    }) => Promise<{ success: boolean; totalInserted: number; message: string }>;
    getEconomicNewsRange: (params: {
      currencies: string[];
      fromTime: number;
      toTime: number;
      minImpact?: string;
    }) => Promise<Array<{
      id: number;
      timestamp: number;
      currency: string;
      country: string;
      event_name: string;
      impact: 'HIGH' | 'MEDIUM' | 'LOW';
      actual?: string | null;
      forecast?: string | null;
      previous?: string | null;
    }>>;
    getEconomicNewsStats: () => Promise<{
      totalEvents: number;
      countByCurrency: Record<string, number>;
      minTime: number | null;
      maxTime: number | null;
    }>;
    onNewsProgress: (callback: (progress: {
      status: 'fetching' | 'processing' | 'done' | 'error';
      percent: number;
      message: string;
      eventsInserted?: number;
    }) => void) => () => void;

    // Commercial License Engine
    checkLicense?: () => Promise<{
      isLicensed: boolean;
      serialKey?: string;
      hwid: string;
      activatedAt?: string;
      expiresAt?: string | null;
      plan?: string;
      planName?: string;
      message?: string;
    }>;
    activateLicense?: (serialKey: string) => Promise<{ success: boolean; message: string }>;
    getHardwareId?: () => Promise<string>;
    deactivateLicense?: () => Promise<boolean>;
    geminiRequest?: (params: { prompt: string; images?: string[]; apiKey: string; model: string }) => Promise<string>;
    openAiRequest?: (params: { url: string; apiKey?: string; model: string; messages: any[] }) => Promise<string>;
  };
}
