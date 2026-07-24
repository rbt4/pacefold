# Changelog

## 15.2.1 — Upgrade-gate synchronization

- Made the installed-version browser gate wait for the new worker and normalized 15.2 preference schema before asserting migration, eliminating a false failure against the still-running previous page.
- Re-ran the full release archive against a checksum-verified installed 15.1.8 build, including automatic reload, profile/routine/theme preservation and calm-default migration.

## 15.2.0 — Calm interaction reset

- Replaced alarm-style system alerts with silent, non-persistent notifications carrying one contextual clear action; quiet essentials are the default and every-cue coverage is opt-in.
- Kept the taskbar empty until attention is actually due, using a dot by default and retaining the next-cue countdown only as an explicit option.
- Made clearing a Pacefold notification clear both sibling notifications and the taskbar indicator, while preserving durable exactly-once action logging.
- Anchored hydration, distance-look and movement cadence to the current live work session instead of manufacturing a backlog from the beginning of the workday.
- Added the previously missing distance-look system-notification path and made real meals, away periods and scheduled pauses reset eye timing as well as movement timing.
- Reorganized the 4,700-pixel settings sheet into four focused, keyboard-accessible views: Today, Rhythm, Tools and App.
- Reduced default pulse, glow and edge animation; the stronger animated Andon treatment is now reserved for the explicit Clear cue-strength setting.
- Prevented setup controls from sitting underneath an open settings panel and suppressed routine OneNote catch-up toasts during background sync.
- Expanded static, browser, upgrade and self-check gates for quiet notification semantics, session timing, taskbar modes and the new settings navigation.

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
- Added a real-time clock favicon for browser-tab and app-window surfaces.
- Added distinct notification artwork for moments, hydration, preparation, away time, meals, eyes, movement and diagnostics.
- Added context-aware notification actions that record or snooze without opening Pacefold; clicking the notification body still opens the app.
- Added a durable, deduplicated service-worker action queue so a click is not lost while Pacefold is unfocused or between reloads.
- Added right-click taskbar shortcuts for Log / clear current cue, Capture, Care and Sound, including launch-queue handling for an already-running installed app.
- Added static, browser, offline and prior-release upgrade coverage for the new icons, manifest shortcuts, action queue and exactly-once local logging.
- Documented the Edge boundary: a PWA cannot override the operating system’s normal taskbar single-click/double-click behaviour or continuously redraw the pinned icon face.

## 15.0.0 — Care, sound and Kiroku underneath

- Added a quiet four-tool dock while preserving the clock as Pacefold's dominant surface.
- Added local-first capture for notes, follow-ups, incidents, inspections, JHSC, construction, notifications, meetings and resources.
- Added optional Microsoft OneNote synchronization using local MSAL Browser and delegated `Notes.ReadWrite`; captures queue offline, retry silently and guard against duplicate appends.
- Added one dated OneNote page per day, selectable notebook/section destination and an exact Microsoft Entra setup guide.
- Added break-aware movement resets and expanded 20-20-20 care; meals, away time and scheduled pauses reset the movement clock.
- Added offline generated Brown hush, Rain glass and Soft fan textures, local/direct audio, Media Session controls and cue ducking.
- Added Moss, Dusk and user-defined colour themes.
- Deferred automatic update reloads during setup or capture, persisted unfinished capture text, and added migration tests from Pacefold 14 storage.
- Expanded the service-worker shell and validator for the new offline assets, local MSAL license, Graph adapter and version consistency.

## 14.0.1 — Final reliability pass

- Anchored the landing-page Andon card to the hero artwork and removed desktop horizontal overflow.
- Prevented first-time service-worker activation from reloading onboarding and discarding in-progress setup choices.
- Restored the complete responsive onboarding design, including readable option cards and a real three-step progress indicator.
- Bounded service-worker readiness during notification tests so workplace policy cannot leave setup waiting forever.
- Added a direct page-notification fallback and now reports a failed test accurately instead of claiming delivery.
- Added validation guards for the hero anchor and bounded notification path.

## 14.0.0 — Profiles, reliable setup and display comfort

- Added Pacefold Original, Everyday, Mindfulness, Muslim, Jewish, Christian, Hindu, Buddhist and Custom rhythm profiles.
- Preserved the developer default: Muslim prayer rhythm, Hanafi Asr, Toronto and a 30-minute noodle timer.
- Added editable personal moments for non-Islamic profiles with explicit non-authoritative timing language.
- Added configurable preparation presets for noodles, tea, coffee, food prep, steep/brew and custom routines.
- Replaced the fragile install-only setup dock with a three-step setup wizard that works even when Edge does not expose a native install prompt.
- Added app-level Auto, Neutral, Warm and Dim display-comfort modes.
- Added optional distance-look cues and a user-initiated Windows Night light shortcut.
- Rebuilt the landing page to showcase profiles, routine mixing, display comfort, local privacy and honest platform limits.
- Generalized taskbar labels, timeline language and scheduled-moment controls.
- Simplified the runtime to load `app/app.js` directly, removing the generated loader, text fragments, gzip tail and DecompressionStream dependency.
- Expanded CI validation for the new interface and direct-source service-worker shell.

## 13.1.0 — Location and one-file builds

- Added a Location control (device geolocation or manual coordinates); prayer times, the day arc, and Qibla now recalculate for anywhere, with Toronto as the default.
- Added `scripts/build.mjs` so `app/app.js` is the single source of truth: the build regenerates the split app parts, the loader integrity hash, and the service-worker shell, and syncs the worker version to `APP_VERSION`.
- Documented the build-and-validate workflow.


## 13.0.0 — Install, update, and reliability hardening

- Moved installation to a root-scoped PWA so the landing page and app share one install identity.
- Added a direct landing-page install button, compatibility indicators, and a guided setup dock inside the app.
- Added automatic service-worker update checks at startup, every 30 minutes, on focus, visibility return, and reconnect.
- Added automatic update activation with one controlled reload while preserving local records.
- Added notification modes, actual browser-permission reporting, persistent deduplication, and an end-to-end test-notification control.
- Added service-worker notification click handling that focuses or opens Pacefold.
- Added app self-checks for interface, storage, manifest, offline engine, and prayer-clock calculations.
- Added storage-health reporting and defensive preference repair.
- Added a clean-source GitHub Pages workflow with pull-request validation.
- Added static validation for manifest scope, icon dimensions, asset references, worker shell entries, DOM references, and external runtime dependencies.
- Fixed a startup failure caused by storage health being initialized after the first save.
- Fixed signal previews being hidden behind a real prayer/timer cue.
- Fixed global keyboard shortcuts firing while controls had focus.
- Added a legacy app-worker migration path and removed the obsolete nested manifest.

## 12.0.0 — Pacefold

- Rebranded the application from Deskline to Pacefold.
- Added the Ma / Andon / Kiroku / Kaizen / Hansei product system.
- Added a score-free Day Close.
- Added one-at-a-time local Kaizen suggestions.
- Added a new Japanese-minimal icon and visual palette.
- Migrated existing Deskline local preferences.

## 11.0.0

- Added prayer mini-break logging, desk meal versus away lunch, overlap-safe break accounting, and a private timeline.
