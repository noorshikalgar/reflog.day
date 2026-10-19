// Dev only: fill a database with 10 branches and 30 days of history.
// Usage: REFLOG_DATA=/tmp/reflog-seed node server/src/seed.ts
import { mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { openDb } from './db.ts';
import { Store } from './store.ts';
import { uuidv7 } from '../../shared/src/ids.ts';

const DATA = resolve(process.env.REFLOG_DATA ?? '');
if (!process.env.REFLOG_DATA || existsSync(join(DATA, 'reflog.db'))) {
  console.error('Set REFLOG_DATA to a new, empty folder. The seed never touches an existing database.');
  process.exit(1);
}
mkdirSync(DATA, { recursive: true });

const DAYS = 30;
const real = Date.now();
let now = new Date(real - DAYS * 864e5);
const store = new Store(openDb(join(DATA, 'reflog.db')), () => now);
store.patchSettings({ tz: process.env.TZ || 'Asia/Kolkata' });

const B: [string, number, number, string | null, string[]][] = [
  ['walk', 1, 127, '07:00', ['4.2k steps, park', 'rainy, 20 min', 'done']],
  ['read', 2, 127, '22:00', ['20 pages', 'finished ch. 4', '15 pages']],
  ['water', 6, 127, '10:00', ['2L', '2L before lunch', '2.5L']],
  ['stretch', 3, 0b0011111, '18:30', ['10 min', 'yoga', 'hips']],
  ['gym', 4, 0b0010101, null, ['legs. ouch.', 'push day', 'pull day']],
  ['meditate', 8, 127, null, ['10 min', '5 min, still counts', 'headspace']],
  ['journal', 5, 127, '22:30', ['3 lines', 'brain dump', 'gratitude']],
  ['no-sugar', 7, 127, null, ['clean', 'skipped dessert', 'clean']],
  ['sleep-11', 10, 127, null, ['22:52', '23:04', '22:40']],
  ['guitar', 9, 0b1101010, null, ['chords', 'riff practice', '15 min']],
];
const ids = B.map(([slug, lane, days_mask, remind_at]) => store.createHabit({ slug, lane, days_mask, remind_at }).id);
store.rollover();

let seed = 7;
const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

for (let d = 0; d <= DAYS; d++) {
  const base = real - (DAYS - d) * 864e5 - 15 * 36e5; // keep every entry in the past
  ids.forEach((id, i) => {
    now = new Date(base + (2 + i * 0.7 + rnd() * 6) * 36e5);
    const r = rnd();
    const last = d === DAYS;
    if (last && i >= 6) return; // leave some open today
    const kind = r < 0.08 ? null : r < 0.13 ? 'rest' : 'done';
    if (!kind) return;
    try { store.putEntry(uuidv7(now.getTime()), { habit_id: id, kind, message: kind === 'done' ? B[i][4][Math.floor(rnd() * 3)] : null }); }
    catch { /* not scheduled or no rest left */ }
  });
  now = new Date(base + 14 * 36e5); // never jump past the real clock
  store.rollover();
}
now = new Date(real);
store.rollover();
console.log(`seeded ${ids.length} branches, ${DAYS} days → ${DATA}`);
