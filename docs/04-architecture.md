# 04 — Architecture

## 1. Stack decision

| Part | Choice | Reason |
|------|--------|--------|
| Language | TypeScript (server and client) | One language for one developer. |
| Runtime | Node.js 24 LTS | Has built-in `node:sqlite`. No native build step. |
| HTTP | Hono with `@hono/node-server` | Small, fast, typed routes. |
| Database | SQLite through `node:sqlite`, WAL mode | One file. Easy backup. |
| Push | `web-push` (VAPID) | Standard Web Push for iOS 16.4+ and Android. |
| Client | Svelte 5 + Vite | Small bundle. Built-in transitions for the motion rules. |
| Service worker | Hand-written, about 150 lines | Full control of cache and push. No plugin magic. |
| Styling | Plain CSS with tokens | Tokens from [03 §3](03-ux-ui.md). No CSS framework. |
| Tests | Vitest | Unit tests for game rules and API. |

Alternative (not selected): Go single binary with `modernc.org/sqlite`. Select it if Node.js is not wanted on the host.

## 2. Components

```
 iPhone PWA ──HTTPS──▶ nginx (app.reflog.day:443)
                          │  proxy_pass
                          ▼
                    reflog server (Node, 127.0.0.1:8740)
                    ├── static: built Svelte app + sw.js
                    ├── /api/*: Hono routes
                    ├── scheduler: 1-minute tick
                    │     ├── reminders → web-push
                    │     ├── day rollover → insert misses
                    │     └── 03:00 backup
                    └── SQLite: data/reflog.db
                          │
 Web Push ◀──outbound────┘ (Apple / Google push service)
```

## 3. Repository layout

```
reflog/
├── docs/                 planning documents
├── mockups/              static HTML mockups
├── server/
│   ├── src/
│   │   ├── index.ts      start server, mount routes, start scheduler
│   │   ├── db.ts         open SQLite, run migrations
│   │   ├── migrations/   001_init.sql, ...
│   │   ├── rules.ts      streak, patina, logical day (pure functions)
│   │   ├── routes/       habits.ts, commits.ts, push.ts, auth.ts, export.ts
│   │   ├── scheduler.ts  reminders, rollover, backup
│   │   └── messages.ts   fun text lists
│   └── test/
├── web/
│   ├── src/
│   │   ├── App.svelte
│   │   ├── screens/      Status, Log, Show, Branches
│   │   ├── components/   BranchRow, Graph, Sheet, Toast, Odometer, MissCard
│   │   ├── lib/          api.ts, outbox.ts (offline queue), theme.css
│   │   └── sw.ts
│   └── public/           manifest.webmanifest, icons
└── deploy/               nginx.conf, reflog.service, launchd plist
```

## 4. Key design points

1. **Rules are pure functions.** `rules.ts` takes rows and returns streak, patina and day states. The server and the client use the same file. Test this file first.
2. **Optimistic commits.** The client draws the commit at once. The client puts the request in an IndexedDB outbox. The outbox sends when the network is available.
3. **Idempotent writes.** The client makes the commit `id` (UUID v7). A second send of the same `id` does nothing.
4. **One time zone.** The server stores the user time zone in `settings`. All "logical day" math uses this time zone.
5. **No ORM.** Use plain SQL with prepared statements.
