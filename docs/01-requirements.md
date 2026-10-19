# 01 — Requirements

"Must" is mandatory. "Should" is recommended. "May" is optional.

## 1. Functional requirements

### 1.1 Branches (habits)

| ID | Requirement |
|----|-------------|
| F-01 | The user must be able to add a branch with a name, a lane color and an optional emoji. |
| F-02 | The name must be a short slug. Example: `walk`, `read`, `no-sugar`. Maximum 20 characters. |
| F-03 | The user must be able to set the scheduled days of the week. Default: every day. |
| F-04 | The user must be able to set zero or one reminder time for each branch. |
| F-05 | The user must be able to archive a branch. Archive keeps the history. |
| F-06 | The user should be able to change the sequence of branches with drag. |
| F-07 | The app must allow a maximum of 12 active branches. The app should show a soft hint above 8: "big routines break. keep it small?" |

### 1.2 Logs

| ID | Requirement |
|----|-------------|
| F-10 | A tap on a branch row on the Today screen must make a commit immediately. |
| F-11 | A long press on a branch row must open the commit sheet. |
| F-12 | The commit sheet must let the user add a one-line message. Maximum 72 characters. |
| F-13 | The commit sheet must let the user log a rest day. |
| F-14 | The user must be able to undo a commit for 10 seconds after the tap ("revert" toast). |
| F-15 | The user must be able to log the previous logical day until 12:00 today. The app marks it `amended`. |
| F-16 | Each commit must get a 7-character hex hash. The hash is for fun, not for security. |

### 1.3 Misses and streaks

| ID | Requirement |
|----|-------------|
| F-20 | The app must record a miss for each scheduled branch without a log at the end of the logical day. |
| F-21 | On the next open, the app must show one "miss card" for all new misses. |
| F-22 | The app must apply the streak and patina rules in [02 — Game rules](02-game-rules.md). |
| F-23 | The app must keep the best streak of each branch. |

### 1.4 Views

| ID | Requirement |
|----|-------------|
| F-30 | Today screen (`status`): all branches scheduled today, with state and streak. |
| F-31 | Log screen (`log --graph`): history as a lane graph, newest day first, infinite scroll. |
| F-32 | Branch screen (`show`): big streak number, best streak, total commits, 12-week grid. |
| F-33 | Branches screen (`branch -a`): list, add, edit, archive. Settings are at the bottom of this screen. |
| F-34 | The app should show weekly "release notes" on Monday morning (refer to [02](02-game-rules.md)). |

### 1.5 Notifications

| ID | Requirement |
|----|-------------|
| F-40 | The app must send a Web Push reminder at the reminder time of each branch, if no log exists. |
| F-41 | The app should send one evening summary at a time that the user sets. Default: 21:30. |
| F-42 | A tap on a notification must open the Today screen with that branch highlighted. |
| F-43 | The user must be able to turn all notifications off with one switch. |

### 1.6 Data

| ID | Requirement |
|----|-------------|
| F-50 | The user must be able to export all data as JSON. |
| F-51 | The user may import a JSON export. |
| F-52 | The server must make a daily SQLite backup file. Keep the last 14 files. |

## 2. Non-functional requirements

| ID | Requirement |
|----|-------------|
| N-01 | Mobile first. Design for a 390 px wide screen first. |
| N-02 | Today screen must be interactive in less than 1 s on the local network. |
| N-03 | A commit must show visual feedback in less than 100 ms (optimistic UI). |
| N-04 | The app must work offline. Logs made offline must sync when the server is available. |
| N-05 | The app must use no external CDN, font or script at runtime. |
| N-06 | The app must obey `prefers-reduced-motion` and `prefers-color-scheme`. |
| N-07 | Text contrast must be WCAG AA minimum. |
| N-08 | The server must be one process and one SQLite file. |
| N-09 | Only devices that the user pairs can read or write data. |
