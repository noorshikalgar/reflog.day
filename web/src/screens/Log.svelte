<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import type { LogCell, LogDay, LogView } from '../../../shared/src/api.ts';
  import { api } from '../lib/api.ts';
  import { clock, dayLabel } from '../lib/format.ts';
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
        today = v.today;
        closed.clear();
        v.days.slice(2).forEach(d => closed.add(d.day));
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

  load();

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

  const DOT: Record<string, string> = { done: '', rest: 'r', miss: 'm', open: 'o', none: 'x' };
</script>

<main>
  <div class="head">$ git log --oneline</div>
  <h1>log</h1>

  {#if habits.length}
    <div class="fbar" role="tablist" aria-label="filter by branch">
      <button class="fchip" class:on={!filter} onclick={() => setFilter(null)} role="tab" aria-selected={!filter}>all · {habits.length}</button>
      {#each habits as h (h.id)}
        <button class="fchip" class:on={filter === h.id} style:--c="var(--l{h.lane})" onclick={() => setFilter(h.id)} role="tab" aria-selected={filter === h.id}><i></i>{h.slug}</button>
      {/each}
    </div>
  {/if}

  <div class="tl" class:fade={fading} style:--tc={fh ? `var(--l${fh.lane})` : 'var(--line)'}>
    {#if fh}
      <button class="fhead" style:--c="var(--l{fh.lane})" onclick={() => (app.show = fh.id)} aria-label="show {fh.slug}">
        {#if stats}<b>{stats.streak}d</b> {fh.slug} · best {stats.best}{:else}<b>{fh.slug}</b> archived{/if}
        <span class="go">show ›</span>
      </button>
      {#each days as d (d.day)}
        {@const c = d.cells[fi]}
        {#if c.state === 'none'}
          <div class="ev skip"><div class="rail"></div><span class="m dim">{dayLabel(d.day)} · not scheduled</span><span></span></div>
        {:else if c.state === 'open'}
          <div class="ev open" style:--c="var(--l{fh.lane})"><div class="rail"><i class="n"></i></div><span class="m"><span class="dl">{dayLabel(d.day)}</span> · <span class="dim">open</span></span><span class="tm">HEAD</span></div>
        {:else}
          {@render row({ h: fh, c }, d.day)}
        {/if}
      {/each}
    {:else}
      {#each days as d (d.day)}
        {@const evs = events(d)}
        {@const k = count(d)}
        <div class="d" class:today={d.day === today} class:clean={k.clean} class:closed={closed.has(d.day)}>
          <button class="dh" onclick={() => toggle(d.day)} aria-expanded={!closed.has(d.day)}>
            <span class="rail"></span>
            <span>
              <span class="lbl">{dayLabel(d.day)}{#if d.day === today}<small>HEAD</small>{/if}</span>
              <span class="dots" aria-hidden="true">
                {#each d.cells as c, i (habits[i]?.id ?? i)}<i class={DOT[c.state]} style:--c="var(--l{habits[i]?.lane ?? 10})"></i>{/each}
              </span>
              <span class="sum">{summary(evs)}</span>
            </span>
            <span><span class="cnt">{k.complete}<small>/{k.total}</small></span><span class="chev">▾</span></span>
          </button>
          <div class="ev-wrap"><div>
            {#each evs as e (e.h.id)}{@render row(e)}{/each}
          </div></div>
        </div>
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

{#snippet row(e: Ev, day?: string)}
  {@const lane = `var(--l${e.h.lane})`}
  {@const tag = e.c.rebase ? 'rebased' : e.c.entry?.amended ? 'amended' : ''}
  {#if e.c.state === 'miss'}
    <div class="ev miss" style:--c={lane}>
      <div class="rail">
        <svg width="28" height="42" viewBox="0 0 28 42" aria-hidden="true"><path d="M14 0 C14 11 22 10 22 21 C22 32 14 31 14 42" stroke="var(--tc)" stroke-width="2" fill="none" opacity=".7" /></svg>
        <i class="n"></i>
      </div>
      <span class="m">{#if day}<span class="dl">{dayLabel(day)}</span> · {/if}◌ {#if !day}<span class="b" style:color={lane}>{e.h.slug}</span> — {/if}{e.c.entry?.message ?? 'no commit'}</span>
      <span class="tm">{#if tag}<span class="tag">{tag}</span>{/if}</span>
    </div>
  {:else if e.c.state === 'rest'}
    <div class="ev rest" style:--c={lane}>
      <div class="rail"><i class="n"></i></div>
      <span class="m">{#if day}<span class="dl">{dayLabel(day)}</span> · rest day{:else}<span class="h">{e.c.entry?.hash}</span> {e.h.slug} --allow-empty{/if}</span>
      <span class="tm">rest</span>
    </div>
  {:else}
    <div class="ev" style:--c={lane}>
      <div class="rail"><i class="n"></i></div>
      <span class="m">
        {#if day}<span class="dl">{dayLabel(day)}</span> · {e.c.entry?.message ?? 'done'}
        {:else}<span class="h">{e.c.entry?.hash}</span> <span style:color={lane}>{e.h.slug}</span>: {e.c.entry?.message ?? 'done'}{/if}
      </span>
      <span class="tm">{#if tag}<span class="tag dim">{tag}</span>{:else if e.c.entry}{clock(e.c.entry.created_at)}{/if}</span>
    </div>
  {/if}
{/snippet}

<style>
  main { padding: calc(14px + env(safe-area-inset-top)) 20px calc(130px + env(safe-area-inset-bottom)); }
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
  .fhead { display: flex; align-items: baseline; gap: 10px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--edge); border-radius: 20px; padding: 12px 16px; margin-bottom: 10px; font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
  .fhead { width: 100%; text-align: left; }
  .fhead .go { margin-left: auto; color: var(--dim); }
  .fhead b { font-family: var(--font-display); font-weight: 300; font-size: 36px; letter-spacing: -.03em; color: var(--c); }

  .rail { position: relative; align-self: stretch; }
  .rail::before { content: ""; position: absolute; left: 13px; top: 0; bottom: 0; width: 2px; background: var(--tc); opacity: .7; }
  .dh { display: grid; grid-template-columns: 28px 1fr auto; gap: 0 6px; width: 100%; text-align: left; padding: 10px 0; align-items: start; }
  .dh .rail::after { content: ""; position: absolute; left: 6px; top: 1px; width: 16px; height: 16px; border-radius: 50%; background: var(--bg); box-shadow: inset 0 0 0 2px var(--muted); }
  .d.today .dh .rail::after { box-shadow: inset 0 0 0 2px var(--ok), 0 0 10px -2px var(--ok); }
  .d.clean .dh .rail::after { background: var(--ok); box-shadow: inset 0 0 0 2px var(--ok); }
  .lbl { font-family: var(--font-mono); font-size: 12px; }
  .lbl small { color: var(--dim); margin-left: 6px; }
  .sum { display: block; font-family: var(--font-mono); font-size: 11px; color: var(--dim); margin-top: 6px; max-height: 0; opacity: 0; overflow: hidden; transition: max-height .25s, opacity .25s; }
  .d.closed .sum { max-height: 20px; opacity: 1; }
  .dots { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 7px; }
  .dots i { width: 9px; height: 9px; border-radius: 50%; background: var(--c); }
  .dots i.o { background: none; box-shadow: inset 0 0 0 1.5px var(--line); }
  .dots i.m { background: none; box-shadow: inset 0 0 0 1.5px var(--miss); }
  .dots i.r { background: var(--rest); border-radius: 2px; transform: scale(.8); }
  .dots i.x { background: var(--line); transform: scale(.45); }
  .cnt { display: block; font-family: var(--font-display); font-size: 24px; font-weight: 300; line-height: 1; text-align: right; font-variant-numeric: tabular-nums; }
  .cnt small { font-family: var(--font-mono); font-size: 11px; color: var(--dim); }
  .chev { display: block; font-family: var(--font-mono); font-size: 11px; color: var(--dim); margin-top: 6px; text-align: right; transition: transform .25s var(--ease); }
  .d.closed .chev { transform: rotate(-90deg); }
  .ev-wrap { display: grid; grid-template-rows: 1fr; transition: grid-template-rows .32s var(--ease); }
  .d.closed .ev-wrap { grid-template-rows: 0fr; }
  .ev-wrap > div { overflow: hidden; min-height: 0; }

  .ev { display: grid; grid-template-columns: 28px 1fr auto; gap: 0 6px; height: 42px; font-family: var(--font-mono); font-size: 12px; align-items: center; }
  .n { position: absolute; left: 9px; top: 50%; margin-top: -5px; width: 10px; height: 10px; border-radius: 50%; background: var(--c); box-shadow: 0 0 0 3px var(--bg); }
  .ev.rest .n { border-radius: 3px; background: var(--rest); }
  .ev.open .n { background: var(--bg); box-shadow: inset 0 0 0 2px var(--c), 0 0 0 3px var(--bg); }
  .ev.skip .rail::after { content: ""; position: absolute; left: 11px; top: 50%; margin-top: -3px; width: 6px; height: 6px; border-radius: 50%; background: var(--line); }
  .ev.miss .rail::before { display: none; }
  .ev.miss svg { position: absolute; left: 0; top: 0; }
  .ev.miss .n { left: 17px; background: var(--bg); border: 1.5px dashed var(--miss); box-shadow: none; }
  .m { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .h, .tm, .dim { color: var(--dim); }
  .dl { color: var(--muted); }
  .tm { font-size: 10px; }
  .ev.miss .m { color: var(--miss); font-style: italic; }
  .ev.miss .b { font-style: normal; opacity: .75; }
  .ev.rest .m { color: var(--rest); }
  .tag { display: inline-block; font-size: 9px; padding: 1px 6px; border-radius: 6px; box-shadow: inset 0 0 0 1px currentColor; }

  .more { display: grid; place-items: center; min-height: 60px; font-family: var(--font-mono); font-size: 11px; color: var(--dim); }
  .link { font-family: var(--font-mono); font-size: 12px; color: var(--ok); }
  .pulse { width: 10px; height: 10px; border-radius: 50%; box-shadow: inset 0 0 0 2px var(--ok); animation: pulse 1s var(--ease) infinite alternate; }
  @keyframes pulse { to { transform: scale(1.6); opacity: .4; } }
</style>
