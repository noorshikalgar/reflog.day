<script lang="ts">
  import Group from '../../components/ui/Group.svelte';
  import { api } from '../../lib/api.ts';

  let code = $state('');
  let error = $state('');
  api.newPairCode().then(x => (code = x.code)).catch(e => (error = (e as Error).message));
</script>

<Group foot="Open reflog on the new device and type this code.">
  <div class="code" aria-live="polite">{code || (error ? '——————' : '······')}</div>
  <p class="v">{error || 'Valid for 10 minutes'}</p>
</Group>

<style>
  .code { font-family: var(--font-mono); font-size: 34px; letter-spacing: .3em; text-align: center; padding: 20px 0 4px .3em; color: var(--ok); }
  .v { font-family: var(--font-ui); font-size: 12px; color: var(--dim); text-align: center; padding-bottom: 16px; }
</style>
