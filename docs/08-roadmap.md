# 08 — Roadmap

Do the phases in sequence. Each phase ends with a version that you can use on the phone.

## Phase 0 — Mockups (done)

- [x] Planning documents 00–08.
- [x] Static mockups in `mockups/index.html`.
- [x] User reviews mockups and approves the look (log v2, 3 dark themes).

## Phase 1 — Core loop (v0.1)

Goal: log habits on the phone every day. Status: steps 1–8 done. Step 9 needs the host.

1. Set up the repository: `server/` and `web/` with TypeScript, Vite, Vitest.
2. Write `rules.ts` (logical day, streak, patina, miss rule). Write tests first.
3. Write the SQLite migration `001_init.sql` and `db.ts`.
4. Write API routes: `today`, `habits`, `entries`.
5. Build the `status` screen with tap-to-commit, hash typing and odometer.
6. Build the `branches` screen with add and edit.
7. Add the manifest and the service worker (app shell cache only).
8. Add device pairing.
9. Deploy behind nginx. Install on the iPhone.

## Phase 2 — Fun (v0.2) — done

1. Add the `log --graph` screen with lanes, detours and breaks.
2. Add the miss card, rest days and amend.
3. Add the commit sheet and undo toast.
4. Add milestone tags and the "working tree clean" effect.
5. Add the `show <branch>` screen with the 12-week grid.

## Phase 3 — Notifications (v0.3) — done (real-device test pending)

1. Generate VAPID keys at first start. Store them in `setting`.
2. Add subscribe and unsubscribe routes.
3. Add the scheduler: reminders, evening summary, rollover.
4. Add the `send test` button.

## Phase 4 — Solid (v0.4) — done

v1.0.0 comes after the app runs on the host and the iPhone for one week (Phase 1 step 9, real push test).

1. Add the offline outbox.
2. Add backups, export and import.
3. Add the light theme and the desktop two-column layout.
4. Add weekly release notes.
5. Do an accessibility check (contrast, VoiceOver labels, reduced motion).

## Open decisions

| ID | Question | Default if no answer |
|----|----------|----------------------|
| D-01 | Host machine: Mac or Linux box? | Mac with launchd |
| D-02 | TLS and name | Decided: `app.reflog.day`, Let's Encrypt DNS-01 (refer to 07) |
| D-03 | Node + Svelte, or Go single binary? | Node + Svelte |
| D-04 | Rest days each week: 1 or 2? | 1 |
| D-05 | Day start hour | 04:00 |
