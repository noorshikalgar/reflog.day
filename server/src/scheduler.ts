import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { localClock } from '../../shared/src/rules.ts';
import type { Store } from './store.ts';

const KEEP_BACKUPS = 14;

/** One tick each minute: rollover misses, daily backup. Push reminders come in phase 3. */
export function startScheduler(store: Store, dataDir: string) {
  const backups = join(dataDir, 'backups');
  mkdirSync(backups, { recursive: true });

  const tick = () => {
    try {
      const n = store.rollover();
      if (n) console.log(`rollover: ${n} miss rows`);
      const { date, hour } = localClock(store.now(), store.settings().tz);
      if (hour >= 3 && store.get('last_backup') !== date) {
        store.db.exec(`VACUUM INTO '${join(backups, `reflog-${date}.db`).replaceAll("'", "''")}'`);
        store.set('last_backup', date);
        const old = readdirSync(backups).filter(f => /^reflog-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -KEEP_BACKUPS);
        for (const f of old) rmSync(join(backups, f));
        console.log(`backup: reflog-${date}.db`);
      }
    } catch (e) {
      console.error('scheduler', e);
    }
  };
  tick();
  return setInterval(tick, 60_000);
}
