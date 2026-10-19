# 00 — Overview

## 1. Purpose

reflog helps one person do daily habits and improve a daily routine.
The app must be fast to use. The app must be fun to use. The app must not punish the user.

## 2. Name

In git, `reflog` is the log of all the things that you did. This app is the log of all the things that you did today.

## 3. Scope

### 3.1 In scope

- One user. One SQLite file.
- Habits ("branches"), daily logs ("commits"), rest days and missed days.
- A `git log --graph` history view.
- Streaks with a soft miss rule (refer to [02 — Game rules](02-game-rules.md)).
- PWA install on iPhone and Android.
- Web Push reminders.
- Local hosting behind nginx with a local DNS name.

### 3.2 Out of scope

- More than one user, sharing, social features.
- Cloud sync, accounts, payments.
- Native iOS or Android apps.
- Analytics, AI coach, gamified shop or points.

## 4. Principles

| ID | Principle | Meaning |
|----|-----------|---------|
| P-01 | One tap | Log a habit with one tap from the Today screen. |
| P-02 | Big | Use big text and big touch targets. Minimum touch target is 56 px. |
| P-03 | Kind | A miss gives a mark, not a penalty. One miss does not break a streak. |
| P-04 | Honest | The history keeps all misses. The app does not hide or delete them. |
| P-05 | Developer feel | Use git words, monospace hashes and a terminal color theme. |
| P-06 | Calm motion | Use short, soft animations. Obey `prefers-reduced-motion`. |
| P-07 | Local | All data stays on the user's machine. No third-party scripts or fonts. |
| P-08 | Simple | If a feature needs a manual, remove the feature. |

## 5. Writing rules for these documents

These documents use ASD-STE100 Simplified Technical English rules:

- Use short sentences. Procedure sentences: 20 words maximum. Description sentences: 25 words maximum.
- Write one instruction in each sentence.
- Use the active voice. Use the imperative in procedures.
- Use one word for one meaning. Refer to the glossary below.
- Use tables and numbered steps when possible.

## 6. Glossary

| Term | Meaning |
|------|---------|
| Branch | One habit. Example: `walk`. Each branch has a lane color. |
| Commit | One "done" log for one branch on one day. It has a 7-character hash. |
| Rest | A planned skip day. In git words: an empty commit (`--allow-empty`). |
| Miss | A scheduled day with no commit and no rest. |
| Streak | The count of done days in the current run of a branch. |
| Rebase | The reset of a streak after two misses in a row. |
| Patina | A small color change on a branch after misses. It heals with time. |
| Logical day | The day that a log belongs to. It starts at 04:00 by default, not at 00:00. |
| Lane | The vertical line of one branch in the graph view. |
