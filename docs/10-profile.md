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

The profile tab looks like the iPhone Settings app: grouped lists on one short root page, and rows that open sub-pages. There is no long scroll. Mockup: `mockups/profile.html` (working navigation).

### 3.1 Page tree

```
Profile (root)
├── identity card ─────────► Edit profile
├── Insights
│   ├── Stats ─────────────► Stats ──► Branches
│   │                                 └► Rhythm
│   └── Records ───────────► Records
├── Preferences
│   ├── Appearance ────────► Appearance (theme, log view)
│   ├── Day & time ────────► Day & time
│   └── Notifications ─────► Notifications
├── Data
│   ├── Backups ───────────► Backups ──► Remotes
│   └── Export & import ───► Export & import
├── Devices ───────────────► Devices ──► Pair device
└── About reflog ──────────► About
```

Maximum depth: 3 pages (root → page → sub-page).

### 3.2 Row rules

| ID | Rule |
|----|------|
| R-01 | Put the label on the first line and the help text under it, in a smaller, dim style. |
| R-02 | Put the current value on the right. Add a chevron (›) only when the row opens a page. |
| R-03 | Use a switch only for on/off. Use a picker for a fixed list. Use a time field for a time. |
| R-04 | Group rows under a short uppercase header. Put an explanation under the group, not inside rows. |
| R-05 | A red label means a destructive action. Put it alone, in the last group of the page. |
| R-06 | Each sub-page has a back button with the parent title, and a centered title. The root page has a large title. |
| R-07 | Push and pop slide sideways (about 450 ms). Values changed on a sub-page show on the parent when you go back. |

### 3.3 Pages

| Page | Content |
|------|---------|
| Root | Identity card (avatar, name, "committing since"), 3 totals (commits, best now, tags), then the groups in §3.1. |
| Edit profile | Name (1–24 characters) and avatar (emoji or initials). No photo upload. |
| Stats | Range control (30d, 90d, 1y, all), contribution graph (GitHub style, neutral `--ok` scale), 7-day done % trend line, links to Branches and Rhythm. |
| Branches | Done % in the range and current streak for each branch, sorted by done %. Lane colors here only. |
| Rhythm | Weekday bars with "your hard day", and commits by hour. |
| Records | Streak records, history numbers, tags earned. |
| Appearance | Theme as 4 preview cards (synced). Log view as 2 radio rows with a small sample (this device). |
| Day & time | Day start, time zone, amend limit (fixed at 12:00, shown for clarity). |
| Notifications | This device: allow, send test. All devices: branch reminders, evening summary, summary time, quiet on rest days. |
| Backups | Back up now, local list with restore, retention, link to Remotes. |
| Remotes | Phase B targets and the encryption passphrase. |
| Export & import | Export, import, and "delete all history" (red, asks twice). |
| Devices | Paired devices with last seen; remove; pair a new device (6-digit code). |
| About | Version, build, source, licence, credits. |

Stats rules (unchanged): read-only; neutral colors except per-branch rows; hand-made SVG, no chart library; each chart has a text summary for screen readers.

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
| 5a | 4th tab, page stack, root page, move settings (Appearance, Day & time, Notifications), Edit profile, Devices, About | `v0.5.0` |
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
