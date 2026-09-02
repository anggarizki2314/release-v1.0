/**
 * utils/timezone.ts
 *
 * Fast Daylight Saving Time (DST) calculator for New York Time.
 * Used for high-performance UTC -> NY Close bucket alignment during aggregation.
 */

// Cached values to avoid Date object creation in hot loops
let lastYear = 0;
let lastYearStart = 0;
let lastYearEnd = 0;
let dstStart = 0;
let dstEnd = 0;

/**
 * Determines if a given UTC timestamp (in seconds) falls under US Daylight Saving Time (EDT).
 * Rule (since 2007):
 * - Starts: 2nd Sunday of March at 02:00 local time (07:00 UTC)
 * - Ends: 1st Sunday of November at 02:00 local time (06:00 UTC)
 */
export function isUSDSTFast(timeUTC: number): boolean {
  // Fast path: cache hit
  if (timeUTC >= lastYearStart && timeUTC < lastYearEnd) {
    return timeUTC >= dstStart && timeUTC < dstEnd;
  }

  // Cache miss: compute boundaries for the year
  const d = new Date(timeUTC * 1000);
  const year = d.getUTCFullYear();

  lastYear = year;
  lastYearStart = Date.UTC(year, 0, 1) / 1000;
  lastYearEnd = Date.UTC(year + 1, 0, 1) / 1000;

  // Find 2nd Sunday in March
  const march1 = new Date(Date.UTC(year, 2, 1));
  const march2ndSundayDate = 1 + ((7 - march1.getUTCDay()) % 7) + 7;
  dstStart = Date.UTC(year, 2, march2ndSundayDate, 7, 0, 0) / 1000;

  // Find 1st Sunday in November
  const nov1 = new Date(Date.UTC(year, 10, 1));
  const nov1stSundayDate = 1 + ((7 - nov1.getUTCDay()) % 7);
  dstEnd = Date.UTC(year, 10, nov1stSundayDate, 6, 0, 0) / 1000;

  return timeUTC >= dstStart && timeUTC < dstEnd;
}

/**
 * Gets the UTC anchor for New York Close (17:00 NY Time)
 * @param timeUTC timestamp in seconds
 * @returns 21:00 UTC in summer, 22:00 UTC in winter
 */
export function getNYCloseAnchor(timeUTC: number): number {
  return isUSDSTFast(timeUTC) ? 21 * 3600 : 22 * 3600;
}
