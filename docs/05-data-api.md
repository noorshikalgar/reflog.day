# 05 — Data and API

## 1. SQLite schema

Run these pragmas when the database opens: `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=3000`.

```sql
CREATE TABLE habit (
  id           TEXT PRIMARY KEY,            -- uuid v7
  slug         TEXT NOT NULL UNIQUE,        -- 'walk'
  emoji        TEXT,
  lane         INTEGER NOT NULL,            -- 1..10, lane color
  days_mask    INTEGER NOT NULL DEFAULT 127,-- bit 0 = Monday
  remind_at    TEXT,                        -- 'HH:MM' or NULL
  position     INTEGER NOT NULL,
  created_at   TEXT NOT NULL,               -- ISO 8601
  archived_at  TEXT
);

CREATE TABLE entry (
  id           TEXT PRIMARY KEY,            -- uuid v7, made by client
  habit_id     TEXT NOT NULL REFERENCES habit(id),
  day          TEXT NOT NULL,               -- logical day 'YYYY-MM-DD'
  kind         TEXT NOT NULL CHECK (kind IN ('done','rest','miss')),
  hash         TEXT NOT NULL,               -- 7 hex chars
  message      TEXT,                        -- max 72 chars
  amended      INTEGER NOT NULL DEFAULT 0,
  seen_at      TEXT,                        -- for miss card
  created_at   TEXT NOT NULL,
  UNIQUE (habit_id, day)
);
CREATE INDEX entry_day ON entry(day);

CREATE TABLE push_sub (
  endpoint     TEXT PRIMARY KEY,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  device       TEXT,
  created_at   TEXT NOT NULL
);

CREATE TABLE device (
  token_hash   TEXT PRIMARY KEY,            -- sha256 of cookie token
  name         TEXT,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT
);

CREATE TABLE setting (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- keys: tz, day_start_hour, evening_at, push_enabled, theme, vapid_public, vapid_private
```

Notes:

- One entry for each branch for each day (`UNIQUE (habit_id, day)`). A commit on a "miss" day (amend) replaces the miss row.
- Streak and patina are not stored. `rules.ts` calculates them. The data is small, so this is fast.

## 2. HTTP API

All routes are under `/api`. All bodies are JSON. All routes except `/api/pair` need the device cookie.

| Method | Path | Body / query | Result |
|--------|------|--------------|--------|
| POST | `/api/pair` | `{ code, name }` | Sets cookie `rl_dev` (1 year, HttpOnly, Secure). |
| GET | `/api/today` | — | Branches for today with state, streak, patina, hash. Unseen misses. Release notes if due. |
| GET | `/api/log` | `?before=YYYY-MM-DD&days=14` | Day groups with entries for the graph. |
| GET | `/api/habits` | — | All branches, active first. |
| POST | `/api/habits` | `{ slug, emoji, lane, days_mask, remind_at }` | New branch. |
| PATCH | `/api/habits/:id` | Any habit field, or `{ archived: true }` | Changed branch. |
| GET | `/api/habits/:id` | — | Detail: streak, best, total, patina, 12-week grid. |
| PUT | `/api/entries/:id` | `{ habit_id, day, kind, message, amended }` | Idempotent upsert. Server makes the hash. |
| DELETE | `/api/entries/:id` | — | Undo (revert). Allowed for 24 h. |
| POST | `/api/misses/seen` | `{ ids: [] }` | Marks miss rows as seen. |
| POST | `/api/push/subscribe` | PushSubscription JSON | Stores the subscription. |
| DELETE | `/api/push/subscribe` | `{ endpoint }` | Removes it. |
| GET | `/api/push/key` | — | VAPID public key. |
| GET | `/api/settings` | — | All settings except secrets. |
| PATCH | `/api/settings` | Any setting | Changed settings. |
| GET | `/api/export` | — | Full JSON dump. |
| POST | `/api/import` | JSON dump | Replaces data. Makes a backup first. |

## 3. Device pairing

1. Start the server. The server writes a 6-digit pairing code to the log. The code is valid for 10 minutes.
2. Open the app on the phone. Type the code.
3. The server sets a random 32-byte token as a cookie. The server stores only its SHA-256 hash.
4. To pair another device, open `branches` → `pair new device` on a paired device. It shows a new code.

## 4. Hash

`hash = first 7 hex chars of sha1(habit_id + day + created_at)`. It looks like a git short hash. It has no security function.
