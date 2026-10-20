// App state: server address, device token, today's view. Tiny store on useSyncExternalStore.
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import type { Theme, TodayView } from '../../../shared/src/api.ts';

type State = {
  ready: boolean;
  server: string | null;
  token: string | null;
  today: TodayView | null;
  online: boolean;
  theme: Theme;
};

let state: State = { ready: false, server: null, token: null, today: null, online: true, theme: 'terminal' };
const subs = new Set<() => void>();

export function setState(p: Partial<State>) {
  state = { ...state, ...p };
  subs.forEach(f => f());
}
export const getState = () => state;
export function useStore<T>(pick: (s: State) => T): T {
  return useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, () => pick(state));
}

const KEY = 'reflog.session';

export async function loadSession() {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (raw) {
      const { server, token } = JSON.parse(raw) as { server: string; token: string };
      setState({ server, token });
    }
  } finally {
    setState({ ready: true });
  }
}

export async function saveSession(server: string, token: string) {
  await SecureStore.setItemAsync(KEY, JSON.stringify({ server, token }));
  setState({ server, token });
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(KEY);
  setState({ server: null, token: null, today: null });
}
