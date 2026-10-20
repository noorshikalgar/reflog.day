<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { dragDown } from '../lib/gestures.ts';
  let { open, onclose, children }: { open: boolean; onclose: () => void; children: Snippet } = $props();
  // After a drag-down the sheet is already off screen: close without the slide.
  let dragged = $state(false);
  $effect(() => { if (open) dragged = false; });
  const dragClose = () => { dragged = true; onclose(); };
</script>

<svelte:window onkeydown={e => open && e.key === 'Escape' && onclose()} />

{#if open}
  <div class="scrim" in:fade={{ duration: 200 }} out:fade={{ duration: dragged ? 0 : 200 }} onclick={onclose} aria-hidden="true"></div>
  <div class="sheet" role="dialog" aria-modal="true" use:dragDown={{ onclose: dragClose }} in:fly={{ y: 420, duration: 300, opacity: 1 }} out:fly={{ y: 420, duration: dragged ? 0 : 300, opacity: 1 }}>
    <div class="grab"></div>
    {@render children()}
  </div>
{/if}

<style>
  .scrim { position: fixed; inset: 0; z-index: 50; background: rgba(0, 0, 0, .55); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); }
  .sheet {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 51; max-width: 520px; margin: 0 auto;
    max-height: 90dvh; overflow-y: auto; background: var(--surface); border-radius: 30px 30px 0 0;
    padding: 10px 20px calc(24px + env(safe-area-inset-bottom)); box-shadow: 0 -1px 0 var(--edge);
  }
  .grab { width: 40px; height: 5px; border-radius: 3px; background: var(--line); margin: 0 auto 18px; }
</style>
