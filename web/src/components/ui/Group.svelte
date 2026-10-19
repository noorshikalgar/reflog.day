<script lang="ts">
  import type { Snippet } from 'svelte';
  let { title = '', foot = '', children }: { title?: string; foot?: string; children: Snippet } = $props();
</script>

<section class="grp">
  {#if title}<h2 class="h">{title}</h2>{/if}
  <div class="list">{@render children()}</div>
  {#if foot}<p class="f">{foot}</p>{/if}
</section>

<style>
  .grp { margin: 0 0 26px; }
  .h { font-family: var(--font-ui); font-size: 12px; font-weight: 500; color: var(--dim); text-transform: uppercase; letter-spacing: .6px; padding: 0 16px 7px; }
  .f { font-family: var(--font-ui); font-size: 12px; color: var(--dim); padding: 7px 16px 0; line-height: 1.45; }
  .list { background: var(--surface); border-radius: 14px; overflow: hidden; box-shadow: inset 0 0 0 1px var(--edge); }
  /* Hairline between rows, indented past the icon like iOS. */
  .list > :global(* + *) { position: relative; }
  .list > :global(* + *)::before { content: ""; position: absolute; top: 0; left: 56px; right: 0; height: 1px; background: var(--line); }
  .list > :global(.noi + *)::before, .list > :global(* + .noi)::before { left: 16px; }
</style>
