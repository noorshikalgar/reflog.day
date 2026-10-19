import type { Theme, TodayView } from '../../../shared/src/api.ts';
import { api, ApiError } from './api.ts';

export type Tab = 'status' | 'log' | 'branches';

export const app = $state({
  paired: true,
  loading: true,
  online: true,
  tab: 'status' as Tab,
  newBranch: false,
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

export async function refresh() {
  try {
    app.today = await api.today();
    app.paired = true;
    app.online = true;
    applyTheme(app.today.settings.theme);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) app.paired = false;
    else app.online = false;
  } finally {
    app.loading = false;
  }
}

export function go(tab: Tab) {
  if (tab === app.tab) return;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (doc.startViewTransition && !reduce) doc.startViewTransition(() => { app.tab = tab; });
  else app.tab = tab;
}
