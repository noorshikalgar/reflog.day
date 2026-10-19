<script lang="ts">
  import type { HabitView } from '../../../shared/src/api.ts';
  import { untrack } from 'svelte';
  import { clock, daysText } from '../lib/format.ts';

  let { habit, pending = false, ontap, onlong }: {
    habit: HabitView;
    pending?: boolean;
    ontap: (h: HabitView) => void;
    onlong: (h: HabitView) => void;
  } = $props();

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = $derived(pending ? 'done' : habit.entry && habit.entry.kind !== 'miss' ? habit.entry.kind : 'open');
  const sub = $derived(habit.remind_at ? `remind ${habit.remind_at}` : habit.days_mask === 127 ? 'every day' : daysText(habit.days_mask));

  // Type the hash in, one character at a time, when a new commit arrives.
  const initial = untrack(() => habit.entry?.hash ?? '');
  let shown = $state(initial);
  let last = initial;
  let timer: ReturnType<typeof setInterval> | undefined;
  let just = $state(0);
  $effect(() => {
    const h = habit.entry?.hash ?? '';
    if (h === last) return;
    last = h;
    clearInterval(timer);
    if (!h || reduce) { shown = h; return; }
    let k = 0;
    shown = '';
    timer = setInterval(() => { shown = h.slice(0, ++k); if (k >= h.length) clearInterval(timer); }, 35);
  });

  // Long press (450 ms) opens the commit sheet. A short tap commits.
  const LONG_MS = 450;
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let pressed = $state(false);
  let longFired = false;
  let start = { x: 0, y: 0 };

  function down(e: PointerEvent) {
    if (pending) return;
    longFired = false;
    start = { x: e.clientX, y: e.clientY };
    pressed = true;
    pressTimer = setTimeout(() => { longFired = true; pressed = false; navigator.vibrate?.(10); onlong(habit); }, LONG_MS);
  }
  function cancel() { clearTimeout(pressTimer); pressed = false; }
  function move(e: PointerEvent) {
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel();
  }

  function tap() {
    cancel();
    if (longFired) { longFired = false; return; }
    if (state !== 'open') { onlong(habit); return; }
    just++;
    ontap(habit);
  }
</script>

<button
  class="row" class:pressed data-state={state} style:--c="var(--l{habit.lane})" aria-label="{habit.slug}, {state}"
  onclick={tap} onpointerdown={down} onpointerup={() => clearTimeout(pressTimer)} onpointerleave={cancel} onpointercancel={cancel} onpointermove={move}
  oncontextmenu={e => e.preventDefault()}
>
  {#key just}
    <span class="node" class:pop={just > 0} style:filter={habit.patina ? `saturate(${1 - habit.patina * 0.18})` : null}></span>
  {/key}
  <span class="name">{habit.emoji ? habit.emoji + ' ' : ''}{habit.slug}<small>{sub}</small></span>
  <span class="meta">
    {#if state === 'rest'}
      <span class="streak rest">rest</span><span class="hash">--allow-empty</span>
    {:else}
      <span class="streak">{habit.streak}<em>d{'~'.repeat(habit.patina)}</em></span>
      <span class="hash">
        {#if state === 'done'}
          {pending ? '·······' : shown}{#if !pending && habit.entry && shown.length === habit.entry.hash.length}&nbsp;· {clock(habit.entry.created_at)}{/if}
        {:else}tap →{/if}
      </span>
    {/if}
  </span>
</button>

<style>
  .row {
    display: grid; grid-template-columns: 28px 1fr auto; align-items: center; gap: 14px;
    width: 100%; height: 76px; padding: 0 18px; border-radius: 22px; background: var(--surface);
    box-shadow: inset 0 0 0 1px var(--edge); text-align: left; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation;
    transition: transform .12s var(--ease), background .2s;
  }
  .row.pressed { transform: scale(.97); background: var(--surface-2); transition: transform .45s var(--ease), background .2s; }
  .row:active { transform: scale(.98); background: var(--surface-2); }
  .row:focus-visible { outline: 2px solid var(--c); outline-offset: 2px; }
  .name { font-family: var(--font-mono); font-size: 18px; font-weight: 500; letter-spacing: -.01em; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name small { display: block; font-size: 11px; color: var(--dim); font-weight: 400; margin-top: 3px; }
  .meta { text-align: right; font-family: var(--font-mono); }
  .streak { display: block; font-family: var(--font-display); font-size: 22px; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
  .streak em { font-style: normal; color: var(--dim); font-family: var(--font-mono); font-size: 14px; }
  .streak.rest { color: var(--rest); font-size: 15px; font-family: var(--font-mono); }
  .hash { display: block; font-size: 11px; color: var(--muted); margin-top: 2px; min-height: 14px; white-space: nowrap; }
  [data-state="done"] .hash { color: var(--c); }
  [data-state="rest"] .hash { color: var(--dim); }

  .node { width: 24px; height: 24px; border-radius: 50%; box-shadow: inset 0 0 0 2.5px var(--c); position: relative; transition: box-shadow .35s var(--ease), background .35s var(--ease); }
  [data-state="done"] .node { background: var(--c); box-shadow: inset 0 0 0 12px var(--c); }
  [data-state="rest"] .node { width: 18px; height: 18px; margin-left: 3px; border-radius: 6px; background: var(--rest); box-shadow: none; }
  .node::after { content: ""; position: absolute; inset: 0; border-radius: 50%; border: 2px solid var(--c); opacity: 0; pointer-events: none; }
  .node.pop { animation: pop .36s var(--ease); }
  .node.pop::after { animation: ripple .7s var(--ease); }
  @keyframes pop { 0% { transform: scale(.7); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }
  @keyframes ripple { from { opacity: .9; transform: scale(1); } to { opacity: 0; transform: scale(2.8); } }
</style>
