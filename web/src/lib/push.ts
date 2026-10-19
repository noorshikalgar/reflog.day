import { api } from './api.ts';

export type PushState = 'unsupported' | 'install' | 'denied' | 'off' | 'on' | 'no-sw';

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function urlB64(key: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (key.length % 4)) % 4);
  const raw = atob((key + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

/** Where push stands on this device. iOS gives Web Push only to Home Screen apps. */
export async function pushState(): Promise<PushState> {
  if (!('PushManager' in window) || !('Notification' in window)) return isIOS() && !standalone() ? 'install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registration();
  if (!reg) return 'no-sw';
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
}

/** Must run from a tap: iOS rejects the permission prompt without a user gesture. */
export async function enablePush(): Promise<void> {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'blocked. allow it in the system settings.' : 'not allowed.');
  const reg = await registration();
  if (!reg) throw new Error('service worker not active. use the built app.');
  const { key } = await api.pushKey();
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(key) });
  const device = isIOS() ? 'iphone' : /Android/.test(navigator.userAgent) ? 'android' : 'browser';
  await api.pushSubscribe(sub.toJSON(), device);
}

export async function disablePush(): Promise<void> {
  const sub = await (await registration())?.pushManager.getSubscription();
  if (!sub) return;
  await api.pushUnsubscribe(sub.endpoint).catch(() => {});
  await sub.unsubscribe();
}
