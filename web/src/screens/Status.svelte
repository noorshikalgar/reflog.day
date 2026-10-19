<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import type { HabitView } from '../../../shared/src/api.ts';
  import { uuidv7 } from '../../../shared/src/ids.ts';
  import { CLEAN, COMMIT_TOASTS, pick } from '../../../shared/src/messages.ts';
  import { tagFor } from '../../../shared/src/rules.ts';
  import BranchRow from '../components/BranchRow.svelte';
  import Confetti from '../components/Confetti.svelte';
  import MissCard from '../components/MissCard.svelte';
  import Odometer from '../components/Odometer.svelte';
  import Strip from '../components/Strip.svelte';
  import { api } from '../lib/api.ts';
  import { dayLabel } from '../lib/format.ts';
  import { app, go, hideToast, showToast } from '../lib/state.svelte.ts';

  const t = $derived(app.today!);
  const pending = new SvelteSet<string>();
  const rows = $derived(t.habits.filter(h => h.scheduled));
  const isDone = (h: HabitView) => pending.has(h.id) || h.entry?.kind === 'done' || h.entry?.kind === 'rest';
  const done = $derived(rows.filter(isDone).length);
  const left = $derived(rows.length - done);
  const strip = $derived(t.strip.map((d, i) => i === t.strip.length - 1 && rows.length && left === 0 ? { ...d, state: 'full' as const } : d));

  let big: HTMLElement | undefined = $state();
  let burst = $state<{ x: number; y: number; id: number } | null>(null);
  let lastToast: string | undefined;

  function replace(h: HabitView) {
    const i = t.habits.findIndex(x => x.id === h.id);
    if (i >= 0) t.habits[i] = h;
  }

  function celebrate() {
    if (!big || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = big.getBoundingClientRect();
    burst = { x: r.left + 60, y: r.top + 50, id: Date.now() };
    setTimeout(() => (burst = null), 1300);
  }

  async function commit(h: HabitView) {
    pending.add(h.id);
    try {
      const r = await api.putEntry(uuidv7(), { habit_id: h.id, kind: 'done' });
      replace(r.habit);
      pending.delete(h.id);
      const tag = tagFor(r.habit.streak);
      if (rows.length && rows.every(isDone)) { showToast(CLEAN, () => undo(r.entry.id)); celebrate(); }
      else if (tag) showToast(`tag ${tag} — ${h.slug} ${r.habit.streak}d`, () => undo(r.entry.id));
      else showToast(`committed ${r.entry.hash} ${(lastToast = pick(COMMIT_TOASTS, lastToast))}`, () => undo(r.entry.id));
    } catch (e) {
      pending.delete(h.id);
      showToast(`commit failed: ${(e as Error).message}`, null, 4000);
    }
  }

  async function undo(entryId: string) {
    hideToast();
    try { replace((await api.deleteEntry(entryId)).habit); }
    catch (e) { showToast(`undo failed: ${(e as Error).message}`, null, 4000); }
  }
</script>

<main>
  <div class="top">
    <span>{dayLabel(t.day)}</span>
    <span class="sync" class:off={!app.online}>{app.online ? 'synced' : 'offline'}</span>
  </div>

  {#if t.misses.length}
    <MissCard misses={t.misses} today={t.day} canAmend={t.can_amend} />
  {/if}

  {#if rows.length}
    <div class="big" bind:this={big}><Odometer value={done} /><span class="of">/{rows.length}</span></div>
    <div class="state">
      {#key left === 0}
        <span class="swap">
          {#if left === 0}working tree clean.<br /><span class="br">all {rows.length} branches pushed.</span>
          {:else}on branch <span class="br">today</span><br />{left} change{left > 1 ? 's' : ''} not committed{/if}
        </span>
      {/key}
    </div>
    <Strip days={strip} />
    <div class="rows">
      {#each rows as h (h.id)}
        <BranchRow habit={h} pending={pending.has(h.id)} ontap={commit} />
      {/each}
    </div>
  {:else}
    <div class="big"><span class="of">0/0</span></div>
    <div class="empty">
      {#if t.habits.length}
        <p>nothing scheduled today.<br /><span class="br">enjoy the day off.</span></p>
      {:else}
        <p>no branches yet.<br />start with one small habit.</p>
        <button class="btn" onclick={() => { app.newBranch = true; go('branches'); }}>git branch walk</button>
      {/if}
    </div>
  {/if}
</main>

{#if burst}{#key burst.id}<Confetti x={burst.x} y={burst.y} />{/key}{/if}

<style>
  main { padding: calc(14px + env(safe-area-inset-top)) 20px calc(130px + env(safe-area-inset-bottom)); }
  .top { display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono); font-size: 12px; color: var(--muted); margin: 6px 0 4px; }
  .sync { display: inline-flex; gap: 6px; align-items: center; }
  .sync::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 8px var(--ok); }
  .sync.off::before { background: var(--miss); box-shadow: none; }
  .big { font-family: var(--font-display); font-weight: 200; font-size: 104px; line-height: 1; letter-spacing: -.05em; font-variant-numeric: tabular-nums; display: flex; align-items: baseline; margin-top: 8px; }
  .of { color: var(--dim); }
  .state { font-family: var(--font-mono); font-size: 13px; color: var(--muted); margin-top: 10px; min-height: 40px; line-height: 1.55; }
  .swap { display: block; animation: swap .35s var(--ease); }
  .br { color: var(--ok); }
  .rows { display: flex; flex-direction: column; gap: 10px; }
  .empty { font-family: var(--font-mono); font-size: 14px; color: var(--muted); line-height: 1.6; margin-top: 16px; }
  .btn { margin-top: 20px; width: 100%; height: 60px; border-radius: 18px; background: var(--ok); color: var(--on-ok); font-family: var(--font-mono); font-size: 16px; font-weight: 600; }
  @keyframes swap { from { opacity: 0; transform: translateY(4px); } }
</style>
