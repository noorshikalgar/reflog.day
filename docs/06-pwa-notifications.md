# 06 — PWA and notifications

## 1. Requirements for a PWA with push on iPhone

| No. | Requirement | Reason |
|-----|-------------|--------|
| 1 | HTTPS with a certificate that the phone trusts | Service workers and push work only in a secure context. |
| 2 | A web app manifest with `display: "standalone"` | iOS gives Web Push only to apps on the Home Screen. |
| 3 | iOS 16.4 or later | First iOS version with Web Push for Home Screen apps. |
| 4 | A user tap before the permission request | iOS rejects `Notification.requestPermission()` without a user gesture. |
| 5 | Outbound internet from the server | The server sends push messages to Apple (`web.push.apple.com`) or Google. The phone gets them from there. |

Important: push messages go through the Apple or Google push service. The message body leaves your network. Keep the body short. Do not put private notes in it.

## 2. Manifest

```json
{
  "name": "reflog",
  "short_name": "reflog",
  "start_url": "/?src=pwa",
  "display": "standalone",
  "background_color": "#0b0d12",
  "theme_color": "#0b0d12",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Also add `<link rel="apple-touch-icon" href="/icons/180.png">` and `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`.

## 3. Service worker

| Event | Action |
|-------|--------|
| `install` | Cache the app shell (HTML, JS, CSS, icons). |
| `fetch` (shell) | Cache first, then network. |
| `fetch` (`/api/today`, `/api/log`) | Network first. If offline, use the last cached response. |
| `push` | Show the notification. Use `tag` = branch slug, so a new reminder replaces the old one. |
| `notificationclick` | Focus an open window or open `/?focus=<slug>`. |

Offline writes: the client stores writes in an IndexedDB outbox. The client sends the outbox on `online`, on app open and on `visibilitychange`. Do not depend on Background Sync: iOS does not support it.

## 4. Enable notifications (procedure for the user)

1. Open `https://app.reflog.day` in Safari on the iPhone.
2. Tap Share, then tap "Add to Home Screen".
3. Open reflog from the Home Screen icon.
4. Go to `branches` → settings.
5. Tap `enable notifications`.
6. Tap "Allow" in the iOS dialog.
7. Tap `send test`. Make sure that a notification comes.

## 5. Scheduler rules

The server runs a tick every 60 seconds.

| Job | When | Action |
|-----|------|--------|
| Reminder | At `remind_at` of a branch, on a scheduled day | If no entry exists for today, send a push. |
| Evening summary | At `evening_at` | If one or more branches are open, send one push with the count. |
| Rollover | At `day_start_hour` | Insert `miss` rows for scheduled branches without an entry for the previous logical day. |
| Backup | 03:00 | `VACUUM INTO 'backups/reflog-YYYY-MM-DD.db'`. Delete files older than 14 days. |

After a server restart, the scheduler does a catch-up: it runs the rollover for all missed days. It does not send old reminders.

If the push service returns 404 or 410, delete that subscription.
