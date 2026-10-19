<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { ReleaseNotes } from '../../../shared/src/api.ts';
  import { api } from '../lib/api.ts';
  import { app } from '../lib/state.svelte.ts';

  let { notes }: { notes: ReleaseNotes } = $props();
  const best = $derived([...notes.new_best].sort((a, b) => b.best - a.best));

  async function close() {
    const version = notes.version; // read before the card unmounts
    if (app.today) app.today.release_notes = null;
    await api.notesSeen(version).catch(() => {});
  }
</script>

<button class="card" onclick={close} out:slide={{ duration: 300 }} aria-label="release notes {notes.version}, tap to close">
  <div class="h"><span class="tag">{notes.version}</span> release notes</div>
  <div class="line">
    <b>{notes.commits}</b> commit{notes.commits === 1 ? '' : 's'}
    · <span class="rest">{notes.rest} rest</span>
    · <span class="miss">{notes.miss} miss</span>
  </div>
  {#if notes.longest}<div class="line dim">longest streak: <b>{notes.longest.slug}</b> {notes.longest.streak}d</div>{/if}
  {#if best.length}
    <div class="line dim">new best: {#each best.slice(0, 3) as b, i (b.slug)}{i ? ', ' : ''}<b class="ok">{b.slug}</b> {b.best}d{/each}{#if best.length > 3} +{best.length - 3} more{/if}</div>
  {/if}
  <div class="tap">tap to close</div>
</button>

<style>
  .card { display: block; width: 100%; text-align: left; background: var(--surface); box-shadow: inset 0 0 0 1px var(--edge); border-radius: 22px; padding: 16px 18px; margin: 6px 0 8px; font-family: var(--font-mono); font-size: 12px; color: var(--muted); animation: drop .5s var(--ease) both; }
  .h { font-size: 14px; color: var(--text); font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
  .tag { font-size: 11px; font-weight: 500; color: var(--ok); box-shadow: inset 0 0 0 1px var(--ok); border-radius: 6px; padding: 1px 6px; }
  .line { line-height: 1.7; }
  b { color: var(--text); font-weight: 500; }
  .ok { color: var(--ok); }
  .rest { color: var(--rest); }
  .miss { color: var(--miss); }
  .dim { color: var(--dim); }
  .tap { margin-top: 8px; font-size: 10px; color: var(--dim); }
  @keyframes drop { from { opacity: 0; transform: translateY(-16px); } }
</style>
