<script lang="ts">
  import type { Theme } from '../../../../shared/src/api.ts';
  import Group from '../../components/ui/Group.svelte';
  import { app, setLogView, setTheme, type LogMode } from '../../lib/state.svelte.ts';

  // Small previews. Colors copied from theme.css so each card shows its own theme.
  const THEMES: { id: Theme; d: string; bg: string; s: string; t: string; a: string[] }[] = [
    { id: 'terminal', d: 'cool slate, green', bg: '#0b0d12', s: '#1a1e28', t: '#e7e9ee', a: ['#3ddc97', '#4cc9f0', '#a78bfa'] },
    { id: 'bathory', d: 'black metal', bg: '#000000', s: '#1c1c1c', t: '#f1f1f1', a: ['#fbcb97', '#e78a43', '#5f8787'] },
    { id: 'gruvbox', d: 'retro, cream', bg: '#282828', s: '#3c3836', t: '#ebdbb2', a: ['#b8bb26', '#83a598', '#fe8019'] },
    { id: 'paper', d: 'light, calm', bg: '#f2f1ec', s: '#e6e4dc', t: '#1a1d24', a: ['#107d4e', '#0a769c', '#6d4fd8'] },
  ];
  const VIEWS: { id: LogMode; label: string; sub: string }[] = [
    { id: 'normal', label: 'Normal', sub: 'Two lines per commit. Easy to read.' },
    { id: 'compact', label: 'Compact', sub: 'Raw git log --graph. More on one screen.' },
  ];
  const theme = $derived(app.today?.settings.theme ?? 'terminal');
</script>

<Group title="Theme" foot="Synced to all your devices.">
  <div class="themes" role="radiogroup" aria-label="theme">
    {#each THEMES as t (t.id)}
      <button class="th" class:on={theme === t.id} role="radio" aria-checked={theme === t.id} onclick={() => setTheme(t.id)}>
        <span class="pv" style:background={t.bg} style:color={t.t}>
          <span class="n">6<span class="of">/9</span></span>
          <span class="bars">{#each t.a as c (c)}<i style:background={t.s}><b style:background={c}></b></i>{/each}</span>
        </span>
        <span class="nm"><span class="ck"><svg viewBox="0 0 12 12"><path d="M2 6l3 3 5-6" /></svg></span>{t.id}</span>
        <span class="ds">{t.d}</span>
      </button>
    {/each}
  </div>
</Group>

<Group title="Log view" foot="This device only.">
  {#each VIEWS as v (v.id)}
    <button class="opt" role="radio" aria-checked={app.logView === v.id} onclick={() => setLogView(v.id)}>
      <span class="tx">
        <span class="lb">{v.label}</span>
        <span class="sb">{v.sub}</span>
        <span class="sample">
          {#if v.id === 'normal'}<span style:color="var(--l1)">walk</span> park, 4.2k<br /><span class="h">7b56d50</span> 18:40
          {:else}* (HEAD -&gt; today) 6/9<br />| <span style:color="var(--l1)">*</span> <span class="y">7b56d50</span> (<span style:color="var(--l1)">walk</span>) park{/if}
        </span>
      </span>
      <span class="radio" class:on={app.logView === v.id} aria-hidden="true"></span>
    </button>
  {/each}
</Group>

<style>
  .themes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 14px; }
  .th { display: flex; flex-direction: column; border-radius: 14px; padding: 8px; box-shadow: inset 0 0 0 1.5px var(--line); text-align: left; font-family: var(--font-ui); transition: box-shadow .2s, transform .15s var(--ease); }
  .th:active { transform: scale(.97); }
  .th.on { box-shadow: inset 0 0 0 2.5px var(--ok); }
  .pv { height: 96px; border-radius: 9px; padding: 10px; display: flex; flex-direction: column; box-shadow: inset 0 0 0 1px rgba(127, 127, 127, .15); }
  .n { font-family: var(--font-display); font-size: 26px; font-weight: 300; line-height: 1; }
  .of { opacity: .45; }
  .bars { display: flex; flex-direction: column; gap: 4px; margin-top: auto; }
  .bars i { display: flex; align-items: center; height: 12px; border-radius: 4px; padding-left: 4px; }
  .bars b { width: 6px; height: 6px; border-radius: 50%; }
  .nm { display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 500; margin-top: 9px; padding: 0 4px; }
  .ck { width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; box-shadow: inset 0 0 0 1.5px var(--line); flex: none; }
  .on .ck { background: var(--ok); box-shadow: none; }
  .ck svg { width: 10px; height: 10px; stroke: var(--on-ok); fill: none; stroke-width: 3; opacity: 0; }
  .on .ck svg { opacity: 1; }
  .ds { font-size: 11.5px; color: var(--dim); margin-top: 2px; padding: 0 4px 2px 29px; }
  .opt { display: grid; grid-template-columns: 1fr auto; gap: 12px; width: 100%; padding: 12px 16px; text-align: left; font-family: var(--font-ui); }
  .opt:active { background: color-mix(in srgb, var(--text) 7%, transparent); }
  .tx { display: flex; flex-direction: column; min-width: 0; }
  .lb { font-size: 16px; }
  .sb { font-size: 12.5px; color: var(--dim); margin-top: 2px; }
  .sample { margin-top: 8px; border-radius: 10px; background: var(--bg); padding: 8px 10px; font-family: var(--font-mono); font-size: 10.5px; line-height: 1.6; color: var(--muted); }
  .h { color: var(--dim); background: var(--surface-2); padding: 0 4px; border-radius: 4px; font-size: 9.5px; }
  .y { color: var(--rest); }
  .radio { width: 22px; height: 22px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--line); transition: box-shadow .2s; margin-top: 2px; }
  .radio.on { box-shadow: inset 0 0 0 7px var(--ok); }
</style>
