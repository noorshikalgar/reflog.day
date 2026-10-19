# 02 — Game rules

This document gives the rules that make reflog fun. The rules must stay simple. The user must be able to say each rule in one sentence.

## 1. The five rules

| No. | Rule |
|-----|------|
| 1 | One tap is one commit. |
| 2 | A rest day keeps your streak. You get one rest day for each branch each week. |
| 3 | One miss does not break your streak. It leaves a mark. |
| 4 | Two misses in a row rebase your streak to zero. Your best streak stays. |
| 5 | Marks fade after 14 days. The history keeps them forever. |

Short form for the UI: **"Never miss twice."**

## 2. Day states

| State | Graph node | Color | Effect on streak |
|-------|-----------|-------|------------------|
| Done | Filled circle `●` | Lane color | +1 |
| Rest | Small square `■` | Amber | No change. The streak continues. |
| Miss | Hollow ring `◌`, dashed | Muted slate | No change for the first miss. |
| Second miss in a row | Hollow ring and a lane break | Muted slate | Rebase: streak = 0. |
| Not scheduled | No node. Thin lane line only. | — | No change. |

The app does not use red for a miss. Red means "error". A miss is not an error.

## 3. Streak

1. Walk back from today through the scheduled days of the branch.
2. Count each "done" day.
3. Skip each "rest" day. Do not count it. Do not stop.
4. Skip a single "miss" day. Do not count it. Do not stop.
5. Stop at two "miss" days in a row.

Today does not count as a miss before the end of the logical day.

## 4. Patina (the small mark)

Patina is the "slight change" after a miss. It is visible but gentle.

- Patina level = the number of misses in the last 14 days. Maximum level is 3.
- Each level reduces the saturation of the lane color by 18 %.
- At level 1 or more, the branch row shows a small `~` after the streak number. Example: `12d~`.
- Patina goes down by itself when old misses go out of the 14-day window. The user does not need to do anything.

| Level | Saturation | Row text |
|-------|-----------|----------|
| 0 | 100 % | `12d` |
| 1 | 82 % | `12d~` |
| 2 | 64 % | `12d~~` |
| 3 | 46 % | `12d~~~` |

## 5. Graph detour

A miss also bends the lane in the graph. The lane moves one half column to the right for that day, then comes back. This looks like a short side branch in git. It is a visual mark only. It has no effect on data.

A rebase draws a full lane break: the old lane ends with `┘` and a new lane starts.

## 6. Logical day and grace

- The logical day starts at 04:00 local time. The user can change this hour (00:00–06:00).
- A log at 01:30 on Tuesday belongs to Monday.
- The user can log the previous day until 12:00 ("amend"). The commit gets the `amended` tag. An amended commit counts as done.

## 7. Miss card

On the first open after a miss, the app shows one card. The card is small and easy to close.

Card contents:

1. Title: a random fun message from the list in section 8.
2. A short line: `walk — no commit yesterday. Streak safe. Never miss twice.`
3. Two buttons:
   - `ok` — closes the card.
   - `it was a rest day` — changes the miss to rest, if the weekly rest is still available.

If this is the second miss in a row, line 2 changes: `walk — rebased. Best streak 23 stays yours.`

## 8. Fun text

The app picks one message at random. It does not show the same message twice in a row.

### 8.1 Miss titles

- `fix: life happened`
- `chore: touched grass instead`
- `revert: yesterday`
- `git stash — saved for later`
- `HEAD detached, briefly`
- `wip: human being`
- `merge conflict with the couch`
- `404: habit not found (yesterday)`
- `skipped CI. it's fine.`

### 8.2 Commit toasts

- `committed a3f9c1e — nice.`
- `pushed to main.`
- `green build.`
- `+1 ahead of yesterday.`
- `working tree clean.` (shown when all of today's branches are done)

### 8.3 Rest toasts

- `--allow-empty. rest is a feature.`
- `scheduled downtime.`

### 8.4 Notifications

- `walk has uncommitted changes.`
- `read: 0 commits today. one small push?`
- Evening: `2 branches behind. 1 tap each.`

## 9. Weekly release notes

On the first open each Monday, the app shows a card for the past week.

```
v2026.42 — release notes
  18 commits · 2 rest · 1 miss
  longest streak: walk 23d
  new best: read 9d
```

The version is `vYYYY.WW` (ISO week). The card closes with one tap.

## 10. Milestones

At streaks of 7, 30, 100 and 365 days, the app shows a "tag" with a short confetti of dots in the lane color.
Tag names: `v0.1.0` (7), `v1.0.0` (30), `v2.0.0` (100), `LTS` (365).
