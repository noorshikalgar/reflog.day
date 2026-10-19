# 03 — UX and UI

## 1. Layout rules

| ID | Rule |
|----|------|
| U-01 | Design for 390 × 844 px first. Then scale up to tablet and desktop. |
| U-02 | Put all primary actions in the bottom half of the screen (thumb zone). |
| U-03 | Minimum touch target: 56 px. Branch rows: 76 px high. |
| U-04 | Use 20 px side padding. Use 12 px between rows. |
| U-05 | Use a bottom tab bar with 3 tabs only: `status`, `log`, `branches`. |
| U-06 | Respect the iPhone safe areas (`env(safe-area-inset-*)`). |
| U-07 | Use no modal dialogs for normal work. Use bottom sheets. |
| U-08 | On desktop (≥ 900 px), show `status` and `log` side by side. |

## 2. Screens

### 2.1 `status` (Today) — the home screen

```
┌──────────────────────────────┐
│ Mon 19 Oct          ⌁ synced │
│                              │
│   3/5                        │  ← big rounded numerals
│   on branch today            │
│   2 changes not committed    │
│ ●─●─●─◌─●─●─●  (7-day strip) │
│                              │
│ ┌──────────────────────────┐ │
│ │● walk       23d   a3f9c1e│ │  ← done: hash + time
│ │● read        9d~  07:10  │ │
│ │○ water      12d    tap → │ │  ← open
│ │○ stretch     4d    tap → │ │
│ │■ gym        rest  --empty│ │
│ └──────────────────────────┘ │
│  status     log    branches  │
└──────────────────────────────┘
```

- Tap a row: commit. Long press: commit sheet.
- When all rows are done, the header text changes to `working tree clean.`

### 2.2 Commit sheet (bottom sheet)

- Title: `git commit -m` and the branch name.
- One text input (72 characters). Placeholder: `walk: done`.
- Quick chips: `quick`, `long one`, `felt good`, `hard today`.
- Big primary button: `commit`.
- Secondary button: `rest day (--allow-empty)`. It shows `1 left this week`.
- Toggle: `amend yesterday` (only visible before 12:00).

### 2.3 `log` — v2, one trunk (selected)

v1 used one lane for each branch. With 10 branches, v1 shows 10 lines. This is too wide and too busy. v2 replaces v1. The mockup keeps v1 for comparison.

Rules for v2:

1. Show one vertical line only (the trunk). The number of branches has no effect on the width.
2. Show one day node for each logical day. The day header shows:
   - The date. Today also shows `HEAD`.
   - A dot strip with one dot for each branch, in the branch sequence. `●` done, `■` rest, `◌` miss, ring = open, small grey dot = not scheduled. The strip wraps after 12 dots.
   - The count `done/scheduled` in big numerals. Rest counts as done.
3. Under the day header, show one row for each event: node in the lane color, then `hash  branch: message  time`.
4. Put misses at the end of the day group. For a miss, the trunk bends to the right (wobble) and the node is a dashed ring.
5. Fold days. Today and yesterday are open. Older days are folded and show a summary: `9 commits · 1 rest · 1 miss`. Tap a day header to fold or unfold.
6. Filter chips in a horizontal scroll row at the top: `all · 10`, then one chip for each branch.
7. With a branch filter, the trunk takes the lane color. The screen shows a streak header and one row for each day (date and message). A rebase shows the `rebased` tag.
8. Tap a line: show a small detail popover with the full time and tags.

| ID | Requirement |
|----|-------------|
| F-35 | The `log` screen must stay readable with 12 branches on a 360 px wide screen. |

### 2.4 `show <branch>` (branch detail)

- Very big streak number in thin rounded numerals, in the lane color. Example: `23`.
- Under it: `day streak · best 31 · 214 commits`.
- Patina meter: 3 small dots. Filled dots = patina level.
- 12-week contribution grid (7 rows × 12 columns) in the lane color.
- Buttons: `edit`, `archive`.

### 2.5 `branches` (list and settings)

- List of branches with the lane color, schedule (`M T W T F · ·`) and reminder time.
- Button: `+ new branch`. It opens a sheet: name, emoji, color, days, reminder.
- Settings section at the bottom: day start hour, evening summary time, notifications switch, theme, export, pair new device.

### 2.6 Miss card and release notes card

- Show at the top of `status`, above the big numerals.
- Enter with a soft slide-down and one small wobble (2°). Close with a swipe up or a tap.

## 3. Theme

The theme is a calm terminal theme. Dark is the default. Light is "paper".

### 3.1 Color tokens

`web/src/lib/theme.css` is the source of truth. Some values below were tuned after this table to pass WCAG AA (4.5:1) for text; `shared/test/contrast.test.ts` checks all four themes.

| Token | Dark | Light | Use |
|-------|------|-------|-----|
| `--bg` | `#0b0d12` | `#f5f4ef` | Page |
| `--surface` | `#12151c` | `#ffffff` | Rows, cards |
| `--surface-2` | `#1a1e28` | `#ecebe5` | Pressed, sheet |
| `--line` | `#252a36` | `#dcdad2` | Borders, idle lanes |
| `--text` | `#e7e9ee` | `#1a1d24` | Main text |
| `--muted` | `#8b92a1` | `#5f6573` | Secondary text |
| `--dim` | `#5a6170` | `#9a9fa9` | Hashes, hints |
| `--ok` | `#3ddc97` | `#14935c` | Commit, success |
| `--rest` | `#f2b84b` | `#b7791f` | Rest day |
| `--miss` | `#6c7487` | `#9aa0ad` | Miss (never red) |

### 3.2 Lane colors (10, colors repeat after 10)

| Lane | Dark | Light |
|------|------|-------|
| 1 green | `#3ddc97` | `#13915b` |
| 2 cyan | `#4cc9f0` | `#0b7fa8` |
| 3 violet | `#a78bfa` | `#6d4fd8` |
| 4 orange | `#ff9f5a` | `#c25a12` |
| 5 pink | `#f472b6` | `#c0307a` |
| 6 blue | `#6ea8ff` | `#2a5fd0` |
| 7 lime | `#c3e88d` | `#5d8a16` |
| 8 teal | `#2dd4bf` | `#0f8f80` |
| 9 coral | `#ff8a80` | `#c2463c` |
| 10 silver | `#b8c4d8` | `#56657e` |

Patina: apply `filter: saturate(…)` to the lane color (refer to [02 §4](02-game-rules.md)).

### 3.3 More themes

The app has 4 themes: `terminal` (default), `bathory`, `gruvbox` and `paper` (light). Each theme sets the same tokens. Components must use only tokens, never fixed colors.

| Token | `bathory` | `gruvbox` |
|-------|-----------|-----------|
| `--bg` | `#000000` | `#282828` |
| `--surface` | `#0e0e0e` | `#32302f` |
| `--surface-2` | `#222222` | `#3c3836` |
| `--line` | `#222222` | `#504945` |
| `--text` | `#f1f1f1` | `#ebdbb2` |
| `--muted` | `#999999` | `#a89984` |
| `--dim` | `#6e6e6e` | `#7c6f64` |
| `--ok` | `#fbcb97` | `#b8bb26` |
| `--on-ok` | `#000000` | `#1d2021` |
| `--rest` | `#e78a43` | `#fabd2f` |
| `--miss` | `#505050` | `#928374` |
| Lanes 1–10 | `#fbcb97 #e78a43 #5f8787 #c1c1c1 #9b99a3 #d9a679 #8fb3b3 #aaaaaa #b5776a #888888` | `#b8bb26 #83a598 #d3869b #fe8019 #8ec07c #458588 #98971a #689d6a #b16286 #d65d0e` |

Notes:

1. `bathory` comes from `lua/black-metal/palette/bathory.lua` in metalelf0/black-metal-theme-neovim. Lanes 1–5 are palette colors. Lanes 6–10 are tints made for this app, because the palette has only a few colors.
2. In `bathory`, `--dim` is `#6e6e6e`, not the palette comment color `#505050`. `#505050` on black fails WCAG AA for text. The app uses `#505050` only for miss rings.
3. `gruvbox` does not use the gruvbox red (`#fb4934`) or yellow as a lane color. Red means error. Yellow is the rest color.
4. The user selects the theme in `branches` → config → theme. The app stores it in `setting.theme` and sets `theme_color` in the manifest at runtime.

## 4. Font

| Role | Stack | Use |
|------|-------|-----|
| Display | `ui-rounded, "SF Pro Rounded", system-ui, sans-serif` | Big numerals, titles |
| UI | `system-ui, -apple-system, sans-serif` | Labels |
| Mono | `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace` | Hashes, log lines, git words |

Notes:

1. On iPhone, iPad and Mac, `ui-rounded` gives SF Pro Rounded. This is the rounded Apple system face that the Clock and Alarm screens use for big numerals. It is free to use through the system font. Do not bundle Apple font files: the license is for Apple platforms only.
2. For the "alarm" look, use weight 200–300, `font-variant-numeric: tabular-nums`, and a negative letter-spacing (`-0.04em`).
3. On Android, `ui-rounded` is not available. The stack falls back to the system sans. You may bundle a free rounded face (for example Nunito, OFL licence) as a local file later.
4. The iOS 27 Alarm font is not confirmed as a separate face. If Apple adds a new system face for CSS, change only the `--font-display` token.

## 5. Motion

All motion is short and soft. Default easing: `cubic-bezier(.2,.8,.2,1)`.

| ID | Event | Motion | Time |
|----|-------|--------|------|
| M-01 | Tap a row | Row scales to 0.98, then back. | 120 ms |
| M-02 | Commit | The open ring fills into a dot. A ripple in the lane color goes out from the dot. | 360 ms |
| M-03 | Commit hash | The hash types in, one character at a time. | 7 × 35 ms |
| M-04 | Counter | The big `3/5` number rolls up like an odometer. | 400 ms |
| M-05 | Strip | A new dot drops into the 7-day strip. | 300 ms |
| M-06 | All done | Header text cross-fades to `working tree clean.` Small dot confetti. | 900 ms |
| M-07 | Miss card | Slide down plus one 2° wobble. | 500 ms |
| M-08 | Tab change | View Transitions API cross-fade and 8 px slide. | 220 ms |
| M-09 | Sheet | Slide up with a spring. Drag down to close. | 280 ms |
| M-10 | Undo toast | Slide up. A thin progress line runs for 10 s. | 10 s |

When `prefers-reduced-motion: reduce` is set, use opacity fades only. Keep all state changes.

On iPhone, the app may use the `<input type="checkbox" switch>` element for a small haptic tick (Safari 18+). This is optional.
