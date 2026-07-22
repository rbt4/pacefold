# Changelog

## 15.2.1 — Upgrade-gate synchronization

- Made the installed-version browser gate wait for the new worker and normalized 15.2 preference schema before asserting migration, eliminating a false failure against the still-running previous page.
- Re-ran the full release archive against a checksum-verified installed 15.1.8 build, including automatic reload, profile/routine/theme preservation and calm-default migration.

## 15.2.0 — Calm interaction reset

- Replaced alarm-style system alerts with silent, non-persistent notifications carrying one contextual clear action; quiet essentials are the default and every-cue coverage is opt-in.
- Kept the taskbar empty until attention is actually due, using a dot by default and retaining the next-cue countdown only as an explicit option.
- Made clearing a Pacefold notification clear both sibling notifications and the taskbar indicator, while preserving durable exactly-once action logging.
- Anchored hydration, distance-look and movement cadence to the current live work session instead of manufacturing a backlog from the beginning of the workday.
- Added the missing distance-look system-notification path and made real meals, away periods and scheduled pauses reset eye timing as well as movement timing.
- Reorganized the 4,700-pixel settings sheet into four focused views and reduced default pulse, glow and edge animation.
- Expanded static, browser, upgrade and self-check gates for the calmer notification contract, session timing, taskbar modes and settings navigation.

## 15.1.8 — Permission-aware notification gate

- Applied notification permission when creating the Playwright context, matching current Playwright guidance.
- Added an honest spec-only branch when a CI browser still hard-denies notifications: the gate verifies the exact actions, source artwork and real service-worker queue without claiming operating-system delivery.

## 15.1.7 — Atomic notification assertion

- Collapsed payload capture, source-specific delivery and permission reporting into one browser evaluation so the audit cannot race a page transition between test operations.

## 15.1.6 — Explicit notification-path audit

- Added a permission-respecting notification preview hook so the browser gate exercises a real source-specific notification instead of an in-app signal preview.
- Tightened delivery verification to require the created browser notification to carry the water-cue source.

## 15.1.5 — Navigation-stable payload bridge

- Moved the test-only notification payload bridge to Playwright’s page-console channel, which remains attached while the service worker changes the page lifecycle.

## 15.1.4 — Direct notification payload capture

- Handed the emitted notification payload directly to the Playwright runner before any service-worker lifecycle transition, eliminating page-memory races while retaining independent browser delivery verification.

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
