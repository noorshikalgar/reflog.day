// reflog service worker. Refer to docs/06-pwa-notifications.md §3.
const VERSION = 'v2';
const SHELL = `reflog-shell-${VERSION}`;
const DATA = `reflog-data-${VERSION}`;
const SHELL_URLS = ['/', '/manifest.webmanifest', '/icons/icon.svg', '/icons/192.png'];
const CACHED_API = ['/api/today', '/api/habits', '/api/settings'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SHELL && k !== DATA) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (!hit) throw new Error('offline');
    // Mark it, so the app can say "offline" while it shows the last data.
    const headers = new Headers(hit.headers);
    headers.set('x-reflog-cache', '1');
    return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(new Request('/'), SHELL));
  } else if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(cacheFirst(req)); // hashed file names, safe to keep
  } else if (CACHED_API.includes(url.pathname)) {
    e.respondWith(networkFirst(req, DATA));
  }
});

// Web Push (phase 3). The server sends { title, body, tag, slug }.
self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.title || 'reflog', {
    body: d.body || '',
    tag: d.tag || 'reflog',
    icon: '/icons/192.png',
    badge: '/icons/192.png',
    data: { url: d.slug ? `/?focus=${encodeURIComponent(d.slug)}` : '/' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find(c => new URL(c.url).origin === location.origin);
    if (open) { await open.focus(); open.navigate(url); }
    else await self.clients.openWindow(url);
  })());
});
