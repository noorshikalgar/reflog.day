import { beforeEach, describe, expect, it } from 'vitest';
import { Pairing } from '../src/auth.ts';
import { createApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import { Store } from '../src/store.ts';
import { uuidv7 } from '../../shared/src/ids.ts';
import type { HabitView, TodayView } from '../../shared/src/api.ts';

// IST = UTC+05:30. 2026-10-19 09:00 IST = 03:30Z.
let now = new Date('2026-10-19T03:30:00Z');
const at = (iso: string) => { now = new Date(iso); };

let store: Store;
let pairing: Pairing;
let app: ReturnType<typeof createApp>;
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
  app = createApp(store, pairing);
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
  it('amends yesterday before 12:00 only', async () => {
    at('2026-10-20T03:30:00Z'); // 09:00 IST
    const ok = await commit(walk, { day: '2026-10-19' });
    expect(ok.json.entry.amended).toBe(true);
    at('2026-10-21T07:00:00Z'); // 12:30 IST
    expect((await commit(walk, { day: '2026-10-20' })).status).toBe(409);
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
