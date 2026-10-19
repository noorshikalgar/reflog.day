import type { Entry, Habit, HabitInput, HabitView, LogView, Settings, TodayView } from '../../../shared/src/api.ts';

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
  return json as T;
}

export const api = {
  pair: (code: string, name: string) => call<{ ok: true }>('POST', '/api/pair', { code, name }),
  newPairCode: () => call<{ code: string; expires_at: string }>('POST', '/api/pair/new'),
  today: () => call<TodayView>('GET', '/api/today'),
  log: (before?: string, days = 14) => call<LogView>('GET', `/api/log?days=${days}${before ? `&before=${before}` : ''}`),
  habits: () => call<Habit[]>('GET', '/api/habits'),
  createHabit: (h: HabitInput) => call<Habit>('POST', '/api/habits', h),
  updateHabit: (id: string, h: HabitInput & { archived?: boolean }) => call<Habit>('PATCH', `/api/habits/${id}`, h),
  putEntry: (id: string, body: { habit_id: string; kind: 'done' | 'rest'; day?: string; message?: string | null }) =>
    call<{ entry: Entry; habit: HabitView }>('PUT', `/api/entries/${id}`, body),
  deleteEntry: (id: string) => call<{ habit: HabitView }>('DELETE', `/api/entries/${id}`),
  missesSeen: (ids: string[]) => call<{ ok: true }>('POST', '/api/misses/seen', { ids }),
  patchSettings: (s: Partial<Settings>) => call<Settings>('PATCH', '/api/settings', s),
};
