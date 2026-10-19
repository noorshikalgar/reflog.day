<script lang="ts">
  let { value }: { value: number } = $props();
  const digits = $derived(String(Math.max(0, value)).split('').map(Number));
</script>

<span class="odo" aria-label={String(value)}>
  {#each digits as d, i (digits.length - i)}
    <span class="col" aria-hidden="true">
      <span class="reel" style:transform="translateY({-d}em)">
        {#each { length: 10 } as _, n}<b>{n}</b>{/each}
      </span>
    </span>
  {/each}
</span>

<style>
  .odo { display: inline-flex; }
  .col { display: inline-block; height: 1em; overflow: hidden; line-height: 1; }
  .reel { display: flex; flex-direction: column; transition: transform .45s var(--ease); }
  b { font-weight: inherit; height: 1em; line-height: 1; }
</style>
