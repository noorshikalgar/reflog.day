// Offline outbox: writes made without a network wait in IndexedDB and go out later.
// Refer to docs/04-architecture.md §4 and docs/06-pwa-notifications.md §3. iOS has no
// Background Sync, so we flush on app open, on `online` and when the app becomes visible.
import { api, ApiError } from './api.ts';

export interface QueuedEntry {
  id: string;
  habit_id: string;
  kind: 'done' | 'rest';
  day: string;
  message: string | null;
  queued_at: string;
}

const DB = 'reflog';
const STORE = 'outbox';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const outbox = {
  all: () => tx<QueuedEntry[]>('readonly', s => s.getAll() as IDBRequest<QueuedEntry[]>).catch(() => [] as QueuedEntry[]),
  put: (e: QueuedEntry) => tx('readwrite', s => s.put(e)),
  remove: (id: string) => tx('readwrite', s => s.delete(id)).catch(() => undefined),
};

/** True for a fetch that never reached the server. */
export const isNetworkError = (e: unknown) => e instanceof TypeError || (e instanceof ApiError && e.status >= 502 && e.status <= 504);

let flushing: Promise<{ sent: number; dropped: string[] }> | null = null;

/** Send queued entries in order. Stops at the first network error. */
export function flush(): Promise<{ sent: number; dropped: string[] }> {
  flushing ??= (async () => {
    let sent = 0;
    const dropped: string[] = [];
    try {
      const items = (await outbox.all()).sort((a, b) => a.queued_at.localeCompare(b.queued_at));
      for (const q of items) {
        try {
          await api.putEntry(q.id, { habit_id: q.habit_id, kind: q.kind, day: q.day, message: q.message, at: q.queued_at });
          await outbox.remove(q.id);
          sent++;
        } catch (e) {
          if (isNetworkError(e)) break;
          if (e instanceof ApiError && e.status === 401) break;
          // The server said no (for example: too late to amend). Drop it and tell the user.
          await outbox.remove(q.id);
          dropped.push((e as Error).message);
        }
      }
    } finally {
      flushing = null;
    }
    return { sent, dropped };
  })();
  return flushing;
}
