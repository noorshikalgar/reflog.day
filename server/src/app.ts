import { join } from 'node:path';
import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { Pairing } from './auth.ts';
import type { Push } from './push.ts';
import { HttpError, type Store } from './store.ts';
import type { About } from '../../shared/src/api.ts';

const COOKIE = 'rl_dev';

export function createApp(store: Store, pairing: Pairing, push: Push, opts: { backupDir?: string; about?: About } = {}) {
  const app = new Hono<{ Variables: { device: string } }>();

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
    if (err instanceof SyntaxError) return c.json({ error: 'invalid JSON' }, 400);
    console.error(err);
    return c.json({ error: 'server error' }, 500);
  });

  app.get('/api/health', c => c.json({ ok: true }));

  app.post('/api/pair', async c => {
    const { code, name } = await c.req.json<{ code?: string; name?: string }>();
    const token = pairing.pair(String(code ?? ''), name ?? null);
    if (!token) return c.json({ error: 'wrong or expired code' }, 401);
    const https = c.req.header('x-forwarded-proto') === 'https' || new URL(c.req.url).protocol === 'https:';
    setCookie(c, COOKIE, token, { httpOnly: true, secure: https, sameSite: 'Strict', path: '/', maxAge: 400 * 24 * 3600 });
    return c.json({ ok: true });
  });

  app.use('/api/*', async (c, next) => {
    const device = pairing.check(getCookie(c, COOKIE));
    if (!device) return c.json({ error: 'unpaired' }, 401);
    c.set('device', device);
    await next();
  });

  app.get('/api/profile', c => c.json(store.profile()));
  app.patch('/api/profile', async c => c.json(store.patchProfile(await c.req.json())));

  app.get('/api/devices', c => c.json(pairing.list(c.get('device'))));
  app.delete('/api/devices/:id', c => {
    const id = c.req.param('id');
    if (id === c.get('device')) return c.json({ error: 'you cannot remove this device here' }, 409);
    if (!pairing.remove(id, c.get('device'))) return c.json({ error: 'device not found' }, 404);
    return c.json(pairing.list(c.get('device')));
  });

  app.get('/api/about', c => c.json(opts.about ?? { version: 'dev', build: null }));

  app.post('/api/pair/new', c => c.json(pairing.newCode()));

  app.get('/api/today', c => c.json(store.todayView()));

  app.get('/api/log', c => {
    const before = c.req.query('before');
    if (before !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(before)) return c.json({ error: 'before must be YYYY-MM-DD' }, 400);
    return c.json(store.logView(before, Number(c.req.query('days') ?? 14)));
  });

  app.get('/api/habits', c => c.json(store.habits(true)));
  app.post('/api/habits', async c => c.json(store.createHabit(await c.req.json()), 201));
  app.get('/api/habits/:id', c => c.json(store.habitDetail(c.req.param('id'))));
  app.patch('/api/habits/:id', async c => c.json(store.updateHabit(c.req.param('id'), await c.req.json())));

  app.put('/api/entries/:id', async c => c.json(store.putEntry(c.req.param('id'), await c.req.json())));
  app.delete('/api/entries/:id', c => c.json(store.deleteEntry(c.req.param('id'))));
  app.post('/api/misses/seen', async c => {
    const { ids } = await c.req.json<{ ids?: string[] }>();
    store.markMissesSeen(Array.isArray(ids) ? ids.map(String) : []);
    return c.json({ ok: true });
  });

  app.get('/api/push/key', c => c.json({ key: push.vapid().publicKey, subscriptions: push.count() }));
  app.post('/api/push/subscribe', async c => {
    const body = await c.req.json<{ subscription: Parameters<Push['subscribe']>[0]; device?: string }>();
    push.subscribe(body.subscription, body.device ?? null);
    return c.json({ ok: true, subscriptions: push.count() });
  });
  app.delete('/api/push/subscribe', async c => {
    const { endpoint } = await c.req.json<{ endpoint?: string }>();
    push.unsubscribe(String(endpoint ?? ''));
    return c.json({ ok: true, subscriptions: push.count() });
  });
  app.post('/api/push/test', async c => {
    const sent = await push.broadcast({ title: 'reflog', body: 'test push. working tree clean.', tag: 'test' });
    return c.json({ sent });
  });

  app.get('/api/settings', c => c.json(store.settings()));
  app.patch('/api/settings', async c => c.json(store.patchSettings(await c.req.json())));

  app.get('/api/export', c => {
    c.header('Content-Disposition', `attachment; filename="reflog-${store.today()}.json"`);
    return c.json(store.exportAll());
  });

  app.post('/api/import', async c => {
    const data = await c.req.json();
    if (opts.backupDir) store.backupTo(join(opts.backupDir, `reflog-preimport-${Date.now()}.db`));
    return c.json(store.importAll(data));
  });

  app.post('/api/notes/seen', async c => {
    const { version } = await c.req.json<{ version?: string }>();
    store.notesSeen(String(version ?? ''));
    return c.json({ ok: true });
  });

  app.all('/api/*', c => c.json({ error: 'not found' }, 404));
  return app;
}
