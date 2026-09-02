import React from 'react';

export interface CountryFlagProps {
  countryOrCurrency: string;
  size?: number; // diameter in px
  className?: string;
  style?: React.CSSProperties;
}

export const CountryFlag: React.FC<CountryFlagProps> = ({
  countryOrCurrency,
  size = 14,
  className = '',
  style = {},
}) => {
  const code = (countryOrCurrency || 'USD').toUpperCase().trim();

  const containerStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    overflow: 'hidden',
    boxShadow: '0 0 0 1px rgba(0,0,0,0.25)',
    flexShrink: 0,
    verticalAlign: 'middle',
    ...style,
  };

  // 1. United States (USD / US)
  if (code === 'USD' || code === 'US') {
    return (
      <span className={`country-flag country-flag--us ${className}`} style={containerStyle}>
        <svg viewBox="0 0 24 16" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
          {/* Stripes */}
          <rect width="24" height="16" fill="#b91c1c" />
          <rect y="2.46" width="24" height="2.46" fill="#ffffff" />
          <rect y="7.38" width="24" height="2.46" fill="#ffffff" />
          <rect y="12.3" width="24" height="2.46" fill="#ffffff" />
          {/* Canton */}
          <rect width="10" height="8.8" fill="#1e3a8a" />
          {/* Stars representation */}
          <circle cx="2.5" cy="2.2" r="0.7" fill="#ffffff" />
          <circle cx="5" cy="2.2" r="0.7" fill="#ffffff" />
          <circle cx="7.5" cy="2.2" r="0.7" fill="#ffffff" />
          <circle cx="3.75" cy="4.4" r="0.7" fill="#ffffff" />
          <circle cx="6.25" cy="4.4" r="0.7" fill="#ffffff" />
          <circle cx="2.5" cy="6.6" r="0.7" fill="#ffffff" />
          <circle cx="5" cy="6.6" r="0.7" fill="#ffffff" />
          <circle cx="7.5" cy="6.6" r="0.7" fill="#ffffff" />
        </svg>
      </span>
    );
  }

  // 2. European Union (EUR / EU / DE / FR)
  if (code === 'EUR' || code === 'EU' || code === 'DE' || code === 'FR' || code === 'EMU') {
    return (
      <span className={`country-flag country-flag--eu ${className}`} style={containerStyle}>
        <svg viewBox="0 0 24 16" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
          <rect width="24" height="16" fill="#003399" />
          {/* Circle of 12 Stars */}
          <g fill="#ffcc00" transform="translate(12, 8)">
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const cx = Math.cos(rad) * 4.6;
              const cy = Math.sin(rad) * 4.6;
              return <circle key={deg} cx={cx} cy={cy} r="0.6" />;
            })}
          </g>
        </svg>
      </span>
    );
  }

  // 3. Great Britain / United Kingdom (GBP / GB / UK)
  if (code === 'GBP' || code === 'GB' || code === 'UK') {
    return (
      <span className={`country-flag country-flag--gb ${className}`} style={containerStyle}>
        <svg viewBox="0 0 24 16" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
          <rect width="24" height="16" fill="#012169" />
          {/* White Diagonals */}
          <path d="M0,0 L24,16 M24,0 L0,16" stroke="#ffffff" strokeWidth="3" />
          {/* Red Diagonals */}
          <path d="M0,0 L12,8 M24,0 L12,8 M0,16 L12,8 M24,16 L12,8" stroke="#c8102e" strokeWidth="1.6" />
          {/* White Cross */}
          <path d="M12,0 V16 M0,8 H24" stroke="#ffffff" strokeWidth="5" />
          {/* Red Cross */}
          <path d="M12,0 V16 M0,8 H24" stroke="#c8102e" strokeWidth="3" />
        </svg>
      </span>
    );
  }

  // 4. Japan (JPY / JP)
  if (code === 'JPY' || code === 'JP') {
    return (
      <span className={`country-flag country-flag--jp ${className}`} style={containerStyle}>
        <svg viewBox="0 0 24 16" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
          <rect width="24" height="16" fill="#ffffff" />
          <circle cx="12" cy="8" r="4.5" fill="#bc002d" />
        </svg>
      </span>
    );
  }

  // 5. Australia (AUD / AU)
  if (code === 'AUD' || code === 'AU') {
    return (
      <span className={`country-flag country-flag--au ${className}`} style={containerStyle}>
        <svg viewBox="0 0 24 16" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
          <rect width="24" height="16" fill="#00008b" />
          {/* Mini Union Jack Canton */}
          <g transform="scale(0.42)">
            <rect width="24" height="16" fill="#012169" />
            <path d="M0,0 L24,16 M24,0 L0,16" stroke="#ffffff" strokeWidth="3" />
            <path d="M12,0 V16 M0,8 H24" stroke="#ffffff" strokeWidth="5" />
            <path d="M12,0 V16 M0,8 H24" stroke="#c8102e" strokeWidth="3" />
          </g>
          {/* Commonwealth Star */}
          <circle cx="6" cy="11.5" r="1.5" fill="#ffffff" />
          {/* Southern Cross */}
          <circle cx="18" cy="3.5" r="0.6" fill="#ffffff" />
          <circle cx="16.5" cy="6.5" r="0.6" fill="#ffffff" />
          <circle cx="19.5" cy="8" r="0.6" fill="#ffffff" />
          <circle cx="18" cy="12.5" r="0.8" fill="#ffffff" />
          <circle cx="18.8" cy="9.2" r="0.4" fill="#ffffff" />
        </svg>
      </span>
    );
  }

  // 6. Canada (CAD / CA)
  if (code === 'CAD' || code === 'CA') {
    return (
      <span className={`country-flag country-flag--ca ${className}`} style={containerStyle}>
        <svg viewBox="0 0 24 16" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
          <rect width="24" height="16" fill="#ff0000" />
          <rect x="6" width="12" height="16" fill="#ffffff" />
          {/* Maple Leaf */}
          <path
            d="M12,3 L13.2,5.8 L15.5,5.2 L14.5,7.2 L16.8,8.8 L14,9.2 L14.8,11.5 L12.6,10.5 L12,13 L11.4,10.5 L9.2,11.5 L10,9.2 L7.2,8.8 L9.5,7.2 L8.5,5.2 L10.8,5.8 Z"
            fill="#ff0000"
          />
        </svg>
      </span>
    );
  }

  // 7. Switzerland (CHF / CH)
  if (code === 'CHF' || code === 'CH') {
    return (
      <span className={`country-flag country-flag--ch ${className}`} style={containerStyle}>
        <svg viewBox="0 0 24 16" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
          <rect width="24" height="16" fill="#d52b1e" />
          <rect x="10.5" y="4" width="3" height="8" fill="#ffffff" />
          <rect x="7" y="6.5" width="10" height="3" fill="#ffffff" />
        </svg>
      </span>
    );
  }

  // 8. New Zealand (NZD / NZ)
  if (code === 'NZD' || code === 'NZ') {
    return (
      <span className={`country-flag country-flag--nz ${className}`} style={containerStyle}>
        <svg viewBox="0 0 24 16" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
          <rect width="24" height="16" fill="#00247d" />
          {/* Mini Union Jack Canton */}
          <g transform="scale(0.42)">
            <rect width="24" height="16" fill="#012169" />
            <path d="M0,0 L24,16 M24,0 L0,16" stroke="#ffffff" strokeWidth="3" />
            <path d="M12,0 V16 M0,8 H24" stroke="#ffffff" strokeWidth="5" />
            <path d="M12,0 V16 M0,8 H24" stroke="#c8102e" strokeWidth="3" />
          </g>
          {/* Red Stars with white borders */}
          <circle cx="18" cy="3.5" r="0.8" fill="#cc142b" stroke="#ffffff" strokeWidth="0.4" />
          <circle cx="16.5" cy="6.5" r="0.8" fill="#cc142b" stroke="#ffffff" strokeWidth="0.4" />
          <circle cx="19.5" cy="8" r="0.8" fill="#cc142b" stroke="#ffffff" strokeWidth="0.4" />
          <circle cx="18" cy="12.5" r="1.0" fill="#cc142b" stroke="#ffffff" strokeWidth="0.4" />
        </svg>
      </span>
    );
  }

  // Fallback: Two-letter badge
  return (
    <span
      className={`country-flag country-flag--generic ${className}`}
      style={{
        ...containerStyle,
        background: '#334155',
        color: '#f8fafc',
        fontSize: '8px',
        fontWeight: 700,
        letterSpacing: '0.2px',
      }}
    >
      {code.slice(0, 2)}
    </span>
  );
};
