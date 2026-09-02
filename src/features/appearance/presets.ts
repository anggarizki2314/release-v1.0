import type { ThemePreset } from './types';

export const DEFAULT_THEME: ThemePreset = {
  id: 'dark-mantap',
  name: 'Dark Mantap',
  theme: {
    app: {
      background: '#1a1d2e',
      sidebar: '#10141c',
      toolbar: '#10141c',
      panel: '#10141c',
      popup: '#0a212e',
      border: '#212836',
      shadow: 'rgba(0,0,0,0.45)',
      hover: 'rgba(255, 255, 255, 0.06)',
      accent: '#cc5500',
    },
    button: {
      primary: '#f5c800',
      primaryText: '#ffffff',
      secondary: '#202836',
      secondaryText: '#d8dce3',
    },
    text: {
      primary: '#d8dce3',
      secondary: '#838da0',
      muted: '#576070',
    },
    chart: {
      background: '#0a0d13',
      backgroundGradientFrom: '#0a0d13',
      backgroundGradientTo: '#0a0d13',
      useGradient: false,
    },
    candle: {
      bull: { body: '#9e9e9e', border: '#9e9e9e', wick: '#9e9e9e' },
      bear: { body: '#00e676', border: '#00e676', wick: '#00e676' },
    },
    grid: { visible: false, color: '#212836', opacity: 3.5 },
    crosshair: { visible: true, color: '#4f86f7', style: 'dashed', width: 1 },
    scale: {
      price: { text: '#d1d5db', background: '#10141c', border: '#212836' },
      time: { text: '#d1d5db', background: '#10141c', border: '#212836' },
    },
    watermark: { showSymbol: true, showTimeframe: true, color: '#212836', opacity: 50 },
    session: { visible: false, color: '#212836', style: 'solid' },
    border: { visible: true, color: '#ffffff', opacity: 45 },
  },
};


const fxreplayLight: ThemePreset = {
  id: 'fxreplay-light',
  name: 'FXReplay Light',
  theme: {
    app: {
      background: '#f0f2f5',
      sidebar: '#ffffff',
      toolbar: '#ffffff',
      panel: '#ffffff',
      popup: '#ffffff',
      border: '#d1d4dc',
      shadow: 'rgba(0,0,0,0.12)',
      hover: '#f0f0f0',
      accent: '#4f86f7',
    },
    button: {
      primary: '#4f86f7',
      primaryText: '#ffffff',
      secondary: '#e8eaed',
      secondaryText: '#333333',
    },
    text: {
      primary: '#131722',
      secondary: '#4a4d5a',
      muted: '#9598a1',
    },
    chart: {
      background: '#ffffff',
      backgroundGradientFrom: '#ffffff',
      backgroundGradientTo: '#ffffff',
      useGradient: false,
    },
    candle: {
      bull: { body: '#089981', border: '#089981', wick: '#089981' },
      bear: { body: '#f23645', border: '#f23645', wick: '#f23645' },
    },
    grid: { visible: true, color: '#e0e3eb', opacity: 100 },
    crosshair: { visible: true, color: '#2196f3', style: 'dashed', width: 1 },
    scale: {
      price: { text: '#334155', background: '#ffffff', border: '#d1d4dc' },
      time: { text: '#334155', background: '#ffffff', border: '#d1d4dc' },
    },
    watermark: { showSymbol: true, showTimeframe: true, color: '#d1d4dc', opacity: 50 },
    session: { visible: false, color: '#d1d4dc', style: 'solid' },
    border: { visible: true, color: '#4f86f7', opacity: 25 },
  },
};

const tradingviewDark: ThemePreset = {
  id: 'tradingview-dark',
  name: 'TradingView Dark',
  theme: {
    app: {
      background: '#0d1015',
      sidebar: '#131722',
      toolbar: '#131722',
      panel: '#131722',
      popup: '#1e222d',
      border: '#363c4e',
      shadow: 'rgba(0,0,0,0.5)',
      hover: '#2a2e39',
      accent: '#2962ff',
    },
    button: {
      primary: '#2962ff',
      primaryText: '#ffffff',
      secondary: '#2a2e39',
      secondaryText: '#d1d4dc',
    },
    text: {
      primary: '#d1d4dc',
      secondary: '#787b86',
      muted: '#4c525e',
    },
    chart: {
      background: '#131722',
      backgroundGradientFrom: '#131722',
      backgroundGradientTo: '#131722',
      useGradient: false,
    },
    candle: {
      bull: { body: '#089981', border: '#089981', wick: '#089981' },
      bear: { body: '#f23645', border: '#f23645', wick: '#f23645' },
    },
    grid: { visible: true, color: '#2a2e39', opacity: 100 },
    crosshair: { visible: true, color: '#758696', style: 'dashed', width: 1 },
    scale: {
      price: { text: '#d1d5db', background: '#131722', border: '#363c4e' },
      time: { text: '#d1d5db', background: '#131722', border: '#363c4e' },
    },
    watermark: { showSymbol: true, showTimeframe: true, color: '#363c4e', opacity: 50 },
    session: { visible: false, color: '#363c4e', style: 'solid' },
    border: { visible: true, color: '#2962ff', opacity: 25 },
  },
};

const tradingviewLight: ThemePreset = {
  id: 'tradingview-light',
  name: 'TradingView Light',
  theme: {
    app: {
      background: '#ffffff',
      sidebar: '#ffffff',
      toolbar: '#ffffff',
      panel: '#ffffff',
      popup: '#ffffff',
      border: '#d1d4dc',
      shadow: 'rgba(0,0,0,0.1)',
      hover: '#f5f5f5',
      accent: '#2962ff',
    },
    button: {
      primary: '#2962ff',
      primaryText: '#ffffff',
      secondary: '#e0e3eb',
      secondaryText: '#333333',
    },
    text: {
      primary: '#131722',
      secondary: '#4a4d5a',
      muted: '#9598a1',
    },
    chart: {
      background: '#ffffff',
      backgroundGradientFrom: '#ffffff',
      backgroundGradientTo: '#ffffff',
      useGradient: false,
    },
    candle: {
      bull: { body: '#089981', border: '#089981', wick: '#089981' },
      bear: { body: '#f23645', border: '#f23645', wick: '#f23645' },
    },
    grid: { visible: true, color: '#e0e3eb', opacity: 100 },
    crosshair: { visible: true, color: '#2196f3', style: 'dashed', width: 1 },
    scale: {
      price: { text: '#334155', background: '#ffffff', border: '#d1d4dc' },
      time: { text: '#334155', background: '#ffffff', border: '#d1d4dc' },
    },
    watermark: { showSymbol: true, showTimeframe: true, color: '#d1d4dc', opacity: 50 },
    session: { visible: false, color: '#d1d4dc', style: 'solid' },
    border: { visible: true, color: '#2962ff', opacity: 25 },
  },
};

const minimalDark: ThemePreset = {
  id: 'minimal-dark',
  name: 'Minimal Dark',
  theme: {
    app: {
      background: '#0d0d0d',
      sidebar: '#141414',
      toolbar: '#141414',
      panel: '#141414',
      popup: '#1a1a1a',
      border: '#333333',
      shadow: 'rgba(0,0,0,0.5)',
      hover: '#1e1e1e',
      accent: '#4caf50',
    },
    button: {
      primary: '#4caf50',
      primaryText: '#ffffff',
      secondary: '#2a2a2a',
      secondaryText: '#e0e0e0',
    },
    text: {
      primary: '#e0e0e0',
      secondary: '#aaaaaa',
      muted: '#666666',
    },
    chart: {
      background: '#0d0d0d',
      backgroundGradientFrom: '#0d0d0d',
      backgroundGradientTo: '#0d0d0d',
      useGradient: false,
    },
    candle: {
      bull: { body: '#4caf50', border: '#4caf50', wick: '#4caf50' },
      bear: { body: '#f44336', border: '#f44336', wick: '#f44336' },
    },
    grid: { visible: false, color: '#2a2a2a', opacity: 100 },
    crosshair: { visible: true, color: '#757575', style: 'solid', width: 1 },
    scale: {
      price: { text: '#d1d5db', background: '#141414', border: '#333333' },
      time: { text: '#d1d5db', background: '#141414', border: '#333333' },
    },
    watermark: { showSymbol: true, showTimeframe: true, color: '#444444', opacity: 30 },
    session: { visible: false, color: '#333333', style: 'solid' },
    border: { visible: true, color: '#4caf50', opacity: 25 },
  },
};

const minimalLight: ThemePreset = {
  id: 'minimal-light',
  name: 'Minimal Light',
  theme: {
    app: {
      background: '#f5f5f5',
      sidebar: '#ffffff',
      toolbar: '#ffffff',
      panel: '#ffffff',
      popup: '#ffffff',
      border: '#dddddd',
      shadow: 'rgba(0,0,0,0.08)',
      hover: '#f0f0f0',
      accent: '#4caf50',
    },
    button: {
      primary: '#4caf50',
      primaryText: '#ffffff',
      secondary: '#e8e8e8',
      secondaryText: '#333333',
    },
    text: {
      primary: '#333333',
      secondary: '#666666',
      muted: '#999999',
    },
    chart: {
      background: '#f5f5f5',
      backgroundGradientFrom: '#f5f5f5',
      backgroundGradientTo: '#f5f5f5',
      useGradient: false,
    },
    candle: {
      bull: { body: '#4caf50', border: '#4caf50', wick: '#4caf50' },
      bear: { body: '#f44336', border: '#f44336', wick: '#f44336' },
    },
    grid: { visible: false, color: '#eeeeee', opacity: 100 },
    crosshair: { visible: true, color: '#2196f3', style: 'solid', width: 1 },
    scale: {
      price: { text: '#666666', background: '#ffffff', border: '#dddddd' },
      time: { text: '#666666', background: '#ffffff', border: '#dddddd' },
    },
    watermark: { showSymbol: true, showTimeframe: true, color: '#cccccc', opacity: 40 },
    session: { visible: false, color: '#dddddd', style: 'solid' },
    border: { visible: true, color: '#4caf50', opacity: 25 },
  },
};

export const THEME_PRESETS: ThemePreset[] = [
  DEFAULT_THEME,
  fxreplayLight,
  tradingviewDark,
  tradingviewLight,
  minimalDark,
  minimalLight,
];
