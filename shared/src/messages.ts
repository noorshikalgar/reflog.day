// Fun text. Refer to docs/02-game-rules.md §8.

export const MISS_TITLES = [
  'fix: life happened',
  'chore: touched grass instead',
  'revert: yesterday',
  'git stash — saved for later',
  'HEAD detached, briefly',
  'wip: human being',
  'merge conflict with the couch',
  '404: habit not found (yesterday)',
  "skipped CI. it's fine.",
];

export const COMMIT_TOASTS = ['— nice.', '— pushed to main.', '— green build.', '— +1 ahead of yesterday.'];
export const REST_TOASTS = ['--allow-empty. rest is a feature.', 'scheduled downtime.'];
export const CLEAN = 'working tree clean.';

/** Random item, never the same as `last`. */
export function pick<T>(list: readonly T[], last?: T): T {
  if (list.length < 2) return list[0];
  let x: T;
  do x = list[Math.floor(Math.random() * list.length)]; while (x === last);
  return x;
}
