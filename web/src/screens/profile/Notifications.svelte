<script lang="ts">
  import Group from '../../components/ui/Group.svelte';
  import Row from '../../components/ui/Row.svelte';
  import Switch from '../../components/ui/Switch.svelte';
  import { api } from '../../lib/api.ts';
  import { disablePush, enablePush, pushState, type PushState } from '../../lib/push.ts';
  import { saveSettings } from '../../lib/settings.ts';
  import { app, showToast } from '../../lib/state.svelte.ts';

  const s = $derived(app.today?.settings);
  let ps = $state<PushState | null>(null);
  let busy = $state(false);
  pushState().then(x => (ps = x));

  const HELP: Record<PushState, string> = {
    on: 'On for this device',
    off: 'Off for this device',
    denied: 'Blocked. Allow it in the system settings.',
    unsupported: 'This browser has no Web Push',
    install: 'Add reflog to the Home Screen first',
    'no-sw': 'Works in the installed app only',
  };

  async function toggleDevice() {
    if (busy || (ps !== 'on' && ps !== 'off')) return;
    busy = true;
    try {
      if (ps === 'on') { await disablePush(); showToast('notifications off on this device.', null, 3000); }
      else { await enablePush(); showToast('notifications on. git push incoming.', null, 3000); }
    } catch (e) {
      showToast((e as Error).message, null, 4000);
    } finally {
      ps = await pushState();
      busy = false;
    }
  }

  async function test() {
    try {
      const { sent } = await api.pushTest();
      showToast(sent ? `sent to ${sent} device${sent > 1 ? 's' : ''}.` : 'no device subscribed.', null, 3000);
    } catch (e) { showToast((e as Error).message, null, 4000); }
  }
</script>

<Group title="This device" foot="On iPhone, push works only when reflog is on the Home Screen.">
  <Row label="Allow notifications" sub={ps ? HELP[ps] : '…'} disabled={busy || (ps !== 'on' && ps !== 'off')} onclick={toggleDevice}>
    {#snippet right()}<Switch on={ps === 'on'} />{/snippet}
  </Row>
  <Row icon="send" label="Send test push" sub="Check that it arrives" disabled={ps !== 'on'} onclick={test} />
</Group>

{#if s}
  <Group title="All devices">
    <Row label="Reminders" sub="Branch reminders and the evening summary" onclick={() => saveSettings({ push_enabled: !s.push_enabled })}>
      {#snippet right()}<Switch on={s.push_enabled} />{/snippet}
    </Row>
    <Row label="Evening summary" sub="One message with the open count">
      {#snippet right()}
        <input class="time" type="time" value={s.evening_at} onchange={async e => { const v = e.currentTarget.value; if (v && await saveSettings({ evening_at: v })) showToast(`summary at ${v}`, null, 2500); }} />
      {/snippet}
    </Row>
  </Group>
{/if}

<style>
  .time { background: var(--surface-2); border: 0; border-radius: 8px; padding: 6px 8px; color: var(--text); font-family: var(--font-mono); font-size: 14px; }
</style>
