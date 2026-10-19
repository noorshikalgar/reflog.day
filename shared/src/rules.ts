// Game rules for reflog. Pure functions only: the server and the web app share this file.
// Refer to docs/02-game-rules.md.

export type Kind = 'done' | 'rest' | 'miss';
/** Map of logical day ('YYYY-MM-DD') to the entry kind for one branch. */
export type DayLog = ReadonlyMap<string, Kind>;

/** Bit 0 = Monday … bit 6 = Sunday. */
export const EVERY_DAY = 0b1111111;
export const PATINA_WINDOW = 14;
export const PATINA_MAX = 3;
export const REST_PER_WEEK = 1;
export const AMEND_UNTIL_HOUR = 12;

const TAGS: Record<number, string> = { 7: 'v0.1.0', 30: 'v1.0.0', 100: 'v2.0.0', 365: 'LTS' };

// ---------- calendar ----------

const toUTC = (day: string) => new Date(day + 'T00:00:00Z');
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(day: string, n: number): string {
  const d = toUTC(day);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(day: string): number {
  return (toUTC(day).getUTCDay() + 6) % 7;
}

export function isScheduled(mask: number, day: string): boolean {
  return (mask & (1 << weekday(day))) !== 0;
}

/** ISO week as a release version, for example 'v2026.43'. */
export function isoWeekLabel(day: string): string {
  const d = toUTC(day);
  d.setUTCDate(d.getUTCDate() + 3 - weekday(day)); // Thursday of this week
  const year = d.getUTCFullYear();
  const week = 1 + Math.floor((d.getTime() - Date.UTC(year, 0, 1)) / 864e5 / 7);
  return `v${year}.${String(week).padStart(2, '0')}`;
}

/** Local wall clock in a time zone. */
export function localClock(at: Date, tz: string): { date: string; hm: string; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(at).map(p => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hm: `${parts.hour}:${parts.minute}`, hour: Number(parts.hour) };
}

/** 'HH:MM' plus minutes. Does not wrap at midnight, so '23:50' + 30 = '24:20' (still compares above '23:59'). */
export function addMinutes(hm: string, n: number): string {
  const [h, m] = hm.split(':').map(Number);
  const t = h * 60 + m + n;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** The logical day of an instant. The day starts at `startHour` local time, not at midnight. */
export function logicalDay(at: Date, tz: string, startHour: number): string {
  return localClock(new Date(at.getTime() - startHour * 36e5), tz).date;
}

// ---------- streaks ----------

/**
 * Current streak: count done days back from today.
 * Rest and a single miss do not stop the count. Two misses in a row stop it (rebase).
 * A past scheduled day without an entry is a miss. An open today is not a miss.
 */
export function streak(log: DayLog, mask: number, today: string, since: string): number {
  let count = 0;
  let misses = 0;
  for (let d = today; d >= since; d = addDays(d, -1)) {
    if (!isScheduled(mask, d)) continue;
    const k = log.get(d);
    if (d === today && k === undefined) continue;
    if (k === 'done') { count++; misses = 0; }
    else if (k === 'rest') misses = 0;
    else if (++misses >= 2) break;
  }
  return count;
}

/** Best streak in the history, with the same rules as `streak`. */
export function bestStreak(log: DayLog, mask: number, today: string, since: string): number {
  let run = 0, misses = 0, best = 0;
  for (let d = since; d <= today; d = addDays(d, 1)) {
    if (!isScheduled(mask, d)) continue;
    const k = log.get(d);
    if (d === today && k === undefined) continue;
    if (k === 'done') { run++; misses = 0; }
    else if (k === 'rest') misses = 0;
    else if (++misses >= 2) run = 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Patina level 0–3: misses in the last 14 days before today. */
export function patina(log: DayLog, mask: number, today: string, since = '0000-01-01'): number {
  let n = 0;
  for (let i = 1; i <= PATINA_WINDOW; i++) {
    const d = addDays(today, -i);
    if (d < since) break;
    if (!isScheduled(mask, d)) continue;
    const k = log.get(d);
    if (k !== 'done' && k !== 'rest') n++;
  }
  return Math.min(n, PATINA_MAX);
}

/** True when the miss on `day` is the second miss in a row (the streak rebases). */
export function missIsRebase(log: DayLog, mask: number, day: string): boolean {
  if (log.get(day) !== 'miss') return false;
  for (let i = 1; i <= 7; i++) {
    const p = addDays(day, -i);
    if (isScheduled(mask, p)) return log.get(p) === 'miss';
  }
  return false;
}

/** Rest days left in the ISO week of `day`. */
export function restLeftThisWeek(log: DayLog, day: string, perWeek = REST_PER_WEEK): number {
  const monday = addDays(day, -weekday(day));
  let used = 0;
  for (let i = 0; i < 7; i++) if (log.get(addDays(monday, i)) === 'rest') used++;
  return Math.max(0, perWeek - used);
}

/** The next milestone above a streak, or null after the last one. */
export function nextTag(n: number): { name: string; at: number; to_go: number } | null {
  const at = Object.keys(TAGS).map(Number).sort((a, b) => a - b).find(t => t > n);
  return at ? { name: TAGS[at], at, to_go: at - n } : null;
}

/** How many milestone tags a branch earned in its history (each time a run reaches 7, 30, 100, 365). */
export function tagsEarned(log: DayLog, mask: number, today: string, since: string): number {
  const at = new Set(Object.keys(TAGS).map(Number));
  let run = 0, misses = 0, n = 0;
  for (let d = since; d <= today; d = addDays(d, 1)) {
    if (!isScheduled(mask, d)) continue;
    const k = log.get(d);
    if (d === today && k === undefined) continue;
    if (k === 'done') { run++; misses = 0; if (at.has(run)) n++; }
    else if (k === 'rest') misses = 0;
    else if (++misses >= 2) run = 0;
  }
  return n;
}

/** Milestone tag for an exact streak value, or null. */
export function tagFor(n: number): string | null {
  return TAGS[n] ?? null;
}

/** Day summary. Rest counts as complete. */
export function dayStats(kinds: ReadonlyArray<Kind | null>): { complete: number; total: number; clean: boolean } {
  const complete = kinds.filter(k => k === 'done' || k === 'rest').length;
  return { complete, total: kinds.length, clean: kinds.length > 0 && complete === kinds.length };
}
