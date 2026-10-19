import type { Theme, TodayView } from '../../../shared/src/api.ts';
import { api, ApiError, fromCache } from './api.ts';
import { flush, isNetworkError, outbox, type QueuedEntry } from './outbox.ts';

export type Tab = 'status' | 'log' | 'branches';

export const app = $state({
  paired: true,
  loading: true,
  online: true,
  /** Commits waiting in the offline outbox. */
  queued: 0,
  /** Bumped after each local write, so other open screens can reload. */
  rev: 0,
  tab: 'status' as Tab,
  newBranch: false,
  /** Branch id shown on the `show` screen, over the current tab. */
  show: null as string | null,
  /** Branch id to open in the editor on the branches tab. */
  editId: null as string | null,
  /** Branch slug to light up on `status` (from a notification tap). */
  focus: null as string | null,
  today: null as TodayView | null,
});

export const toast = $state({ text: '', undo: null as null | (() => void), seq: 0 });

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(text: string, undo: null | (() => void) = null, ms = 10_000) {
  toast.text = text;
  toast.undo = undo;
  toast.seq++;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.text = ''; toast.undo = null; }, ms);
}
export function hideToast() {
  clearTimeout(toastTimer);
  toast.text = '';
  toast.undo = null;
}

const THEME_COLOR: Record<Theme, string> = { terminal: '#0b0d12', bathory: '#000000', gruvbox: '#282828', paper: '#f5f4ef' };

export function applyTheme(t: Theme) {
  if (t === 'terminal') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[t]);
  try { if (t === 'terminal') localStorage.removeItem('rl_theme'); else localStorage.setItem('rl_theme', t); } catch { /* private mode */ }
}

/** Show queued (offline) commits on top of the view from the server or the cache. */
export function overlay(view: TodayView, queued: QueuedEntry[]): TodayView {
  for (const q of queued) {
    if (q.day !== view.day) continue;
    const h = view.habits.find(x => x.id === q.habit_id);
    if (!h || (h.entry && h.entry.kind !== 'miss')) continue;
    h.entry = { id: q.id, habit_id: q.habit_id, day: q.day, kind: q.kind, hash: '·······', message: q.message, amended: false, seen_at: null, created_at: q.queued_at };
    if (q.kind === 'done') h.streak++;
  }
  return view;
}

let refreshing = false;
export async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    const sent = await flush();
    if (sent.dropped.length) showToast(`dropped ${sent.dropped.length} queued commit(s): ${sent.dropped[0]}`, null, 5000);
    const view = await api.today();
    const queued = await outbox.all();
    app.queued = queued.length;
    app.today = overlay(view, queued);
    app.rev++;
    app.paired = true;
    app.online = !fromCache(view);
    applyTheme(app.today.settings.theme);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) app.paired = false;
    else if (isNetworkError(e)) app.online = false;
    else app.online = false;
  } finally {
    refreshing = false;
    app.loading = false;
  }
}

export function go(tab: Tab) {
  app.show = null;
  if (tab === app.tab) return;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (doc.startViewTransition && !reduce) doc.startViewTransition(() => { app.tab = tab; });
  else app.tab = tab;
}
