import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { DB } from './db.ts';
import type { Device } from '../../shared/src/api.ts';
import { uuidv7 } from '../../shared/src/ids.ts';

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_TRIES = 5;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Device pairing with a 6-digit code. Refer to docs/05-data-api.md §3. */
export class Pairing {
  private code: string | null = null;
  private expires = 0;
  private tries = 0;

  private db: DB;
  private now: () => number;

  constructor(db: DB, now: () => number = Date.now) {
    this.db = db;
    this.now = now;
  }

  hasDevices(): boolean {
    return !!this.db.prepare('SELECT 1 FROM device LIMIT 1').get();
  }

  newCode(): { code: string; expires_at: string } {
    this.code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    this.expires = this.now() + CODE_TTL_MS;
    this.tries = 0;
    return { code: this.code, expires_at: new Date(this.expires).toISOString() };
  }

  /** Returns a new device token, or null. */
  pair(code: string, name: string | null): string | null {
    if (!this.code || this.now() > this.expires) return null;
    const a = Buffer.from(String(code).padEnd(6).slice(0, 6));
    const ok = timingSafeEqual(a, Buffer.from(this.code));
    if (!ok) {
      if (++this.tries >= MAX_TRIES) this.code = null;
      return null;
    }
    this.code = null;
    const token = randomBytes(32).toString('base64url');
    const at = new Date(this.now()).toISOString();
    this.db.prepare('INSERT INTO device (id, token_hash, name, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv7(this.now()), sha256(token), name?.slice(0, 40) ?? null, at, at);
    return token;
  }

  /** Returns the device id for a valid token, or null. */
  check(token: string | undefined): string | null {
    if (!token) return null;
    const h = sha256(token);
    const row = this.db.prepare('SELECT id, last_seen_at FROM device WHERE token_hash = ?').get(h) as { id: string; last_seen_at: string } | undefined;
    if (!row) return null;
    if (this.now() - new Date(row.last_seen_at).getTime() > 36e5) {
      this.db.prepare('UPDATE device SET last_seen_at = ? WHERE token_hash = ?').run(new Date(this.now()).toISOString(), h);
    }
    return row.id;
  }

  list(currentId: string): Device[] {
    const rows = this.db.prepare('SELECT id, name, created_at, last_seen_at FROM device ORDER BY created_at').all() as Omit<Device, 'current'>[];
    return rows.map(r => ({ ...r, current: r.id === currentId }));
  }

  /** Remove another device. Its cookie stops working at once. */
  remove(id: string, currentId: string): boolean {
    if (id === currentId) return false;
    return Number(this.db.prepare('DELETE FROM device WHERE id = ?').run(id).changes) > 0;
  }
}
