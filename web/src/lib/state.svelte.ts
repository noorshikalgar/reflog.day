import type { Theme, TodayView } from '../../../shared/src/api.ts';
import { api, ApiError, fromCache } from './api.ts';
import { flush, isNetworkError, outbox, type QueuedEntry } from './outbox.ts';
import { popToRoot } from './profile.svelte.ts';

export type Tab = 'status' | 'log' | 'branches' | 'profile';
export type LogMode = 'normal' | 'compact';

const readLogView = (): LogMode => { try { return localStorage.getItem('rl_log_view') === 'compact' ? 'compact' : 'normal'; } catch { return 'normal'; } };

export const app = $state({
  paired: true,
  loading: true,
  online: true,
  /** Commits waiting in the offline outbox. */
  queued: 0,
  /** Bumped after each local write, so other open screens can reload. */
  rev: 0,
  /** Log density for this device. normal = two-line list, compact = raw git graph. */
  logView: readLogView(),
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
const PENDING_THEME = 'rl_theme_pending';
const readPending = () => { try { return localStorage.getItem(PENDING_THEME) as Theme | null; } catch { return null; } };
const writePending = (t: Theme | null) => { try { if (t) localStorage.setItem(PENDING_THEME, t); else localStorage.removeItem(PENDING_THEME); } catch { /* private mode */ } };

/** Apply a theme at once and save it to the server. Offline, it waits and goes with the next refresh. */
export async function setTheme(t: Theme) {
  applyTheme(t);
  if (app.today) app.today.settings.theme = t;
  writePending(t);
  await syncTheme();
}

async function syncTheme() {
  const t = readPending();
  if (!t) return;
  try {
    await api.patchSettings({ theme: t });
    if (readPending() === t) writePending(null);
  } catch { /* offline: keep it for the next refresh */ }
}

export async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    await syncTheme();
    const sent = await flush();
    if (sent.dropped.length) showToast(`dropped ${sent.dropped.length} queued commit(s): ${sent.dropped[0]}`, null, 5000);
    const view = await api.today();
    const queued = await outbox.all();
    app.queued = queued.length;
    app.today = overlay(view, queued);
    app.rev++;
    app.paired = true;
    app.online = !fromCache(view);
    // A theme picked offline wins over the older one from the server.
    const pending = readPending();
    if (pending) app.today.settings.theme = pending;
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

/** Scroll container of the visible screen. */
export const activePane = () => document.querySelector<HTMLElement>(`.pane.on[data-pane="${app.show ? 'show' : app.tab}"]`);

/** Ease the scroller back to the top (native 'tap the tab bar' feel). */
export function scrollToTop(el: HTMLElement) {
  const from = el.scrollTop;
  if (from <= 0) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.scrollTop = 0; return; }
  const start = performance.now(), D = Math.min(500, 200 + from / 6);
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / D);
    el.scrollTop = from * Math.pow(1 - t, 3);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Switch tabs at once, like a native tab bar. Tap the current tab again: scroll to top (and pop profile pages). */
export function go(tab: Tab) {
  const wasShow = !!app.show;
  app.show = null;
  if (tab === app.tab && !wasShow) {
    if (tab === 'profile') popToRoot();
    const el = activePane();
    if (el) scrollToTop(el);
    return;
  }
  app.tab = tab;
}

export function setLogView(v: LogMode) {
  app.logView = v;
  try { localStorage.setItem('rl_log_view', v); } catch { /* private mode */ }
}
