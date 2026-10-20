<script lang="ts">
  import { untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import type { LogCell, LogDay, LogView } from '../../../shared/src/api.ts';
  import { api } from '../lib/api.ts';
  import { clock, dayLabel } from '../lib/format.ts';
  import { addDays } from '../../../shared/src/rules.ts';
  import { app } from '../lib/state.svelte.ts';

  type Habit = LogView['habits'][number];
  type Ev = { h: Habit; c: LogCell };
  const NONE: LogCell = { state: 'none', entry: null, rebase: false };

  let habits = $state<Habit[]>([]);
  let days = $state<LogDay[]>([]);
  let next = $state<string | null>(null);
  let today = $state('');
  let loading = $state(false);
  let failed = $state(false);
  let filter = $state<string | null>(null);
  let fading = $state(false);
  const closed = new SvelteSet<string>();
  let sentinel: HTMLElement | undefined = $state();

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fh = $derived(filter ? habits.find(h => h.id === filter) ?? null : null);
  const fi = $derived(fh ? habits.indexOf(fh) : -1);
  const stats = $derived(fh ? app.today?.habits.find(h => h.id === fh.id) : undefined);

  async function load(more = false) {
    if (loading || (more && !next)) return;
    loading = true;
    try {
      const v = await api.log(more ? next! : undefined);
      failed = false;
      // Older pages can hold archived branches: keep one union of branches, in order.
      const merged = more ? mergeHabits(habits, v.habits) : v.habits;
      const remap = (d: LogDay, from: Habit[]): LogDay => ({
        day: d.day,
        cells: merged.map(h => { const k = from.findIndex(x => x.id === h.id); return k >= 0 ? d.cells[k] : NONE; }),
      });
      days = more ? [...days.map(d => remap(d, habits)), ...v.days.map(d => remap(d, v.habits))] : v.days;
      habits = merged;
      if (!more) {
        // Keep the user's folds on a reload; new days start folded after the first two.
        const first = !today;
        today = v.today;
        if (first) v.days.slice(2).forEach(d => closed.add(d.day));
      } else {
        v.days.forEach(d => closed.add(d.day));
      }
      next = v.next;
    } catch {
      failed = true;
    } finally {
      loading = false;
    }
  }

  function mergeHabits(a: Habit[], b: Habit[]): Habit[] {
    const out = [...a];
    for (const h of b) if (!out.some(x => x.id === h.id)) out.push(h);
    return out;
  }

  // Load the first page now, and again after each write on another screen.
  $effect(() => {
    void app.rev;
    untrack(() => load());
  });

  $effect(() => {
    if (!sentinel) return;
    const io = new IntersectionObserver(e => e[0].isIntersecting && load(true), { rootMargin: '400px' });
    io.observe(sentinel);
    return () => io.disconnect();
  });

  function setFilter(id: string | null) {
    if (id === filter) return;
    if (reduce) { filter = id; return; }
    fading = true;
    setTimeout(() => { filter = id; fading = false; }, 160);
  }

  function toggle(day: string) {
    if (closed.has(day)) closed.delete(day);
    else closed.add(day);
  }

  function events(d: LogDay): Ev[] {
    return d.cells
      .map((c, i) => ({ h: habits[i], c }))
      .filter(e => e.h && (e.c.state === 'done' || e.c.state === 'rest' || e.c.state === 'miss'))
      .sort((a, b) => Number(a.c.state === 'miss') - Number(b.c.state === 'miss') || (b.c.entry?.created_at ?? '').localeCompare(a.c.entry?.created_at ?? ''));
  }

  function count(d: LogDay) {
    const sched = d.cells.filter(c => c.state !== 'none');
    const complete = sched.filter(c => c.state === 'done' || c.state === 'rest').length;
    return { complete, total: sched.length, clean: sched.length > 0 && complete === sched.length };
  }

  function summary(evs: Ev[]) {
    const n = (s: string) => evs.filter(e => e.c.state === s).length;
    const c = n('done'), r = n('rest'), m = n('miss');
    return [c && `${c} commit${c > 1 ? 's' : ''}`, r && `${r} rest`, m && `${m} miss`].filter(Boolean).join(' · ') || 'nothing scheduled';
  }

  /** 'today', 'yesterday', '3 days ago'; empty after two weeks (the date says enough). */
  function rel(day: string): string {
    if (!today) return '';
    if (day === today) return 'today';
    if (day === addDays(today, -1)) return 'yesterday';
    for (let n = 2; n < 14; n++) if (day === addDays(today, -n)) return `${n} days ago`;
    return '';
  }

  const compact = $derived(app.logView === 'compact');
  const tagOf = (e: Ev) => (e.c.rebase ? 'rebased' : e.c.entry?.amended ? 'amended' : '');
</script>

<main class:compact>
  <div class="head">$ git log{compact ? ' --graph --oneline --decorate' : ''}</div>
  <h1>log</h1>

  {#if habits.length}
    <div class="fbar" role="tablist" aria-label="filter by branch">
      <button class="fchip" class:on={!filter} onclick={() => setFilter(null)} role="tab" aria-selected={!filter}>all · {habits.length}</button>
      {#each habits as h (h.id)}
        <button class="fchip" class:on={filter === h.id} style:--c="var(--l{h.lane})" onclick={() => setFilter(h.id)} role="tab" aria-selected={filter === h.id}><i></i>{h.slug}</button>
      {/each}
    </div>
  {/if}

  <div class="tl" class:fade={fading}>
    {#if fh}
      <button class="fhead" style:--c="var(--l{fh.lane})" onclick={() => (app.show = fh.id)} aria-label="show {fh.slug}">
        {#if stats}<b>{stats.streak}d</b> {fh.slug} · best {stats.best}{:else}<b>{fh.slug}</b> archived{/if}
        <span class="go">show ›</span>
      </button>
      {#if compact}
        <div class="raw">
          {#each days as d (d.day)}
            {@const c = d.cells[fi]}
            {#if c.state !== 'none'}{@render rawRow({ h: fh, c }, d.day)}{/if}
          {/each}
        </div>
      {:else}
        <div class="list solo">
          {#each days as d (d.day)}
            {@const c = d.cells[fi]}
            {#if c.state !== 'none'}{@render niceRow({ h: fh, c }, d.day)}{/if}
          {/each}
        </div>
      {/if}
    {:else}
      {#each days as d (d.day)}
        {@const evs = events(d)}
        {@const k = count(d)}
        {@const isToday = d.day === today}
        {#if compact}
          <div class="raw day" class:closed={closed.has(d.day)}>
            <button class="rh" onclick={() => toggle(d.day)} aria-expanded={!closed.has(d.day)}>
              <span class="star" class:clean={k.clean}>*</span>
              <span class="ref">({#if isToday}<span class="hd">HEAD -&gt; today</span>{', '}{/if}{dayLabel(d.day)})</span>
              <span class="cnt">{k.complete}/{k.total}</span>
            </button>
            <div class="sum"><span class="g">|</span> {summary(evs)}</div>
            <div class="ev-wrap"><div>
              {#each evs as e (e.h.id)}{@render rawRow(e)}{/each}
              <div class="g bar">|</div>
            </div></div>
          </div>
        {:else}
          <div class="day" class:today={isToday} class:clean={k.clean} class:closed={closed.has(d.day)}>
            <button class="dh" onclick={() => toggle(d.day)} aria-expanded={!closed.has(d.day)}>
              <span class="ic" aria-hidden="true">
                <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3" /><path d="M1 8h4M11 8h4" /></svg>
              </span>
              <span class="t">
                <b>{dayLabel(d.day)}</b>{#if rel(d.day)}<span class="rel">{rel(d.day)}</span>{/if}
                <span class="sum">{summary(evs)}</span>
              </span>
              <span class="k">{#if k.clean}✓ clean{:else}{k.complete}/{k.total}{/if}</span>
            </button>
            <div class="ev-wrap"><div class="list">
              {#each evs as e (e.h.id)}{@render niceRow(e)}{/each}
            </div></div>
          </div>
        {/if}
      {/each}
    {/if}
  </div>

  <div bind:this={sentinel} class="more">
    {#if loading}<span class="pulse"></span>
    {:else if failed}<button class="link" onclick={() => load(days.length > 0)}>offline. retry</button>
    {:else if !next && days.length}<span>— start of history —</span>
    {:else if !days.length}<span>no commits yet.</span>{/if}
  </div>
</main>

<!-- normal: two lines, like a GitHub commit list -->
{#snippet niceRow(e: Ev, day?: string)}
  {@const tag = tagOf(e)}
  <div class="ev {e.c.state}" style:--c="var(--l{e.h.lane})">
    <span class="l1">
      {#if day}<span class="sl">{dayLabel(day)}</span>{:else}<span class="sl">{e.h.slug}</span>{/if}
      {#if e.c.state === 'miss'}{e.c.entry?.message ?? 'no commit'}
      {:else if e.c.state === 'rest'}rest day
      {:else if e.c.state === 'open'}<span class="dim">open</span>
      {:else}{e.c.entry?.message ?? 'done'}{/if}
    </span>
    <span class="side" aria-hidden="true"></span>
    <span class="l2">
      {#if e.c.state === 'miss'}<span>no commit</span>
      {:else if e.c.state === 'open'}<span>today</span>
      {:else if e.c.entry}<span class="hs">{e.c.entry.hash}</span><span>{e.c.state === 'rest' ? '--allow-empty' : clock(e.c.entry.created_at)}</span>{/if}
      {#if tag}<span class="tag">{tag}</span>{/if}
    </span>
  </div>
{/snippet}

<!-- compact: git log --graph --oneline --decorate -->
{#snippet rawRow(e: Ev, day?: string)}
  {@const tag = tagOf(e)}
  <div class="rl {e.c.state}" style:--c="var(--l{e.h.lane})">
    {#if !day}<span class="g">|</span>{/if}
    <span class="mk">{e.c.state === 'miss' ? 'o' : e.c.state === 'open' ? '○' : '*'}</span>
    {#if e.c.entry && e.c.state !== 'miss'}<span class="hs">{e.c.entry.hash}</span>{/if}
    <span class="m">
      {#if day}<span class="ref">({dayLabel(day)})</span>{:else if e.c.state !== 'miss'}<span class="ref">(<span class="br">{e.h.slug}</span>)</span>{:else}{e.h.slug}:{/if}
      {#if e.c.state === 'rest'}--allow-empty{:else if e.c.state === 'open'}open{:else}{e.c.entry?.message ?? (e.c.state === 'miss' ? 'no commit' : 'done')}{/if}
    </span>
    <span class="tm">{tag || (e.c.entry && e.c.state === 'done' ? clock(e.c.entry.created_at) : '')}</span>
  </div>
{/snippet}

<style>
  main { padding: calc(14px + env(safe-area-inset-top)) 20px 32px; }
  .head { font-family: var(--font-mono); font-size: 12px; color: var(--muted); margin-top: 6px; }
  h1 { font-family: var(--font-display); font-weight: 300; font-size: 40px; letter-spacing: -.03em; margin-bottom: 10px; }

  .fbar { display: flex; gap: 6px; overflow-x: auto; margin: 0 -20px 12px; padding: 0 20px 2px; scrollbar-width: none; }
  .fbar::-webkit-scrollbar { display: none; }
  .fchip { flex: none; display: flex; gap: 6px; align-items: center; font-family: var(--font-mono); font-size: 12px; padding: 10px 12px; border-radius: 12px; background: var(--surface); color: var(--muted); transition: background .2s, color .2s, transform .12s var(--ease); }
  .fchip:active { transform: scale(.95); }
  .fchip i { width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
  .fchip.on { background: var(--text); color: var(--bg); }

  .tl { transition: opacity .16s, transform .25s var(--ease); }
  .tl.fade { opacity: 0; transform: translateY(6px); }
  .fhead { display: flex; width: 100%; text-align: left; align-items: baseline; gap: 10px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--edge); border-radius: 20px; padding: 12px 16px; margin-bottom: 10px; font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
  .fhead b { font-family: var(--font-display); font-weight: 300; font-size: 36px; letter-spacing: -.03em; color: var(--c); }
  .fhead .go { margin-left: auto; color: var(--dim); }

  .ev-wrap { display: grid; grid-template-rows: 1fr; transition: grid-template-rows .32s var(--ease); }
  .closed .ev-wrap { grid-template-rows: 0fr; }
  .ev-wrap > div { overflow: hidden; min-height: 0; }
  .sum { display: block; font-family: var(--font-mono); font-size: 11px; color: var(--dim); max-height: 0; opacity: 0; overflow: hidden; transition: max-height .25s, opacity .25s; }
  .closed .sum { max-height: 20px; opacity: 1; margin-top: 3px; }
  .tag { display: inline-block; font-size: 9px; padding: 1px 6px; border-radius: 6px; box-shadow: inset 0 0 0 1px currentColor; }
  .dim { color: var(--dim); }

  /* ---------- normal ---------- */
  .day { margin-bottom: 4px; }
  .dh { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 12px 0 8px; font-family: var(--font-mono); }
  .ic { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--surface-2); flex: none; transition: background .2s, box-shadow .2s; }
  .ic svg { width: 14px; height: 14px; stroke: var(--muted); fill: none; stroke-width: 2; }
  .day.clean .ic { background: color-mix(in srgb, var(--ok) 20%, transparent); }
  .day.clean .ic svg { stroke: var(--ok); }
  /* HEAD: today's icon is a lit ring, not a text badge. */
  .day.today .ic { background: var(--bg); box-shadow: inset 0 0 0 2px var(--ok), 0 0 0 4px color-mix(in srgb, var(--ok) 16%, transparent); }
  .day.today .ic svg { stroke: var(--ok); }
  .t { flex: 1; min-width: 0; font-size: 13px; }
  .t b { font-weight: 600; }
  .rel { margin-left: 8px; font-size: 11px; color: var(--dim); }
  .day.today .rel { color: var(--ok); }
  .k { font-family: var(--font-mono); font-size: 11px; color: var(--dim); flex: none; }
  .day.clean .k { color: var(--ok); }
  .list { margin-left: 11px; border-left: 2px solid var(--line); padding-left: 14px; }
  .list.solo { margin-top: 4px; }
  .ev { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; padding: 9px 0; border-bottom: 1px solid color-mix(in srgb, var(--line) 60%, transparent); }
  .ev:last-child { border-bottom: 0; }
  .l1 { font-family: var(--font-ui); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sl { font-family: var(--font-mono); font-size: 12px; color: var(--c); margin-right: 6px; }
  .l2 { grid-column: 1; font-family: var(--font-mono); font-size: 10.5px; color: var(--dim); display: flex; gap: 8px; align-items: center; }
  .l2 .hs { background: var(--surface-2); padding: 1px 6px; border-radius: 5px; }
  .side { grid-row: 1 / 3; grid-column: 2; align-self: center; width: 10px; height: 10px; border-radius: 50%; background: var(--c); }
  .ev.rest .side { border-radius: 2px; background: var(--rest); }
  .ev.miss .side { background: none; border: 1.5px dashed var(--miss); }
  .ev.open .side { background: none; box-shadow: inset 0 0 0 2px var(--c); }
  .ev.miss .l1 { color: var(--miss); font-style: italic; }
  .ev.miss .sl { opacity: .8; font-style: normal; }

  /* ---------- compact ---------- */
  .raw { font-family: var(--font-mono); font-size: 12px; line-height: 1.85; }
  .raw.day { margin: 0; }
  .rh { display: flex; gap: 6px; width: 100%; text-align: left; padding: 4px 0 0; white-space: nowrap; font-family: var(--font-mono); font-size: 12px; line-height: 1.85; }
  /* The day mark stays neutral: color belongs to branches only. A clean day is bolder, not greener. */
  .star { color: var(--muted); }
  .star.clean { color: var(--text); font-weight: 700; }
  .ref { color: var(--rest); }
  .hd { color: var(--l2); font-weight: 600; }
  .br { color: var(--c); }
  .cnt { color: var(--dim); }
  .g { color: var(--dim); white-space: pre; }
  .bar { line-height: 1.4; }
  .raw .sum { margin-top: 0; }
  .rl { display: flex; align-items: baseline; gap: 6px; white-space: nowrap; overflow: hidden; }
  .rl .mk { color: var(--c); }
  .rl.miss .mk { color: var(--miss); }
  .rl.rest .mk { color: var(--rest); }
  .rl .hs { color: var(--rest); }
  .rl .m { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .rl.miss .m { color: var(--miss); font-style: italic; }
  .rl .tm { color: var(--dim); margin-left: auto; padding-left: 8px; font-size: 10px; flex: none; }

  .more { display: grid; place-items: center; min-height: 60px; font-family: var(--font-mono); font-size: 11px; color: var(--dim); }
  .link { font-family: var(--font-mono); font-size: 12px; color: var(--ok); }
  .pulse { width: 10px; height: 10px; border-radius: 50%; box-shadow: inset 0 0 0 2px var(--ok); animation: pulse 1s var(--ease) infinite alternate; }
  @keyframes pulse { to { transform: scale(1.6); opacity: .4; } }
</style>
