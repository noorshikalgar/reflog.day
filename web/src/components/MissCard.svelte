<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { UnseenMiss } from '../../../shared/src/api.ts';
  import { uuidv7 } from '../../../shared/src/ids.ts';
  import { api } from '../lib/api.ts';
  import { refresh, showToast } from '../lib/state.svelte.ts';
  import { addDays } from '../../../shared/src/rules.ts';

  let { misses, today, canAmend }: { misses: UnseenMiss[]; today: string; canAmend: boolean } = $props();

  const yesterday = $derived(addDays(today, -1));
  const title = $derived(misses[misses.length - 1].title);
  const restable = $derived(canAmend && misses.length === 1 && misses[0].day === yesterday && !misses[0].rebase);
  const when = (d: string) => (d === yesterday ? 'yesterday' : d);
  let busy = $state(false);

  async function ok() {
    busy = true;
    await api.missesSeen(misses.map(m => m.id)).catch(() => {});
    await refresh();
  }

  async function rest() {
    busy = true;
    const m = misses[0];
    try {
      await api.putEntry(uuidv7(), { habit_id: m.habit_id, kind: 'rest', day: m.day });
      showToast('--allow-empty. rest is a feature.', null, 4000);
    } catch (e) {
      showToast(`no rest: ${(e as Error).message}`, null, 4000);
      await api.missesSeen([m.id]).catch(() => {});
    }
    await refresh();
  }
</script>

<div class="card" out:slide={{ duration: 300 }}>
  <h3>{title}</h3>
  <p>
    {#each misses as m (m.id)}
      <span><b>{m.slug}</b> — {m.rebase ? `rebased. best streak stays yours.` : `no commit ${when(m.day)}.`}</span>
    {/each}
    {#if misses.some(m => !m.rebase)}<span class="rule">streak safe. never miss twice.</span>{/if}
  </p>
  <div class="acts">
    <button class="chip" onclick={ok} disabled={busy}>ok</button>
    {#if restable}<button class="chip ghost" onclick={rest} disabled={busy}>it was a rest day</button>{/if}
  </div>
</div>

<style>
  .card {
    background: var(--surface); border: 1px dashed var(--line); border-radius: 22px; padding: 16px 18px 14px; margin: 6px 0 8px;
    font-family: var(--font-mono); transform-origin: 30% 0; animation: drop .5s var(--ease) both, wob .5s .45s var(--ease);
  }
  h3 { font-size: 14px; font-weight: 600; display: flex; gap: 8px; align-items: center; }
  h3::before { content: "◌"; color: var(--miss); font-size: 16px; }
  p { font-size: 12px; color: var(--muted); margin: 6px 0 12px; line-height: 1.5; display: flex; flex-direction: column; }
  b { color: var(--text); font-weight: 500; }
  .rule { color: var(--dim); }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; }
  .chip { font-family: var(--font-mono); font-size: 12px; padding: 10px 16px; border-radius: 12px; background: var(--surface-2); min-height: 40px; }
  .chip.ghost { background: none; box-shadow: inset 0 0 0 1px var(--line); color: var(--muted); }
  @keyframes drop { from { opacity: 0; transform: translateY(-16px); } }
  @keyframes wob { 30% { transform: rotate(-2deg); } 65% { transform: rotate(1deg); } }
</style>
