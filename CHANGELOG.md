# Changelog

## 15.8.0 — Integrated quiet dock

- Replaced the layered permanent rail with one centered 48 px dock that exposes the current cue, local-first capture, Notebook, contained Media and one progressive-disclosure control.
- Added a compact command surface for the current action, Capture, Notebook, Media, Weather, OneNote and local diagnostics without creating parallel timers, storage or action implementations.
- Added slash-routed capture for Daily, Follow-ups, Incidents, Inspections, JHSC, Construction, Notifications and Resources.
- Defined one taskbar meaning: the badge represents a new unacknowledged actionable cue.
- Made acknowledgement clear the app badge and Pacefold notifications without completing the underlying cue; Done remains an explicit exactly-once action.
- Added first-pulse acknowledgement, second-interaction control disclosure, focus acknowledgement and clean actionable window titles.
- Added Current, Capture, Notebook and Media PWA shortcuts to available manifests.
- Replaced SVG-only notification delivery with generated source-specific PNG artwork for more dependable Windows rendering.
- Added `Ctrl+Shift+Space`, `/` and `Escape` keyboard paths for controls, Capture and dismissal.
- Added dark, light, reduced-motion and 390 px layouts with a dock-height ceiling of 60 px and no horizontal overflow.
- Retained the full 15.7.1 lossless storage, setup lifecycle, OneNote settlement and diagnostic hardening gates.
- Added an independent integrated browser and visual audit covering exact architecture, slash capture, taskbar acknowledgement, second interaction, explicit completion, Notebook proxying, root restoration, launch shortcuts, clean cue labels and desktop/mobile screenshots.

## 15.7.1 — Lossless lifecycle hardening

- Preserved malformed notebook data whenever both local and session recovery writes fail instead of deleting the only copy.
- Added entry-count and payload-size bounds, missing-ID repair, dual-store recovery pruning and truthful recovery notices.
- Deduplicated repeated diagnostics, redacted URLs, email addresses and credential-like values, and added a session-storage journal fallback.
- Bound OneNote busy state and the cross-window lease to the real adapter promise, sharing identical in-flight page sends and timing out hung requests safely.
- Narrowed setup text detection so normal content containing “get started” cannot hide Pacefold.
- Made setup-exit recovery non-starvable, added bounded fresh-remount retries and aligned the legacy embedded detector at the reconciliation boundary without hiding real onboarding.
- Repaired duplicate roots deterministically and refused unsafe service-worker cleanup or incomplete runtime version substitution.
- Split release validation into core, construction, notebook/integration and destructive resilience gates with retained diagnostic artifacts.
- Added failure injection for storage quota exhaustion, setup flapping, ordinary setup-like text, duplicate roots, duplicate OneNote requests and repeated sensitive errors.

## 15.7.0 — Resilience hardening

- Aligned the guardian with the core’s real `data-onboard-profile` and `.onboarding-option` setup controls so the lower workspace cannot reappear over onboarding.
- Discarded preserved pre-setup roots and rebuilt the workspace after setup rather than reattaching stale event/state trees.
- Added focus, visibility and bfcache reconciliation for installed-app restores and body replacement.
- Reordered startup to guardian → resilience preflight → Notebook runtime using deterministic `defer` scripts.
- Added pre-start notebook storage validation, bounded recovery copies, malformed JSON quarantine and normalization of legacy entries without a section.
- Added duplicate guards for capture, save, delete, completion, cue, provider and OneNote actions.
- Added a cross-window lease so two Pacefold windows cannot submit the same OneNote page concurrently.
- Added a bounded privacy-trimmed local resilience error journal.
- Replaced accumulating service-worker tails with explicit removable BEGIN/END blocks and an idempotent notification wrapper guard.
- Removed overlay-owned cache deletion so the verified core remains the sole owner of Pacefold offline caches.
- Expanded CI to inject the release twice and simulate real setup transitions, stale-root rejection, corrupt storage, legacy normalization, duplicate submissions, cross-window sync, repeated provider loads, exactly-once cues and mobile recovery.

## 15.6.0 — Notebook corrective release

- Fixed the setup regression by preventing the injected workspace from mounting over onboarding and making the guardian remove rather than resurrect the rail while setup is visible.
- Added an IndexedDB recovery snapshot for configured Pacefold state so an unexpected localStorage loss does not silently force a configured installation back through setup.
- Replaced the lightweight Fold Stack with a real dated HSSys notebook organized into Daily, Follow-ups, Incidents, Inspections, JHSC, Construction, Notifications and Resources.
- Added notebook search, date navigation, section tabs, editing, completion, deletion and migration of existing local captures.
- Restored optional Microsoft OneNote delivery through an existing Pacefold adapter or already-connected MSAL session, with a retry-safe local queue, Windows Share and copy-page fallbacks.
- Made the Amazon Music field editable and added strict parsing for official regional Amazon Music URLs, tracking-parameter cleanup and best-effort contained playback of the exact saved playlist, album, station or track URL.
- Simplified the bottom layout to one compact rhythm/capture row and one lowest-edge music row; notebook, player, weather and diagnostics open only when requested.
- Removed provider popup-escape permission, retained strict CSP/domain validation and added local-audio drag-and-drop.
- Expanded CI to reject unknown/dead buttons, setup overlap, Amazon read-only behaviour, sandbox escape permission, invalid OneNote payloads, hostile provider URLs, duplicate cue handling, guardian failure and 390 px overflow.

## 15.5.0 — Origami embedded hub

- Replaced external music-service launch buttons with a single Pacefold Player sheet that keeps local audio, official YouTube embeds, official Spotify embeds and an Amazon Music compatibility frame inside Pacefold.
- Added strict provider URL parsing, official-domain allowlists, sandboxed iframes, `no-referrer`, and CSP frame restrictions; Pacefold stores no provider passwords, cookies, OAuth tokens or access tokens.
- Removed the OneNote/Graph/OneDrive-folder/export notebook workflow from the user experience and replaced it with lightweight local “Folds” that can be completed or deleted.
- Added a custom Pacefold origami mark throughout the persistent strip, expanded surfaces and fallback artwork.
- Added source-specific notification artwork for hydration, eye care, movement, prayer, meals, preparation and away time, applied at the service-worker notification boundary.
- Preserved one Andon action, badge acknowledgement without false completion, current-cue arbitration, cached weather, local diagnostics and guardian restoration.
- Added browser gates proving that no music action opens an external window, only approved iframe origins load, notebook language is absent, Folds persist, notification mappings exist and the surface remains responsive at 390 px.

## 15.4.0 — Kanso corrective redesign

- Removed the redundant three-card Hub, duplicate Capture/Care/Weather tab system introduced in 15.3.
- Replaced the standalone Care destination with one Andon-style action that translates the live core cue into Hydrate, Look far, Move, Prayer, Meal, Prepare or Step away.
- Rebuilt the persistent bottom surface around one always-open Kiroku capture field and one quiet media rail using scalable line icons, host-aware light/dark material and restrained contextual motion.
- Kept OneNote available through Windows Share while retaining clipboard, Markdown export and optional OneDrive-synced folder filing; removed the redundant permanent OneNote mini-app/button.
- Separated taskbar-badge acknowledgement from cue completion so focusing Pacefold clears the Windows indicator without silently completing the underlying action.
- Added cached forecast loading, lazy radar, request timeouts and offline fallback so radar no longer loads during every Pacefold start.
- Reduced mutation-observer work by ignoring Kanso-owned changes and coalescing host scans to animation frames; bounded guardian restoration work as well.
- Removed Kanso injection from the public landing page and limited the interactive surface to `/app/`.
- Added local diagnostics, drag-and-drop audio, Media Session controls, keyboard shortcuts and expanded browser gates for architecture, lazy weather, badges, guardian restoration and 390 px responsive layout.

## 15.3.0 — Persistent work hub

- Added an always-visible capture strip and a bottom-edge mini-player so the most-used tools remain available without turning Pacefold into a full dashboard.
- Replaced the OneNote-only synchronization path with a local-first Capture Bridge: optional OneDrive-synced Markdown folder append, Windows Share, clipboard copy and dated Markdown export.
- Reduced ergonomics to three explicit, large care resets—distance look, movement and posture—with no stacked missed-break debt.
- Added a compact three-day forecast and latest-radar glance, plus a direct route to the full MSN Weather experience.
- Replaced cryptic miniature action icons with larger labeled controls and contextual animation only while attention is genuinely required.
- Added focus-based app-badge clearing and a visible waiting action that attempts to clear or log the current Pacefold cue before clearing the taskbar state.
- Preserved the checksum-verified 15.2.1 rhythm core and added a separate Hub version gate, injection step and Playwright smoke audit before deployment.

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
- Kept the durable service-worker queue, reload survival and exactly-once local logging checks unchanged.

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

- Added location-aware prayer/Qiblah calculations and consolidated application source.
