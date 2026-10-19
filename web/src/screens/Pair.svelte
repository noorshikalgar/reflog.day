<script lang="ts">
  import { api } from '../lib/api.ts';
  import { refresh } from '../lib/state.svelte.ts';

  let code = $state('');
  let error = $state('');
  let busy = $state(false);
  let shake = $state(0);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = '';
    try {
      const name = /iPhone|iPad/.test(navigator.userAgent) ? 'iphone' : /Android/.test(navigator.userAgent) ? 'android' : 'browser';
      await api.pair(code, name);
      await refresh();
    } catch (err) {
      error = (err as Error).message;
      shake++;
    } finally {
      busy = false;
    }
  }
</script>

<main>
  <div class="head">$ git remote add this-device</div>
  <h1>pair device</h1>
  <p>Type the 6-digit code from the server log. On a paired device: <code>branches → pair device</code>.</p>
  <form onsubmit={submit}>
    {#key shake}
      <input class:shake={shake > 0} bind:value={code} inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern={"[0-9]{6}"} placeholder="000000" aria-label="pairing code" />
    {/key}
    <button class="btn" disabled={busy || code.length !== 6}>pair</button>
    <div class="err" role="alert">{error}</div>
  </form>
</main>

<style>
  main { max-width: 440px; margin: 0 auto; padding: calc(60px + env(safe-area-inset-top)) 20px 40px; }
  .head { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
  h1 { font-family: var(--font-display); font-weight: 300; font-size: 44px; letter-spacing: -.03em; margin: 4px 0 10px; }
  p { color: var(--muted); font-size: 14px; line-height: 1.5; margin-bottom: 28px; }
  code { font-family: var(--font-mono); color: var(--text); font-size: 13px; }
  input {
    width: 100%; font-family: var(--font-mono); font-size: 40px; letter-spacing: .35em; text-align: center;
    background: var(--surface); border: 0; border-radius: 20px; padding: 18px 0 18px .35em; outline: none; box-shadow: inset 0 0 0 1px var(--line);
  }
  input:focus { box-shadow: inset 0 0 0 2px var(--ok); }
  input.shake { animation: shake .4s var(--ease); }
  .btn { width: 100%; height: 60px; border-radius: 18px; margin-top: 14px; background: var(--ok); color: var(--on-ok); font-family: var(--font-mono); font-size: 16px; font-weight: 600; transition: opacity .2s; }
  .btn:disabled { opacity: .4; }
  .err { font-family: var(--font-mono); font-size: 13px; color: var(--muted); min-height: 20px; margin-top: 12px; text-align: center; }
  @keyframes shake { 20%, 60% { transform: translateX(-8px); } 40%, 80% { transform: translateX(8px); } }
</style>
