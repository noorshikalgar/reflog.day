<script lang="ts">
  // Last 7 days, read-only, in a neutral color (never a branch color). History lives in `log`.
  import type { StripDay } from '../../../shared/src/api.ts';
  import { shortDay } from '../lib/format.ts';
  let { days }: { days: StripDay[] } = $props();

  const cls = (d: StripDay, today: boolean) =>
    d.state === 'none' ? 'none' : d.p >= 1 ? 'full' : today ? 'open' : d.p === 0 ? 'miss' : 'half';
</script>

<div class="dash" aria-label="last 7 days">
  {#each days as d, i (d.day)}
    {@const today = i === days.length - 1}
    <i class="{cls(d, today)}" class:today style:--p={Math.round(d.p * 100)} title="{d.day}: {Math.round(d.p * 100)}%"></i>
  {/each}
</div>
<div class="lbl" aria-hidden="true">
  {#each days as d, i (d.day)}<span>{i === days.length - 1 ? 'today' : shortDay(d.day)}</span>{/each}
</div>

<style>
  .dash { --dot: var(--muted); position: relative; display: flex; justify-content: space-between; align-items: center; margin: 22px 2px 0; height: 16px; }
  .dash::before { content: ""; position: absolute; left: 6px; right: 6px; top: 50%; border-top: 2px dashed var(--line); }
  i { position: relative; width: 14px; height: 14px; border-radius: 50%; background: var(--bg); transition: background .3s, box-shadow .3s; }
  .full { background: var(--dot); }
  .half { box-shadow: inset 0 0 0 2px var(--dot); }
  .half::after { content: ""; position: absolute; inset: 4px; border-radius: 50%; background: conic-gradient(var(--dot) calc(var(--p) * 1%), transparent 0); }
  .miss { box-shadow: inset 0 0 0 2px var(--miss); }
  .miss::after { content: ""; position: absolute; inset: 5px; border-radius: 50%; background: var(--miss); opacity: .5; }
  .none { box-shadow: inset 0 0 0 1px var(--line); transform: scale(.6); }
  .open { box-shadow: inset 0 0 0 2px var(--text); }
  .today.full { background: var(--text); box-shadow: 0 0 0 3px color-mix(in srgb, var(--text) 18%, transparent); }
  .lbl { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 10px; color: var(--dim); margin: 8px 0 18px; }
  .lbl span { width: 30px; text-align: center; }
  .lbl span:first-child { text-align: left; }
  .lbl span:last-child { text-align: right; color: var(--text); }
</style>
