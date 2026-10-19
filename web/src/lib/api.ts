import type { Entry, Habit, HabitDetail, HabitInput, HabitView, LogView, Settings, TodayView } from '../../../shared/src/api.ts';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error ?? res.statusText);
  if (res.headers.get('x-reflog-cache')) Object.defineProperty(json, 'fromCache', { value: true });
  return json as T;
}

export const api = {
  pair: (code: string, name: string) => call<{ ok: true }>('POST', '/api/pair', { code, name }),
  newPairCode: () => call<{ code: string; expires_at: string }>('POST', '/api/pair/new'),
  today: () => call<TodayView>('GET', '/api/today'),
  log: (before?: string, days = 14) => call<LogView>('GET', `/api/log?days=${days}${before ? `&before=${before}` : ''}`),
  habits: () => call<Habit[]>('GET', '/api/habits'),
  habit: (id: string) => call<HabitDetail>('GET', `/api/habits/${id}`),
  createHabit: (h: HabitInput) => call<Habit>('POST', '/api/habits', h),
  updateHabit: (id: string, h: HabitInput & { archived?: boolean }) => call<Habit>('PATCH', `/api/habits/${id}`, h),
  putEntry: (id: string, body: { habit_id: string; kind: 'done' | 'rest'; day?: string; message?: string | null; at?: string }) =>
    call<{ entry: Entry; habit: HabitView }>('PUT', `/api/entries/${id}`, body),
  deleteEntry: (id: string) => call<{ habit: HabitView }>('DELETE', `/api/entries/${id}`),
  missesSeen: (ids: string[]) => call<{ ok: true }>('POST', '/api/misses/seen', { ids }),
  pushKey: () => call<{ key: string; subscriptions: number }>('GET', '/api/push/key'),
  pushSubscribe: (subscription: PushSubscriptionJSON, device: string) => call<{ ok: true; subscriptions: number }>('POST', '/api/push/subscribe', { subscription, device }),
  pushUnsubscribe: (endpoint: string) => call<{ ok: true; subscriptions: number }>('DELETE', '/api/push/subscribe', { endpoint }),
  pushTest: () => call<{ sent: number }>('POST', '/api/push/test'),
  patchSettings: (s: Partial<Settings>) => call<Settings>('PATCH', '/api/settings', s),
};

/** True when the service worker served the last cached copy (no network). */
export const fromCache = (x: object) => (x as { fromCache?: boolean }).fromCache === true;
