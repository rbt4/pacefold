# Changelog

## 15.1.3 — Reload-safe notification audit

- Preserved the captured notification payload across a first-activation reload so the browser gate can verify delivery, actions and source artwork without racing the service-worker lifecycle.

## 15.1.2 — Notification audit observability

- Added a same-page notification event at the send boundary so browser tests can inspect the exact Edge action/icon payload while separately confirming that Chrome created the notification.
- Preserved the durable service-worker queue, reload survival and exactly-once logging checks.

## 15.1.1 — Browser-gate compatibility

- Corrected the notification-action browser audit to inspect the exact options Pacefold sends to Edge instead of relying on headless Chrome to expose operating-system notification metadata through `getNotifications()`.
- Kept the durable service-worker queue, reload survival and exactly-once logging checks unchanged.

## 15.1.0 — Taskbar and notification control surface

- Replaced cryptic taskbar source codes with a live minutes-to-next-cue badge and a dot when action is waiting.
- Added a real-time clock favicon for browser-tab and installed-app window surfaces.
- Added distinct notification artwork for moments, hydration, preparation, away time, meals, eye care, movement and diagnostics.
- Added context-aware notification actions that record or snooze without opening Pacefold; clicking the notification body still opens it.
- Added a durable, lease-protected and deduplicated service-worker action queue so a click is not lost or double-applied across focus changes and reloads.
- Added right-click taskbar shortcuts for Log / clear current cue, Capture, Care and Sound, including launch-queue handling for an already-running app.
- Added static, browser, offline and prior-release upgrade gates for the new icons, manifest shortcuts, action queue and exactly-once local logging.
- Documented the Edge boundary around normal taskbar clicks and pinned icon artwork.

## 15.0.0 — Care, sound and Kiroku underneath

- Added the quiet four-tool dock without turning Pacefold into a dashboard.
- Added local-first capture and optional Microsoft OneNote synchronization with offline queuing, dated pages and duplicate-safe recovery.
- Added break-aware movement resets, expanded eye care, generated/local/direct audio, media controls, cue ducking and new themes.
- Added update deferral for setup and capture, persisted unfinished capture text and v14-to-v15 migration.
- Added checksum, version-advance, static, mocked Graph, installed-upgrade, offline and responsive browser gates before deployment.

## 14.0.1 — Final reliability pass

- Fixed landing overflow, first-activation reload, incomplete responsive onboarding and unbounded notification-worker waits.

## 14.0.0 — Profiles, routines, setup, and comfort

- Added nine rhythm profiles, configurable preparation routines, robust setup, display comfort and the direct validated runtime.

## 13.1.0 — Claude foundation

- Added location-aware prayer/Qibla calculations and consolidated application source.
