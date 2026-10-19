<script lang="ts">
  import type { Habit, Settings, Theme } from '../../../shared/src/api.ts';
  import Sheet from '../components/Sheet.svelte';
  import { api } from '../lib/api.ts';
  import { daysText } from '../lib/format.ts';
  import { disablePush, enablePush, pushState, type PushState } from '../lib/push.ts';
  import { app, refresh, setLogView, setTheme, showToast } from '../lib/state.svelte.ts';
  import { isNetworkError } from '../lib/outbox.ts';

  const MAX = 12;
  const SOFT = 8;
  const DAY_KEYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const THEMES: Theme[] = ['terminal', 'bathory', 'gruvbox', 'paper'];

  let habits = $state<Habit[]>([]);
  let settings = $state<Settings | null>(app.today?.settings ?? null);
  const active = $derived(habits.filter(h => !h.archived_at));
  const archived = $derived(habits.filter(h => h.archived_at));

  // editor
  let open = $state(false);
  let editing = $state<Habit | null>(null);
  let slug = $state('');
  let emoji = $state('');
  let lane = $state(1);
  let mask = $state(127);
  let remind = $state('');
  let error = $state('');
  let busy = $state(false);

  let pairCode = $state<{ code: string; expires_at: string } | null>(null);

  let push = $state<PushState | null>(null);
  let pushBusy = $state(false);
  const PUSH_TEXT: Record<PushState, string> = {
    on: 'on ✓', off: 'enable', denied: 'blocked', unsupported: 'not supported', install: 'add to home screen first', 'no-sw': 'built app only',
  };
  pushState().then(s => (push = s));

  async function togglePush() {
    if (pushBusy || (push !== 'on' && push !== 'off')) return;
    pushBusy = true;
    try {
      if (push === 'on') { await disablePush(); showToast('notifications off on this device.', null, 3000); }
      else { await enablePush(); showToast('notifications on. git push incoming.', null, 3000); }
    } catch (err) {
      showToast((err as Error).message, null, 4000);
    } finally {
      push = await pushState();
      pushBusy = false;
    }
  }

  async function testPush() {
    try {
      const { sent } = await api.pushTest();
      showToast(sent ? `sent to ${sent} device${sent > 1 ? 's' : ''}.` : 'no device subscribed.', null, 3000);
    } catch (err) {
      showToast((err as Error).message, null, 4000);
    }
  }

  async function load() {
    habits = await api.habits();
    settings = app.today?.settings ?? settings;
  }
  load();

  $effect(() => {
    if (app.newBranch) { app.newBranch = false; edit(null); }
  });
  $effect(() => {
    const id = app.editId;
    if (!id) return;
    const h = habits.find(x => x.id === id);
    if (h) { app.editId = null; edit(h); }
  });

  function freeLane() {
    const used = new Set(active.map(h => h.lane));
    for (let l = 1; l <= 10; l++) if (!used.has(l)) return l;
    return 1;
  }

  function edit(h: Habit | null) {
    editing = h;
    slug = h?.slug ?? '';
    emoji = h?.emoji ?? '';
    lane = h?.lane ?? freeLane();
    mask = h?.days_mask ?? 127;
    remind = h?.remind_at ?? '';
    error = '';
    open = true;
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = '';
    const body = { slug, emoji: emoji || null, lane, days_mask: mask, remind_at: remind || null };
    try {
      if (editing) await api.updateHabit(editing.id, body);
      else await api.createHabit(body);
      showToast(editing ? `amended ${slug}.` : `switched to a new branch '${slug.toLowerCase()}'`, null, 3000);
      open = false;
      await Promise.all([load(), refresh()]);
    } catch (err) {
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }

  async function archive(h: Habit, value: boolean) {
    try {
      await api.updateHabit(h.id, { archived: value });
      showToast(value ? `branch -d ${h.slug}. history kept.` : `restored ${h.slug}.`, null, 3000);
      open = false;
      await Promise.all([load(), refresh()]);
    } catch (err) {
      showToast((err as Error).message, null, 4000);
    }
  }

  async function setSetting(p: Partial<Settings>) {
    // The theme is a look: show it now, save it after. It also works offline.
    if (p.theme) {
      setTheme(p.theme);
      if (settings) settings = { ...settings, theme: p.theme };
      return;
    }
    try {
      settings = await api.patchSettings(p);
      if (app.today) app.today.settings = settings;
    } catch (err) {
      showToast(isNetworkError(err) ? 'offline. change not saved.' : (err as Error).message, null, 4000);
    }
  }

  let importing = $state(false);
  async function importFile(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    let data: unknown;
    try { data = JSON.parse(await file.text()); }
    catch { showToast('that file is not JSON.', null, 4000); return; }
    if (!confirm('Replace all branches and history with this file? The server makes a backup first.')) return;
    importing = true;
    try {
      const r = await api.importAll(data);
      showToast(`imported ${r.habits} branches, ${r.entries} entries.`, null, 4000);
      await Promise.all([load(), refresh()]);
    } catch (err) {
      showToast(`import failed: ${(err as Error).message}`, null, 5000);
    } finally {
      importing = false;
    }
  }

  async function newCode() {
    try { pairCode = await api.newPairCode(); }
    catch (err) { showToast((err as Error).message, null, 4000); }
  }
</script>

<main>
  <div class="head">$ git branch -a</div>
  <h1>branches</h1>

  {#if active.length}
    <div class="list">
      {#each active as h (h.id)}
        <button class="item" style:--c="var(--l{h.lane})" onclick={() => (app.show = h.id)}>
          <i class="dot"></i>
          <span><span class="n">{h.emoji ? h.emoji + ' ' : ''}{h.slug}</span><span class="days">{daysText(h.days_mask)}</span></span>
          <span class="r">{h.remind_at ? `⏰ ${h.remind_at}` : '—'}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if active.length < MAX}
    <button class="add" onclick={() => edit(null)}>+ new branch</button>
  {:else}
    <p class="hint">max {MAX} branches. archive one to add one.</p>
  {/if}
  {#if active.length >= SOFT && active.length < MAX}<p class="hint">big routines break. keep it small?</p>{/if}

  {#if archived.length}
    <div class="sect">archived</div>
    <div class="list">
      {#each archived as h (h.id)}
        <div class="item muted" style:--c="var(--l{h.lane})">
          <i class="dot"></i><span class="n">{h.slug}</span>
          <button class="link" onclick={() => archive(h, false)} disabled={active.length >= MAX}>restore</button>
        </div>
      {/each}
    </div>
  {/if}

  {#if settings}
    <div class="sect">config</div>
    <div class="list">
      <div class="set">
        <span>theme</span>
        <span class="themes">
          {#each THEMES as th (th)}
            <button class="chip" class:on={settings.theme === th} onclick={() => setSetting({ theme: th })}>{th}</button>
          {/each}
        </span>
      </div>
      <div class="set">
        <span>log view <span class="dim">· this device</span></span>
        <span class="themes">
          {#each [['normal', 'normal'], ['compact', 'compact']] as [v, label] (v)}
            <button class="chip" class:on={app.logView === v} onclick={() => setLogView(v as 'normal' | 'compact')}>{label}</button>
          {/each}
        </span>
      </div>
      <label class="set">
        <span>day starts</span>
        <select value={settings.day_start_hour} onchange={e => setSetting({ day_start_hour: Number(e.currentTarget.value) })}>
          {#each [0, 1, 2, 3, 4, 5, 6] as hr (hr)}<option value={hr}>0{hr}:00</option>{/each}
        </select>
      </label>
      <button class="set" onclick={togglePush} disabled={pushBusy}>
        <span>notifications <span class="dim">· this device</span></span>
        <span class="val" class:on={push === 'on'}>{push ? PUSH_TEXT[push] : '…'}</span>
      </button>
      {#if push === 'on'}
        <button class="set" onclick={testPush}><span>send test push</span><span class="val">›</span></button>
      {/if}
      <label class="set">
        <span>reminders <span class="dim">· all devices</span></span>
        <input type="checkbox" class="sr" checked={settings.push_enabled} onchange={e => setSetting({ push_enabled: e.currentTarget.checked })} />
        <i class="sw" class:on={settings.push_enabled} aria-hidden="true"></i>
      </label>
      <label class="set">
        <span>evening summary</span>
        <input type="time" value={settings.evening_at} onchange={e => setSetting({ evening_at: e.currentTarget.value })} />
      </label>
      <div class="set">
        <span>time zone</span>
        <span class="val">{settings.tz}</span>
      </div>
      <a class="set" href="/api/export" download><span>export json</span><span class="val">↓</span></a>
      <label class="set">
        <span>import json <span class="dim">· replaces data</span></span>
        <span class="val">{importing ? '…' : '↑'}</span>
        <input type="file" accept="application/json,.json" class="file" onchange={importFile} disabled={importing} />
      </label>
      <button class="set" onclick={newCode}>
        <span>pair device</span>
        <span class="val">{#if pairCode}<b class="code">{pairCode.code}</b>{:else}code ›{/if}</span>
      </button>
    </div>
    {#if pairCode}<p class="hint">type this code on the new device. valid 10 min.</p>{/if}
  {/if}
</main>

<Sheet {open} onclose={() => (open = false)}>
  <form onsubmit={save}>
    <div class="cmd">$ git {editing ? `branch -m ${editing.slug}` : 'branch'}</div>
    <h2>{editing ? 'edit branch' : 'new branch'}</h2>

    <div class="field-row">
      <input class="emoji" bind:value={emoji} maxlength="4" placeholder="☺" aria-label="emoji (optional)" />
      <input class="name" bind:value={slug} maxlength="20" placeholder="walk" autocapitalize="off" autocomplete="off" spellcheck="false" aria-label="name" />
    </div>

    <div class="label">lane</div>
    <div class="lanes">
      {#each { length: 10 } as _, i (i)}
        <button type="button" class="lane" class:on={lane === i + 1} style:--c="var(--l{i + 1})" onclick={() => (lane = i + 1)} aria-label="lane {i + 1}"></button>
      {/each}
    </div>

    <div class="label">days</div>
    <div class="days-pick">
      {#each DAY_KEYS as d, i (i)}
        <button type="button" class:on={mask & (1 << i)} onclick={() => (mask = mask ^ (1 << i) || mask)}>{d}</button>
      {/each}
    </div>

    <label class="label" for="remind">reminder <span class="opt">(optional)</span></label>
    <div class="field-row">
      <input id="remind" class="time" type="time" bind:value={remind} />
      {#if remind}<button type="button" class="chip" onclick={() => (remind = '')}>none</button>{/if}
    </div>

    <div class="err" role="alert">{error}</div>
    <button class="btn" disabled={busy || !slug}>{editing ? 'save' : 'create branch'}</button>
    {#if editing}
      <button type="button" class="btn ghost" onclick={() => archive(editing!, true)}>archive (keeps history)</button>
    {/if}
  </form>
</Sheet>

<style>
  main { padding: calc(14px + env(safe-area-inset-top)) 20px calc(130px + env(safe-area-inset-bottom)); }
  .head, .cmd { font-family: var(--font-mono); font-size: 12px; color: var(--muted); margin-top: 6px; }
  h1 { font-family: var(--font-display); font-weight: 300; font-size: 40px; letter-spacing: -.03em; margin-bottom: 14px; }
  h2 { font-family: var(--font-display); font-weight: 300; font-size: 32px; letter-spacing: -.03em; margin: 2px 0 16px; }
  .list { display: flex; flex-direction: column; background: var(--surface); border-radius: 22px; overflow: hidden; box-shadow: inset 0 0 0 1px var(--edge); }
  .item, .set {
    display: grid; grid-template-columns: 14px 1fr auto; gap: 14px; align-items: center; width: 100%; min-height: 60px;
    padding: 12px 18px; border-bottom: 1px solid var(--line); font-family: var(--font-mono); text-align: left; color: var(--text); text-decoration: none;
  }
  .set { grid-template-columns: 1fr auto; font-size: 14px; }
  .item:last-child, .set:last-child { border-bottom: 0; }
  .item.muted { opacity: .55; }
  .dot { width: 12px; height: 12px; border-radius: 50%; background: var(--c); }
  .n { font-size: 16px; }
  .days { display: block; font-size: 10px; color: var(--dim); margin-top: 3px; letter-spacing: 2px; }
  .r, .val { font-size: 12px; color: var(--muted); }
  .val.on { color: var(--ok); }
  .file { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .dim { color: var(--dim); font-size: 11px; }
  .set { position: relative; }
  .sr { position: absolute; right: 18px; width: 46px; height: 28px; opacity: 0; margin: 0; cursor: pointer; }
  .sw { width: 46px; height: 28px; border-radius: 14px; background: var(--line); position: relative; pointer-events: none; transition: background .2s; }
  .sw::after { content: ""; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; transition: left .2s var(--ease); }
  .sw.on { background: var(--ok); }
  .sw.on::after { left: 21px; }
  .code { font-size: 18px; color: var(--ok); letter-spacing: .2em; }
  .link { font-family: var(--font-mono); font-size: 12px; color: var(--ok); }
  .add { margin: 12px 0 8px; width: 100%; height: 56px; border-radius: 18px; border: 1.5px dashed var(--line); font-family: var(--font-mono); color: var(--muted); font-size: 14px; }
  .hint { font-family: var(--font-mono); font-size: 11px; color: var(--dim); margin: 8px 4px 0; }
  .sect { font-family: var(--font-mono); font-size: 11px; color: var(--dim); margin: 24px 4px 8px; }
  .themes { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  .chip { font-family: var(--font-mono); font-size: 12px; padding: 8px 10px; border-radius: 10px; background: var(--surface-2); color: var(--muted); }
  .chip.on { background: var(--text); color: var(--bg); }
  select, input[type="time"] { background: var(--surface-2); border: 0; border-radius: 10px; padding: 8px 10px; font-family: var(--font-mono); font-size: 13px; color: var(--text); }

  .field-row { display: flex; gap: 10px; align-items: center; }
  .name, .emoji, .time { background: var(--bg); border: 0; border-radius: 16px; padding: 16px; font-family: var(--font-mono); font-size: 18px; outline: none; box-shadow: inset 0 0 0 1px var(--line); }
  .name:focus, .emoji:focus, .time:focus { box-shadow: inset 0 0 0 2px var(--ok); }
  .name { flex: 1; min-width: 0; text-transform: lowercase; }
  .emoji { width: 62px; text-align: center; }
  .time { font-size: 16px; padding: 12px 14px; }
  .label { display: block; font-family: var(--font-mono); font-size: 11px; color: var(--dim); margin: 18px 2px 8px; }
  .opt { color: var(--dim); opacity: .7; }
  .lanes { display: grid; grid-template-columns: repeat(10, 1fr); gap: 8px; }
  .lane { aspect-ratio: 1; border-radius: 50%; background: var(--c); transition: transform .15s var(--ease), box-shadow .15s; }
  .lane.on { transform: scale(1.12); box-shadow: 0 0 0 3px var(--surface), 0 0 0 5px var(--c); }
  .days-pick { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
  .days-pick button { height: 46px; border-radius: 14px; background: var(--surface-2); font-family: var(--font-mono); color: var(--dim); transition: background .15s, color .15s; }
  .days-pick button.on { background: var(--ok); color: var(--on-ok); }
  .err { font-family: var(--font-mono); font-size: 12px; color: var(--muted); min-height: 18px; margin: 14px 2px 6px; }
  .btn { width: 100%; height: 60px; border-radius: 18px; background: var(--ok); color: var(--on-ok); font-family: var(--font-mono); font-size: 16px; font-weight: 600; transition: opacity .2s; }
  .btn:disabled { opacity: .4; }
  .btn.ghost { margin-top: 10px; background: none; color: var(--muted); box-shadow: inset 0 0 0 1.5px var(--line); font-weight: 400; font-size: 14px; }
</style>
