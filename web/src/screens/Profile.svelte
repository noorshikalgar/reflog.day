<script lang="ts">
  // Profile tab: iOS Settings style pages on a small navigation stack. Refer to docs/10-profile.md §3.
  import { cubicOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';
  import { edgeSwipe } from '../lib/gestures.ts';
  import { nav, pop, swipePop, TITLES } from '../lib/profile.svelte.ts';
  import About from './profile/About.svelte';
  import Appearance from './profile/Appearance.svelte';
  import Data from './profile/Data.svelte';
  import DayTime from './profile/DayTime.svelte';
  import Devices from './profile/Devices.svelte';
  import Edit from './profile/Edit.svelte';
  import Notifications from './profile/Notifications.svelte';
  import Pair from './profile/Pair.svelte';
  import Root from './profile/Root.svelte';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const top = $derived(nav.stack[nav.stack.length - 1]);
  const parent = $derived(nav.stack.length > 1 ? nav.stack[nav.stack.length - 2] : null);
  const W = Math.min(innerWidth, 560);
  const ease = cubicOut;
  // Push: new page comes from the right, old page drifts left. Pop: the reverse.
  const inX = () => (nav.dir === 1 ? W : -W * 0.3);
  const outX = () => (nav.dir === 1 ? -W * 0.3 : W);
  const D = reduce ? 0 : 380;
</script>

<div class="stack">
  {#key top}
    <main class="page" use:edgeSwipe={{ enabled: !!parent, onback: swipePop }}
      in:fly={{ x: inX(), duration: D, easing: ease, opacity: nav.dir === 1 ? 1 : 0.4 }}
      out:fly={{ x: outX(), duration: nav.instant ? 0 : D, easing: ease, opacity: nav.dir === 1 ? 0.4 : 1 }}>
      <header class="bar" class:sub={!!parent}>
        <span>{#if parent}<button class="back" onclick={pop}><svg viewBox="0 0 12 20" aria-hidden="true"><path d="M10 2 2 10l8 8" /></svg>{TITLES[parent]}</button>{/if}</span>
        {#if parent}<h1 class="ttl">{TITLES[top]}</h1>{/if}
        <span></span>
      </header>
      {#if !parent}<h1 class="large">{TITLES[top]}</h1>{/if}

      {#if top === 'root'}<Root />
      {:else if top === 'edit'}<Edit />
      {:else if top === 'appearance'}<Appearance />
      {:else if top === 'daytime'}<DayTime />
      {:else if top === 'notifications'}<Notifications />
      {:else if top === 'data'}<Data />
      {:else if top === 'devices'}<Devices />
      {:else if top === 'pair'}<Pair />
      {:else if top === 'about'}<About />{/if}
    </main>
  {/key}
</div>

<style>
  .stack { display: grid; overflow-x: clip; }
  .page { grid-area: 1 / 1; min-width: 0; padding: calc(4px + env(safe-area-inset-top)) 16px 32px; background: var(--bg); }
  .bar { position: sticky; top: 0; z-index: 5; height: 48px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; margin: 0 -16px; padding: env(safe-area-inset-top) 8px 0; box-sizing: content-box;
    background: color-mix(in srgb, var(--bg) 85%, transparent); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
  .back { display: inline-flex; align-items: center; gap: 4px; color: var(--ok); font-family: var(--font-ui); font-size: 16px; padding: 8px 6px; min-height: 44px; }
  .back svg { width: 11px; height: 19px; stroke: currentColor; fill: none; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
  .ttl { font-family: var(--font-ui); font-size: 16px; font-weight: 600; white-space: nowrap; }
  .large { font-family: var(--font-display); font-size: 34px; font-weight: 600; letter-spacing: -.02em; margin: -4px 4px 10px; }
  .bar:not(.sub) { height: 12px; }
</style>
