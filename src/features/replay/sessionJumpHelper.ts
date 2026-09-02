export type SessionJumpType =
  | 'MIDNIGHT_OPEN'
  | 'LONDON_OPEN'
  | 'NY_OPEN'
  | 'WALL_STREET_OPEN'
  | 'LONDON_CLOSE'
  | 'ASIA_OPEN'
  | 'NEXT_MACRO'
  | 'MACRO_LONDON_PRE'
  | 'MACRO_NY_AM_1'
  | 'MACRO_NY_AM_2'
  | 'MACRO_NY_AM_3'
  | 'NEXT_H4'
  | 'NEXT_DAY'
  | 'NEXT_DAY_SAME_TIME'
  | 'NEXT_WEEK_OPEN'
  | 'HIGH_IMPACT_NEWS';

import { getNYCloseAnchor, isUSDSTFast } from '@/utils/timezone';

/**
 * Converts a given New York local time on a specific date to a UTC timestamp (seconds).
 * Automatically accounts for US Daylight Saving Time (EDT vs EST).
 */
function getNYTimeInUTC(y: number, m: number, date: number, nyHour: number, nyMinute: number, nySecond: number = 0): number {
  const midnightUTC = Math.floor(Date.UTC(y, m, date, 0, 0, 0) / 1000);
  const isSummer = isUSDSTFast(midnightUTC);
  const offset = isSummer ? 4 : 5; // EDT is UTC-4, EST is UTC-5
  return Math.floor(Date.UTC(y, m, date, nyHour + offset, nyMinute, nySecond) / 1000);
}

export interface SessionJumpOption {
  type: SessionJumpType;
  label: string;
  subLabel?: string;
  timeInfo: string;
  category: 'session' | 'macro' | 'time' | 'news';
}

export const SESSION_JUMP_OPTIONS: SessionJumpOption[] = [
  {
    type: 'MIDNIGHT_OPEN',
    label: 'NY Midnight Open',
    timeInfo: '11:00 WIB • 00:00 NY',
    category: 'session',
  },
  {
    type: 'LONDON_OPEN',
    label: 'London Open',
    timeInfo: '14:00 WIB • 07:00 UTC',
    category: 'session',
  },
  {
    type: 'NY_OPEN',
    label: 'NY Open',
    timeInfo: '19:00 WIB • 12:00 UTC',
    category: 'session',
  },
  {
    type: 'WALL_STREET_OPEN',
    label: 'Wall Street (Equities)',
    timeInfo: '20:30 WIB • 09:30 NY',
    category: 'session',
  },
  {
    type: 'LONDON_CLOSE',
    label: 'London Close',
    timeInfo: '21:00 WIB • 10:00 NY',
    category: 'session',
  },
  {
    type: 'ASIA_OPEN',
    label: 'Asia Open',
    timeInfo: '07:00 WIB • 00:00 UTC',
    category: 'session',
  },
  {
    type: 'NEXT_MACRO',
    label: 'Next ICT Macro (Auto)',
    timeInfo: 'Jendela Terdekat',
    category: 'macro',
  },
  {
    type: 'MACRO_LONDON_PRE',
    label: 'London Pre-Open Macro',
    timeInfo: '13:33 WIB • 02:33 NY',
    category: 'macro',
  },
  {
    type: 'MACRO_NY_AM_1',
    label: 'NY AM Macro 1 (Pre-Open)',
    timeInfo: '19:50 WIB • 08:50 NY',
    category: 'macro',
  },
  {
    type: 'MACRO_NY_AM_2',
    label: 'NY AM Macro 2 (Silver Bullet)',
    timeInfo: '20:50 WIB • 09:50 NY',
    category: 'macro',
  },
  {
    type: 'MACRO_NY_AM_3',
    label: 'NY AM Macro 3 (London Close)',
    timeInfo: '21:50 WIB • 10:50 NY',
    category: 'macro',
  },
  {
    type: 'HIGH_IMPACT_NEWS',
    label: 'High-Impact News',
    timeInfo: 'Red Event (-1m)',
    category: 'news',
  },
  {
    type: 'NEXT_H4',
    label: 'Next H4 Candle',
    timeInfo: '4-Hour Block',
    category: 'time',
  },
  {
    type: 'NEXT_DAY',
    label: 'Next Day',
    timeInfo: '05:00 WIB • 21:00 UTC',
    category: 'time',
  },
  {
    type: 'NEXT_WEEK_OPEN',
    label: 'Next Week',
    timeInfo: 'Senin 05:00 WIB • 21:00 UTC',
    category: 'time',
  },
];

/**
 * Calculates the next target timestamp (in seconds UTC) based on the selected jump target.
 */
export function calculateNextSessionJump(
  currentReplayTimeSec: number,
  targetType: SessionJumpType,
  newsEvents?: { timestamp: number; impact?: string }[]
): number | null {
  if (!currentReplayTimeSec || currentReplayTimeSec <= 0) {
    return null;
  }

  const d = new Date(currentReplayTimeSec * 1000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const date = d.getUTCDate();

  switch (targetType) {
    case 'ASIA_OPEN': {
      const todayOpen = Math.floor(Date.UTC(y, m, date, 0, 0, 0) / 1000);
      if (currentReplayTimeSec < todayOpen) {
        return todayOpen;
      }
      return Math.floor(Date.UTC(y, m, date + 1, 0, 0, 0) / 1000);
    }

    case 'MIDNIGHT_OPEN': {
      // 00:00 NY Time
      const todayOpen = getNYTimeInUTC(y, m, date, 0, 0);
      if (currentReplayTimeSec < todayOpen) return todayOpen;
      return getNYTimeInUTC(y, m, date + 1, 0, 0);
    }

    case 'LONDON_OPEN': {
      // 02:00 NY Time (approx 07:00 London/UTC)
      const todayOpen = getNYTimeInUTC(y, m, date, 2, 0);
      if (currentReplayTimeSec < todayOpen) return todayOpen;
      return getNYTimeInUTC(y, m, date + 1, 2, 0);
    }

    case 'NY_OPEN': {
      // 07:00 NY Time
      const todayOpen = getNYTimeInUTC(y, m, date, 7, 0);
      if (currentReplayTimeSec < todayOpen) return todayOpen;
      return getNYTimeInUTC(y, m, date + 1, 7, 0);
    }

    case 'WALL_STREET_OPEN': {
      // 09:30 NY Time
      const todayOpen = getNYTimeInUTC(y, m, date, 9, 30);
      if (currentReplayTimeSec < todayOpen) return todayOpen;
      return getNYTimeInUTC(y, m, date + 1, 9, 30);
    }

    case 'LONDON_CLOSE': {
      // 10:00 NY Time
      const todayOpen = getNYTimeInUTC(y, m, date, 10, 0);
      if (currentReplayTimeSec < todayOpen) return todayOpen;
      return getNYTimeInUTC(y, m, date + 1, 10, 0);
    }

    case 'MACRO_LONDON_PRE': {
      // 02:33 NY Time
      const todayOpen = getNYTimeInUTC(y, m, date, 2, 33);
      if (currentReplayTimeSec < todayOpen) return todayOpen;
      return getNYTimeInUTC(y, m, date + 1, 2, 33);
    }

    case 'MACRO_NY_AM_1': {
      // 08:50 NY Time
      const todayOpen = getNYTimeInUTC(y, m, date, 8, 50);
      if (currentReplayTimeSec < todayOpen) return todayOpen;
      return getNYTimeInUTC(y, m, date + 1, 8, 50);
    }

    case 'MACRO_NY_AM_2': {
      // 09:50 NY Time
      const todayOpen = getNYTimeInUTC(y, m, date, 9, 50);
      if (currentReplayTimeSec < todayOpen) return todayOpen;
      return getNYTimeInUTC(y, m, date + 1, 9, 50);
    }

    case 'MACRO_NY_AM_3': {
      // 10:50 NY Time
      const todayOpen = getNYTimeInUTC(y, m, date, 10, 50);
      if (currentReplayTimeSec < todayOpen) return todayOpen;
      return getNYTimeInUTC(y, m, date + 1, 10, 50);
    }

    case 'NEXT_MACRO': {
      // All Macros in NY Time
      const macroHoursMinutes = [
        [2, 33],   // London Pre
        [4, 3],    // London Classic
        [8, 50],   // NY AM 1
        [9, 50],   // NY AM 2
        [10, 50],  // NY AM 3
        [11, 50],  // NY AM 4
        [13, 10],  // NY PM 1
        [15, 15],  // NY PM 2
        [19, 50],  // Asia
      ];

      const upcomingTimes: number[] = [];
      for (const [h, min] of macroHoursMinutes) {
        const todayT = getNYTimeInUTC(y, m, date, h, min);
        if (todayT > currentReplayTimeSec) {
          upcomingTimes.push(todayT);
        } else {
          const tomorrowT = getNYTimeInUTC(y, m, date + 1, h, min);
          upcomingTimes.push(tomorrowT);
        }
      }
      upcomingTimes.sort((a, b) => a - b);
      return upcomingTimes[0] ?? null;
    }

    case 'NEXT_H4': {
      const step = 4 * 3600;
      const currentH4Block = Math.floor(currentReplayTimeSec / step) * step;
      return currentH4Block + step;
    }

    case 'NEXT_DAY':
    case 'NEXT_DAY_SAME_TIME': {
      // Opening candle daily: 17:00 NY (21:00 UTC in summer, 22:00 UTC in winter)
      const midnightUTC = Math.floor(Date.UTC(y, m, date, 0, 0, 0) / 1000);
      const todayDO = midnightUTC + getNYCloseAnchor(midnightUTC);
      if (currentReplayTimeSec < todayDO) {
        return todayDO;
      }
      const tomorrowMidnightUTC = Math.floor(Date.UTC(y, m, date + 1, 0, 0, 0) / 1000);
      return tomorrowMidnightUTC + getNYCloseAnchor(tomorrowMidnightUTC);
    }

    case 'NEXT_WEEK_OPEN': {
      const dayOfWeek = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      // Weekly candle open: Sunday 17:00 NY (21:00/22:00 UTC)
      if (dayOfWeek === 0) {
        const midnightUTC = Math.floor(Date.UTC(y, m, date, 0, 0, 0) / 1000);
        const sundayOpen = midnightUTC + getNYCloseAnchor(midnightUTC);
        if (currentReplayTimeSec < sundayOpen) {
          return sundayOpen;
        }
        const nextSundayMidnight = Math.floor(Date.UTC(y, m, date + 7, 0, 0, 0) / 1000);
        return nextSundayMidnight + getNYCloseAnchor(nextSundayMidnight);
      }
      const daysToSunday = 7 - dayOfWeek;
      const targetMidnight = Math.floor(Date.UTC(y, m, date + daysToSunday, 0, 0, 0) / 1000);
      return targetMidnight + getNYCloseAnchor(targetMidnight);
    }

    case 'HIGH_IMPACT_NEWS': {
      if (!newsEvents || newsEvents.length === 0) {
        return null;
      }
      // Filter high-impact events and find the first occurring after current replay time
      const nextEvent = newsEvents
        .filter(
          (ev) =>
            ev.timestamp > currentReplayTimeSec + 30 &&
            (!ev.impact ||
              ev.impact.toUpperCase() === 'HIGH' ||
              ev.impact.toUpperCase() === 'RED')
        )
        .sort((a, b) => a.timestamp - b.timestamp)[0];

      if (!nextEvent) {
        return null;
      }
      // Land 60 seconds before the news event
      return Math.max(currentReplayTimeSec, nextEvent.timestamp - 60);
    }

    default:
      return null;
  }
}
