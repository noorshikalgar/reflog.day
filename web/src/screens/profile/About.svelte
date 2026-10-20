<script lang="ts">
  import type { About } from '../../../../shared/src/api.ts';
  import Group from '../../components/ui/Group.svelte';
  import Row from '../../components/ui/Row.svelte';
  import { api } from '../../lib/api.ts';

  let a = $state<About | null>(null);
  api.about().then(x => (a = x)).catch(() => {});
  const open = (url: string) => window.open(url, '_blank', 'noopener');
</script>

<div class="brand"><span class="nm">reflog</span><span class="tag">git log for your day</span></div>

<Group>
  <Row label="Version" value={a ? `v${a.version}` : '…'} />
  <Row label="Build" value={a?.build ?? '—'} />
  <Row icon="code" label="Source code" sub="github.com/noorshikalgar/reflog.day" chevron onclick={() => open('https://github.com/noorshikalgar/reflog.day')} />
</Group>

<Group foot="Theme colors: bathory from black-metal-theme-neovim (Apache-2.0), gruvbox by morhetz.">
  <Row icon="list" label="Licence" value="MIT" />
  <Row icon="heart" label="Credits" sub="black-metal.nvim, gruvbox" />
</Group>

<style>
  .brand { display: flex; flex-direction: column; align-items: center; padding: 4px 0 22px; }
  .nm { font-family: var(--font-display); font-size: 30px; font-weight: 600; }
  .tag { font-family: var(--font-mono); font-size: 12px; color: var(--dim); margin-top: 4px; }
</style>
