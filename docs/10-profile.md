# 10 — Profile tab (plan)

Status: plan. No code yet. Mockups come next.

## 1. Purpose

The profile tab shows the user's progress over a long time. It is also the one place for settings, data and backups.

The tab is the `git config` and `git shortlog` of reflog. `status` shows now. `log` shows history line by line. `profile` shows the big picture.

## 2. Tab bar

| No. | Tab | Content |
|-----|-----|---------|
| 1 | `status` | Today. No change. |
| 2 | `log` | History. No change. |
| 3 | `branches` | The branch list and the branch editor only. The config section moves to `profile`. |
| 4 | `profile` | Identity, stats, settings, data, devices, about. |

Rules:

1. Keep 4 tabs maximum. Do not add a fifth tab.
2. Each tab has a minimum touch target of 56 px. 4 tabs fit on a 360 px screen (90 px each).
3. On desktop (≥ 900 px), `status` and `log` stay side by side. `profile` uses the full width.

## 3. Screen layout

The profile screen is one scroll page with these sections, in this sequence.

### 3.1 Identity (`git config user.name`)

| Item | Rule |
|------|------|
| Avatar | One emoji or two initials on a round tile. No photo upload (no file storage, no privacy risk). |
| Name | Display name, 1–24 characters. Default: `you`. |
| Line | `committing since 01 oct 2026 · 214 commits · 19 days clean` |
| Edit | Tap the identity card. A sheet opens with name and avatar. |

### 3.2 Stats (`git shortlog --stat`)

A range selector at the top of the section: `30d`, `90d`, `1y`, `all`. Default: `90d`. The selection is kept on this device.

| No. | Block | What it shows | Visual |
|-----|-------|---------------|--------|
| 1 | Contribution graph | Done % for each day. 5 levels, like GitHub. | Grid of squares, 7 rows (Mon–Sun) × N weeks. Scroll sideways on a phone. Shows the `less ▢▢▢▢ more` scale. |
| 2 | Trend | 7-day rolling done %. | Line chart with a soft area under the line. |
| 3 | Branches | For each branch: streak, best streak, done % in the range, total commits. | Table with a small bar for done %. Sort by done %. Tap a row: `show <branch>`. |
| 4 | Weekdays | Done % for each weekday. Marks the weakest day: `your hard day: sat`. | 7 vertical bars. |
| 5 | Time of day | When commits happen. Example: `you commit most at 07–09`. | 24 small bars. |
| 6 | Records | Longest streak ever, longest clean run, first commit, rest days used, misses, rebases, tags earned. | List of key–value rows. |

Rules for stats:

1. All stats are read-only.
2. The contribution graph and the trend use neutral colors (`--ok` scale). Only the branch table uses lane colors, because each row is one branch.
3. Each chart has a text summary for screen readers.
4. Use small hand-made SVG components. Do not add a chart library: the bundle must stay small (now 28 KB gzip).
5. A tap on a chart shows a small tooltip with the exact value. It does not open other screens.

### 3.3 Settings (`git config --list`)

These rows move here from `branches`:

| Row | Scope |
|-----|-------|
| theme | all devices (synced) |
| log view | this device |
| day starts | all devices |
| time zone | all devices |
| reminders | all devices |
| evening summary | all devices |
| notifications | this device |
| send test push | this device |

### 3.4 Data

| Row | Action |
|-----|--------|
| export json | Download all data. Secrets are never in the file. |
| import json | Replace all data. The server makes a backup first. |
| backups | Open the backups sheet (section 4). |

### 3.5 Devices (`git remote -v`)

| Row | Action |
|-----|--------|
| List | Each paired device: name, first seen, last seen. The current device has the mark `this device`. |
| pair device | Show a new 6-digit code (moves here from `branches`). |
| remove | Remove a device. Its cookie stops working at once. The user cannot remove the current device here. |

### 3.6 About

App version (`v0.4.0`), build commit hash, link to the repository, licence, theme credits.

## 4. Backups

### 4.1 Phase A — local backups (do first)

The server already makes one backup each day (`VACUUM INTO`, keeps 14). Phase A shows them and adds control.

| Feature | Rule |
|---------|------|
| List | Date, size, type (`daily`, `pre-import`, `pre-restore`, `manual`). |
| backup now | Make a manual backup at once. |
| download | Download one backup as a `.db` file. |
| restore | Replace the live database with a backup. Show a confirm step. The server makes a `pre-restore` backup first, then restarts the database connection. |
| retention | 7, 14 or 30 daily backups. Default: 14. Manual backups are kept until the user deletes them. |

### 4.2 Phase B — backup remotes (later, open source friendly)

A backup remote is a place outside the machine. In git words: `git remote add backup <target>`.

| Order | Target | Why |
|-------|--------|-----|
| 1 | Local folder | Simplest. A folder on another disk, or a folder that iCloud Drive, Dropbox or Syncthing syncs. This gives "cloud" with no API keys. |
| 2 | S3-compatible | Cloudflare R2, Backblaze B2, MinIO, AWS S3. One code path for all. |
| 3 | WebDAV | Nextcloud and many NAS devices. |
| 4 | Git remote | Push the JSON export to a private repository. Fun, and gives history. |

Rules for remotes:

1. Each target is one module with one interface:

   ```ts
   interface BackupTarget {
     kind: 'folder' | 's3' | 'webdav' | 'git';
     put(name: string, file: Uint8Array): Promise<void>;
     list(): Promise<{ name: string; size: number; at: string }[]>;
     get(name: string): Promise<Uint8Array>;
     remove(name: string): Promise<void>;
   }
   ```

2. Encrypt the file before it leaves the machine: AES-256-GCM with a key made from a passphrase (scrypt). The server never sends the passphrase anywhere.
3. Keep credentials and the passphrase in the database (`setting`) or in `.env`. Never in git, never in exports, never in logs. The settings API returns them masked (`••••`).
4. The server pushes after each daily backup. The backups sheet shows the last push time, size and result.
5. A failed push does not stop the local backup. It shows a warning on the profile tab only.

## 5. Data and API

| Method | Path | Result |
|--------|------|--------|
| GET | `/api/profile` | `{ name, avatar, since, totals }` |
| PATCH | `/api/profile` | Changed profile |
| GET | `/api/stats?range=90d` | `{ heatmap: [{ day, p }], trend: [{ day, p7 }], weekday: number[7], hours: number[24], branches: [{ id, slug, lane, streak, best, rate, total }], records: {…} }` |
| GET | `/api/devices` | Paired devices, current marked |
| DELETE | `/api/devices/:id` | Remove a device |
| GET | `/api/backups` | Backup list |
| POST | `/api/backups` | Make a manual backup |
| GET | `/api/backups/:name` | Download |
| POST | `/api/backups/:name/restore` | Restore (makes a pre-restore backup) |
| GET, POST, DELETE | `/api/remotes…` | Phase B only |

Notes:

1. Profile values are setting keys (`profile_name`, `profile_avatar`). No new table.
2. Migration `002`: add an `id` column (uuid) to `device`, so the API never shows a token hash.
3. Stats are computed on demand from `entry`. One user, 12 branches × 365 days is about 4,400 rows: fast enough. Cache the result for 60 s.
4. Backup file names are fixed patterns (`reflog-YYYY-MM-DD.db`, `reflog-manual-<ts>.db`). The server rejects any other name (no path traversal).

## 6. Phases

| Phase | Content | Tag |
|-------|---------|-----|
| 5a | 4th tab, move settings, identity card + edit sheet, devices, about | `v0.5.0` |
| 5b | Stats API; contribution graph, trend, branch table, range selector | |
| 5c | Weekdays, time of day, records | `v0.6.0` |
| 5d | Local backups UI: list, backup now, download, restore, retention | `v0.7.0` |
| 6 | Backup remotes: folder → S3 → WebDAV → git; encryption | `v0.8.0` |

Each phase is one or more pull requests. Each phase starts with a mockup that the user approves.

## 7. Open decisions

| ID | Question | Default if no answer |
|----|----------|----------------------|
| D-10 | Tab name: `profile`, `me` or `whoami`? | `profile` |
| D-11 | Avatar: emoji only, or emoji and initials? | Both |
| D-12 | Default stats range | `90d` |
| D-13 | First backup remote | Local folder |
| D-14 | Encrypt local backups too, or only remote ones? | Remote only |
