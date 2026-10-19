<script lang="ts">
  import TabBar from './components/TabBar.svelte';
  import Toast from './components/Toast.svelte';
  import { app, refresh } from './lib/state.svelte.ts';
  import Branches from './screens/Branches.svelte';
  import Log from './screens/Log.svelte';
  import Pair from './screens/Pair.svelte';
  import Status from './screens/Status.svelte';

  refresh();

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
  <div class="shell">
    {#if app.tab === 'status'}<Status />
    {:else if app.tab === 'log'}<Log />
    {:else}<Branches />{/if}
  </div>
  <TabBar />
  <Toast />
{/if}

<style>
  .shell { max-width: 520px; margin: 0 auto; }
  .boot { min-height: 100dvh; display: grid; place-items: center; }
  .boot i { width: 14px; height: 14px; border-radius: 50%; box-shadow: inset 0 0 0 2px var(--ok); animation: pulse 1s var(--ease) infinite alternate; }
  .boot.off p { font-family: var(--font-mono); font-size: 14px; color: var(--muted); text-align: center; line-height: 1.6; }
  .boot.off span { color: var(--dim); }
  @keyframes pulse { to { transform: scale(1.6); opacity: .4; } }
</style>
