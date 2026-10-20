// Same API as the web app (shared/src/api.ts types), with a Bearer token instead of a cookie.
import type { Entry, HabitView, TodayView } from '../../../shared/src/api.ts';
import { clearSession, getState, setState } from './store.ts';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

async function call<T>(method: string, path: string, body?: unknown, base?: string, token?: string | null): Promise<T> {
  const s = getState();
  const url = (base ?? s.server ?? '') + path;
  const res = await fetch(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...((token ?? s.token) ? { authorization: `Bearer ${token ?? s.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/pair') { await clearSession(); }
  if (!res.ok) throw new ApiError(res.status, (json as { error?: string }).error ?? `HTTP ${res.status}`);
  return json as T;
}

export const api = {
  pair: (server: string, code: string) => call<{ ok: true; token: string }>('POST', '/api/pair', { code, name: 'iphone', client: 'app' }, server, null),
  today: () => call<TodayView>('GET', '/api/today'),
  putEntry: (id: string, body: { habit_id: string; kind: 'done' | 'rest'; day?: string; message?: string | null; at?: string }) =>
    call<{ entry: Entry; habit: HabitView }>('PUT', `/api/entries/${id}`, body),
  deleteEntry: (id: string) => call<{ habit: HabitView }>('DELETE', `/api/entries/${id}`),
};

export async function refresh() {
  try {
    const today = await api.today();
    setState({ today, online: true, theme: today.settings.theme });
  } catch (e) {
    if (!(e instanceof ApiError)) setState({ online: false });
  }
}
