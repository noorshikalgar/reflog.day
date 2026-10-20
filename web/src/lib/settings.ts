import type { Settings } from '../../../shared/src/api.ts';
import { api } from './api.ts';
import { isNetworkError } from './outbox.ts';
import { app, showToast } from './state.svelte.ts';

/** Save shared settings. Returns the new settings, or null with a toast. */
export async function saveSettings(p: Partial<Settings>): Promise<Settings | null> {
  try {
    const s = await api.patchSettings(p);
    if (app.today) app.today.settings = s;
    return s;
  } catch (err) {
    showToast(isNetworkError(err) ? 'offline. change not saved.' : (err as Error).message, null, 4000);
    return null;
  }
}
