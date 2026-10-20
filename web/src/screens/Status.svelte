<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import type { HabitView } from '../../../shared/src/api.ts';
  import { uuidv7 } from '../../../shared/src/ids.ts';
  import { CLEAN, COMMIT_TOASTS, REST_TOASTS, pick } from '../../../shared/src/messages.ts';
  import { addDays, tagFor, tagProgress } from '../../../shared/src/rules.ts';
  import BranchRow from '../components/BranchRow.svelte';
  import CommitSheet, { type CommitRequest } from '../components/CommitSheet.svelte';
  import Confetti from '../components/Confetti.svelte';
  import MissCard from '../components/MissCard.svelte';
  import ReleaseNotes from '../components/ReleaseNotes.svelte';
  import Odometer from '../components/Odometer.svelte';
  import Rings from '../components/Rings.svelte';
  import Strip from '../components/Strip.svelte';
  import { api } from '../lib/api.ts';
  import { isNetworkError, outbox } from '../lib/outbox.ts';
  import { dayLabel } from '../lib/format.ts';
  import { app, go, hideToast, refresh, showToast } from '../lib/state.svelte.ts';

  const t = $derived(app.today!);
  const pending = new SvelteSet<string>();
  const rows = $derived(t.habits.filter(h => h.scheduled));
  const isDone = (h: HabitView) => pending.has(h.id) || h.entry?.kind === 'done' || h.entry?.kind === 'rest';
  const done = $derived(rows.filter(isDone).length);
  const left = $derived(rows.length - done);
  // Today's strip day follows local taps at once; older days come from the server.
  const strip = $derived(t.strip.map((d, i) => i === t.strip.length - 1 && rows.length
    ? { ...d, p: done / rows.length, state: left === 0 ? 'full' as const : d.state } : d));

  // Rings: today, last 7 days, best current streak toward its next tag.
  const p7 = $derived.by(() => {
    const days = strip.filter(d => d.state !== 'none');
    return days.length ? days.reduce((a, d) => a + d.p, 0) / days.length : 0;
  });
  const best = $derived(Math.max(0, ...t.habits.map(h => h.streak)));
  const tag = $derived(tagProgress(best));
  const ringValues = $derived<[number, number, number]>([rows.length ? done / rows.length : 0, p7, tag.p]);

  let big: HTMLElement | undefined = $state();
  let burst = $state<{ x: number; y: number; id: number } | null>(null);
  let lastToast: string | undefined;

  function replace(h: HabitView) {
    const i = t.habits.findIndex(x => x.id === h.id);
    if (i >= 0) t.habits[i] = h;
    app.rev++;
  }

  function celebrate() {
    if (!big || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = big.getBoundingClientRect();
    burst = { x: r.left + 60, y: r.top + 50, id: Date.now() };
    setTimeout(() => (burst = null), 1300);
  }

  let sheetFor = $state<HabitView | null>(null);

  async function commit(h: HabitView, req: CommitRequest = { kind: 'done', message: null, yesterday: false }) {
    sheetFor = null;
    const editing = !req.yesterday && h.entry && h.entry.kind !== 'miss' ? h.entry : null;
    const id = editing?.id ?? uuidv7();
    if (!req.yesterday && !editing) pending.add(h.id);
    try {
      const r = await api.putEntry(id, {
        habit_id: h.id, kind: req.kind, message: req.message, day: req.yesterday ? addDays(t.day, -1) : undefined,
      });
      replace(r.habit);
      pending.delete(h.id);
      if (req.yesterday) {
        showToast(`amended ${req.kind === 'rest' ? '--allow-empty' : r.entry.hash} into yesterday.`, null, 4000);
        await refresh(); // strip and miss card change
        return;
      }
      if (editing) { showToast(`commit --amend ${r.entry.hash}. message saved.`, null, 3000); return; }
      const tag = tagFor(r.habit.streak);
      if (rows.length && rows.every(isDone)) { showToast(CLEAN, () => undo(r.entry.id)); celebrate(); }
      else if (req.kind === 'rest') showToast(pick(REST_TOASTS), () => undo(r.entry.id));
      else if (tag) { showToast(`tag ${tag} — ${h.slug} ${r.habit.streak}d`, () => undo(r.entry.id)); celebrate(); }
      else showToast(`committed ${r.entry.hash} ${(lastToast = pick(COMMIT_TOASTS, lastToast))}`, () => undo(r.entry.id));
    } catch (e) {
      pending.delete(h.id);
      if (isNetworkError(e) && !editing) return queue(h, req, id);
      showToast(`commit failed: ${(e as Error).message}`, null, 4000);
    }
  }

  /** No network: keep the commit in the outbox and show it now. */
  async function queue(h: HabitView, req: CommitRequest, id: string) {
    const q = { id, habit_id: h.id, kind: req.kind, day: req.yesterday ? addDays(t.day, -1) : t.day, message: req.message, queued_at: new Date().toISOString() };
    try { await outbox.put(q); } catch { showToast('offline, and this browser cannot store the commit.', null, 4000); return; }
    app.queued++;
    if (!req.yesterday) {
      replace({ ...h, entry: { ...q, hash: '·······', amended: false, seen_at: null, created_at: q.queued_at }, streak: h.streak + (req.kind === 'done' ? 1 : 0) });
    }
    app.online = false;
    showToast('offline. commit queued, pushes when online.', () => unqueue(h, id));
  }

  async function unqueue(h: HabitView, id: string) {
    hideToast();
    await outbox.remove(id);
    app.queued = Math.max(0, app.queued - 1);
    replace(h);
  }

  async function revert(h: HabitView) {
    sheetFor = null;
    if (h.entry) await undo(h.entry.id);
    showToast(`reverted ${h.slug}.`, null, 3000);
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
    <span class="sync" class:off={!app.online} class:wait={app.queued > 0}>
      {app.queued ? `${app.queued} queued` : app.online ? 'synced' : 'offline'}
    </span>
  </div>

  {#if t.release_notes}<ReleaseNotes notes={t.release_notes} />{/if}

  {#if t.misses.length}
    <MissCard misses={t.misses} today={t.day} canAmend={t.can_amend} />
  {/if}

  {#if rows.length}
    <div class="hero">
      <div class="big" bind:this={big}><Odometer value={done} /><span class="of">/{rows.length}</span></div>
      <Rings values={ringValues} label="today {done} of {rows.length}, last 7 days {Math.round(p7 * 100)} percent, {best} of {tag.next} days to the next tag" />
    </div>
    <div class="state">
      {#key left === 0}
        <span class="swap">
          {#if left === 0}working tree clean.<br /><span class="br">all {rows.length} branches pushed.</span>
          {:else}on branch <span class="br">today</span><br />{left} change{left > 1 ? 's' : ''} not committed{/if}
        </span>
      {/key}
    </div>
    <div class="legend" aria-hidden="true">
      <span style:--c="var(--ring1)"><i></i>today <b>{done}/{rows.length}</b></span>
      <span style:--c="var(--ring2)"><i></i>7d <b>{Math.round(p7 * 100)}%</b></span>
      <span style:--c="var(--ring3)"><i></i>tag <b>{best}/{tag.next}</b></span>
    </div>
    <Strip days={strip} />
    <div class="rows">
      {#each rows as h (h.id)}
        <BranchRow habit={h} pending={pending.has(h.id)} lit={app.focus === h.slug} ontap={x => commit(x)} onlong={x => (sheetFor = x)} />
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

<CommitSheet habit={sheetFor} canAmend={t.can_amend} onclose={() => (sheetFor = null)} oncommit={commit} onrevert={revert} />

{#if burst}{#key burst.id}<Confetti x={burst.x} y={burst.y} />{/key}{/if}

<style>
  main { padding: calc(14px + env(safe-area-inset-top)) 20px 32px; }
  .top { display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono); font-size: 12px; color: var(--muted); margin: 6px 0 4px; }
  .sync { display: inline-flex; gap: 6px; align-items: center; }
  .sync::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 8px var(--ok); }
  .sync.off::before { background: var(--miss); box-shadow: none; }
  .sync.wait::before { background: var(--rest); box-shadow: 0 0 8px var(--rest); animation: blink 1.2s steps(2) infinite; }
  @keyframes blink { 50% { opacity: .3; } }
  .hero { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 18px; }
  .big { font-family: var(--font-display); font-weight: 300; font-size: 104px; line-height: 1; letter-spacing: -.05em; font-variant-numeric: tabular-nums; display: flex; align-items: baseline; }
  .legend { display: flex; gap: 12px; flex-wrap: wrap; font-family: var(--font-mono); font-size: 11px; color: var(--dim); margin-top: 10px; }
  .legend span { display: inline-flex; gap: 6px; align-items: center; white-space: nowrap; }
  .legend i { width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
  .legend b { color: var(--text); font-weight: 500; }
  .of { color: var(--dim); }
  .state { font-family: var(--font-mono); font-size: 13px; color: var(--muted); margin-top: 10px; min-height: 40px; line-height: 1.55; }
  .swap { display: block; animation: swap .35s var(--ease); }
  .br { color: var(--ok); }
  .rows { display: flex; flex-direction: column; gap: 10px; }
  .empty { font-family: var(--font-mono); font-size: 14px; color: var(--muted); line-height: 1.6; margin-top: 16px; }
  .btn { margin-top: 20px; width: 100%; height: 60px; border-radius: 18px; background: var(--ok); color: var(--on-ok); font-family: var(--font-mono); font-size: 16px; font-weight: 600; }
  @keyframes swap { from { opacity: 0; transform: translateY(4px); } }
</style>
