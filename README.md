# reflog

> git log for your day.

reflog is a habit tracker. It runs on your own machine. It uses SQLite. You open it on your phone as a PWA.
You log a habit with one tap. The app writes the log as a "commit" and draws it in a `git log --graph` view.

## Status

Phase 1 (v0.1): status screen, branches, pairing, themes, PWA shell. Refer to [08 — Roadmap](docs/08-roadmap.md).

## Run it

Needs Node.js 22.18 or later.

```bash
npm install
npm run build
npm start
```

The server prints a 6-digit pairing code. Open http://127.0.0.1:8740 and type the code.

Development, with hot reload:

```bash
npm run dev:server
```

```bash
npm run dev:web
```

Open http://localhost:5173. Tests: `npm test`. Types: `npm run check`.

## Documents

Read the documents in this sequence.

| No. | Document | Subject |
|-----|----------|---------|
| 00 | [Overview](docs/00-overview.md) | Purpose, scope, principles, writing rules |
| 01 | [Requirements](docs/01-requirements.md) | Functional and non-functional requirements |
| 02 | [Game rules](docs/02-game-rules.md) | Commit, rest, miss, streak, patina, fun text |
| 03 | [UX and UI](docs/03-ux-ui.md) | Screens, theme, font, motion |
| 04 | [Architecture](docs/04-architecture.md) | Stack and components |
| 05 | [Data and API](docs/05-data-api.md) | SQLite schema and HTTP API |
| 06 | [PWA and notifications](docs/06-pwa-notifications.md) | Install, offline, Web Push |
| 07 | [Hosting](docs/07-hosting.md) | nginx, local DNS, TLS, service |
| 08 | [Roadmap](docs/08-roadmap.md) | Phases and tasks |
| 09 | [Workflow](docs/09-workflow.md) | Branches, pull requests, releases |
| 10 | [Profile](docs/10-profile.md) | 4th tab: stats, settings, devices, backups (plan) |

## Mockups

Open [mockups/index.html](mockups/index.html) in a browser. The "Today" phone is live: tap a habit to commit.

## Safety

- Your data (`data/`, `*.db`, backups) and secrets (`.env`, keys, tokens) are in `.gitignore`.
- A pre-commit hook (`.githooks/pre-commit`) runs `scripts/check-secrets.mjs`. CI runs it again and runs gitleaks.
- After you clone, run `npm install`. The `prepare` script turns on the hook.

## Credits

- The `bathory` theme uses colors from [black-metal-theme-neovim](https://github.com/metalelf0/black-metal-theme-neovim) by metalelf0 (Apache-2.0).
- The `gruvbox` theme uses colors from [gruvbox](https://github.com/morhetz/gruvbox) by morhetz. Only the color values are used.

## License

MIT
