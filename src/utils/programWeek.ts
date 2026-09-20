// Pure helpers for turning a user's program-day number (see computeProgramDay
// in server.ts for the built-in plan, or days-since-upload for a custom
// uploaded plan) into a week-by-week breakdown for the "Weekly Updates"
// panel — no fetching, no React, just the math, so both the panel and any
// small badge elsewhere in the app compute the exact same week boundaries.

export type WeekStatus = 'completed' | 'current' | 'upcoming';

export interface WeekInfo {
  week: number;
  dayStart: number;
  dayEnd: number;
  status: WeekStatus;
}

/** Standard 7-day weeks: days 1-7 are Week 1, 8-14 are Week 2, etc. A week
 *  only flips to "completed" once the program has moved past its last day
 *  (i.e. on day 8, not day 7) — the day that closes a week is still that
 *  week's final "current" day. */
export function computeWeeks(dayNum: number, totalDays: number): WeekInfo[] {
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
  const currentWeek = Math.min(totalWeeks, Math.max(1, Math.ceil(dayNum / 7)));
  return Array.from({ length: totalWeeks }, (_, i) => {
    const week = i + 1;
    const dayStart = i * 7 + 1;
    const dayEnd = Math.min(totalDays, dayStart + 6);
    const status: WeekStatus = week < currentWeek ? 'completed' : week === currentWeek ? 'current' : 'upcoming';
    return { week, dayStart, dayEnd, status };
  });
}

export interface MonthInfo {
  month: number;
  weeks: WeekInfo[];
  status: WeekStatus;
}

/** Groups weeks into 4-week months (Month 1 = Week 1-4, Month 2 = Week 5-8,
 *  ...) — never padded with weeks that don't actually exist in `weeks`, so a
 *  program shorter than 4 weeks just shows a partial Month 1 instead of
 *  fabricating locked weeks with no real day range behind them. A month's
 *  own status is completed only once every one of its weeks is completed,
 *  current as soon as any of its weeks is the current one, and upcoming
 *  (locked) only while every one of its weeks is still upcoming — matching
 *  the same three-state language the week rows already use. */
export function computeMonths(weeks: WeekInfo[]): MonthInfo[] {
  const months: MonthInfo[] = [];
  for (let i = 0; i < weeks.length; i += 4) {
    const monthWeeks = weeks.slice(i, i + 4);
    const status: WeekStatus = monthWeeks.every((w) => w.status === 'completed')
      ? 'completed'
      : monthWeeks.some((w) => w.status === 'current')
      ? 'current'
      : 'upcoming';
    months.push({ month: months.length + 1, weeks: monthWeeks, status });
  }
  return months;
}

/** Unifies the built-in plan's `programDay` (1-14) and a custom uploaded
 *  plan's calendar-based progress (1-35, from its upload date) into one
 *  {dayNum, totalDays} shape the week math above can work with either way. */
export function unifiedProgramDay(args: { isCustom: boolean; programDay: number | null; uploadedAt: string | null }): { dayNum: number; totalDays: number } | null {
  if (args.isCustom && args.uploadedAt) {
    const uploaded = new Date(args.uploadedAt);
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const elapsed = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(uploaded.getFullYear(), uploaded.getMonth(), uploaded.getDate())) / msPerDay) + 1;
    return { dayNum: Math.min(35, Math.max(1, elapsed)), totalDays: 35 };
  }
  if (args.programDay != null) {
    return { dayNum: args.programDay, totalDays: 14 };
  }
  return null;
}
