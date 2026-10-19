<script lang="ts">
  import Group from '../../components/ui/Group.svelte';
  import Row from '../../components/ui/Row.svelte';
  import { api } from '../../lib/api.ts';
  import { refresh, showToast } from '../../lib/state.svelte.ts';

  let file: HTMLInputElement | undefined = $state();
  let busy = $state(false);

  function exportJson() {
    const a = document.createElement('a');
    a.href = '/api/export';
    a.download = '';
    a.click();
  }

  async function importFile(e: Event & { currentTarget: HTMLInputElement }) {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    let data: unknown;
    try { data = JSON.parse(await f.text()); }
    catch { showToast('that file is not JSON.', null, 4000); return; }
    if (!confirm('Replace all branches and history with this file? The server makes a backup first.')) return;
    busy = true;
    try {
      const r = await api.importAll(data);
      showToast(`imported ${r.habits} branches, ${r.entries} entries.`, null, 4000);
      await refresh();
    } catch (err) {
      showToast(`import failed: ${(err as Error).message}`, null, 5000);
    } finally {
      busy = false;
    }
  }
</script>

<Group foot="Exports never contain keys, tokens or device cookies.">
  <Row icon="arrows" label="Export JSON" sub="All branches, commits and settings" onclick={exportJson} />
  <Row icon="arrows" label="Import JSON" sub={busy ? 'Importing…' : 'Replaces everything. Makes a backup first.'} disabled={busy} onclick={() => file?.click()} />
</Group>
<input bind:this={file} type="file" accept="application/json,.json" hidden onchange={importFile} />
