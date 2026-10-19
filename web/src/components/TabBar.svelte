<script lang="ts">
  import { app, go, type Tab } from '../lib/state.svelte.ts';
  const TABS: [Tab, string][] = [
    ['status', '<circle cx="12" cy="12" r="4"/><path d="M12 2v6M12 16v6"/>'],
    ['log', '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 7v10M18 11c0 4-12 2-12 6"/>'],
    ['branches', '<path d="M4 6h16M4 12h16M4 18h10"/>'],
  ];
</script>

<nav class="tabs">
  {#each TABS as [t, icon] (t)}
    <button class:on={app.tab === t} onclick={() => go(t)} aria-current={app.tab === t ? 'page' : undefined}>
      <svg viewBox="0 0 24 24" aria-hidden="true">{@html icon}</svg>{t}
    </button>
  {/each}
</nav>

<style>
  .tabs {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; display: grid; grid-template-columns: repeat(3, 1fr);
    padding: 8px 12px calc(10px + env(safe-area-inset-bottom)); border-top: 1px solid var(--line);
    background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    view-transition-name: tabs;
  }
  button { display: flex; flex-direction: column; align-items: center; gap: 5px; font-family: var(--font-mono); font-size: 11px; color: var(--dim); padding: 6px 0; min-height: 56px; justify-content: center; }
  svg { width: 22px; height: 22px; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .on { color: var(--text); }
  .on svg { stroke: var(--ok); }
</style>
