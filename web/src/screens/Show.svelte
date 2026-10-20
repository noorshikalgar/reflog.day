<script lang="ts">
  import type { HabitDetail } from '../../../shared/src/api.ts';
  import Odometer from '../components/Odometer.svelte';
  import { api } from '../lib/api.ts';
  import { daysText } from '../lib/format.ts';
  import { app } from '../lib/state.svelte.ts';

  let { id }: { id: string } = $props();

  let d = $state<HabitDetail | null>(null);
  let failed = $state('');
  let shown = $state(0);

  $effect(() => {
    const want = id;
    d = null;
    api.habit(want).then(x => {
      if (want !== id) return;
      d = x;
      // Roll the big number up after the first paint.
      requestAnimationFrame(() => requestAnimationFrame(() => (shown = x.streak)));
    }).catch(e => (failed = (e as Error).message));
  });

  const PATINA = ['clean', 'a little faded', 'faded', 'very faded'];
  const CELL: Record<string, string> = { done: 'd', rest: 'r', miss: 'm', open: 'o', none: '', future: 'f' };

  function back() { app.show = null; }
  function edit() { app.editId = id; app.show = null; }
</script>

<main style:--c={d ? `var(--l${d.lane})` : 'var(--ok)'}>
  <button class="back" onclick={back}>‹ back</button>
  {#if d}
    <div class="head">$ git show {d.slug}</div>
    <div class="giant" aria-label="{d.streak} day streak"><Odometer value={shown} /></div>
    <div class="sub"><b>day streak</b> · best {d.best} · {d.total} commit{d.total === 1 ? '' : 's'}</div>

    <div class="cards">
      <div class="card"><div class="k">this week</div><div class="v">{d.week.complete}/{d.week.scheduled}</div></div>
      <div class="card"><div class="k">rest left</div><div class="v rest">{d.rest_left}</div></div>
      <div class="card">
        <div class="k">next tag</div>
        {#if d.next_tag}<div class="v">{d.next_tag.name}</div><div class="k">at {d.next_tag.at}d · {d.next_tag.to_go} to go</div>
        {:else}<div class="v">LTS</div><div class="k">all tags earned</div>{/if}
      </div>
      <div class="card">
        <div class="k">patina</div>
        <div class="pdots">{#each [1, 2, 3] as i (i)}<i class:on={d.patina >= i}></i>{/each}</div>
        <div class="k">{PATINA[d.patina]}</div>
      </div>
    </div>

    <div class="heat" aria-label="last 12 weeks">
      {#each d.grid as c (c.day)}<i class={CELL[c.state]} title="{c.day}: {c.state}"></i>{/each}
    </div>
    <div class="heat-lbl"><span>12 weeks ago</span><span>today</span></div>

    <div class="meta">
      <span>{daysText(d.days_mask)}</span>
      <span>{d.remind_at ? `⏰ ${d.remind_at}` : 'no reminder'}</span>
    </div>
    <button class="btn" onclick={edit}>edit branch</button>
  {:else if failed}
    <p class="err">{failed}</p>
  {:else}
    <div class="giant dim">··</div>
  {/if}
</main>

<style>
  main { padding: calc(14px + env(safe-area-inset-top)) 20px 32px; }
  .back { font-family: var(--font-mono); font-size: 13px; color: var(--muted); padding: 10px 0; min-height: 44px; }
  .head { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
  .giant { font-family: var(--font-display); font-weight: 200; font-size: 168px; line-height: 1; letter-spacing: -.07em; color: var(--c); font-variant-numeric: tabular-nums; margin: 4px 0 0 -6px; }
  .giant.dim { color: var(--line); }
  .sub { font-family: var(--font-mono); font-size: 13px; color: var(--muted); }
  .sub b { color: var(--text); font-weight: 500; }
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 18px 0; }
  .card { background: var(--surface); box-shadow: inset 0 0 0 1px var(--edge); border-radius: 20px; padding: 14px 16px; }
  .k { font-family: var(--font-mono); font-size: 11px; color: var(--dim); }
  .v { font-family: var(--font-display); font-size: 30px; font-weight: 300; letter-spacing: -.03em; margin: 2px 0; }
  .v.rest { color: var(--rest); }
  .pdots { display: flex; gap: 6px; margin: 10px 0 8px; }
  .pdots i { width: 12px; height: 12px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--line); }
  .pdots i.on { background: var(--miss); box-shadow: none; }
  .heat { display: grid; grid-template-columns: repeat(12, 1fr); grid-template-rows: repeat(7, auto); grid-auto-flow: column; gap: 4px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--edge); border-radius: 20px; padding: 14px 16px; }
  .heat i { aspect-ratio: 1; border-radius: 4px; background: var(--line); opacity: .5; }
  .heat i.d { background: var(--c); opacity: 1; }
  .heat i.r { background: var(--rest); opacity: .85; border-radius: 2px; transform: scale(.7); }
  .heat i.m { background: none; opacity: 1; box-shadow: inset 0 0 0 1.5px var(--miss); }
  .heat i.o { background: none; opacity: 1; box-shadow: inset 0 0 0 2px var(--c); }
  .heat i.f { background: none; }
  .heat-lbl { font-family: var(--font-mono); font-size: 11px; color: var(--dim); display: flex; justify-content: space-between; margin: 8px 4px 0; }
  .meta { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 12px; color: var(--muted); margin: 20px 4px 12px; letter-spacing: .5px; }
  .btn { width: 100%; height: 56px; border-radius: 18px; box-shadow: inset 0 0 0 1.5px var(--line); font-family: var(--font-mono); font-size: 14px; color: var(--muted); }
  .err { font-family: var(--font-mono); color: var(--muted); margin-top: 20px; }
</style>
