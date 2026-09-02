export interface QuarterLevel {
  price: number;
  label: string;
  type: 'major-whole' | 'major-half' | 'major-quarter' | 'small-quarter';
}

/**
 * Calculates Quarter Theory levels covering the current visible min/max price range.
 */
export function calculateQuarterLevels(
  minPrice: number,
  maxPrice: number,
  symbol?: string
): QuarterLevel[] {
  if (minPrice <= 0 || maxPrice <= 0 || minPrice >= maxPrice) return [];

  const sym = symbol ? symbol.toUpperCase() : '';
  const isJpy = sym.includes('JPY');
  const isGold = sym.includes('XAU') || sym.includes('GOLD');
  const isCrypto = sym.includes('BTC') || sym.includes('ETH');

  // Determine standard 1000 pip, 500 pip, 250 pip, 50 pip intervals based on asset class
  let majorWholeStep = 0.01; // default 1000 pips for 5-decimal FX (0.01000)
  if (minPrice > 500 && minPrice < 5000) {
    // Gold or Indices
    majorWholeStep = isGold ? 10 : 50;
  } else if (isCrypto || minPrice >= 5000) {
    // Bitcoin or High Value Crypto
    majorWholeStep = 1000;
  } else if (isJpy || (minPrice > 50 && minPrice <= 500)) {
    // JPY pairs (e.g. USDJPY 155.00)
    majorWholeStep = 1.0;
  } else {
    // Standard FX (EURUSD 1.0800, GBPUSD 1.2800)
    majorWholeStep = 0.01; // 100 pips / 1000 points
  }

  const majorHalfStep = majorWholeStep / 2;
  const majorQuarterStep = majorWholeStep / 4;
  const smallQuarterStep = majorWholeStep / 20; // 5 pips / hesitation point

  // Expand range slightly to ensure seamless edge-to-edge coverage
  const pad = (maxPrice - minPrice) * 0.15;
  const startPrice = Math.floor((minPrice - pad) / majorQuarterStep) * majorQuarterStep;
  const endPrice = Math.ceil((maxPrice + pad) / majorQuarterStep) * majorQuarterStep;

  const levels: QuarterLevel[] = [];
  const precision = isJpy ? 3 : (isGold ? 2 : (isCrypto ? 1 : 5));

  for (let p = startPrice; p <= endPrice + 0.0000001; p += majorQuarterStep) {
    const rounded = Number(p.toFixed(precision));

    // Check if it's Major Whole, Major Half, or Major Quarter
    const remWhole = Math.abs(Math.round(rounded / majorWholeStep) * majorWholeStep - rounded);
    const remHalf = Math.abs(Math.round(rounded / majorHalfStep) * majorHalfStep - rounded);

    let type: QuarterLevel['type'] = 'major-quarter';
    let label = `${rounded.toFixed(precision)} (Major Quarter)`;

    if (remWhole < 0.000001) {
      type = 'major-whole';
      label = `${rounded.toFixed(precision)} [Major Whole]`;
    } else if (remHalf < 0.000001) {
      type = 'major-half';
      label = `${rounded.toFixed(precision)} [Major Half-Point]`;
    }

    levels.push({
      price: rounded,
      label,
      type,
    });
  }

  return levels;
}
