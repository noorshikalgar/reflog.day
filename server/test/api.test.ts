import { beforeEach, describe, expect, it } from 'vitest';
import { Pairing } from '../src/auth.ts';
import { createApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import { Store } from '../src/store.ts';
import { Push, type PushPayload, type Sender } from '../src/push.ts';
import { uuidv7 } from '../../shared/src/ids.ts';
import type { HabitView, TodayView } from '../../shared/src/api.ts';

// IST = UTC+05:30. 2026-10-19 09:00 IST = 03:30Z.
let now = new Date('2026-10-19T03:30:00Z');
const at = (iso: string) => { now = new Date(iso); };

let store: Store;
let pairing: Pairing;
let app: ReturnType<typeof createApp>;
let push: Push;
let sent: { endpoint: string; payload: PushPayload }[] = [];
let gone = new Set<string>();
const fakeSender: Sender = async (sub, payload) => { if (gone.has(sub.endpoint)) return false; sent.push({ endpoint: sub.endpoint, payload }); return true; };
let cookie = '';

async function req<T = any>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T }> {
  const res = await app.request(path, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  return { status: res.status, json: await res.json() as T };
}

async function pairDevice() {
  const { code } = pairing.newCode();
  expect((await req('POST', '/api/pair', { code, name: 'test' })).status).toBe(200);
}

const commit = (habit_id: string, extra: object = {}) =>
  req('PUT', `/api/entries/${uuidv7()}`, { habit_id, kind: 'done', ...extra });

const today = async () => (await req<TodayView>('GET', '/api/today')).json;
const view = async (slug: string) => (await today()).habits.find(h => h.slug === slug) as HabitView;

beforeEach(async () => {
  at('2026-10-19T03:30:00Z');
  const db = openDb(':memory:');
  store = new Store(db, () => now);
  store.patchSettings({ tz: 'Asia/Kolkata', day_start_hour: 4 });
  pairing = new Pairing(db, () => now.getTime());
  push = new Push(store, fakeSender, 'https://reflog.day');
  sent = [];
  gone = new Set();
  app = createApp(store, pairing, push);
  cookie = '';
});

describe('pairing', () => {
  it('rejects requests without a device cookie', async () => {
    expect((await req('GET', '/api/today')).status).toBe(401);
  });
  it('pairs with the code and then allows requests', async () => {
    await pairDevice();
    expect(cookie).toMatch(/^rl_dev=/);
    expect((await req('GET', '/api/today')).status).toBe(200);
  });
  it('kills the code after 5 wrong tries', async () => {
    const { code } = pairing.newCode();
    for (let i = 0; i < 5; i++) expect((await req('POST', '/api/pair', { code: '000000' === code ? '111111' : '000000' })).status).toBe(401);
    expect((await req('POST', '/api/pair', { code })).status).toBe(401);
  });
  it('expires the code after 10 minutes', async () => {
    const { code } = pairing.newCode();
    at('2026-10-19T03:41:00Z');
    expect((await req('POST', '/api/pair', { code })).status).toBe(401);
  });
});

describe('branches', () => {
  beforeEach(pairDevice);

  it('creates a branch with defaults', async () => {
    const { status, json } = await req('POST', '/api/habits', { slug: 'Walk' });
    expect(status).toBe(201);
    expect(json).toMatchObject({ slug: 'walk', lane: 1, days_mask: 127, remind_at: null });
  });
  it('validates input', async () => {
    expect((await req('POST', '/api/habits', { slug: 'no spaces' })).status).toBe(400);
    expect((await req('POST', '/api/habits', { slug: 'ok', lane: 11 })).status).toBe(400);
    expect((await req('POST', '/api/habits', { slug: 'ok', remind_at: '25:00' })).status).toBe(400);
    await req('POST', '/api/habits', { slug: 'walk' });
    expect((await req('POST', '/api/habits', { slug: 'walk' })).status).toBe(409);
  });
  it('allows 12 active branches only', async () => {
    for (let i = 0; i < 12; i++) expect((await req('POST', '/api/habits', { slug: `h${i}` })).status).toBe(201);
    expect((await req('POST', '/api/habits', { slug: 'h12' })).status).toBe(409);
  });
  it('archives and hides a branch', async () => {
    const h = (await req('POST', '/api/habits', { slug: 'walk' })).json;
    await req('PATCH', `/api/habits/${h.id}`, { archived: true });
    expect((await today()).habits).toHaveLength(0);
  });
});

describe('commits', () => {
  let walk: string;
  beforeEach(async () => {
    await pairDevice();
    walk = (await req('POST', '/api/habits', { slug: 'walk' })).json.id;
  });

  it('commits today with a 7-char hash', async () => {
    const { status, json } = await commit(walk, { message: '4.2k steps' });
    expect(status).toBe(200);
    expect(json.entry).toMatchObject({ day: '2026-10-19', kind: 'done', message: '4.2k steps', amended: false });
    expect(json.entry.hash).toMatch(/^[0-9a-f]{7}$/);
    expect(json.habit.streak).toBe(1);
  });
  it('is idempotent for the same id', async () => {
    const id = uuidv7();
    const a = await req('PUT', `/api/entries/${id}`, { habit_id: walk, kind: 'done' });
    const b = await req('PUT', `/api/entries/${id}`, { habit_id: walk, kind: 'done' });
    expect(b.status).toBe(200);
    expect(b.json.entry.hash).toBe(a.json.entry.hash);
  });
  it('undoes a commit', async () => {
    const { json } = await commit(walk);
    expect((await req('DELETE', `/api/entries/${json.entry.id}`)).json.habit.entry).toBeNull();
  });
  it('uses the logical day after midnight', async () => {
    at('2026-10-19T20:30:00Z'); // 20 Oct 02:00 IST
    expect((await commit(walk)).json.entry.day).toBe('2026-10-19');
  });
  it('allows one rest day each week', async () => {
    expect((await commit(walk, { kind: 'rest' })).json.habit.rest_left).toBe(0);
    at('2026-10-20T03:30:00Z');
    expect((await commit(walk, { kind: 'rest' })).status).toBe(409);
  });
  it('reports the kind of yesterday for amend', async () => {
    await commit(walk, { kind: 'rest' });
    at('2026-10-20T03:30:00Z');
    expect((await view('walk')).yesterday).toBe('rest');
  });
  it('edits the message of a commit with the same id', async () => {
    const id = uuidv7();
    await req('PUT', `/api/entries/${id}`, { habit_id: walk, kind: 'done' });
    const { json } = await req('PUT', `/api/entries/${id}`, { habit_id: walk, kind: 'done', message: 'felt good' });
    expect(json.entry.message).toBe('felt good');
  });
  it('amends yesterday before 12:00 only', async () => {
    at('2026-10-20T03:30:00Z'); // 09:00 IST
    const ok = await commit(walk, { day: '2026-10-19' });
    expect(ok.json.entry.amended).toBe(true);
    at('2026-10-21T07:00:00Z'); // 12:30 IST
    expect((await commit(walk, { day: '2026-10-20' })).status).toBe(409);
  });
  it('accepts an offline commit with its tap time', async () => {
    const tapped = '2026-10-19T15:30:00Z'; // 21:00 IST on the 19th
    at('2026-10-20T07:30:00Z'); // uploaded at 13:00 IST on the 20th, too late to amend
    const { status, json } = await commit(walk, { at: tapped });
    expect(status).toBe(200);
    expect(json.entry).toMatchObject({ day: '2026-10-19', amended: false, created_at: new Date(tapped).toISOString() });
  });
  it('rejects a tap time from the future or older than 48 h', async () => {
    expect((await commit(walk, { at: '2026-10-19T04:00:00Z' })).status).toBe(400); // 30 min ahead
    expect((await commit(walk, { at: '2026-10-17T03:00:00Z' })).status).toBe(400);
    expect((await commit(walk, { at: 'nope' })).status).toBe(400);
  });
  it('rejects a day before the branch existed', async () => {
    at('2026-10-20T03:30:00Z');
    const late = (await req('POST', '/api/habits', { slug: 'late' })).json.id;
    expect((await commit(late, { day: '2026-10-19' })).status).toBe(409);
  });
});

describe('misses and streaks', () => {
  let walk: string;
  beforeEach(async () => {
    await pairDevice();
    walk = (await req('POST', '/api/habits', { slug: 'walk' })).json.id;
    store.rollover(); // first run sets the start point
  });

  it('records a miss and shows one card', async () => {
    await commit(walk);
    at('2026-10-21T03:30:00Z'); // skipped the 20th
    store.rollover();
    const t = await today();
    expect(t.misses).toHaveLength(1);
    expect(t.misses[0]).toMatchObject({ slug: 'walk', day: '2026-10-20', rebase: false });
    expect(t.habits[0]).toMatchObject({ streak: 1, patina: 1 });
    await req('POST', '/api/misses/seen', { ids: [t.misses[0].id] });
    expect((await today()).misses).toHaveLength(0);
  });
  it('rebases after two misses in a row', async () => {
    await commit(walk);
    at('2026-10-22T03:30:00Z'); // skipped 20th and 21st
    store.rollover();
    const t = await today();
    expect(t.misses.map(m => m.rebase)).toEqual([false, true]);
    expect((await view('walk')).streak).toBe(0);
    expect((await view('walk')).best).toBe(1);
  });
  it('replaces a miss when you amend it', async () => {
    at('2026-10-20T03:30:00Z');
    store.rollover();
    await commit(walk, { day: '2026-10-19' });
    const t = await today();
    expect(t.misses).toHaveLength(0);
    expect(t.habits[0].streak).toBe(1);
  });
  it('builds the 7-day strip', async () => {
    await commit(walk);
    at('2026-10-21T03:30:00Z');
    store.rollover();
    const strip = (await today()).strip;
    expect(strip.slice(-3).map(s => s.state)).toEqual(['full', 'miss', 'open']);
    expect(strip.slice(-3).map(s => s.p)).toEqual([1, 0, 0]);
    expect(strip[0].state).toBe('none');
  });
});

describe('settings and export', () => {
  beforeEach(pairDevice);

  it('validates settings', async () => {
    expect((await req('PATCH', '/api/settings', { theme: 'bathory' })).json.theme).toBe('bathory');
    expect((await req('PATCH', '/api/settings', { theme: 'neon' })).status).toBe(400);
    expect((await req('PATCH', '/api/settings', { day_start_hour: 9 })).status).toBe(400);
    expect((await req('PATCH', '/api/settings', { tz: 'Mars/Base' })).status).toBe(400);
  });
  it('exports all data', async () => {
    const h = (await req('POST', '/api/habits', { slug: 'walk' })).json;
    await commit(h.id);
    const { json } = await req('GET', '/api/export');
    expect(json).toMatchObject({ app: 'reflog', version: 1 });
    expect(json.entries).toHaveLength(1);
  });
});

describe('log', () => {
  let walk: string, read: string;
  beforeEach(async () => {
    await pairDevice();
    walk = (await req('POST', '/api/habits', { slug: 'walk' })).json.id;
    read = (await req('POST', '/api/habits', { slug: 'read', days_mask: 0b0000001 })).json.id; // Mondays
    store.rollover();
  });

  it('returns days newest first with one cell for each branch', async () => {
    await commit(walk, { message: 'park' });
    at('2026-10-21T03:30:00Z'); // Wed; 20th skipped
    store.rollover();
    const { json } = await req('GET', '/api/log');
    expect(json.habits.map((h: any) => h.slug)).toEqual(['walk', 'read']);
    expect(json.days.map((d: any) => d.day)).toEqual(['2026-10-21', '2026-10-20', '2026-10-19']);
    const [wed, tue, mon] = json.days;
    expect(wed.cells.map((c: any) => c.state)).toEqual(['open', 'none']);
    expect(tue.cells.map((c: any) => c.state)).toEqual(['miss', 'none']);
    expect(mon.cells.map((c: any) => c.state)).toEqual(['done', 'miss']);
    expect(mon.cells[0].entry.message).toBe('park');
    expect(json.next).toBeNull();
  });

  it('marks the second miss as a rebase', async () => {
    at('2026-10-22T03:30:00Z');
    store.rollover();
    const { json } = await req('GET', '/api/log');
    const walkCells = json.days.map((d: any) => d.cells[0]);
    expect(walkCells.map((c: any) => [c.state, c.rebase])).toEqual([['open', false], ['miss', true], ['miss', true], ['miss', false]]);
  });

  it('pages with before and next', async () => {
    at('2026-11-10T03:30:00Z');
    const p1 = (await req('GET', '/api/log?days=7')).json;
    expect(p1.days).toHaveLength(7);
    expect(p1.next).toBe('2026-11-04');
    const p2 = (await req('GET', `/api/log?days=7&before=${p1.next}`)).json;
    expect(p2.days[0].day).toBe('2026-11-03');
    expect((await req('GET', '/api/log?before=bad')).status).toBe(400);
  });

  it('hides archived branches without entries in the page', async () => {
    await req('PATCH', `/api/habits/${read}`, { archived: true });
    at('2026-10-20T03:30:00Z');
    const { json } = await req('GET', '/api/log?days=1');
    expect(json.habits.map((h: any) => h.slug)).toEqual(['walk']);
  });
});

describe('branch detail', () => {
  it('returns the 12-week grid, totals and next tag', async () => {
    await pairDevice();
    const walk = (await req('POST', '/api/habits', { slug: 'walk' })).json.id;
    store.rollover();
    await commit(walk);
    at('2026-10-21T03:30:00Z'); // Wed
    store.rollover();
    await commit(walk);
    const { json } = await req('GET', `/api/habits/${walk}`);
    expect(json.grid).toHaveLength(84);
    expect(json.grid[77].day).toBe('2026-10-19'); // Monday of this week
    expect(json.grid.slice(77, 81).map((c: any) => c.state)).toEqual(['done', 'miss', 'done', 'future']);
    expect(json.grid[0].state).toBe('none');
    expect(json).toMatchObject({ total: 2, streak: 2, week: { complete: 2, scheduled: 7 }, next_tag: { name: 'v0.1.0', to_go: 5 } });
    expect((await req('GET', '/api/habits/nope')).status).toBe(404);
  });
});

describe('push', () => {
  const sub = (n: number) => ({ subscription: { endpoint: `https://push.example/${n}`, keys: { p256dh: 'p', auth: 'a' } }, device: 'test' });
  let water: string;
  beforeEach(async () => {
    await pairDevice();
    water = (await req('POST', '/api/habits', { slug: 'water', remind_at: '10:00' })).json.id;
    await req('POST', '/api/habits', { slug: 'read' });
    store.patchSettings({ evening_at: '21:30' });
  });

  it('makes a VAPID key once and keeps it', async () => {
    const a = (await req('GET', '/api/push/key')).json.key;
    expect(a).toMatch(/^[A-Za-z0-9_-]{80,}$/);
    expect((await req('GET', '/api/push/key')).json.key).toBe(a);
  });
  it('stores and removes subscriptions', async () => {
    expect((await req('POST', '/api/push/subscribe', sub(1))).json.subscriptions).toBe(1);
    expect((await req('POST', '/api/push/subscribe', sub(1))).json.subscriptions).toBe(1);
    expect((await req('POST', '/api/push/subscribe', { subscription: { endpoint: 'http://x' } })).status).toBe(400);
    expect((await req('DELETE', '/api/push/subscribe', { endpoint: 'https://push.example/1' })).json.subscriptions).toBe(0);
  });
  it('sends a reminder once, inside the window, only for open branches', async () => {
    await req('POST', '/api/push/subscribe', sub(1));
    at('2026-10-19T04:00:00Z'); // 09:30 IST
    await push.tick();
    expect(sent).toHaveLength(0);
    at('2026-10-19T04:35:00Z'); // 10:05 IST
    await push.tick();
    await push.tick();
    expect(sent.map(s => s.payload.body)).toEqual(['water has uncommitted changes.']);
    expect(sent[0].payload).toMatchObject({ tag: 'remind-water', slug: 'water' });
  });
  it('does not remind a committed branch', async () => {
    await req('POST', '/api/push/subscribe', sub(1));
    await commit(water);
    at('2026-10-19T04:31:00Z');
    await push.tick();
    expect(sent).toHaveLength(0);
  });
  it('sends one evening summary with the open count', async () => {
    await req('POST', '/api/push/subscribe', sub(1));
    at('2026-10-19T16:00:00Z'); // 21:30 IST
    await push.tick();
    await push.tick();
    expect(sent.map(s => s.payload.body)).toEqual(['2 branches behind. 1 tap each.']);
  });
  it('respects the global switch', async () => {
    await req('POST', '/api/push/subscribe', sub(1));
    await req('PATCH', '/api/settings', { push_enabled: false });
    at('2026-10-19T04:31:00Z');
    await push.tick();
    expect(sent).toHaveLength(0);
  });
  it('drops subscriptions that are gone', async () => {
    await req('POST', '/api/push/subscribe', sub(1));
    await req('POST', '/api/push/subscribe', sub(2));
    gone.add('https://push.example/1');
    expect((await req('POST', '/api/push/test')).json.sent).toBe(1);
    expect(push.count()).toBe(1);
  });
});

describe('import', () => {
  beforeEach(pairDevice);

  it('round-trips an export', async () => {
    const h = (await req('POST', '/api/habits', { slug: 'walk', remind_at: '07:00' })).json;
    await commit(h.id, { message: 'park' });
    await req('PATCH', '/api/settings', { theme: 'gruvbox' });
    const dump = (await req('GET', '/api/export')).json;
    await req('PATCH', `/api/habits/${h.id}`, { slug: 'changed' });
    await req('POST', '/api/habits', { slug: 'extra' });
    const { status, json } = await req('POST', '/api/import', dump);
    expect(status).toBe(200);
    expect(json).toEqual({ habits: 1, entries: 1 });
    const t = await today();
    expect(t.habits.map(x => x.slug)).toEqual(['walk']);
    expect(t.habits[0].entry?.message).toBe('park');
    expect(t.settings.theme).toBe('gruvbox');
  });
  it('rejects bad files and keeps the data', async () => {
    await req('POST', '/api/habits', { slug: 'walk' });
    expect((await req('POST', '/api/import', { app: 'other' })).status).toBe(400);
    expect((await req('POST', '/api/import', { app: 'reflog', version: 1, habits: [{ id: 'x', slug: 'Bad Slug' }], entries: [] })).status).toBe(400);
    expect((await today()).habits).toHaveLength(1);
  });
});

describe('release notes', () => {
  it('shows last week once, on the first open of the new week', async () => {
    await pairDevice();
    at('2026-10-12T03:30:00Z'); // Mon of the previous week
    const walk = (await req('POST', '/api/habits', { slug: 'walk' })).json.id;
    store.rollover();
    for (let i = 0; i < 6; i++) { at(`2026-10-${12 + i}T03:30:00Z`); store.rollover(); await commit(walk); }
    at('2026-10-19T03:30:00Z'); // Mon; Sunday the 18th was missed
    store.rollover();
    const n = (await today()).release_notes!;
    expect(n).toMatchObject({ version: 'v2026.42', commits: 6, rest: 0, miss: 1, longest: { slug: 'walk', streak: 6 } });
    expect(n.new_best).toEqual([{ slug: 'walk', best: 6 }]);
    await req('POST', '/api/notes/seen', { version: n.version });
    expect((await today()).release_notes).toBeNull();
  });
  it('is empty with no activity last week', async () => {
    await pairDevice();
    await req('POST', '/api/habits', { slug: 'walk' });
    expect((await today()).release_notes).toBeNull();
  });
});

describe('profile', () => {
  beforeEach(pairDevice);

  it('has defaults and totals', async () => {
    const walk = (await req('POST', '/api/habits', { slug: 'walk' })).json.id;
    store.rollover();
    for (let i = 0; i < 7; i++) { at(`2026-10-${19 + i}T03:30:00Z`); store.rollover(); await commit(walk); }
    const { json } = await req('GET', '/api/profile');
    expect(json).toMatchObject({ name: 'you', avatar: '🌱', since: '2026-10-19', totals: { commits: 7, best_now: 7, tags: 1, days: 7 } });
  });
  it('validates name and avatar', async () => {
    expect((await req('PATCH', '/api/profile', { name: '  noor ', avatar: 'NS' })).json).toMatchObject({ name: 'noor', avatar: 'NS' });
    expect((await req('PATCH', '/api/profile', { avatar: '🦉' })).json.avatar).toBe('🦉');
    expect((await req('PATCH', '/api/profile', { name: '' })).status).toBe(400);
    expect((await req('PATCH', '/api/profile', { name: 'x'.repeat(25) })).status).toBe(400);
    expect((await req('PATCH', '/api/profile', { avatar: '<b>' })).status).toBe(400);
    expect((await req('PATCH', '/api/profile', { avatar: 'abc' })).status).toBe(400);
  });
});

describe('devices', () => {
  it('lists devices, marks the current one, removes others only', async () => {
    await pairDevice();          // device 1
    await pairDevice();          // device 2, now current
    const list = (await req('GET', '/api/devices')).json;
    expect(list).toHaveLength(2);
    expect(list.map((d: any) => d.current)).toEqual([false, true]);
    expect(list[0]).not.toHaveProperty('token_hash');
    expect((await req('DELETE', `/api/devices/${list[1].id}`)).status).toBe(409);
    expect((await req('DELETE', `/api/devices/${list[0].id}`)).json).toHaveLength(1);
    expect((await req('DELETE', `/api/devices/${list[0].id}`)).status).toBe(404);
  });
  it('signs out a removed device at once', async () => {
    await pairDevice();
    const first = cookie;
    await pairDevice();
    const [d1] = (await req('GET', '/api/devices')).json;
    await req('DELETE', `/api/devices/${d1.id}`);
    cookie = first;
    expect((await req('GET', '/api/today')).status).toBe(401);
  });
});

describe('about', () => {
  it('returns version info', async () => {
    await pairDevice();
    expect((await req('GET', '/api/about')).json).toEqual({ version: 'dev', build: null });
  });
});
