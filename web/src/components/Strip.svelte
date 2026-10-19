<script lang="ts">
  import type { StripDay } from '../../../shared/src/api.ts';
  import { shortDay } from '../lib/format.ts';
  let { days }: { days: StripDay[] } = $props();
</script>

<div class="strip" aria-label="last 7 days">
  {#each days as d, i (d.day)}
    {#if i}<u></u>{/if}
    <i class={d.state} class:today={i === days.length - 1} title="{d.day}: {d.state}"></i>
  {/each}
</div>
<div class="lbl">
  {#each days as d, i (d.day)}<span>{i === days.length - 1 ? 'today' : shortDay(d.day)}</span>{/each}
</div>

<style>
  .strip { display: flex; align-items: center; margin: 16px 0 6px; }
  i { width: 10px; height: 10px; border-radius: 50%; flex: none; background: var(--ok); transition: background .3s, box-shadow .3s, transform .3s var(--ease); }
  i.half { background: none; box-shadow: inset 0 0 0 2px var(--ok); }
  i.miss { background: none; box-shadow: inset 0 0 0 1.5px var(--miss); }
  i.none { background: var(--line); transform: scale(.5); }
  i.open { background: none; box-shadow: inset 0 0 0 2px var(--dim); }
  i.today.full { box-shadow: 0 0 10px var(--ok); transform: scale(1.25); }
  u { flex: 1; height: 2px; background: var(--line); }
  .lbl { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 10px; color: var(--dim); margin-bottom: 18px; }
</style>
