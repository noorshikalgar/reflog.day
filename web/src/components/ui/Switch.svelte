<script lang="ts">
  let { on }: { on: boolean } = $props();
</script>

<span class="sw" class:on aria-hidden="true"></span>

<style>
  .sw { position: relative; width: 51px; height: 31px; border-radius: 16px; background: var(--line); transition: background .25s; flex: none; display: block; }
  .sw::after { content: ""; position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff; box-shadow: 0 2px 4px rgba(0, 0, 0, .25); transition: transform .25s var(--ease); }
  .on { background: var(--ok); }
  .on::after { transform: translateX(20px); }
</style>
