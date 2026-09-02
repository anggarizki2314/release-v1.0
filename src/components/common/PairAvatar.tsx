import React from 'react';

export interface PairAvatarProps {
  symbol: string;
  size?: number;
  className?: string;
}

/* ─────────────────────────────────────────────────────────────
 * SVG Flags & TradingView-Style Asset Badges
 * ──────────────────────────────────────────────────────────── */

const FlagUSA: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <clipPath id="usa-clip">
      <circle cx="16" cy="16" r="16" />
    </clipPath>
    <g clipPath="url(#usa-clip)">
      {/* Stripes */}
      <rect width="32" height="32" fill="#B22234" />
      <rect y="2.46" width="32" height="2.46" fill="#FFFFFF" />
      <rect y="7.38" width="32" height="2.46" fill="#FFFFFF" />
      <rect y="12.30" width="32" height="2.46" fill="#FFFFFF" />
      <rect y="17.23" width="32" height="2.46" fill="#FFFFFF" />
      <rect y="22.15" width="32" height="2.46" fill="#FFFFFF" />
      <rect y="27.07" width="32" height="2.46" fill="#FFFFFF" />
      {/* Canton */}
      <rect width="14" height="15" fill="#3C3B6E" />
      {/* Stars */}
      <circle cx="3.5" cy="3.5" r="1.1" fill="#FFFFFF" />
      <circle cx="7" cy="3.5" r="1.1" fill="#FFFFFF" />
      <circle cx="10.5" cy="3.5" r="1.1" fill="#FFFFFF" />
      <circle cx="5.25" cy="6.5" r="1.1" fill="#FFFFFF" />
      <circle cx="8.75" cy="6.5" r="1.1" fill="#FFFFFF" />
      <circle cx="3.5" cy="9.5" r="1.1" fill="#FFFFFF" />
      <circle cx="7" cy="9.5" r="1.1" fill="#FFFFFF" />
      <circle cx="10.5" cy="9.5" r="1.1" fill="#FFFFFF" />
      <circle cx="5.25" cy="12.5" r="1.1" fill="#FFFFFF" />
      <circle cx="8.75" cy="12.5" r="1.1" fill="#FFFFFF" />
    </g>
  </svg>
);

const FlagEUR: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <clipPath id="eur-clip">
      <circle cx="16" cy="16" r="16" />
    </clipPath>
    <g clipPath="url(#eur-clip)">
      <rect width="32" height="32" fill="#003399" />
      {/* 12 Stars Circle */}
      <circle cx="16" cy="6" r="1.1" fill="#FFCC00" />
      <circle cx="21" cy="7.3" r="1.1" fill="#FFCC00" />
      <circle cx="24.7" cy="11" r="1.1" fill="#FFCC00" />
      <circle cx="26" cy="16" r="1.1" fill="#FFCC00" />
      <circle cx="24.7" cy="21" r="1.1" fill="#FFCC00" />
      <circle cx="21" cy="24.7" r="1.1" fill="#FFCC00" />
      <circle cx="16" cy="26" r="1.1" fill="#FFCC00" />
      <circle cx="11" cy="24.7" r="1.1" fill="#FFCC00" />
      <circle cx="7.3" cy="21" r="1.1" fill="#FFCC00" />
      <circle cx="6" cy="16" r="1.1" fill="#FFCC00" />
      <circle cx="7.3" cy="11" r="1.1" fill="#FFCC00" />
      <circle cx="11" cy="7.3" r="1.1" fill="#FFCC00" />
    </g>
  </svg>
);

const FlagGBR: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <clipPath id="gbr-clip">
      <circle cx="16" cy="16" r="16" />
    </clipPath>
    <g clipPath="url(#gbr-clip)">
      <rect width="32" height="32" fill="#012169" />
      {/* White Diagonals */}
      <path d="M0 0 L32 32 M32 0 L0 32" stroke="#FFFFFF" strokeWidth="5.5" />
      {/* Red Diagonals */}
      <path d="M0 0 L32 32 M32 0 L0 32" stroke="#C8102E" strokeWidth="2.8" />
      {/* White Cross */}
      <path d="M16 0 V32 M0 16 H32" stroke="#FFFFFF" strokeWidth="9" />
      {/* Red Cross */}
      <path d="M16 0 V32 M0 16 H32" stroke="#C8102E" strokeWidth="5.5" />
    </g>
  </svg>
);

const FlagJPN: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <clipPath id="jpn-clip">
      <circle cx="16" cy="16" r="16" />
    </clipPath>
    <g clipPath="url(#jpn-clip)">
      <rect width="32" height="32" fill="#FFFFFF" />
      <circle cx="16" cy="16" r="8" fill="#BC002D" />
    </g>
  </svg>
);

const FlagAUD: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <clipPath id="aud-clip">
      <circle cx="16" cy="16" r="16" />
    </clipPath>
    <g clipPath="url(#aud-clip)">
      <rect width="32" height="32" fill="#012169" />
      {/* Mini Canton */}
      <rect width="16" height="16" fill="#012169" />
      <path d="M0 0 L16 16 M16 0 L0 16" stroke="#FFFFFF" strokeWidth="3" />
      <path d="M0 0 L16 16 M16 0 L0 16" stroke="#C8102E" strokeWidth="1.5" />
      <path d="M8 0 V16 M0 8 H16" stroke="#FFFFFF" strokeWidth="5" />
      <path d="M8 0 V16 M0 8 H16" stroke="#C8102E" strokeWidth="3" />
      {/* Commonwealth Star & Southern Cross */}
      <circle cx="8" cy="24" r="2.2" fill="#FFFFFF" />
      <circle cx="24" cy="8" r="1.3" fill="#FFFFFF" />
      <circle cx="27" cy="14" r="1.3" fill="#FFFFFF" />
      <circle cx="24" cy="24" r="1.3" fill="#FFFFFF" />
      <circle cx="20" cy="16" r="1.3" fill="#FFFFFF" />
    </g>
  </svg>
);

const FlagCAD: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <clipPath id="cad-clip">
      <circle cx="16" cy="16" r="16" />
    </clipPath>
    <g clipPath="url(#cad-clip)">
      <rect width="32" height="32" fill="#FFFFFF" />
      <rect width="8.5" height="32" fill="#FF0000" />
      <rect x="23.5" width="8.5" height="32" fill="#FF0000" />
      {/* Maple Leaf */}
      <path
        d="M16 7 L17.5 12 L20 10.5 L19 14.5 L23 15.5 L20 18 L21.5 22 L17.5 20.5 L17 24 L15 24 L14.5 20.5 L10.5 22 L12 18 L9 15.5 L13 14.5 L12 10.5 L14.5 12 Z"
        fill="#FF0000"
      />
    </g>
  </svg>
);

const FlagCHF: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <clipPath id="chf-clip">
      <circle cx="16" cy="16" r="16" />
    </clipPath>
    <g clipPath="url(#chf-clip)">
      <rect width="32" height="32" fill="#D52B1E" />
      <rect x="13" y="7" width="6" height="18" fill="#FFFFFF" />
      <rect x="7" y="13" width="18" height="6" fill="#FFFFFF" />
    </g>
  </svg>
);

const FlagNZD: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <clipPath id="nzd-clip">
      <circle cx="16" cy="16" r="16" />
    </clipPath>
    <g clipPath="url(#nzd-clip)">
      <rect width="32" height="32" fill="#012169" />
      {/* Mini Union Jack Canton */}
      <rect width="16" height="16" fill="#012169" />
      <path d="M0 0 L16 16 M16 0 L0 16" stroke="#FFFFFF" strokeWidth="3" />
      <path d="M0 0 L16 16 M16 0 L0 16" stroke="#C8102E" strokeWidth="1.5" />
      <path d="M8 0 V16 M0 8 H16" stroke="#FFFFFF" strokeWidth="5" />
      <path d="M8 0 V16 M0 8 H16" stroke="#C8102E" strokeWidth="3" />
      {/* 4 Red Stars with White Border */}
      <circle cx="24" cy="8" r="1.6" fill="#FFFFFF" />
      <circle cx="24" cy="8" r="1.1" fill="#C8102E" />
      <circle cx="27" cy="14" r="1.6" fill="#FFFFFF" />
      <circle cx="27" cy="14" r="1.1" fill="#C8102E" />
      <circle cx="24" cy="22" r="1.6" fill="#FFFFFF" />
      <circle cx="24" cy="22" r="1.1" fill="#C8102E" />
      <circle cx="20" cy="15" r="1.6" fill="#FFFFFF" />
      <circle cx="20" cy="15" r="1.1" fill="#C8102E" />
    </g>
  </svg>
);

const FlagDEU: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <clipPath id="deu-clip">
      <circle cx="16" cy="16" r="16" />
    </clipPath>
    <g clipPath="url(#deu-clip)">
      <rect y="0" width="32" height="10.67" fill="#000000" />
      <rect y="10.67" width="32" height="10.67" fill="#DD0000" />
      <rect y="21.33" width="32" height="10.67" fill="#FFCE00" />
    </g>
  </svg>
);

/* ─────────────────────────────────────────────────────────────
 * TradingView-Style Asset Vector Badges
 * ──────────────────────────────────────────────────────────── */

const BadgeGold: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="url(#gold-grad)" />
    <defs>
      <linearGradient id="gold-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FBBF24" />
        <stop offset="1" stopColor="#B45309" />
      </linearGradient>
    </defs>
    {/* Gold Bullions Stack */}
    <path
      d="M7 19.5 L12 11 H20 L25 19.5 L23 21.5 H9 L7 19.5 Z"
      fill="#FFFBEB"
      fillOpacity="0.95"
    />
    <path
      d="M9 19.5 L12.5 13 H19.5 L23 19.5 H9 Z"
      fill="#F59E0B"
    />
    <path
      d="M13 14.5 H19 L21.5 19 H10.5 L13 14.5 Z"
      fill="#FEF3C7"
    />
  </svg>
);

const BadgeSilver: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="url(#silver-grad)" />
    <defs>
      <linearGradient id="silver-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#E2E8F0" />
        <stop offset="1" stopColor="#64748B" />
      </linearGradient>
    </defs>
    <path
      d="M7 19.5 L12 11 H20 L25 19.5 L23 21.5 H9 L7 19.5 Z"
      fill="#FFFFFF"
      fillOpacity="0.95"
    />
    <path
      d="M9 19.5 L12.5 13 H19.5 L23 19.5 H9 Z"
      fill="#94A3B8"
    />
  </svg>
);

const BadgeNasdaq: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#0284C7" />
    <text
      x="16"
      y="20.5"
      textAnchor="middle"
      fill="#FFFFFF"
      fontSize="11.5"
      fontWeight="900"
      fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      letterSpacing="-0.5px"
    >
      NQ
    </text>
  </svg>
);

const BadgeDow: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#1D4ED8" />
    <text
      x="16"
      y="20.5"
      textAnchor="middle"
      fill="#FFFFFF"
      fontSize="11"
      fontWeight="900"
      fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    >
      DJ
    </text>
  </svg>
);

const BadgeSPX: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#DC2626" />
    <text
      x="16"
      y="20.5"
      textAnchor="middle"
      fill="#FFFFFF"
      fontSize="10"
      fontWeight="900"
      fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      letterSpacing="-0.5px"
    >
      500
    </text>
  </svg>
);

const BadgeOil: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#1E293B" />
    {/* Oil Barrel / Drop */}
    <path
      d="M16 7 C16 7 9 16 9 20 C9 23.866 12.134 27 16 27 C19.866 27 23 23.866 23 20 C23 16 16 7 16 7 Z"
      fill="#F59E0B"
    />
    <circle cx="13.5" cy="19.5" r="1.8" fill="#FEF3C7" />
  </svg>
);

const BadgeGas: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#EA580C" />
    {/* Gas Flame */}
    <path
      d="M16 6 C16 6 12 12 12 17 C12 21 13.8 24 16 26 C18.2 24 20 21 20 17 C20 12 16 6 16 6 Z"
      fill="#FEF08A"
    />
  </svg>
);

const BadgeBTC: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#F7931A" />
    <text
      x="16"
      y="22.5"
      textAnchor="middle"
      fill="#FFFFFF"
      fontSize="17"
      fontWeight="700"
      fontFamily="sans-serif"
    >
      ₿
    </text>
  </svg>
);

const BadgeETH: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#627EEA" />
    {/* Ethereum Diamond */}
    <path d="M16 5 L10 16.5 L16 20.5 L22 16.5 Z" fill="#FFFFFF" fillOpacity="0.9" />
    <path d="M16 5 L16 20.5 L22 16.5 Z" fill="#FFFFFF" fillOpacity="0.6" />
    <path d="M16 22 L10 18 L16 27 L22 18 Z" fill="#FFFFFF" fillOpacity="0.9" />
    <path d="M16 22 L16 27 L22 18 Z" fill="#FFFFFF" fillOpacity="0.6" />
  </svg>
);

const BadgeGeneric: React.FC<{ size: number; text: string; bg?: string }> = ({
  size,
  text,
  bg = '#334155',
}) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill={bg} />
    <text
      x="16"
      y="20.5"
      textAnchor="middle"
      fill="#FFFFFF"
      fontSize="10"
      fontWeight="800"
      fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    >
      {text.slice(0, 3)}
    </text>
  </svg>
);

/* ─────────────────────────────────────────────────────────────
 * Pair Resolver Engine
 * ──────────────────────────────────────────────────────────── */

function renderAssetBadge(code: string, size: number): React.ReactNode {
  const c = (code || '').toUpperCase().trim();

  // Currencies
  if (c === 'USD') return <FlagUSA size={size} />;
  if (c === 'EUR') return <FlagEUR size={size} />;
  if (c === 'GBP') return <FlagGBR size={size} />;
  if (c === 'JPY') return <FlagJPN size={size} />;
  if (c === 'AUD') return <FlagAUD size={size} />;
  if (c === 'CAD') return <FlagCAD size={size} />;
  if (c === 'CHF') return <FlagCHF size={size} />;
  if (c === 'NZD') return <FlagNZD size={size} />;
  if (c === 'DEU' || c === 'GER') return <FlagDEU size={size} />;

  // Metals
  if (c === 'XAU' || c.includes('GOLD')) return <BadgeGold size={size} />;
  if (c === 'XAG' || c.includes('SILVER')) return <BadgeSilver size={size} />;

  // Indices
  if (c.includes('NAS') || c.includes('TECH') || c.includes('100') || c.includes('NDX'))
    return <BadgeNasdaq size={size} />;
  if (c.includes('US30') || c.includes('DOW') || c.includes('DJI'))
    return <BadgeDow size={size} />;
  if (c.includes('500') || c.includes('SPX')) return <BadgeSPX size={size} />;

  // Commodities
  if (c.includes('OIL') || c.includes('WTI') || c.includes('USO') || c.includes('LIGHT') || c.includes('BRENT'))
    return <BadgeOil size={size} />;
  if (c.includes('GAS')) return <BadgeGas size={size} />;

  // Crypto
  if (c.includes('BTC')) return <BadgeBTC size={size} />;
  if (c.includes('ETH')) return <BadgeETH size={size} />;

  return <BadgeGeneric size={size} text={c} />;
}

export function resolvePairAvatars(symName: string, size: number): {
  base: React.ReactNode;
  quote: React.ReactNode;
} {
  const s = (symName || '').toUpperCase().trim();

  // 1. Metals
  if (s.includes('XAU') || s.includes('GOLD')) {
    return { base: <BadgeGold size={size} />, quote: <FlagUSA size={size} /> };
  }
  if (s.includes('XAG') || s.includes('SILVER')) {
    return { base: <BadgeSilver size={size} />, quote: <FlagUSA size={size} /> };
  }

  // 2. Indices (Dukascopy & Global)
  if (
    s.includes('USATECH') ||
    s.includes('NAS100') ||
    s.includes('USTECH') ||
    s.includes('NDX') ||
    s.includes('NASDAQ')
  ) {
    return { base: <BadgeNasdaq size={size} />, quote: <FlagUSA size={size} /> };
  }
  if (s.includes('USA30') || s.includes('US30') || s.includes('DJI') || s.includes('DOW')) {
    return { base: <BadgeDow size={size} />, quote: <FlagUSA size={size} /> };
  }
  if (s.includes('USA500') || s.includes('US500') || s.includes('SPX') || s.includes('SP500')) {
    return { base: <BadgeSPX size={size} />, quote: <FlagUSA size={size} /> };
  }
  if (s.includes('DEUIDX') || s.includes('GER40') || s.includes('DAX')) {
    return { base: <FlagDEU size={size} />, quote: <FlagEUR size={size} /> };
  }
  if (s.includes('GBRIDX') || s.includes('UK100') || s.includes('FTSE')) {
    return { base: <FlagGBR size={size} />, quote: <BadgeGeneric size={size} text="GBP" bg="#047857" /> };
  }
  if (s.includes('JPNIDX') || s.includes('JPN225') || s.includes('NIKKEI')) {
    return { base: <FlagJPN size={size} />, quote: <BadgeGeneric size={size} text="JPY" bg="#B91C1C" /> };
  }
  if (s.includes('AUSIDX') || s.includes('AUS200')) {
    return { base: <FlagAUD size={size} />, quote: <BadgeGeneric size={size} text="AUD" bg="#0369A1" /> };
  }

  // 3. Commodities & Energy
  if (
    s.includes('LIGHTCMD') ||
    s.includes('OIL') ||
    s.includes('WTI') ||
    s.includes('USO') ||
    s.includes('BRENT')
  ) {
    return { base: <BadgeOil size={size} />, quote: <FlagUSA size={size} /> };
  }
  if (s.includes('GASCMD') || s.includes('GAS') || s.includes('NGAS')) {
    return { base: <BadgeGas size={size} />, quote: <FlagUSA size={size} /> };
  }

  // 4. Crypto
  if (s.includes('BTC')) {
    return { base: <BadgeBTC size={size} />, quote: <FlagUSA size={size} /> };
  }
  if (s.includes('ETH')) {
    return { base: <BadgeETH size={size} />, quote: <FlagUSA size={size} /> };
  }

  // 5. Forex (3-letter pairs, e.g. EURUSD, GBPJPY, AUDCAD)
  const baseCode = s.slice(0, 3);
  const quoteCode = s.slice(3, 6);

  return {
    base: renderAssetBadge(baseCode, size),
    quote: renderAssetBadge(quoteCode, size),
  };
}

/**
 * Pixel-Perfect TradingView Style PairAvatar
 */
export const PairAvatar: React.FC<PairAvatarProps> = ({
  symbol,
  size = 20,
  className = '',
}) => {
  const { base, quote } = resolvePairAvatars(symbol, size);

  return (
    <div
      className={`pair-avatar ${className}`}
      style={{
        width: Math.round(size * 1.55),
        height: size,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
      }}
      title={symbol}
    >
      <div
        className="pair-avatar__base"
        style={{
          position: 'relative',
          zIndex: 2,
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
        }}
      >
        {base}
      </div>
      <div
        className="pair-avatar__quote"
        style={{
          position: 'relative',
          zIndex: 1,
          width: size,
          height: size,
          marginLeft: -Math.round(size * 0.38),
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
        }}
      >
        {quote}
      </div>
    </div>
  );
};
