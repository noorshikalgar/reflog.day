<script lang="ts">
  import Group from '../../components/ui/Group.svelte';
  import Row from '../../components/ui/Row.svelte';
  import { saveSettings } from '../../lib/settings.ts';
  import { app, showToast } from '../../lib/state.svelte.ts';

  const s = $derived(app.today?.settings);
</script>

{#if s}
  <Group foot="A new day start does not move old commits.">
    <Row label="Day starts at" sub="A commit at 01:30 still counts for the day before">
      {#snippet right()}
        <select class="sel" value={s.day_start_hour} onchange={async e => { const v = Number(e.currentTarget.value); if (await saveSettings({ day_start_hour: v })) showToast(`day starts at 0${v}:00`, null, 2500); }}>
          {#each [0, 1, 2, 3, 4, 5, 6] as h (h)}<option value={h}>0{h}:00</option>{/each}
        </select>
        <svg class="chev" viewBox="0 0 8 14" aria-hidden="true"><path d="M1 1l6 6-6 6" /></svg>
      {/snippet}
    </Row>
    <Row label="Time zone" sub="For reminders and day changes" value={s.tz} />
  </Group>

  <Group title="Amend" foot="Fixed. This keeps “never miss twice” honest.">
    <Row label="Amend yesterday until" sub="After this time, a missed day is final" value="12:00" />
  </Group>
{/if}

<style>
  .sel { background: none; border: 0; outline: none; color: var(--dim); font-family: var(--font-ui); font-size: 15px; text-align: right; appearance: none; -webkit-appearance: none; cursor: pointer; }
  .chev { width: 8px; height: 14px; stroke: var(--dim); fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; opacity: .7; }
</style>
