<script lang="ts" module>
  export type CommitRequest = { kind: 'done' | 'rest'; message: string | null; yesterday: boolean };
</script>

<script lang="ts">
  import type { HabitView } from '../../../shared/src/api.ts';
  import Sheet from './Sheet.svelte';

  let { habit, canAmend, onclose, oncommit, onrevert }: {
    habit: HabitView | null;
    canAmend: boolean;
    onclose: () => void;
    oncommit: (h: HabitView, r: CommitRequest) => void;
    onrevert: (h: HabitView) => void;
  } = $props();

  const CHIPS = ['quick', 'long one', 'felt good', 'hard today'];
  // Safari 18+: <input switch> gives a small haptic tick on iPhone.
  const SWITCH = { switch: '' } as Record<string, string>;
  const MAX = 72;

  let message = $state('');
  let amend = $state(false);
  let input: HTMLInputElement | undefined = $state();

  const committed = $derived(habit?.entry && habit.entry.kind !== 'miss' ? habit.entry : null);
  const amendable = $derived(!!habit && canAmend && habit.yesterday !== 'done' && habit.yesterday !== 'rest');

  // Reset the form each time the sheet opens for a branch.
  let openFor: string | null = null;
  $effect(() => {
    const id = habit?.id ?? null;
    if (id === openFor) return;
    openFor = id;
    message = committed?.message ?? '';
    amend = false;
  });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (habit) oncommit(habit, { kind: committed?.kind === 'rest' && !amend ? 'rest' : 'done', message: message.trim() || null, yesterday: amend });
  }
</script>

<Sheet open={!!habit} {onclose}>
  {#if habit}
    <form onsubmit={submit} style:--c="var(--l{habit.lane})">
      <div class="cmd">$ git commit {committed && !amend ? '--amend ' : ''}-m · <b>{habit.slug}</b></div>
      <h2>{committed && !amend ? `edit ${habit.slug}` : amend ? `amend yesterday` : `commit ${habit.slug}`}</h2>

      <label class="input">
        <input bind:this={input} bind:value={message} maxlength={MAX} placeholder="{habit.slug}: done" aria-label="commit message" autocomplete="off" />
        <small>{message.length}/{MAX}</small>
      </label>
      <div class="chips">
        {#each CHIPS as c (c)}
          <button type="button" class="chip" class:on={message === c} onclick={() => { message = message === c ? '' : c; input?.focus(); }}>{c}</button>
        {/each}
      </div>

      <button class="btn primary">{committed && !amend ? 'save message' : 'commit'}</button>

      {#if !committed || amend}
        <button type="button" class="btn rest" disabled={habit.rest_left === 0}
          onclick={() => oncommit(habit!, { kind: 'rest', message: message.trim() || null, yesterday: amend })}>
          rest day
          <small>--allow-empty · {habit.rest_left ? `${habit.rest_left} left this week` : 'none left this week'}</small>
        </button>
      {:else}
        <button type="button" class="btn ghost" onclick={() => onrevert(habit!)}>git revert {committed.hash}</button>
      {/if}

      {#if amendable}
        <label class="toggle">
          <span>amend yesterday <span class="dim">(until 12:00)</span></span>
          <input type="checkbox" {...SWITCH} bind:checked={amend} />
          <i class="sw" class:on={amend} aria-hidden="true"></i>
        </label>
      {/if}
    </form>
  {/if}
</Sheet>

<style>
  .cmd { font-family: var(--font-mono); font-size: 13px; color: var(--muted); }
  .cmd b { color: var(--c); font-weight: 500; }
  h2 { font-family: var(--font-display); font-weight: 300; font-size: 34px; letter-spacing: -.03em; margin: 2px 0 16px; }
  .input { display: flex; align-items: center; gap: 10px; background: var(--bg); border-radius: 16px; padding: 0 16px; box-shadow: inset 0 0 0 1px var(--line); }
  .input:focus-within { box-shadow: inset 0 0 0 2px var(--c); }
  .input input { flex: 1; min-width: 0; background: none; border: 0; outline: none; padding: 16px 0; font-family: var(--font-mono); font-size: 16px; caret-color: var(--c); }
  .input small { font-family: var(--font-mono); font-size: 11px; color: var(--dim); }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 18px; }
  .chip { font-family: var(--font-mono); font-size: 12px; padding: 10px 14px; border-radius: 12px; background: var(--surface-2); transition: background .15s, color .15s; }
  .chip.on { background: var(--c); color: var(--bg); }
  .btn { width: 100%; height: 60px; border-radius: 18px; font-family: var(--font-mono); font-size: 16px; font-weight: 600; transition: opacity .2s, transform .12s var(--ease); }
  .btn:active { transform: scale(.98); }
  .btn.primary { background: var(--ok); color: var(--on-ok); }
  .btn.rest { margin-top: 10px; height: 64px; box-shadow: inset 0 0 0 1.5px var(--rest); color: var(--rest); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
  .btn.rest small { color: var(--muted); font-weight: 400; font-size: 12px; }
  .btn.rest:disabled { opacity: .4; }
  .btn.ghost { margin-top: 10px; box-shadow: inset 0 0 0 1.5px var(--line); color: var(--muted); font-weight: 400; font-size: 14px; }
  .toggle { display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono); font-size: 13px; color: var(--muted); margin-top: 18px; min-height: 44px; position: relative; }
  .dim { color: var(--dim); }
  .toggle input { position: absolute; right: 0; width: 46px; height: 28px; opacity: 0; margin: 0; }
  .sw { width: 46px; height: 28px; border-radius: 14px; background: var(--line); position: relative; flex: none; pointer-events: none; transition: background .2s; }
  .sw::after { content: ""; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; transition: left .2s var(--ease); }
  .sw.on { background: var(--ok); }
  .sw.on::after { left: 21px; }
</style>
