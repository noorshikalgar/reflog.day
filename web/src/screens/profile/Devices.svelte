<script lang="ts">
  import type { Device } from '../../../../shared/src/api.ts';
  import Group from '../../components/ui/Group.svelte';
  import Row from '../../components/ui/Row.svelte';
  import { api } from '../../lib/api.ts';
  import { push } from '../../lib/profile.svelte.ts';
  import { showToast } from '../../lib/state.svelte.ts';

  let list = $state<Device[]>([]);
  api.devices().then(x => (list = x)).catch(() => {});

  const ago = (iso: string | null) => {
    if (!iso) return 'never';
    const m = Math.round((Date.now() - Date.parse(iso)) / 6e4);
    return m < 60 ? 'just now' : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
  };
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toLowerCase();

  async function remove(d: Device) {
    if (!confirm(`Remove ${d.name ?? 'this device'}? It is signed out at once.`)) return;
    try { list = await api.removeDevice(d.id); showToast(`removed ${d.name ?? 'device'}.`, null, 3000); }
    catch (e) { showToast((e as Error).message, null, 4000); }
  }
</script>

<div class="cmd">$ git remote -v</div>

<Group title="Paired" foot="Removing a device signs it out at once.">
  {#each list as d (d.id)}
    <Row icon={d.name === 'browser' ? 'laptop' : 'phone'} label={d.name ?? 'device'} sub="paired {day(d.created_at)} · last seen {d.current ? 'now' : ago(d.last_seen_at)}">
      {#snippet right()}
        {#if d.current}<span class="pill">This device</span>
        {:else}<button class="rm" onclick={() => remove(d)}>Remove</button>{/if}
      {/snippet}
    </Row>
  {/each}
</Group>

<Group>
  <Row icon="link" label="Pair a new device" sub="Shows a 6-digit code for 10 minutes" chevron onclick={() => push('pair')} />
</Group>

<style>
  .cmd { font-family: var(--font-mono); font-size: 11px; color: var(--dim); margin: -6px 4px 12px; }
  .pill { font-family: var(--font-ui); font-size: 11px; padding: 2px 8px; border-radius: 99px; color: var(--ok); background: color-mix(in srgb, var(--ok) 16%, transparent); white-space: nowrap; }
  .rm { font-family: var(--font-ui); font-size: 15px; color: #ff6b6b; padding: 6px 0; }
  :global([data-theme="paper"]) .rm { color: #c0392b; }
</style>
