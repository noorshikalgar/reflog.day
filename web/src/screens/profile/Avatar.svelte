<script lang="ts">
  let { value, size = 62 }: { value: string; size?: number } = $props();
  const initials = $derived(/^[A-Z]{1,2}$/.test(value));
</script>

<span class="av" class:ini={initials} style:width="{size}px" style:height="{size}px" style:font-size="{initials ? size * 0.32 : size * 0.48}px" aria-hidden="true">{value}</span>

<style>
  .av { border-radius: 50%; display: grid; place-items: center; background: var(--surface-2); box-shadow: inset 0 0 0 2px var(--ok); flex: none; line-height: 1; }
  .ini { font-family: var(--font-mono); font-weight: 600; }
</style>
