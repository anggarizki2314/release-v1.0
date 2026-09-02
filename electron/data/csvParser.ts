import fs from 'fs';
import readline from 'readline';

// Main-process CSV parsing. Streams the file line-by-line (readline
// over a read stream) so multi-million-row files never sit fully in
// memory — rows are handed to the caller in batches instead.

export interface RawCandle {
  time: number; // unix seconds (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ParseResult {
  totalRows: number;
  skippedRows: number;
  outOfOrderRows: number;
  firstTime: number | null;
  lastTime: number | null;
  detectedTimeframeSeconds: number | null;
}

const HEADER_ALIASES = {
  date: ['date'],
  time: ['time'],
  datetime: ['datetime', 'timestamp'],
  open: ['open'],
  high: ['high'],
  low: ['low'],
  close: ['close'],
  volume: ['volume', 'vol', 'tickvol', 'tick_volume'],
};

function detectDelimiter(line: string): string {
  if (line.includes('\t')) return '\t';
  if (line.includes(';')) return ';';
  return ',';
}

function looksLikeHeader(cells: string[]): boolean {
  // A header row has non-numeric first cell (e.g. "Date" vs "2023.01.02")
  return Number.isNaN(Number(cells[0].replace(/[.\-/]/g, '')));
}

function buildHeaderMap(cells: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  cells.forEach((raw, idx) => {
    const cell = raw.trim().toLowerCase();
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(cell)) map[key] = idx;
    }
  });
  return map;
}

// Parses "2023.01.02" / "2023-01-02" / "2023/01/02" (+ optional time
// in the same cell) combined with an optional separate time cell.
function parseDateTime(dateCell: string, timeCell: string | undefined): number | null {
  const d = dateCell.trim().replace(/[./]/g, '-');
  const dateMatch = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) return null;
  const [, y, mo, da] = dateMatch;

  let h = 0,
    mi = 0,
    s = 0;
  const t = (timeCell ?? '').trim();
  const timeMatch = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch) {
    h = Number(timeMatch[1]);
    mi = Number(timeMatch[2]);
    s = timeMatch[3] ? Number(timeMatch[3]) : 0;
  }

  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(da), h, mi, s);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

const NUMERIC_CELL = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

/**
 * Handles a "timestamp" column that is a raw epoch number rather than
 * a formatted date string — including Excel/pandas-style scientific
 * notation ("1.73577E+12"). Disambiguates seconds vs. milliseconds by
 * magnitude (13-digit numbers are ms, 10-digit are seconds), since
 * that's the only signal available without a units column. Falls
 * back to parseDateTime for anything that isn't purely numeric.
 */
function parseTimestampCell(cell: string, timeCell?: string): number | null {
  const trimmed = cell.trim();
  if (NUMERIC_CELL.test(trimmed)) {
    const num = Number(trimmed);
    if (Number.isFinite(num) && num > 0) {
      let timeInSeconds = num;
      if (timeInSeconds > 100000000000) {
        timeInSeconds = Math.floor(timeInSeconds / 1000);
      }
      return Math.round(timeInSeconds);
    }
  }
  return parseDateTime(trimmed, timeCell);
}

const STANDARD_TF_SECONDS: Record<string, number> = {
  M1: 60,
  M5: 300,
  M15: 900,
  M30: 1800,
  H1: 3600,
  H4: 14400,
  D1: 86400,
  W1: 604800,
};

export function nearestStandardTimeframe(seconds: number): { key: string; seconds: number } {
  let best = 'M1';
  let bestDiff = Infinity;
  for (const [key, val] of Object.entries(STANDARD_TF_SECONDS)) {
    const diff = Math.abs(val - seconds);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = key;
    }
  }
  return { key: best, seconds: STANDARD_TF_SECONDS[best] };
}

/**
 * Reads only the first `maxLines` data rows to guess the file's native
 * timeframe before committing to a full streaming parse+insert pass.
 * Keeps memory bounded (a few hundred timestamps, not the whole file)
 * while letting the importer know the timeframe up front.
 */
export async function sniffTimeframe(
  filePath: string,
  maxLines = 500
): Promise<{ key: string; seconds: number | null }> {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let delimiter = ',';
  let headerMap: Record<string, number> | null = null;
  let isFirstLine = true;
  let prevTime: number | null = null;
  let sampled = 0;
  const deltaCounts = new Map<number, number>();

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isFirstLine) {
      delimiter = detectDelimiter(line);
      isFirstLine = false;
      const cells = line.split(delimiter);
      if (looksLikeHeader(cells)) {
        headerMap = buildHeaderMap(cells);
        continue;
      }
    }

    const cells = line.split(delimiter);
    let time: number | null = null;
    if (headerMap) {
      if (headerMap.datetime !== undefined) {
        time = parseTimestampCell(cells[headerMap.datetime]);
      } else if (headerMap.date !== undefined) {
        time = parseDateTime(
          cells[headerMap.date],
          headerMap.time !== undefined ? cells[headerMap.time] : undefined
        );
      }
    } else if (cells.length >= 6) {
      time = parseDateTime(cells[0], cells[1]);
    }

    if (time !== null) {
      if (prevTime !== null) {
        const delta = time - prevTime;
        if (delta > 0) deltaCounts.set(delta, (deltaCounts.get(delta) ?? 0) + 1);
      }
      prevTime = time;
      sampled++;
    }

    if (sampled >= maxLines) break;
  }
  rl.close();

  let bestDelta: number | null = null;
  let bestCount = 0;
  for (const [delta, count] of deltaCounts) {
    if (count > bestCount) {
      bestCount = count;
      bestDelta = delta;
    }
  }

  if (bestDelta === null) return { key: 'M1', seconds: null };
  const nearest = nearestStandardTimeframe(bestDelta);
  return { key: nearest.key, seconds: bestDelta };
}

/**
 * Streams a CSV file and invokes `onBatch` with up to `batchSize`
 * parsed rows at a time. Malformed lines are skipped and counted
 * rather than aborting the whole import.
 */
export async function parseCsvFile(
  filePath: string,
  onBatch: (rows: RawCandle[]) => void,
  batchSize = 5000
): Promise<ParseResult> {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let delimiter = ',';
  let headerMap: Record<string, number> | null = null;
  let isFirstLine = true;

  let batch: RawCandle[] = [];
  let totalRows = 0;
  let skippedRows = 0;
  let outOfOrderRows = 0;
  let firstTime: number | null = null;
  let lastTime: number | null = null;
  let prevTime: number | null = null;

  // Timeframe detection sample: deltas between consecutive rows.
  const deltaCounts = new Map<number, number>();
  const MAX_DELTA_SAMPLES = 500;

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isFirstLine) {
      delimiter = detectDelimiter(line);
      isFirstLine = false;
      const cells = line.split(delimiter);
      if (looksLikeHeader(cells)) {
        headerMap = buildHeaderMap(cells);
        continue; // header consumed, not a data row
      }
      // No header — fall through and parse this line as data below.
    }

    const cells = line.split(delimiter);

    let time: number | null = null;
    let open: number, high: number, low: number, close: number, volume: number | undefined;

    if (headerMap) {
      const dateIdx = headerMap.date;
      const timeIdx = headerMap.time;
      const datetimeIdx = headerMap.datetime;
      if (datetimeIdx !== undefined) {
        time = parseTimestampCell(cells[datetimeIdx]);
      } else if (dateIdx !== undefined) {
        time = parseDateTime(cells[dateIdx], timeIdx !== undefined ? cells[timeIdx] : undefined);
      }
      open = Number(cells[headerMap.open]);
      high = Number(cells[headerMap.high]);
      low = Number(cells[headerMap.low]);
      close = Number(cells[headerMap.close]);
      volume = headerMap.volume !== undefined ? Number(cells[headerMap.volume]) : undefined;
    } else {
      // Positional fallback (common MT4-style export, no header):
      // date, time, open, high, low, close [, volume]
      if (cells.length < 6) {
        skippedRows++;
        continue;
      }
      time = parseDateTime(cells[0], cells[1]);
      open = Number(cells[2]);
      high = Number(cells[3]);
      low = Number(cells[4]);
      close = Number(cells[5]);
      volume = cells[6] !== undefined ? Number(cells[6]) : undefined;
    }

    if (
      time === null ||
      Number.isNaN(open!) ||
      Number.isNaN(high!) ||
      Number.isNaN(low!) ||
      Number.isNaN(close!)
    ) {
      skippedRows++;
      continue;
    }

    // Basic OHLC sanity: prices must be positive and internally
    // consistent (high is really the highest, low really the lowest).
    // Catches corrupted/garbled rows without being so strict that
    // legitimate flat candles (open=high=low=close) get rejected.
    if (
      open! <= 0 ||
      high! <= 0 ||
      low! <= 0 ||
      close! <= 0 ||
      high! < low! ||
      high! < open! ||
      high! < close! ||
      low! > open! ||
      low! > close!
    ) {
      skippedRows++;
      continue;
    }

    if (prevTime !== null) {
      const delta = time - prevTime;
      if (delta <= 0) {
        outOfOrderRows++;
      } else if (deltaCounts.size < MAX_DELTA_SAMPLES || deltaCounts.has(delta)) {
        deltaCounts.set(delta, (deltaCounts.get(delta) ?? 0) + 1);
      }
    }
    prevTime = time;
    if (firstTime === null) firstTime = time;
    lastTime = time;

    batch.push({ time, open: open!, high: high!, low: low!, close: close!, volume });
    totalRows++;

    if (batch.length >= batchSize) {
      onBatch(batch);
      batch = [];
    }
  }

  if (batch.length > 0) onBatch(batch);

  // Most frequent delta = detected native timeframe of this file.
  let detectedTimeframeSeconds: number | null = null;
  let bestCount = 0;
  for (const [delta, count] of deltaCounts) {
    if (count > bestCount) {
      bestCount = count;
      detectedTimeframeSeconds = delta;
    }
  }

  return { totalRows, skippedRows, outOfOrderRows, firstTime, lastTime, detectedTimeframeSeconds };
}
