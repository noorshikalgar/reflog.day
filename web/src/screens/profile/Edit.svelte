<script lang="ts">
  import type { Profile } from '../../../../shared/src/api.ts';
  import Group from '../../components/ui/Group.svelte';
  import { api } from '../../lib/api.ts';
  import { showToast } from '../../lib/state.svelte.ts';
  import Avatar from './Avatar.svelte';

  const AVATARS = ['🦉', '🐙', '🦊', '🌱', '⚡', '🧭', '🪴', '🐢', '🔥', '🌙', '🎧'];
  let p = $state<Profile | null>(null);
  let name = $state('');
  let initials = $state('');
  api.profile().then(x => { p = x; name = x.name; initials = initialsOf(x.name); }).catch(() => {});

  function initialsOf(n: string) {
    return n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase().replace(/[^A-Z]/g, '') || 'ME';
  }

  async function save(patch: { name?: string; avatar?: string }) {
    try { p = await api.patchProfile(patch); }
    catch (e) { showToast((e as Error).message, null, 4000); }
  }

  function saveName() {
    const n = name.trim();
    if (!p || !n || n === p.name) { name = p?.name ?? name; return; }
    initials = initialsOf(n);
    save({ name: n });
  }
</script>

<div class="hero"><Avatar value={p?.avatar ?? '🌱'} size={96} /></div>

<Group title="Name" foot="Shown in the app only. It is never sent anywhere.">
  <label class="field">
    <input bind:value={name} maxlength="24" placeholder="Your name" autocomplete="off" onblur={saveName} onkeydown={e => e.key === 'Enter' && e.currentTarget.blur()} />
    <span class="count">{name.length}/24</span>
  </label>
</Group>

<Group title="Avatar" foot="Emoji or initials. No photo upload: nothing to store, nothing to leak.">
  <div class="avs">
    {#each [...AVATARS, initials] as a (a)}
      <button class:on={p?.avatar === a} class:ini={/^[A-Z]+$/.test(a)} onclick={() => save({ avatar: a })} aria-label="avatar {a}">{a}</button>
    {/each}
  </div>
</Group>

<style>
  .hero { display: grid; place-items: center; padding: 4px 0 22px; }
  .field { display: flex; align-items: center; gap: 10px; padding: 14px 16px; min-height: 52px; }
  input { flex: 1; min-width: 0; background: none; border: 0; outline: none; font-family: var(--font-ui); font-size: 16px; color: var(--text); }
  .count { font-family: var(--font-mono); font-size: 12px; color: var(--dim); }
  .avs { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; padding: 14px; }
  .avs button { aspect-ratio: 1; border-radius: 50%; display: grid; place-items: center; font-size: 22px; background: var(--surface-2); transition: box-shadow .2s, transform .15s var(--ease); }
  .avs button:active { transform: scale(.92); }
  .avs button.on { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--ok); }
  .avs .ini { font-family: var(--font-mono); font-size: 14px; font-weight: 600; }
</style>
