// Types shared by the server and the web app. Refer to docs/05-data-api.md.
import type { Kind } from './rules.ts';

export type Theme = 'terminal' | 'bathory' | 'gruvbox' | 'paper';

export interface Settings {
  tz: string;
  day_start_hour: number;
  evening_at: string;
  push_enabled: boolean;
  theme: Theme;
}

export interface Habit {
  id: string;
  slug: string;
  emoji: string | null;
  lane: number;
  days_mask: number;
  remind_at: string | null;
  position: number;
  created_at: string;
  archived_at: string | null;
}

export type HabitInput = Partial<Pick<Habit, 'slug' | 'emoji' | 'lane' | 'days_mask' | 'remind_at'>>;

export interface Entry {
  id: string;
  habit_id: string;
  day: string;
  kind: Kind;
  hash: string;
  message: string | null;
  amended: boolean;
  seen_at: string | null;
  created_at: string;
}

export interface HabitView extends Habit {
  scheduled: boolean;
  entry: Entry | null;
  /** Kind of the entry on the previous logical day, for amend. */
  yesterday: Kind | null;
  streak: number;
  best: number;
  patina: number;
  rest_left: number;
}

export interface StripDay {
  day: string;
  state: 'full' | 'half' | 'miss' | 'open' | 'none';
  /** Done or rest, divided by scheduled branches (0–1). 0 when nothing was scheduled. */
  p: number;
}

export interface UnseenMiss {
  id: string;
  habit_id: string;
  slug: string;
  day: string;
  title: string;
  rebase: boolean;
}

export interface ReleaseNotes {
  /** ISO week of the notes, for example 'v2026.42'. */
  version: string;
  commits: number;
  rest: number;
  miss: number;
  longest: { slug: string; streak: number } | null;
  new_best: { slug: string; best: number }[];
}

export interface TodayView {
  day: string;
  release_notes: ReleaseNotes | null;
  can_amend: boolean;
  settings: Settings;
  habits: HabitView[];
  strip: StripDay[];
  misses: UnseenMiss[];
}

export type CellState = Kind | 'open' | 'none';

export interface LogCell {
  state: CellState;
  entry: Pick<Entry, 'id' | 'hash' | 'message' | 'created_at' | 'amended'> | null;
  rebase: boolean;
}

export interface LogDay {
  day: string;
  /** One cell for each item of `LogView.habits`, same order. */
  cells: LogCell[];
}

export interface LogView {
  today: string;
  habits: Pick<Habit, 'id' | 'slug' | 'emoji' | 'lane' | 'archived_at'>[];
  days: LogDay[];
  /** Pass as `before` to load older days, or null at the start of the history. */
  next: string | null;
}

export type GridState = CellState | 'future';

export interface HabitDetail extends HabitView {
  total: number;
  week: { complete: number; scheduled: number };
  next_tag: { name: string; at: number; to_go: number } | null;
  /** 12 weeks × 7 days, Monday first, oldest week first. The last week holds today. */
  grid: { day: string; state: GridState }[];
}

export interface Profile {
  name: string;
  avatar: string;
  /** First logical day with a branch, 'YYYY-MM-DD'. */
  since: string;
  totals: { commits: number; best_now: number; tags: number; days: number };
}

export interface Device {
  id: string;
  name: string | null;
  created_at: string;
  last_seen_at: string | null;
  current: boolean;
}

export interface About {
  version: string;
  build: string | null;
}
