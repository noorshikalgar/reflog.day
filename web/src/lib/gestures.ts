// iOS-style edge swipe back. Drag from the left edge: the screen follows the finger.
// Let go after 35% of the width (or a fast flick): it slides out and `onback` runs.
import { tick } from './haptics.ts';

type Opts = { enabled: boolean; onback: () => void };

export function edgeSwipe(node: HTMLElement, opts: Opts) {
  let o = opts;
  let x0 = 0, y0 = 0, t0 = 0, dx = 0, active = false, decided = false;
  const W = () => node.getBoundingClientRect().width || innerWidth;

  const start = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!o.enabled || e.touches.length > 1 || t.clientX > 24) return;
    x0 = t.clientX; y0 = t.clientY; t0 = performance.now(); dx = 0; active = true; decided = false;
  };
  const move = (e: TouchEvent) => {
    if (!active) return;
    const t = e.touches[0];
    const mx = t.clientX - x0, my = t.clientY - y0;
    if (!decided) {
      if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
      decided = true;
      if (Math.abs(my) > Math.abs(mx)) { active = false; return; } // a vertical scroll, not a swipe
      node.style.transition = 'none';
      node.style.boxShadow = '-12px 0 30px rgba(0,0,0,.35)';
    }
    e.preventDefault();
    dx = Math.max(0, mx);
    node.style.transform = `translateX(${dx}px)`;
  };
  const end = () => {
    if (!active) return;
    active = false;
    if (!decided) return;
    const v = dx / Math.max(1, performance.now() - t0);
    const go = dx > W() * 0.35 || v > 0.6;
    node.style.transition = 'transform .24s cubic-bezier(.2,.8,.2,1)';
    node.style.transform = go ? `translateX(${W()}px)` : 'translateX(0)';
    setTimeout(() => {
      node.style.transition = ''; node.style.boxShadow = '';
      if (go) { tick(); o.onback(); }
      node.style.transform = '';
    }, 240);
  };

  node.addEventListener('touchstart', start, { passive: true });
  node.addEventListener('touchmove', move, { passive: false });
  node.addEventListener('touchend', end);
  node.addEventListener('touchcancel', end);
  return {
    update(n: Opts) { o = n; },
    destroy() {
      node.removeEventListener('touchstart', start);
      node.removeEventListener('touchmove', move);
      node.removeEventListener('touchend', end);
      node.removeEventListener('touchcancel', end);
    },
  };
}

// Drag a bottom sheet down to close it. Starts only when its content is scrolled to the top.
export function dragDown(node: HTMLElement, opts: { onclose: () => void }) {
  let o = opts;
  let y0 = 0, t0 = 0, dy = 0, active = false;
  const start = (e: TouchEvent) => {
    if (node.scrollTop > 0 || e.touches.length > 1) return;
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select')) return;
    y0 = e.touches[0].clientY; t0 = performance.now(); dy = 0; active = true;
  };
  const move = (e: TouchEvent) => {
    if (!active) return;
    dy = e.touches[0].clientY - y0;
    if (dy <= 0) { node.style.transform = ''; return; }
    e.preventDefault();
    node.style.transition = 'none';
    node.style.transform = `translateY(${dy}px)`;
  };
  const end = () => {
    if (!active) return;
    active = false;
    const v = dy / Math.max(1, performance.now() - t0);
    const close = dy > 110 || (dy > 30 && v > 0.6);
    node.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1)';
    node.style.transform = close ? 'translateY(110%)' : '';
    if (close) setTimeout(() => o.onclose(), 200);
    else setTimeout(() => (node.style.transition = ''), 230);
  };
  node.addEventListener('touchstart', start, { passive: true });
  node.addEventListener('touchmove', move, { passive: false });
  node.addEventListener('touchend', end);
  node.addEventListener('touchcancel', end);
  return {
    update(n: { onclose: () => void }) { o = n; },
    destroy() {
      node.removeEventListener('touchstart', start);
      node.removeEventListener('touchmove', move);
      node.removeEventListener('touchend', end);
      node.removeEventListener('touchcancel', end);
    },
  };
}

// Pull down at the top of a screen to refresh: `git pull`. The content follows the finger with
// resistance; past the threshold a haptic tick says "let go"; the label shows the result.
export function pullRefresh(node: HTMLElement, opts: { enabled: boolean; onrefresh: () => Promise<unknown> }) {
  let o = opts;
  const TH = 64, MAX = 110;
  const ind = document.createElement('div');
  ind.className = 'ptr';
  ind.setAttribute('aria-hidden', 'true');
  ind.innerHTML = '<i></i><span>git pull</span>';
  node.prepend(ind);
  const label = ind.querySelector('span')!;
  const content = () => node.children[1] as HTMLElement | undefined;

  let y0 = 0, dy = 0, active = false, armed = false, busy = false;
  const set = (y: number, anim = false) => {
    const c = content();
    if (!c) return;
    const t = anim ? 'transform .3s cubic-bezier(.2,.8,.2,1)' : 'none';
    c.style.transition = t; ind.style.transition = anim ? 'opacity .3s, transform .3s cubic-bezier(.2,.8,.2,1)' : 'none';
    c.style.transform = y ? `translateY(${y}px)` : '';
    ind.style.opacity = String(Math.min(1, y / TH));
    ind.style.transform = `translateY(${Math.min(y, TH) - TH}px) rotate(0)`;
    ind.querySelector('i')!.style.transform = `rotate(${Math.min(1, y / TH) * 180}deg)`;
  };
  const start = (e: TouchEvent) => {
    if (!o.enabled || busy || node.scrollTop > 0 || e.touches.length > 1) return;
    y0 = e.touches[0].clientY; dy = 0; active = true; armed = false;
  };
  const move = (e: TouchEvent) => {
    if (!active) return;
    const d = e.touches[0].clientY - y0;
    if (d <= 0 || node.scrollTop > 0) { if (dy) set(0); active = d > 0 && node.scrollTop <= 0; dy = 0; return; }
    e.preventDefault();
    dy = Math.min(MAX, d * 0.45);
    const nowArmed = dy >= TH;
    if (nowArmed !== armed) { armed = nowArmed; label.textContent = armed ? 'release to pull' : 'git pull'; if (armed) tick(); }
    set(dy);
  };
  const end = async () => {
    if (!active) return;
    active = false;
    if (!armed) { set(0, true); return; }
    busy = true;
    ind.classList.add('busy');
    label.textContent = 'pulling…';
    set(TH * 0.8, true);
    const t0 = performance.now();
    try { await o.onrefresh(); label.textContent = 'Already up to date.'; }
    catch { label.textContent = 'fatal: offline'; }
    await new Promise(r => setTimeout(r, Math.max(0, 500 - (performance.now() - t0))));
    ind.classList.remove('busy');
    set(0, true);
    setTimeout(() => { label.textContent = 'git pull'; busy = false; }, 320);
  };
  node.addEventListener('touchstart', start, { passive: true });
  node.addEventListener('touchmove', move, { passive: false });
  node.addEventListener('touchend', end);
  node.addEventListener('touchcancel', end);
  return {
    update(n: typeof opts) { o = n; },
    destroy() {
      ind.remove();
      node.removeEventListener('touchstart', start);
      node.removeEventListener('touchmove', move);
      node.removeEventListener('touchend', end);
      node.removeEventListener('touchcancel', end);
    },
  };
}
