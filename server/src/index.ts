import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Pairing } from './auth.ts';
import { createApp } from './app.ts';
import { openDb } from './db.ts';
import { Push } from './push.ts';
import { startScheduler } from './scheduler.ts';
import { Store } from './store.ts';

const PORT = Number(process.env.PORT ?? 8740);
const HOST = process.env.HOST ?? '127.0.0.1';
const DATA = resolve(process.env.REFLOG_DATA ?? './data');
const WEB = resolve(import.meta.dirname, '../../web/dist');

mkdirSync(join(DATA, 'backups'), { recursive: true });
const db = openDb(join(DATA, 'reflog.db'));
const store = new Store(db);
const pairing = new Pairing(db);
const push = new Push(store);
const ROOT = resolve(import.meta.dirname, '../..');
const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version ?? 'dev';
let build: string | null = process.env.REFLOG_BUILD ?? null;
if (!build) { try { build = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { build = null; } }
const app = createApp(store, pairing, push, { backupDir: join(DATA, 'backups'), about: { version, build } });

// Built web app. The service worker must not be cached by the browser.
app.use('/sw.js', async (c, next) => { await next(); c.header('Cache-Control', 'no-cache'); });
app.use('/*', serveStatic({ root: WEB }));
app.get('*', serveStatic({ root: WEB, path: 'index.html' }));

startScheduler(store, push, DATA);

serve({ fetch: app.fetch, port: PORT, hostname: HOST }, info => {
  console.log(`reflog on http://${HOST}:${info.port}  (data: ${DATA})`);
  if (!pairing.hasDevices()) {
    const { code } = pairing.newCode();
    console.log(`\n  pairing code: ${code}   (valid 10 min)\n`);
  }
});
