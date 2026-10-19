<script lang="ts">
  import { untrack } from 'svelte';
  let { x, y, n = 22 }: { x: number; y: number; n?: number } = $props();
  const dots = Array.from({ length: untrack(() => n) }, (_, i) => {
    const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 90;
    return { lane: 1 + (i % 10), dx: Math.cos(a) * r, dy: Math.sin(a) * r, delay: Math.random() * 120 };
  });
</script>

{#each dots as d, i (i)}
  <i style:left="{x}px" style:top="{y}px" style:background="var(--l{d.lane})" style:--dx="{d.dx}px" style:--dy="{d.dy}px" style:animation-delay="{d.delay}ms"></i>
{/each}

<style>
  i { position: fixed; width: 7px; height: 7px; border-radius: 50%; pointer-events: none; z-index: 45; animation: burst 1s var(--ease) forwards; }
  @keyframes burst { from { transform: translate(0, 0) scale(1); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(.4); opacity: 0; } }
</style>
