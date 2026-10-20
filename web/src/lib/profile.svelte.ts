// Navigation stack for the profile tab (iOS Settings style). Refer to docs/10-profile.md §3.
const toTop = () => document.querySelector<HTMLElement>('.pane[data-pane="profile"]')?.scrollTo({ top: 0 });
export type PageId = 'root' | 'edit' | 'appearance' | 'daytime' | 'notifications' | 'data' | 'devices' | 'pair' | 'about';

export const TITLES: Record<PageId, string> = {
  root: 'Profile', edit: 'Edit profile', appearance: 'Appearance', daytime: 'Day & time',
  notifications: 'Notifications', data: 'Export & import', devices: 'Devices', pair: 'Pair device', about: 'About',
};

export const nav = $state({ stack: ['root'] as PageId[], dir: 1 as 1 | -1 });

export function push(id: PageId) {
  if (nav.stack[nav.stack.length - 1] === id) return;
  nav.dir = 1;
  nav.stack.push(id);
  toTop();
}

export function pop() {
  if (nav.stack.length < 2) return;
  nav.dir = -1;
  nav.stack.pop();
  toTop();
}

/** Back to the root page (tap the profile tab again). */
export function popToRoot() {
  if (nav.stack.length < 2) return;
  nav.dir = -1;
  nav.stack.splice(1);
  toTop();
}
