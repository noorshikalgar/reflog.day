import webpush from 'web-push';
import type { DB } from './db.ts';
import type { Store } from './store.ts';
import { HttpError } from './store.ts';
import { addMinutes, isScheduled, localClock, logicalDay } from '../../shared/src/rules.ts';

export interface PushPayload { title: string; body: string; tag: string; slug?: string }
export interface Subscription { endpoint: string; keys: { p256dh: string; auth: string } }

/** Sends one message. Returns false when the subscription is gone (404/410). */
export type Sender = (sub: Subscription, payload: PushPayload, vapid: Vapid) => Promise<boolean>;
export interface Vapid { publicKey: string; privateKey: string; subject: string }

/** Real sender: Web Push through the browser vendor's push service. */
export const webPushSender: Sender = async (sub, payload, vapid) => {
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), {
      vapidDetails: vapid, TTL: 4 * 3600, urgency: 'normal', topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || undefined,
    });
    return true;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return false;
    throw e;
  }
};

const WINDOW_MIN = 30; // send a missed reminder up to 30 min late (server asleep, restart)

export class Push {
  private store: Store;
  private db: DB;
  private send: Sender;
  private subject: string;

  constructor(store: Store, send: Sender = webPushSender, subject = process.env.REFLOG_PUSH_SUBJECT ?? 'https://reflog.day') {
    this.store = store;
    this.db = store.db;
    this.send = send;
    this.subject = subject;
  }

  /** VAPID keys are made at first use and kept in the database, never in files. */
  vapid(): Vapid {
    let pub = this.store.get('vapid_public');
    let priv = this.store.get('vapid_private');
    if (!pub || !priv) {
      const k = webpush.generateVAPIDKeys();
      this.store.set('vapid_public', (pub = k.publicKey));
      this.store.set('vapid_private', (priv = k.privateKey));
    }
    return { publicKey: pub, privateKey: priv, subject: this.subject };
  }

  subscribe(sub: Subscription, device: string | null) {
    if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) throw new HttpError(400, 'invalid subscription');
    this.db.prepare(`INSERT INTO push_sub (endpoint, p256dh, auth, device, created_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`)
      .run(sub.endpoint, sub.keys.p256dh, sub.keys.auth, device?.slice(0, 40) ?? null, this.store.now().toISOString());
  }

  unsubscribe(endpoint: string) {
    this.db.prepare('DELETE FROM push_sub WHERE endpoint = ?').run(String(endpoint));
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM push_sub').get() as { n: number }).n;
  }

  /** Send to every subscription. Removes the ones that are gone. Returns the number delivered. */
  async broadcast(payload: PushPayload): Promise<number> {
    const subs = this.db.prepare('SELECT endpoint, p256dh, auth FROM push_sub').all() as { endpoint: string; p256dh: string; auth: string }[];
    const vapid = this.vapid();
    let ok = 0;
    for (const s of subs) {
      try {
        if (await this.send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, vapid)) ok++;
        else this.unsubscribe(s.endpoint);
      } catch (e) {
        console.error('push failed', (e as Error).message);
      }
    }
    return ok;
  }

  /** Reminders and the evening summary that are due now. Each is sent once a day. */
  due(): PushPayload[] {
    const s = this.store.settings();
    if (!s.push_enabled) return [];
    const now = this.store.now();
    const { hm } = localClock(now, s.tz);
    const today = logicalDay(now, s.tz, s.day_start_hour);
    const inWindow = (at: string) => at <= hm && hm < addMinutes(at, WINDOW_MIN);
    const view = this.store.todayView();
    const open = view.habits.filter(h => h.scheduled && !(h.entry && h.entry.kind !== 'miss'));
    const out: PushPayload[] = [];

    for (const h of open) {
      if (!h.remind_at || !inWindow(h.remind_at) || !isScheduled(h.days_mask, today)) continue;
      const key = `sent_remind:${h.id}`;
      if (this.store.get(key) === today) continue;
      this.store.set(key, today);
      out.push({ title: 'reflog', body: `${h.slug} has uncommitted changes.`, tag: `remind-${h.slug}`, slug: h.slug });
    }

    if (inWindow(s.evening_at) && this.store.get('sent_evening') !== today) {
      this.store.set('sent_evening', today);
      if (open.length) {
        const n = open.length;
        out.push({ title: 'reflog', body: `${n} branch${n > 1 ? 'es' : ''} behind. 1 tap each.`, tag: 'evening' });
      }
    }
    return out;
  }

  async tick() {
    if (!this.count()) return;
    for (const p of this.due()) await this.broadcast(p);
  }
}
