# Pacefold

**One day, gently folded.**

Pacefold is a local-first, installable workday rhythm system. The verified core keeps the clock, schedule and one next useful action primary. Pacefold Resilience 15.7 hardens the 15.6 HSSys notebook, optional OneNote bridge and contained player without adding another dashboard or changing the quiet workday vision.

## Pacefold Resilience 15.7

- **Setup cannot be covered or resurrected:** the guardian recognizes the core’s real onboarding controls, removes the lower workspace during setup and discards stale pre-setup roots instead of reattaching them later.
- **Ordered startup:** guardian, recovery preflight and Notebook runtime load as ordered `defer` scripts. Damaged local notebook data is handled before the Notebook can parse it.
- **Recoverable notebook storage:** malformed JSON is backed up to a bounded recovery slot, invalid active data is removed safely, and legacy entries without a section are normalized to Daily.
- **Duplicate-action protection:** rapid repeated capture, save, delete, completion, cue, provider and sync actions are suppressed rather than applied twice.
- **Cross-window OneNote protection:** two open Pacefold windows cannot send the same HSSys page simultaneously.
- **Bounded diagnostics:** Pacefold keeps only the latest 20 privacy-trimmed resilience errors and removes URLs from stored messages.
- **Idempotent updates:** repeated injection replaces the previous overlay assets and service-worker patch instead of stacking wrappers.
- **Core caches remain owned by the core:** the Notebook notification artwork layer no longer deletes Pacefold caches during activation.

## HSSys notebook and capture

Entries are organized by date and section—Daily, Follow-ups, Incidents, Inspections, JHSC, Construction, Notifications and Resources—with search, editing, completion and deletion. Capture remains always open in the compact lower rail.

Local persistence always completes before an optional OneNote delivery. The intended Microsoft destination remains the **HSSys** notebook and a **Pacefold** section.

## OneNote bridge

Pacefold uses these paths in order:

1. An existing Pacefold OneNote adapter exposed by the verified application.
2. An already-connected MSAL session with `Notes.Create` and `Notes.ReadWrite` consent.
3. Windows Share, where OneNote can be selected.
4. Copy Page for manual paste.

Failed deliveries remain local and retryable. Pacefold does not store Microsoft passwords or access tokens.

## Contained player

- YouTube Music and Spotify use official embeds.
- Amazon accepts an official regional playlist, album, station or track URL, removes tracking parameters and preserves that exact cleaned link.
- Amazon playback remains best-effort because Amazon can refuse third-party framing.
- Pacefold never automatically opens an external player window.
- Local audio remains on-device and supports picker and drag-and-drop paths.

## Reliability and security

- Every rendered Pacefold button must map to a registered action.
- Provider URLs are restricted to official allowlists.
- Player frames use `no-referrer`, a narrow Content Security Policy and a sandbox that cannot escape through popups.
- Badge acknowledgement remains separate from actual cue completion.
- Origami notification artwork remains distinct for hydration, eyes, movement, prayer, meals, preparation and away time.
- The overlay notification wrapper is guarded so it can be applied only once per worker.
- The complete core offline, notification-action and installed-upgrade suite runs before the Resilience-specific failure-injection audit.

## Honest platform boundaries

Microsoft Edge PWAs support taskbar badges, notification actions and right-click shortcuts. Windows does not let a website intercept a normal pinned-icon click before focus, distinguish single from double taskbar clicks, or continuously redraw the pinned icon face. Exact pre-focus taskbar behaviour requires a native Windows companion.

Amazon Music does not provide the same generally available iframe playback contract as YouTube or Spotify. Pacefold can preserve and attempt to contain an official Amazon URL, but Amazon can still refuse to render it inside another application.

## Core reliability retained

- Quiet, non-persistent notifications with contextual Clear, Done or Log actions.
- Durable, deduplicated service-worker action queue.
- Live-session hydration, distance-look and movement cadence.
- Nine profiles, preparation routines, prayer calculations, meals and personal pauses.
- Default Muslim profile with Hanafi Asr, Toronto defaults, noodle preparation, desk meals, hydration and away breaks.

## Repository release format

The tested core source tree remains stored as a checksum-verified Base64 release under `release/`. GitHub Actions reconstructs it, verifies SHA-256, runs the original core suite, materializes the Notebook surface, injects the resilience layer twice to prove idempotency, and then tests real setup isolation, stale-root rejection, malformed storage recovery, duplicate capture/sync/provider actions, cross-window sync, OneNote payloads, provider containment, cue semantics, guardian recovery and 390 px layout.

Core release SHA-256:

`50c4c2787300102704d577e6e221909e307866522d59422d13871a55085d63e7`

Resilience version:

`15.7.0`

## Install

1. Open `https://rbt4.github.io/pacefold/` in Microsoft Edge.
2. Complete setup before installing or using the lower workspace.
3. Install through **… → Apps → Install Pacefold** and pin it when desired.
4. Fully close and reopen every Pacefold window once after deployment so the 15.7 worker and ordered shell replace the cached release.

## Privacy

No Pacefold account, analytics or advertising. Rhythm data, notebook entries, recovery copies, sync queue, preferences and diagnostics remain on the device. Weather requests contain forecast coordinates. Provider playback is delivered directly by the selected official provider. Microsoft page content is sent only when OneNote synchronization or Windows Share is explicitly enabled.

## Version

Pacefold Resilience 15.7.0 over Pacefold core 15.2.1
