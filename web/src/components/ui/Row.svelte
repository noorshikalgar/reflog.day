<script lang="ts">
  // One settings row: label on top, help text under it, value or control on the right.
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from './Icon.svelte';
  import { tick } from '../../lib/haptics.ts';

  let { icon, label, sub = '', value = '', chevron = false, danger = false, center = false, disabled = false, onclick, right }: {
    icon?: IconName; label: string; sub?: string; value?: string; chevron?: boolean;
    danger?: boolean; center?: boolean; disabled?: boolean; onclick?: () => void; right?: Snippet;
  } = $props();
</script>

{#snippet body()}
  {#if !center}<span class="ico" class:none={!icon}>{#if icon}<Icon name={icon} />{/if}</span>{/if}
  <span class="tx">
    <span class="lb">{label}</span>
    {#if sub}<span class="sb">{sub}</span>{/if}
  </span>
  {#if !center}
    <span class="rt">
      {#if right}{@render right()}{:else if value}<span class="val">{value}</span>{/if}
      {#if chevron}<svg class="chev" viewBox="0 0 8 14" aria-hidden="true"><path d="M1 1l6 6-6 6" /></svg>{/if}
    </span>
  {/if}
{/snippet}

{#if onclick}
  <button class="r" class:noi={!icon} class:danger class:center {disabled} onclick={() => { tick(); onclick?.(); }}>{@render body()}</button>
{:else}
  <div class="r" class:noi={!icon} class:center>{@render body()}</div>
{/if}

<style>
  .r { position: relative; display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; width: 100%; min-height: 52px; padding: 10px 14px; text-align: left; font-family: var(--font-ui); color: var(--text); transition: background .15s; }
  button.r:active:not(:disabled) { background: color-mix(in srgb, var(--text) 7%, transparent); }
  button.r:disabled { opacity: .5; cursor: default; }
  .noi { grid-template-columns: 0 1fr auto; gap: 0 12px; }
  .ico { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; background: var(--surface-2); color: var(--text); }
  .ico.none { width: 0; background: none; }
  .tx { min-width: 0; display: flex; flex-direction: column; }
  .lb { font-size: 16px; line-height: 1.25; }
  .sb { font-size: 12.5px; color: var(--dim); line-height: 1.3; margin-top: 2px; }
  .rt { display: flex; align-items: center; gap: 6px; color: var(--dim); font-size: 15px; }
  .val { max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chev { width: 8px; height: 14px; stroke: var(--dim); fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; opacity: .7; flex: none; }
  .danger .lb { color: #ff6b6b; }
  :global([data-theme="paper"]) .danger .lb { color: #c0392b; }
  .center { grid-template-columns: 1fr; text-align: center; }
  .center .lb { color: var(--ok); font-weight: 500; }
</style>
