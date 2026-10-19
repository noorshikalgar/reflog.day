import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { Pairing } from './auth.ts';
import { HttpError, type Store } from './store.ts';

const COOKIE = 'rl_dev';

export function createApp(store: Store, pairing: Pairing) {
  const app = new Hono();

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
    if (!pairing.check(getCookie(c, COOKIE))) return c.json({ error: 'unpaired' }, 401);
    await next();
  });

  app.post('/api/pair/new', c => c.json(pairing.newCode()));

  app.get('/api/today', c => c.json(store.todayView()));

  app.get('/api/log', c => {
    const before = c.req.query('before');
    if (before !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(before)) return c.json({ error: 'before must be YYYY-MM-DD' }, 400);
    return c.json(store.logView(before, Number(c.req.query('days') ?? 14)));
  });

  app.get('/api/habits', c => c.json(store.habits(true)));
  app.post('/api/habits', async c => c.json(store.createHabit(await c.req.json()), 201));
  app.patch('/api/habits/:id', async c => c.json(store.updateHabit(c.req.param('id'), await c.req.json())));

  app.put('/api/entries/:id', async c => c.json(store.putEntry(c.req.param('id'), await c.req.json())));
  app.delete('/api/entries/:id', c => c.json(store.deleteEntry(c.req.param('id'))));
  app.post('/api/misses/seen', async c => {
    const { ids } = await c.req.json<{ ids?: string[] }>();
    store.markMissesSeen(Array.isArray(ids) ? ids.map(String) : []);
    return c.json({ ok: true });
  });

  app.get('/api/settings', c => c.json(store.settings()));
  app.patch('/api/settings', async c => c.json(store.patchSettings(await c.req.json())));

  app.get('/api/export', c => {
    c.header('Content-Disposition', `attachment; filename="reflog-${store.today()}.json"`);
    return c.json(store.exportAll());
  });

  app.all('/api/*', c => c.json({ error: 'not found' }, 404));
  return app;
}
