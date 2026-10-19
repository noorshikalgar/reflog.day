<script lang="ts">
  import TabBar from './components/TabBar.svelte';
  import Toast from './components/Toast.svelte';
  import { app, refresh } from './lib/state.svelte.ts';
  import Branches from './screens/Branches.svelte';
  import Log from './screens/Log.svelte';
  import Pair from './screens/Pair.svelte';
  import Show from './screens/Show.svelte';
  import Status from './screens/Status.svelte';

  refresh();

  // A notification tap opens /?focus=<slug>. Light that row once, then clean the URL.
  const focus = new URL(location.href).searchParams.get('focus');
  if (focus) {
    app.focus = focus;
    history.replaceState(null, '', '/');
    setTimeout(() => (app.focus = null), 2600);
  }

  // Desktop (≥ 900 px): status and log side by side. Refer to docs/03-ux-ui.md U-08.
  const wideQuery = matchMedia('(min-width: 900px)');
  let wide = $state(wideQuery.matches);
  $effect(() => {
    const on = () => (wide = wideQuery.matches);
    wideQuery.addEventListener('change', on);
    return () => wideQuery.removeEventListener('change', on);
  });
  const split = $derived(wide && !app.show && app.tab !== 'branches');

  $effect(() => {
    const onVis = () => document.visibilityState === 'visible' && refresh();
    const onOnline = () => refresh();
    const onOffline = () => (app.online = false);
    document.addEventListener('visibilitychange', onVis);
    addEventListener('online', onOnline);
    addEventListener('offline', onOffline);
    const timer = setInterval(() => document.visibilityState === 'visible' && refresh(), 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      removeEventListener('online', onOnline);
      removeEventListener('offline', onOffline);
      clearInterval(timer);
    };
  });
</script>

{#if app.loading}
  <div class="boot" aria-label="loading"><i></i></div>
{:else if !app.paired}
  <Pair />
{:else if !app.today}
  <div class="boot off">
    <p>can't reach the server.<br /><span>is reflog running? retrying…</span></p>
  </div>
{:else}
  <div class="shell" class:split>
    {#if split}
      <section aria-label="status"><Status /></section>
      <section aria-label="log"><Log /></section>
    {:else if app.show}<Show id={app.show} />
    {:else if app.tab === 'status'}<Status />
    {:else if app.tab === 'log'}<Log />
    {:else}<Branches />{/if}
  </div>
  <TabBar />
  <Toast />
{/if}

<style>
  .shell { max-width: 520px; margin: 0 auto; }
  .shell.split { max-width: 1120px; display: grid; grid-template-columns: 1fr 1fr; gap: 0 40px; padding: 0 24px; }
  .shell.split section { min-width: 0; }
  .boot { min-height: 100dvh; display: grid; place-items: center; }
  .boot i { width: 14px; height: 14px; border-radius: 50%; box-shadow: inset 0 0 0 2px var(--ok); animation: pulse 1s var(--ease) infinite alternate; }
  .boot.off p { font-family: var(--font-mono); font-size: 14px; color: var(--muted); text-align: center; line-height: 1.6; }
  .boot.off span { color: var(--dim); }
  @keyframes pulse { to { transform: scale(1.6); opacity: .4; } }
</style>
