<script lang="ts">
  import { fly } from 'svelte/transition';
  import TabBar from './components/TabBar.svelte';
  import { edgeSwipe } from './lib/gestures.ts';
  import Toast from './components/Toast.svelte';
  import { app, refresh } from './lib/state.svelte.ts';
  import Branches from './screens/Branches.svelte';
  import Log from './screens/Log.svelte';
  import Pair from './screens/Pair.svelte';
  import Profile from './screens/Profile.svelte';
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
  const split = $derived(wide && !app.show && (app.tab === 'status' || app.tab === 'log'));

  // Native feel: every tab is its own scroll container and stays mounted once opened,
  // so it keeps its scroll position and loaded data. Only the active one is visible.
  const TABS = ['status', 'log', 'branches', 'profile'] as const;
  const visited = $state<Record<string, boolean>>({ status: true });
  $effect(() => { visited[app.tab] = true; });
  // The tab under the branch detail stays visible, so an edge swipe reveals it like iOS.
  const visible = (t: string) => (split ? t === 'status' || t === 'log' : app.tab === t);

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
  <div class="app">
    <div class="panes" class:split>
      {#each TABS as t (t)}
        {#if visited[t] || (split && (t === 'status' || t === 'log'))}
          <div class="pane" class:on={visible(t)} data-pane={t} aria-hidden={!visible(t)}>
            <div class="inner">
              {#if t === 'status'}<Status />
              {:else if t === 'log'}<Log />
              {:else if t === 'branches'}<Branches />
              {:else}<Profile />{/if}
            </div>
          </div>
        {/if}
      {/each}
      {#if app.show && !split}
        <div class="pane on show" data-pane="show" use:edgeSwipe={{ enabled: true, onback: () => (app.show = null) }} transition:fly={{ x: 400, duration: 300, opacity: 1 }}><div class="inner"><Show id={app.show} /></div></div>
      {/if}
    </div>
    <TabBar />
  </div>
  <Toast />
{/if}

<style>
  .app { position: fixed; inset: 0; display: flex; flex-direction: column; background: var(--bg); }
  .panes { position: relative; flex: 1; min-height: 0; overflow: hidden; }
  .pane {
    position: absolute; inset: 0; overflow: hidden auto; overscroll-behavior-y: contain; -webkit-overflow-scrolling: touch;
    visibility: hidden; pointer-events: none; scrollbar-width: none;
  }
  .pane::-webkit-scrollbar { display: none; }
  .pane.on { visibility: visible; pointer-events: auto; }
  .pane.show { z-index: 2; background: var(--bg); box-shadow: -8px 0 24px rgba(0, 0, 0, .25); }
  .inner { max-width: 520px; margin: 0 auto; min-height: calc(100% + 1px); /* always scrollable, so iOS bounces the content, never the chrome */ }
  .panes.split { display: grid; grid-template-columns: 1fr 1fr; max-width: 1180px; margin: 0 auto; width: 100%; }
  .panes.split .pane { position: relative; inset: auto; }
  .panes.split .pane:not(.on) { display: none; }
  .boot { min-height: 100dvh; display: grid; place-items: center; }
  .boot i { width: 14px; height: 14px; border-radius: 50%; box-shadow: inset 0 0 0 2px var(--ok); animation: pulse 1s var(--ease) infinite alternate; }
  .boot.off p { font-family: var(--font-mono); font-size: 14px; color: var(--muted); text-align: center; line-height: 1.6; }
  .boot.off span { color: var(--dim); }
  @keyframes pulse { to { transform: scale(1.6); opacity: .4; } }
</style>
