import path from 'path';

// Heuristics to figure out which symbol a CSV file belongs to.
//
// Priority 1: parent folder name, matching the documented convention
//   Data/XAUUSD/2023-01.csv — but only if the folder actually looks
//   like a symbol (has a letter, isn't a bare year like "2026").
//
// Priority 2: the filename itself. Two shapes are handled:
//   - Broker export style: "usatechidxusd-m1-bid-2026-01-01-2026-02-01.csv"
//     (symbol, then timeframe/side/date tokens — Dukascopy and similar)
//   - Simple style: "XAUUSD_2023-01.csv" (symbol, then a date)
//   Both are handled by taking every token up to the first one that
//   looks like a timeframe, bid/ask side, or a bare number (date part).

// Real symbols vary a lot in length (XAUUSD, NAS100, USATECHIDXUSD),
// but always contain at least one letter — that's what rules out a
// folder/token that's actually just a year like "2026".
const SYMBOL_LIKE = /^(?=.*[A-Z])[A-Z0-9]{2,15}$/;
const LOOKS_LIKE_YEAR = /^(19|20)\d{2}$/;
const TIMEFRAME_TOKEN = /^(tick|m1|m5|m15|m30|h1|h4|d1|w1|mn1)$/i;
const SIDE_TOKEN = /^(bid|ask|bidask)$/i;

function isStopToken(token: string): boolean {
  if (/^\d+$/.test(token)) return true; // pure-number date component (2026, 01, 01...)
  if (TIMEFRAME_TOKEN.test(token)) return true;
  if (SIDE_TOKEN.test(token)) return true;
  return false;
}

function isValidSymbol(candidate: string): boolean {
  return SYMBOL_LIKE.test(candidate) && !LOOKS_LIKE_YEAR.test(candidate);
}

function guessFromFilename(fileName: string): string {
  const base = fileName.replace(/\.csv$/i, '');
  const tokens = base.split(/[-_.\s]+/).filter(Boolean);

  const stopIdx = tokens.findIndex(isStopToken);
  const symbolTokens = stopIdx > 0 ? tokens.slice(0, stopIdx) : tokens;
  const candidate = symbolTokens.join('').toUpperCase();

  return isValidSymbol(candidate) ? candidate : 'UNKNOWN';
}

export function detectSymbol(filePath: string): string {
  const parentFolder = path.basename(path.dirname(filePath)).toUpperCase();
  if (isValidSymbol(parentFolder)) return parentFolder;
  return guessFromFilename(path.basename(filePath));
}
