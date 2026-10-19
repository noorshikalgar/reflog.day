CREATE TABLE habit (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  emoji        TEXT,
  lane         INTEGER NOT NULL CHECK (lane BETWEEN 1 AND 10),
  days_mask    INTEGER NOT NULL DEFAULT 127 CHECK (days_mask BETWEEN 1 AND 127),
  remind_at    TEXT,
  position     INTEGER NOT NULL,
  created_at   TEXT NOT NULL,
  archived_at  TEXT
);

CREATE TABLE entry (
  id           TEXT PRIMARY KEY,
  habit_id     TEXT NOT NULL REFERENCES habit(id),
  day          TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('done', 'rest', 'miss')),
  hash         TEXT NOT NULL,
  message      TEXT,
  amended      INTEGER NOT NULL DEFAULT 0,
  seen_at      TEXT,
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
  token_hash   TEXT PRIMARY KEY,
  name         TEXT,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT
);

CREATE TABLE setting (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
