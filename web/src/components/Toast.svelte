<script lang="ts">
  import { toast, hideToast } from '../lib/state.svelte.ts';
</script>

<div class="toast" class:show={!!toast.text} role="status" aria-live="polite">
  <span>{toast.text}</span>
  {#if toast.undo}<button onclick={() => toast.undo?.()}>undo</button>{:else}<button onclick={hideToast} aria-label="close">×</button>{/if}
  {#key toast.seq}<i class="bar" class:run={!!toast.text}></i>{/key}
</div>

<style>
  .toast {
    position: fixed; left: 16px; right: 16px; bottom: calc(96px + env(safe-area-inset-bottom)); z-index: 40;
    max-width: 488px; margin: 0 auto;
    background: var(--text); color: var(--bg); border-radius: 16px; padding: 14px 16px 16px;
    font-family: var(--font-mono); font-size: 13px; display: flex; justify-content: space-between; align-items: center; gap: 12px;
    transform: translateY(140%); opacity: 0; pointer-events: none; transition: transform .35s var(--ease), opacity .25s; overflow: hidden;
  }
  .toast.show { transform: none; opacity: 1; pointer-events: auto; }
  button { color: var(--bg); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; flex: none; }
  .bar { position: absolute; left: 0; bottom: 0; height: 3px; width: 100%; background: var(--ok); transform-origin: left; }
  .bar.run { animation: shrink 10s linear forwards; }
  @keyframes shrink { to { transform: scaleX(0); } }
</style>
