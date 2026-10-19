<script lang="ts">
  // Three activity rings, outside to inside. Values are 0–1. Decorative: the legend has the numbers.
  let { values, label }: { values: [number, number, number]; label: string } = $props();

  const S = 118, W = 11, G = 3;
  const COLORS = ['var(--ring1)', 'var(--ring2)', 'var(--ring3)'];
  const rings = COLORS.map((color, i) => {
    const r = S / 2 - W / 2 - i * (W + G);
    return { color, r, c: 2 * Math.PI * r };
  });

  // Start empty, then roll to the values after the first paint.
  let shown = $state<number[]>([0, 0, 0]);
  $effect(() => {
    const v = values.map(x => Math.max(0, Math.min(1, x)));
    const id = requestAnimationFrame(() => (shown = v));
    return () => cancelAnimationFrame(id);
  });
</script>

<div class="rings" class:all={values[0] >= 1} role="img" aria-label={label}>
  <svg width={S} height={S} viewBox="0 0 {S} {S}" aria-hidden="true">
    {#each rings as g, i (i)}
      <circle class="track" cx={S / 2} cy={S / 2} r={g.r} stroke={g.color} stroke-width={W} />
      <circle class="arc" class:full={shown[i] >= 1} cx={S / 2} cy={S / 2} r={g.r} stroke={g.color} style:color={g.color}
        stroke-width={W} stroke-dasharray={g.c} stroke-dashoffset={g.c * (1 - Math.max(shown[i], 0.001))} />
    {/each}
  </svg>
  <span class="mark" aria-hidden="true">✓</span>
</div>

<style>
  .rings { width: 118px; height: 118px; flex: none; position: relative; }
  svg { display: block; transform: rotate(-90deg); overflow: visible; }
  .track { fill: none; opacity: .16; }
  .arc { fill: none; stroke-linecap: round; transition: stroke-dashoffset .8s var(--ease); }
  .arc.full { filter: drop-shadow(0 0 4px currentColor); }
  .mark { position: absolute; inset: 0; display: grid; place-items: center; font-family: var(--font-mono); font-size: 12px; color: var(--ring1); opacity: 0; transition: opacity .4s .5s; }
  .all .mark { opacity: 1; }
</style>
