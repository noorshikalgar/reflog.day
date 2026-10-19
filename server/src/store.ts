import { createHash } from 'node:crypto';
import type { DB } from './db.ts';
import * as R from '../../shared/src/rules.ts';
import { MISS_TITLES, pick } from '../../shared/src/messages.ts';
import { uuidv7 } from '../../shared/src/ids.ts';
import type {
  Entry, Habit, HabitDetail, HabitInput, HabitView, LogCell, LogView, Profile, ReleaseNotes, Settings, StripDay, TodayView, UnseenMiss,
} from '../../shared/src/api.ts';

export const MAX_BRANCHES = 12;
const SLUG = /^[a-z0-9][a-z0-9-]{0,19}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class HttpError extends Error {
  status: 400 | 404 | 409;
  constructor(status: 400 | 404 | 409, message: string) {
    super(message);
    this.status = status;
  }
}

const DEFAULTS: Settings = {
  tz: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone,
  day_start_hour: 4,
  evening_at: '21:30',
  push_enabled: true,
  theme: 'terminal',
};
const THEMES = ['terminal', 'bathory', 'gruvbox', 'paper'];

type HabitRow = Omit<Habit, never>;
type EntryRow = Omit<Entry, 'amended'> & { amended: number };

const toEntry = (r: EntryRow): Entry => ({ ...r, amended: r.amended === 1 });
const commitHash = (habitId: string, day: string, at: string) =>
  createHash('sha1').update(habitId + day + at).digest('hex').slice(0, 7);

export class Store {
  readonly db: DB;
  readonly now: () => Date;

  constructor(db: DB, now: () => Date = () => new Date()) {
    this.db = db;
    this.now = now;
  }

  // ---------- settings ----------

  settings(): Settings {
    const rows = this.db.prepare('SELECT key, value FROM setting').all() as { key: string; value: string }[];
    const m = new Map(rows.map(r => [r.key, r.value]));
    return {
      tz: m.get('tz') ?? DEFAULTS.tz,
      day_start_hour: Number(m.get('day_start_hour') ?? DEFAULTS.day_start_hour),
      evening_at: m.get('evening_at') ?? DEFAULTS.evening_at,
      push_enabled: (m.get('push_enabled') ?? '1') === '1',
      theme: (m.get('theme') as Settings['theme']) ?? DEFAULTS.theme,
    };
  }

  patchSettings(p: Partial<Settings>): Settings {
    if (p.tz !== undefined) {
      try { new Intl.DateTimeFormat('en', { timeZone: p.tz }); } catch { throw new HttpError(400, 'unknown time zone'); }
      this.set('tz', p.tz);
    }
    if (p.day_start_hour !== undefined) {
      if (!Number.isInteger(p.day_start_hour) || p.day_start_hour < 0 || p.day_start_hour > 6) throw new HttpError(400, 'day_start_hour must be 0–6');
      this.set('day_start_hour', String(p.day_start_hour));
    }
    if (p.evening_at !== undefined) {
      if (!HM.test(p.evening_at)) throw new HttpError(400, 'evening_at must be HH:MM');
      this.set('evening_at', p.evening_at);
    }
    if (p.push_enabled !== undefined) this.set('push_enabled', p.push_enabled ? '1' : '0');
    if (p.theme !== undefined) {
      if (!THEMES.includes(p.theme)) throw new HttpError(400, 'unknown theme');
      this.set('theme', p.theme);
    }
    return this.settings();
  }

  get(key: string): string | undefined {
    return (this.db.prepare('SELECT value FROM setting WHERE key = ?').get(key) as { value: string } | undefined)?.value;
  }

  set(key: string, value: string) {
    this.db.prepare('INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  }

  // ---------- time ----------

  today(): string {
    const s = this.settings();
    return R.logicalDay(this.now(), s.tz, s.day_start_hour);
  }

  private dayOf(iso: string): string {
    const s = this.settings();
    return R.logicalDay(new Date(iso), s.tz, s.day_start_hour);
  }

  private canAmend(): boolean {
    return R.localClock(this.now(), this.settings().tz).hour < R.AMEND_UNTIL_HOUR;
  }

  // ---------- habits ----------

  habits(includeArchived = false): Habit[] {
    const sql = `SELECT * FROM habit ${includeArchived ? '' : 'WHERE archived_at IS NULL'} ORDER BY archived_at IS NOT NULL, position, created_at`;
    return this.db.prepare(sql).all() as unknown as HabitRow[];
  }

  habit(id: string): Habit {
    const h = this.db.prepare('SELECT * FROM habit WHERE id = ?').get(id) as unknown as HabitRow | undefined;
    if (!h) throw new HttpError(404, 'branch not found');
    return h;
  }

  createHabit(input: HabitInput): Habit {
    const v = this.validateHabit(input, true);
    if (this.habits().length >= MAX_BRANCHES) throw new HttpError(409, `max ${MAX_BRANCHES} branches`);
    if (this.db.prepare('SELECT 1 FROM habit WHERE slug = ?').get(v.slug!)) throw new HttpError(409, 'slug already used');
    const pos = (this.db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM habit').get() as { p: number }).p;
    const id = uuidv7(this.now().getTime());
    this.db.prepare('INSERT INTO habit (id, slug, emoji, lane, days_mask, remind_at, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, v.slug!, v.emoji ?? null, v.lane ?? this.nextLane(), v.days_mask ?? R.EVERY_DAY, v.remind_at ?? null, pos, this.now().toISOString());
    return this.habit(id);
  }

  updateHabit(id: string, input: HabitInput & { archived?: boolean; position?: number }): Habit {
    const h = this.habit(id);
    const v = this.validateHabit(input, false);
    if (v.slug && v.slug !== h.slug && this.db.prepare('SELECT 1 FROM habit WHERE slug = ?').get(v.slug)) throw new HttpError(409, 'slug already used');
    const next = { ...h, ...v };
    if (input.archived === true && !h.archived_at) next.archived_at = this.now().toISOString();
    if (input.archived === false && h.archived_at) {
      if (this.habits().length >= MAX_BRANCHES) throw new HttpError(409, `max ${MAX_BRANCHES} branches`);
      next.archived_at = null;
    }
    if (input.position !== undefined) next.position = input.position;
    this.db.prepare('UPDATE habit SET slug = ?, emoji = ?, lane = ?, days_mask = ?, remind_at = ?, position = ?, archived_at = ? WHERE id = ?')
      .run(next.slug, next.emoji, next.lane, next.days_mask, next.remind_at, next.position, next.archived_at, id);
    return this.habit(id);
  }

  private validateHabit(i: HabitInput, create: boolean): HabitInput {
    const out: HabitInput = {};
    if (i.slug !== undefined || create) {
      const slug = String(i.slug ?? '').trim().toLowerCase();
      if (!SLUG.test(slug)) throw new HttpError(400, 'name: a–z, 0–9 and "-", max 20 characters');
      out.slug = slug;
    }
    if (i.emoji !== undefined) out.emoji = i.emoji ? String(i.emoji).slice(0, 8) : null;
    if (i.lane !== undefined) {
      if (!Number.isInteger(i.lane) || i.lane < 1 || i.lane > 10) throw new HttpError(400, 'lane must be 1–10');
      out.lane = i.lane;
    }
    if (i.days_mask !== undefined) {
      if (!Number.isInteger(i.days_mask) || i.days_mask < 1 || i.days_mask > 127) throw new HttpError(400, 'select one day or more');
      out.days_mask = i.days_mask;
    }
    if (i.remind_at !== undefined) {
      if (i.remind_at !== null && !HM.test(i.remind_at)) throw new HttpError(400, 'reminder must be HH:MM');
      out.remind_at = i.remind_at;
    }
    return out;
  }

  private nextLane(): number {
    const used = new Set(this.habits().map(h => h.lane));
    for (let l = 1; l <= 10; l++) if (!used.has(l)) return l;
    return (this.habits().length % 10) + 1;
  }

  // ---------- entries ----------

  private entries(habitIds: string[]): Map<string, Map<string, Entry>> {
    const out = new Map<string, Map<string, Entry>>(habitIds.map(id => [id, new Map()]));
    if (!habitIds.length) return out;
    const rows = this.db.prepare(`SELECT * FROM entry WHERE habit_id IN (${habitIds.map(() => '?').join(',')})`).all(...habitIds) as unknown as EntryRow[];
    for (const r of rows) out.get(r.habit_id)!.set(r.day, toEntry(r));
    return out;
  }

  private kinds(m: Map<string, Entry>): Map<string, R.Kind> {
    return new Map([...m].map(([d, e]) => [d, e.kind]));
  }

  /** Create or replace the entry for one branch and one day. Same `id` again is a no-op update. */
  putEntry(id: string, body: { habit_id: string; day?: string; kind: 'done' | 'rest'; message?: string | null; at?: string }): { entry: Entry; habit: HabitView } {
    const h = this.habit(body.habit_id);
    if (h.archived_at) throw new HttpError(409, 'branch is archived');
    if (body.kind !== 'done' && body.kind !== 'rest') throw new HttpError(400, 'kind must be done or rest');
    const now = this.now();
    // `at` is the tap time of a commit that waited in the offline outbox. The day rules
    // apply at that time, not at upload time. Accept it for 48 h and never from the future.
    let tap = now;
    if (body.at !== undefined) {
      const t = new Date(body.at);
      if (Number.isNaN(t.getTime()) || t.getTime() > now.getTime() + 5 * 6e4 || t.getTime() < now.getTime() - 48 * 36e5) throw new HttpError(400, 'at must be within the last 48 h');
      tap = t;
    }
    const s = this.settings();
    const today = this.today();
    const tapDay = R.logicalDay(tap, s.tz, s.day_start_hour);
    const day = body.day ?? tapDay;
    const amendOk = day === R.addDays(tapDay, -1) && R.localClock(tap, s.tz).hour < R.AMEND_UNTIL_HOUR;
    if (day !== tapDay && !amendOk) throw new HttpError(409, 'you can only log today, or yesterday before 12:00');
    if (day < this.dayOf(h.created_at)) throw new HttpError(409, 'branch did not exist on that day');
    const message = body.message ? String(body.message).slice(0, 72) : null;

    const existing = this.db.prepare('SELECT * FROM entry WHERE id = ?').get(id) as unknown as EntryRow | undefined;
    if (existing && (existing.habit_id !== h.id || existing.day !== day)) throw new HttpError(409, 'id belongs to another entry');

    const log = this.kinds(this.entries([h.id]).get(h.id)!);
    if (body.kind === 'rest' && log.get(day) !== 'rest' && R.restLeftThisWeek(log, day) === 0) throw new HttpError(409, 'no rest day left this week');

    const at = existing?.created_at ?? tap.toISOString();
    const hash = existing?.hash && existing.kind === body.kind ? existing.hash : commitHash(h.id, day, at + body.kind);
    this.db.exec('BEGIN');
    try {
      this.db.prepare('DELETE FROM entry WHERE habit_id = ? AND day = ? AND id <> ?').run(h.id, day, id);
      this.db.prepare(`INSERT INTO entry (id, habit_id, day, kind, hash, message, amended, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, hash = excluded.hash, message = excluded.message`)
        .run(id, h.id, day, body.kind, hash, message, day === tapDay ? 0 : 1, at);
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    return { entry: this.entry(id), habit: this.habitView(h, today) };
  }

  entry(id: string): Entry {
    const r = this.db.prepare('SELECT * FROM entry WHERE id = ?').get(id) as unknown as EntryRow | undefined;
    if (!r) throw new HttpError(404, 'entry not found');
    return toEntry(r);
  }

  /** Undo a commit. Allowed for 24 h. */
  deleteEntry(id: string): { habit: HabitView } {
    const e = this.entry(id);
    if (e.kind === 'miss') throw new HttpError(409, 'a miss cannot be deleted');
    if (this.now().getTime() - new Date(e.created_at).getTime() > 24 * 36e5) throw new HttpError(409, 'undo is possible for 24 h only');
    this.db.prepare('DELETE FROM entry WHERE id = ?').run(id);
    return { habit: this.habitView(this.habit(e.habit_id), this.today()) };
  }

  markMissesSeen(ids: string[]) {
    const st = this.db.prepare("UPDATE entry SET seen_at = ? WHERE id = ? AND kind = 'miss'");
    const at = this.now().toISOString();
    for (const id of ids) st.run(at, id);
  }

  // ---------- views ----------

  habitView(h: Habit, today: string, entries?: Map<string, Entry>): HabitView {
    const m = entries ?? this.entries([h.id]).get(h.id)!;
    const log = this.kinds(m);
    const since = this.dayOf(h.created_at);
    return {
      ...h,
      scheduled: R.isScheduled(h.days_mask, today),
      entry: m.get(today) ?? null,
      yesterday: m.get(R.addDays(today, -1))?.kind ?? null,
      streak: R.streak(log, h.days_mask, today, since),
      best: R.bestStreak(log, h.days_mask, today, since),
      patina: R.patina(log, h.days_mask, today, since),
      rest_left: R.restLeftThisWeek(log, today),
    };
  }

  habitDetail(id: string): HabitDetail {
    const h = this.habit(id);
    const today = this.today();
    const m = this.entries([h.id]).get(h.id)!;
    const since = this.dayOf(h.created_at);
    const monday = R.addDays(today, -R.weekday(today));
    const grid: HabitDetail['grid'] = [];
    for (let i = 0; i < 84; i++) {
      const d = R.addDays(monday, i - 77);
      const e = m.get(d);
      let state: HabitDetail['grid'][number]['state'];
      if (d > today) state = 'future';
      else if (e) state = e.kind;
      else if (d < since || !R.isScheduled(h.days_mask, d)) state = 'none';
      else state = d === today ? 'open' : 'miss';
      grid.push({ day: d, state });
    }
    const week = grid.slice(77);
    const view = this.habitView(h, today, m);
    return {
      ...view,
      total: [...m.values()].filter(e => e.kind === 'done').length,
      week: {
        complete: week.filter(c => c.state === 'done' || c.state === 'rest').length,
        scheduled: week.filter(c => R.isScheduled(h.days_mask, c.day) && c.day >= since).length,
      },
      next_tag: R.nextTag(view.streak),
      grid,
    };
  }

  todayView(): TodayView {
    const today = this.today();
    const habits = this.habits();
    const all = this.entries(habits.map(h => h.id));
    const views = habits.map(h => this.habitView(h, today, all.get(h.id)));

    const strip: StripDay[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = R.addDays(today, -i);
      const kinds = habits
        .filter(h => R.isScheduled(h.days_mask, d) && this.dayOf(h.created_at) <= d)
        .map(h => all.get(h.id)!.get(d)?.kind ?? (i === 0 ? null : 'miss'));
      const s = R.dayStats(kinds);
      strip.push({
        day: d,
        state: s.total === 0 ? 'none' : s.clean ? 'full' : i === 0 ? 'open' : s.complete > 0 ? 'half' : 'miss',
        p: s.total ? s.complete / s.total : 0,
      });
    }

    const misses: UnseenMiss[] = [];
    const rows = this.db.prepare("SELECT e.id, e.habit_id, e.day, e.message, h.slug, h.days_mask FROM entry e JOIN habit h ON h.id = e.habit_id WHERE e.kind = 'miss' AND e.seen_at IS NULL AND h.archived_at IS NULL ORDER BY e.day")
      .all() as { id: string; habit_id: string; day: string; message: string; slug: string; days_mask: number }[];
    for (const r of rows) {
      const log = this.kinds(all.get(r.habit_id) ?? new Map());
      misses.push({ id: r.id, habit_id: r.habit_id, slug: r.slug, day: r.day, title: r.message, rebase: R.missIsRebase(log, r.days_mask, r.day) });
    }

    return { day: today, release_notes: this.releaseNotes(today, habits, all), can_amend: this.canAmend(), settings: this.settings(), habits: views, strip, misses };
  }

  /** Notes for last ISO week, once, on the first open of a new week. Refer to docs/02-game-rules.md §9. */
  private releaseNotes(today: string, habits: Habit[], all: Map<string, Map<string, Entry>>): ReleaseNotes | null {
    const lastSunday = R.addDays(today, -R.weekday(today) - 1);
    const lastMonday = R.addDays(lastSunday, -6);
    const version = R.isoWeekLabel(lastMonday);
    if (this.get('notes_seen') === version) return null;
    let commits = 0, rest = 0, miss = 0;
    let longest: ReleaseNotes['longest'] = null;
    const newBest: ReleaseNotes['new_best'] = [];
    for (const h of habits) {
      const m = all.get(h.id)!;
      for (const [d, e] of m) {
        if (d < lastMonday || d > lastSunday) continue;
        if (e.kind === 'done') commits++; else if (e.kind === 'rest') rest++; else miss++;
      }
      const log = this.kinds(m);
      const since = this.dayOf(h.created_at);
      if (since > lastSunday) continue;
      const st = R.streak(log, h.days_mask, lastSunday, since);
      if (st > 0 && (!longest || st > longest.streak)) longest = { slug: h.slug, streak: st };
      const before = since <= R.addDays(lastMonday, -1) ? R.bestStreak(log, h.days_mask, R.addDays(lastMonday, -1), since) : 0;
      const after = R.bestStreak(log, h.days_mask, lastSunday, since);
      if (after > before && after >= 3) newBest.push({ slug: h.slug, best: after });
    }
    if (commits + rest + miss === 0) return null;
    return { version, commits, rest, miss, longest, new_best: newBest };
  }

  notesSeen(version: string) {
    if (!/^v\d{4}\.\d{2}$/.test(version)) throw new HttpError(400, 'bad version');
    this.set('notes_seen', version);
  }

  /** History for the log screen, newest day first. Refer to docs/03-ux-ui.md §2.3. */
  logView(before?: string, days = 14): LogView {
    const today = this.today();
    const habits = this.habits(true);
    const all = this.entries(habits.map(h => h.id));
    const born = new Map(habits.map(h => [h.id, this.dayOf(h.created_at)]));
    const gone = new Map(habits.map(h => [h.id, h.archived_at ? this.dayOf(h.archived_at) : null]));
    const first = [...born.values()].sort()[0];
    const start = before && before <= today ? R.addDays(before, -1) : today;
    const n = Math.min(Math.max(1, Math.floor(days)), 60);

    const out: LogView['days'] = [];
    let d = start;
    for (let i = 0; i < n && first && d >= first; i++, d = R.addDays(d, -1)) {
      const cells = habits.map((h): LogCell => {
        const e = all.get(h.id)!.get(d);
        const archived = gone.get(h.id);
        if (e) {
          const log = this.kinds(all.get(h.id)!);
          return {
            state: e.kind,
            entry: { id: e.id, hash: e.hash, message: e.message, created_at: e.created_at, amended: e.amended },
            rebase: e.kind === 'miss' && R.missIsRebase(log, h.days_mask, d),
          };
        }
        if (d < born.get(h.id)! || (archived && d >= archived) || !R.isScheduled(h.days_mask, d)) return { state: 'none', entry: null, rebase: false };
        return { state: d === today ? 'open' : 'miss', entry: null, rebase: false };
      });
      out.push({ day: d, cells });
    }
    // Hide archived branches with no entry in this page.
    const keep = habits.map((h, i) => !h.archived_at || out.some(x => x.cells[i].state !== 'none'));
    return {
      today,
      habits: habits.filter((_, i) => keep[i]).map(h => ({ id: h.id, slug: h.slug, emoji: h.emoji, lane: h.lane, archived_at: h.archived_at })),
      days: out.map(x => ({ day: x.day, cells: x.cells.filter((_, i) => keep[i]) })),
      next: first && d >= first ? R.addDays(d, 1) : null,
    };
  }

  // ---------- profile ----------

  profile(): Profile {
    const today = this.today();
    const habits = this.habits(true);
    const all = this.entries(habits.map(h => h.id));
    const since = habits.map(h => this.dayOf(h.created_at)).sort()[0] ?? today;
    let commits = 0, best = 0, tags = 0;
    for (const h of habits) {
      const m = all.get(h.id)!;
      const log = this.kinds(m);
      const from = this.dayOf(h.created_at);
      for (const e of m.values()) if (e.kind === 'done') commits++;
      if (!h.archived_at) best = Math.max(best, R.streak(log, h.days_mask, today, from));
      tags += R.tagsEarned(log, h.days_mask, today, from);
    }
    const days = Math.round((Date.parse(today) - Date.parse(since)) / 864e5) + 1;
    return {
      name: this.get('profile_name') ?? 'you',
      avatar: this.get('profile_avatar') ?? '🌱',
      since,
      totals: { commits, best_now: best, tags, days },
    };
  }

  patchProfile(p: { name?: string; avatar?: string }): Profile {
    if (p.name !== undefined) {
      const name = String(p.name).trim();
      if (name.length < 1 || name.length > 24) throw new HttpError(400, 'name: 1–24 characters');
      this.set('profile_name', name);
    }
    if (p.avatar !== undefined) {
      const a = String(p.avatar).trim();
      // Two capital initials, or one short emoji (no letters, digits or markup).
      const ok = /^[A-Z]{1,2}$/.test(a) || (a.length > 0 && a.length <= 8 && !/[\p{L}\p{N}<>&"']/u.test(a));
      if (!ok) throw new HttpError(400, 'avatar: one emoji or 1–2 capital letters');
      this.set('profile_avatar', a);
    }
    return this.profile();
  }

  // ---------- rollover ----------

  /** Insert a miss for each scheduled branch without an entry, for each finished logical day. */
  rollover(): number {
    const yesterday = R.addDays(this.today(), -1);
    let from = this.get('last_rollover');
    if (!from) { this.set('last_rollover', yesterday); return 0; }
    let inserted = 0;
    const habits = this.habits(true);
    const st = this.db.prepare('INSERT OR IGNORE INTO entry (id, habit_id, day, kind, hash, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    let last: string | undefined;
    for (let d = R.addDays(from, 1), n = 0; d <= yesterday && n < 400; d = R.addDays(d, 1), n++) {
      for (const h of habits) {
        if (!R.isScheduled(h.days_mask, d) || this.dayOf(h.created_at) > d) continue;
        if (h.archived_at && this.dayOf(h.archived_at) <= d) continue;
        last = pick(MISS_TITLES, last);
        const at = this.now().toISOString();
        inserted += Number(st.run(uuidv7(), h.id, d, 'miss', commitHash(h.id, d, at), last, at).changes);
      }
      this.set('last_rollover', d);
    }
    return inserted;
  }

  // ---------- export / import ----------

  /** Replace all branches, entries and settings with an export. Devices, push and keys stay. */
  importAll(data: unknown): { habits: number; entries: number } {
    const d = data as ReturnType<Store['exportAll']>;
    if (!d || d.app !== 'reflog' || d.version !== 1 || !Array.isArray(d.habits) || !Array.isArray(d.entries)) throw new HttpError(400, 'not a reflog export (version 1)');
    const ids = new Set<string>();
    const slugs = new Set<string>();
    for (const h of d.habits) {
      if (typeof h.id !== 'string' || !SLUG.test(h.slug) || !Number.isInteger(h.lane) || h.lane < 1 || h.lane > 10
        || !Number.isInteger(h.days_mask) || h.days_mask < 1 || h.days_mask > 127 || (h.remind_at !== null && !HM.test(h.remind_at))
        || typeof h.created_at !== 'string' || slugs.has(h.slug)) throw new HttpError(400, `bad branch in export: ${String(h.slug)}`);
      ids.add(h.id);
      slugs.add(h.slug);
    }
    for (const e of d.entries) {
      if (typeof e.id !== 'string' || !ids.has(e.habit_id) || !/^\d{4}-\d{2}-\d{2}$/.test(e.day) || !['done', 'rest', 'miss'].includes(e.kind) || !/^[0-9a-f]{7}$/.test(e.hash))
        throw new HttpError(400, `bad entry in export: ${String(e.id)}`);
    }
    this.db.exec('BEGIN');
    try {
      this.db.exec('DELETE FROM entry; DELETE FROM habit;');
      const hs = this.db.prepare('INSERT INTO habit (id, slug, emoji, lane, days_mask, remind_at, position, created_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const h of d.habits) hs.run(h.id, h.slug, h.emoji ?? null, h.lane, h.days_mask, h.remind_at ?? null, Number(h.position) || 0, h.created_at, h.archived_at ?? null);
      const es = this.db.prepare('INSERT OR IGNORE INTO entry (id, habit_id, day, kind, hash, message, amended, seen_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const e of d.entries) es.run(e.id, e.habit_id, e.day, e.kind, e.hash, e.message ? String(e.message).slice(0, 72) : null, e.amended ? 1 : 0, e.seen_at ?? this.now().toISOString(), e.created_at);
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    if (d.settings) {
      const { tz, day_start_hour, evening_at, push_enabled, theme } = d.settings;
      this.patchSettings({ tz, day_start_hour, evening_at, push_enabled, theme });
    }
    this.set('last_rollover', R.addDays(this.today(), -1));
    return { habits: d.habits.length, entries: d.entries.length };
  }

  /** Copy the database to a file (VACUUM INTO). */
  backupTo(file: string) {
    this.db.exec(`VACUUM INTO '${file.replaceAll("'", "''")}'`);
  }


  exportAll() {
    return {
      app: 'reflog',
      version: 1,
      exported_at: this.now().toISOString(),
      settings: this.settings(),
      habits: this.habits(true),
      entries: (this.db.prepare('SELECT * FROM entry ORDER BY day, created_at').all() as unknown as EntryRow[]).map(toEntry),
    };
  }
}
