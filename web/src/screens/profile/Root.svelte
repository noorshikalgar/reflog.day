<script lang="ts">
  import type { Profile } from '../../../../shared/src/api.ts';
  import Group from '../../components/ui/Group.svelte';
  import Row from '../../components/ui/Row.svelte';
  import { api } from '../../lib/api.ts';
  import { push } from '../../lib/profile.svelte.ts';
  import { app } from '../../lib/state.svelte.ts';
  import Avatar from './Avatar.svelte';

  let p = $state<Profile | null>(null);
  let devices = $state(0);
  api.profile().then(x => (p = x)).catch(() => {});
  api.devices().then(x => (devices = x.length)).catch(() => {});

  const s = $derived(app.today?.settings);
  const since = $derived(p ? new Date(p.since + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).toLowerCase() : '');
  const fmt = (n: number) => n.toLocaleString('en-US');
</script>

<div class="cmd">$ git config --list</div>

<Group>
  <div class="card">
  <button class="me" onclick={() => push('edit')}>
    <Avatar value={p?.avatar ?? '🌱'} />
    <span class="who"><span class="nm">{p?.name ?? '…'}</span><span class="sb">{p ? `committing since ${since}` : ''}</span></span>
    <svg class="chev" viewBox="0 0 8 14" aria-hidden="true"><path d="M1 1l6 6-6 6" /></svg>
  </button>
  <div class="kpis">
    <div class="kpi"><span class="v">{p ? fmt(p.totals.commits) : '–'}</span><span class="k">commits</span></div>
    <div class="kpi"><span class="v">{p ? `${p.totals.best_now}d` : '–'}</span><span class="k">best now</span></div>
    <div class="kpi"><span class="v">{p ? p.totals.tags : '–'}</span><span class="k">tags</span></div>
  </div>
  </div>
</Group>

<Group title="Insights" foot="Stats and records arrive in v0.6.">
  <Row icon="stats" label="Stats" sub="Activity, trend, branches, rhythm" value="soon" disabled onclick={() => {}} />
  <Row icon="trophy" label="Records" sub="Longest streaks and tags" value="soon" disabled onclick={() => {}} />
</Group>

<Group title="Preferences">
  <Row icon="paint" label="Appearance" sub="Theme and log view" value={s?.theme ?? ''} chevron onclick={() => push('appearance')} />
  <Row icon="clock" label="Day & time" sub="When a day starts, time zone" value={s ? `0${s.day_start_hour}:00` : ''} chevron onclick={() => push('daytime')} />
  <Row icon="bell" label="Notifications" sub="Reminders and evening summary" value={s?.push_enabled ? 'On' : 'Off'} chevron onclick={() => push('notifications')} />
</Group>

<Group title="Data">
  <Row icon="db" label="Backups" sub="Daily on the server, 14 kept" value="soon" disabled onclick={() => {}} />
  <Row icon="arrows" label="Export & import" sub="One JSON file with all history" chevron onclick={() => push('data')} />
</Group>

<Group>
  <Row icon="phone" label="Devices" sub={devices ? `${devices} paired` : 'Paired devices'} chevron onclick={() => push('devices')} />
  <Row icon="info" label="About reflog" sub="Version, source, licence" chevron onclick={() => push('about')} />
</Group>

<style>
  .cmd { font-family: var(--font-mono); font-size: 11px; color: var(--dim); margin: -6px 4px 12px; }
  .me { display: grid; grid-template-columns: 62px 1fr auto; gap: 14px; align-items: center; width: 100%; padding: 14px; text-align: left; font-family: var(--font-ui); }
  .me:active { background: color-mix(in srgb, var(--text) 7%, transparent); }
  .who { display: flex; flex-direction: column; min-width: 0; }
  .nm { font-size: 21px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sb { font-size: 13px; color: var(--dim); margin-top: 2px; }
  .chev { width: 8px; height: 14px; stroke: var(--dim); fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; opacity: .7; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--line); }
  .kpi { display: flex; flex-direction: column; padding: 10px 14px 12px; font-family: var(--font-ui); }
  .kpi + .kpi { border-left: 1px solid var(--line); }
  .v { font-family: var(--font-display); font-size: 22px; font-weight: 500; letter-spacing: -.01em; font-variant-numeric: tabular-nums; }
  .k { font-size: 11.5px; color: var(--dim); }
</style>
