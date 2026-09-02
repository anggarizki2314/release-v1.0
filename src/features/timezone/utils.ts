/**
 * Timezone utilities for Forex Replay.
 *
 * All internal timestamps are stored as UTC unix seconds.
 * This module handles conversion to display time using the selected IANA timezone.
 *
 * Architecture:
 * DATABASE (UTC) → REPLAY ENGINE (UTC) → SELECTED TIMEZONE → DISPLAY TIME
 */

export interface TimezoneItem {
  /** IANA timezone identifier, e.g. "Asia/Jakarta" */
  id: string;
  /** UTC offset in minutes at the given reference time */
  offsetMinutes: number;
  /** Formatted offset string, e.g. "UTC+07:00" */
  offsetLabel: string;
  /** Display label, e.g. "UTC+07:00 — Asia/Jakarta" */
  label: string;
}

/** Default timezone when no preference is saved. */
export const DEFAULT_TIMEZONE = 'UTC';

/** Storage key for the selected timezone. */
export const TIMEZONE_STORAGE_KEY = 'app:timezone';

/**
 * Get all available IANA timezones supported by the runtime.
 * Uses Intl.supportedValuesOf('timeZone') with a safe fallback.
 */
export function getAllTimezoneIds(): string[] {
  try {
    if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
      return (Intl as any).supportedValuesOf('timeZone') as string[];
    }
  } catch {
    // Fallback if API not available
  }
  // Minimal fallback list covering major timezones
  return [
    'UTC',
    'Pacific/Midway', 'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles',
    'America/Denver', 'America/Chicago', 'America/New_York', 'America/Caracas',
    'America/Halifax', 'America/St_Johns', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires',
    'Atlantic/South_Georgia', 'Atlantic/Azores', 'Europe/London', 'Europe/Paris',
    'Europe/Berlin', 'Europe/Moscow', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata',
    'Asia/Kathmandu', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Singapore',
    'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Perth', 'Australia/Darwin',
    'Australia/Adelaide', 'Australia/Sydney', 'Pacific/Noumea', 'Pacific/Auckland',
    'Pacific/Chatham', 'Pacific/Tongatapu', 'Pacific/Kiritimati',
  ];
}

/**
 * Get the UTC offset in minutes for a timezone at a given UTC timestamp.
 * Handles DST automatically via Intl.DateTimeFormat.
 */
/**
 * Get the UTC offset in minutes for a timezone at a given UTC timestamp.
 * Handles DST automatically via Intl.DateTimeFormat.
 */
export function getUtcOffsetMinutes(timezone: string, utcSeconds: number): number {
  if (timezone === 'UTC' || !timezone) return 0;
  const date = new Date(utcSeconds * 1000);
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);

    const localYear = get('year');
    const localMonth = get('month');
    const localDay = get('day');
    let localHour = get('hour');
    if (localHour === 24) localHour = 0;
    const localMinute = get('minute');
    const localSecond = get('second');

    const localAsUtc = Date.UTC(localYear, localMonth - 1, localDay, localHour, localMinute, localSecond);
    return Math.round((localAsUtc - date.getTime()) / 60000);
  } catch {
    return 0;
  }
}

/**
 * Format a UTC timestamp in a given timezone.
 * Returns formatted string like "2024-01-03 18:39".
 */
export function formatTimestampInTimezone(utcSeconds: number, timezone: string): string {
  if (utcSeconds === null || utcSeconds === undefined || isNaN(utcSeconds)) return '—';
  const date = new Date(utcSeconds * 1000);
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
    const year = get('year');
    const month = get('month');
    const day = get('day');
    let hour = get('hour');
    if (hour === '24') hour = '00';
    const minute = get('minute');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  } catch {
    return formatTimestampUTC(utcSeconds);
  }
}

/**
 * Parse a local date/time string (e.g. "2024-01-03 18:39" or "2024-01-03") in a given IANA timezone
 * and return the corresponding UTC unix timestamp in seconds.
 * Calculates DST offset at the specified target instant.
 */
export function parseDateTimeInTimezone(dateTimeStr: string, timezone: string): number {
  const normalized = dateTimeStr.trim().replace('T', ' ').replace('Z', '');
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) {
    throw new Error(`Invalid date format "${dateTimeStr}", expected YYYY-MM-DD [HH:MM[:SS]]`);
  }

  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  const hh = match[4] ? parseInt(match[4], 10) : 0;
  const mm = match[5] ? parseInt(match[5], 10) : 0;
  const ss = match[6] ? parseInt(match[6], 10) : 0;

  const baseUtcMs = Date.UTC(y, m - 1, d, hh, mm, ss);
  const baseUtcSec = Math.floor(baseUtcMs / 1000);
  const offsetMinutes = getUtcOffsetMinutes(timezone, baseUtcSec);
  return baseUtcSec - offsetMinutes * 60;
}

/**
 * Format a UTC timestamp as UTC string (fallback).
 */
export function formatTimestampUTC(utcSeconds: number): string {
  const date = new Date(utcSeconds * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Format offset minutes to a string like "UTC+07:00" or "UTC-05:00".
 */
export function formatOffsetLabel(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `UTC${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Build the full sorted timezone list for a given reference time (UTC seconds).
 * Sorted by offset (ascending), then by IANA id alphabetically.
 */
export function buildTimezoneList(referenceUtcSeconds: number): TimezoneItem[] {
  const ids = getAllTimezoneIds();
  const items: TimezoneItem[] = ids.map((id) => {
    const offsetMinutes = getUtcOffsetMinutes(id, referenceUtcSeconds);
    const offsetLabel = formatOffsetLabel(offsetMinutes);
    return {
      id,
      offsetMinutes,
      offsetLabel,
      label: `${offsetLabel} — ${id}`,
    };
  });

  // Sort by offset ascending, then by id alphabetically
  items.sort((a, b) => {
    if (a.offsetMinutes !== b.offsetMinutes) return a.offsetMinutes - b.offsetMinutes;
    return a.id.localeCompare(b.id);
  });

  return items;
}

/**
 * Validate that a string is a valid IANA timezone identifier.
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Search/filter timezone list by query string.
 * Matches against IANA id and offset label. Case-insensitive.
 */
export function filterTimezones(items: TimezoneItem[], query: string): TimezoneItem[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase();
  return items.filter(
    (item) =>
      item.id.toLowerCase().includes(q) ||
      item.offsetLabel.toLowerCase().includes(q) ||
      item.label.toLowerCase().includes(q)
  );
}

/**
 * Format a UTC timestamp for chart tick marks based on tick mark type.
 * Used by Lightweight Charts tickMarkFormatter.
 *
 * @param utcSeconds - UTC unix timestamp
 * @param timezone - IANA timezone identifier
 * @param tickMarkType - The type of tick mark (Year, Month, Day, Time, TimeWithSeconds)
 * @returns Formatted string (max 8 chars recommended)
 */
export function formatTickMark(
  utcSeconds: number,
  timezone: string,
  tickMarkType: number
): string {
  const date = new Date(utcSeconds * 1000);
  try {
    const getPart = (type: string) => {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        [type]: 'numeric',
      });
      return parseInt(fmt.format(date), 10);
    };

    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const hours = getPart('hour');
    const minutes = getPart('minute');
    const seconds = getPart('second');

    // TickMarkType: 0=Year, 1=Month, 2=DayOfMonth, 3=Time, 4=TimeWithSeconds
    switch (tickMarkType) {
      case 0: // Year
        return `${year}`;
      case 1: // Month
        return `${year}-${String(month).padStart(2, '0')}`;
      case 2: // Day
        return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      case 3: // Time (HH:MM)
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      case 4: // TimeWithSeconds (HH:MM:SS)
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      default:
        return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  } catch {
    // Fallback to UTC
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
  }
}

/**
 * Convert local date string "YYYY-MM-DD" (or other formats) at 00:00:00 in the given IANA timezone to UTC unix seconds.
 * Uses Intl offset calculation at the target date to ensure DST accuracy.
 */
export function localDateToUtcSeconds(dateStr: string, timezone: string): number {
  if (!dateStr) return 0;
  let clean = String(dateStr).trim();
  if (clean.includes('T')) clean = clean.split('T')[0];

  const parts = clean.split(/[-/.]/).map((p) => parseInt(p, 10));
  if (parts.length < 3 || parts.some(isNaN)) {
    const t = Math.floor(new Date(clean).getTime() / 1000);
    return isNaN(t) || t <= 0 ? 0 : t;
  }

  let y = parts[0];
  let m = parts[1];
  let d = parts[2];

  // If format was DD/MM/YYYY or MM/DD/YYYY (year is 4 digits at the end)
  if (parts[2] > 1000) {
    y = parts[2];
    if (parts[0] > 12) {
      d = parts[0];
      m = parts[1];
    } else {
      m = parts[0];
      d = parts[1];
    }
  }

  const baseUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0);
  const baseUtcSec = Math.floor(baseUtcMs / 1000);
  try {
    const offsetMinutes = getUtcOffsetMinutes(timezone || 'UTC', baseUtcSec);
    return baseUtcSec - offsetMinutes * 60;
  } catch {
    return baseUtcSec;
  }
}

/**
 * Subtract N calendar days from a "YYYY-MM-DD" date string in local date space.
 * e.g., "2023-01-02" - 3 days = "2022-12-30"
 */
export function subtractCalendarDays(dateStr: string, days: number): string {
  if (!dateStr) return '';
  let clean = String(dateStr).trim();
  if (clean.includes('T')) clean = clean.split('T')[0];

  const parts = clean.split(/[-/.]/).map((p) => parseInt(p, 10));
  if (parts.length < 3 || parts.some(isNaN)) {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      d.setUTCDate(d.getUTCDate() - Math.max(0, Math.floor(days)));
      return d.toISOString().split('T')[0];
    }
    return clean;
  }

  let y = parts[0];
  let m = parts[1];
  let d = parts[2];

  if (parts[2] > 1000) {
    y = parts[2];
    if (parts[0] > 12) {
      d = parts[0];
      m = parts[1];
    } else {
      m = parts[0];
      d = parts[1];
    }
  }

  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - Math.max(0, Math.floor(days)));
  const resY = date.getUTCFullYear();
  const resM = String(date.getUTCMonth() + 1).padStart(2, '0');
  const resD = String(date.getUTCDate()).padStart(2, '0');
  return `${resY}-${resM}-${resD}`;
}

