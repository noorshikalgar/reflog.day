# 11 — iPhone app with Expo (plan)

Status: plan. Decided 2026-10-20.

## 1. Decision

| ID | Decision |
|----|----------|
| X-01 | Make a native iPhone app with Expo (React Native). It replaces the PWA on the phone. |
| X-02 | Keep the Svelte web app for desktop and browsers. Do not remove it. |
| X-03 | Keep one server and one SQLite database for both apps. No second backend. |
| X-04 | Install with a free Apple ID through Xcode. The app must be installed again every 7 days. |
| X-05 | Reminders are local notifications on the phone. No APNs push for now (APNs needs a paid account). |

Reason: the PWA cannot reach a native feel on iOS (bounce, home-indicator gap, gestures, haptics). Expo gives real UIKit navigation, tab bar, sheets and haptics, and it keeps TypeScript, so the shared rules and types stay the same.

## 2. Stack

| Part | Choice | Reason |
|------|--------|--------|
| Framework | Expo SDK 58, React Native 0.88, TypeScript | Current. One language with the server. |
| Navigation | expo-router: native tabs + native stack | Real iOS tab bar and real swipe-back. |
| Sheets | Native form sheets (detents) | Real drag-to-close. |
| Animation | react-native-reanimated, react-native-gesture-handler | 60/120 fps on the UI thread. |
| Drawing | react-native-svg | Rings, strip, graph, charts. |
| Haptics | expo-haptics | Real taptic engine. |
| Notifications | expo-notifications (local only) | Reminders and evening summary without a push server. |
| Secrets | expo-secure-store | Device token in the iOS Keychain. |
| Offline outbox | expo-sqlite (key-value store) | Same outbox idea as the web app. |
| Shared code | `shared/src/*` (rules, api types, messages, ids) | No copy. Metro reads the `shared` folder. |

## 3. Repository layout

```
reflog/
├── shared/      rules.ts, api.ts, messages.ts, ids.ts   (used by server, web, mobile)
├── server/      unchanged, plus token auth (§4)
├── web/         Svelte app, unchanged
└── mobile/      Expo app (new npm workspace)
    ├── app/                 expo-router routes
    │   ├── (tabs)/status    ├── (tabs)/log    ├── (tabs)/branches    └── (tabs)/profile/…
    │   ├── commit.tsx       form sheet
    │   └── pair.tsx         first launch: server address + code
    ├── src/lib/             api client, store, outbox, notifications, theme tokens
    └── src/ui/              Row, Group, Rings, Strip, Odometer, Avatar …
```

## 4. Server changes

| No. | Change |
|-----|--------|
| 1 | `POST /api/pair` with `{ client: "app" }` returns `{ token }` in the body (the web app keeps the cookie). |
| 2 | Accept `Authorization: Bearer <token>` on all `/api/*` routes, same check as the cookie. |
| 3 | Name the device from the app (`iphone`), so Devices shows it correctly. |

No other server change. All endpoints stay the same.

## 5. Network and security

1. Production: the app uses `https://app.reflog.day` (refer to [07](07-hosting.md)).
2. Development: the app may use `http://<LAN IP>:8742`. Set `NSAllowsLocalNetworking` in the iOS config so ATS allows local addresses. Do not set `NSAllowsArbitraryLoads`.
3. Store the token in the Keychain (expo-secure-store). Never in plain storage, never in logs.
4. The first screen asks for the server address and the 6-digit code.

## 6. Screen map

| Web screen | iPhone |
|------------|--------|
| Tab bar (4 tabs) | Native `UITabBar` (system blur, no bottom gap) |
| status | Native large title off; rings, strip, rows; long press → commit form sheet; pull to refresh (native `RefreshControl`) |
| log | Native list (FlashList or FlatList); normal and compact views; tap a day header to fold |
| branches | Native list; tap → `show` pushed on the stack; editor as a form sheet |
| profile | Native stack with large titles; grouped inset lists like iOS Settings |
| Toast + undo | Small bottom banner over the tab bar |

Design tokens (colors, the 4 themes) come from `web/src/lib/theme.css` values, copied into `mobile/src/lib/theme.ts`. A test checks that both use the same values.

## 7. Notifications (local)

1. After each data load, the app plans local notifications for today and the next 6 days: one at each branch reminder time, and one evening summary.
2. A commit cancels that branch's reminder for today.
3. Text is the same as the web push text (refer to [02 §8.4](02-game-rules.md)).
4. Limit: iOS keeps 64 scheduled notifications. 12 branches × 7 days + 7 summaries = 91, so plan only 4 days ahead when needed.

## 8. Risks

| ID | Risk | Plan |
|----|------|------|
| K-1 | The SF Pro Rounded face (the "alarm" numbers) may need a small native setting. | Check in the spike (E0). Fallback: system font, weight 300. |
| K-2 | Free Apple ID builds expire after 7 days. | Re-install from Xcode. If this gets annoying, move to the paid account (TestFlight). |
| K-3 | Two apps to keep in step. | Shared code in `shared/`; the API types make the compiler catch drift. |
| K-4 | CocoaPods is not installed on this Mac. | Install it in E0 (`brew install cocoapods`). |

## 9. Phases

Each phase ends with a build on the iPhone. Each phase is one or more pull requests.

| Phase | Content |
|-------|---------|
| E0 | Spike: workspace, native tabs, pairing screen, status screen on real data, simulator + iPhone install |
| E1 | Status complete: rings, strip, rows, commit sheet, undo, haptics, pull to refresh, miss card |
| E2 | Log: both views, fold, filter, infinite scroll |
| E3 | Branches and branch detail; branch editor sheet |
| E4 | Profile pages (same tree as [10 §3.1](10-profile.md)) |
| E5 | Local notifications, offline outbox, app icon and launch screen |
| E6 | Polish: animations, accessibility (VoiceOver, Dynamic Type), themes |

Web app work stops except for bug fixes, until E6 is done.
