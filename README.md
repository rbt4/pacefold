# Pacefold

**One day, gently folded.**

Pacefold is a local-first, installable workday rhythm system. The verified core keeps the clock, schedule and one next useful action primary. Pacefold Notebook 15.6 corrects the 15.5 regressions and rebuilds the lower workspace around a real dated notebook, optional OneNote synchronization and a contained player.

## Pacefold Notebook 15.6

- **Setup is isolated:** the Pacefold rail does not mount over onboarding. If setup appears, the rail and forced body padding are removed. A small IndexedDB recovery snapshot can restore configured Pacefold state when browser storage is unexpectedly lost.
- **A real HSSys notebook:** entries are organized by date and section—Daily, Follow-ups, Incidents, Inspections, JHSC, Construction, Notifications and Resources—with search, editing, completion and deletion.
- **Capture stays always open:** choose a notebook section, type once and save without leaving Today.
- **OneNote is optional, not required:** local save is always first. A retry-safe page queue can use an existing Pacefold OneNote adapter or an already-connected Microsoft authentication session. Windows Share and page copy remain available as honest fallbacks.
- **Amazon accepts your playlist URL:** paste an official Amazon Music playlist, album, station or track URL. Pacefold removes tracking parameters, saves the cleaned link and attempts to display that exact page inside the sandboxed player.
- **Contained media:** YouTube Music and Spotify use official embeds. Amazon remains best-effort because Amazon may block third-party framing. Pacefold never automatically opens an external player window.
- **Quieter layout:** one compact rhythm/capture row and one music row sit at the bottom. The larger notebook, player, weather and diagnostics open only when requested.
- **Origami notification identity retained:** hydration, eye care, movement, prayer, meals, preparation and away time retain distinct source artwork.

## Reliability and security

- Every rendered Pacefold button must map to a registered action; CI fails on unknown or dead controls.
- Provider URLs are restricted to official allowlists and tracking parameters are stripped.
- Player frames use `no-referrer`, a narrow Content Security Policy and a sandbox that cannot escape through popups.
- Pacefold does not store provider passwords, provider cookies or Microsoft access tokens.
- Notebook entries remain local even when OneNote is unavailable; failed syncs remain queued rather than blocking capture.
- Badge acknowledgement remains separate from actual cue completion.
- The setup-aware guardian restores the workspace only when onboarding is absent.
- The complete core offline, notification-action and installed-upgrade suite runs before the Notebook-specific browser audit.

## OneNote bridge

Pacefold 15.6 does not invent a second Microsoft login screen. It uses one of these paths, in order:

1. An existing Pacefold OneNote adapter exposed by the verified application.
2. An already-connected MSAL session with `Notes.Create` and `Notes.ReadWrite` consent.
3. Windows Share, where OneNote can be selected.
4. Copy page for manual paste.

The intended destination is the **HSSys** notebook and a **Pacefold** section. Local capture never depends on Microsoft connectivity.

## Honest platform boundaries

Microsoft Edge PWAs support taskbar badges, notification actions and right-click shortcuts. Windows does not let a website intercept a normal pinned-icon click before focus, distinguish single from double taskbar clicks, or continuously redraw the pinned icon face. Exact pre-focus taskbar behaviour requires a native Windows companion.

Amazon Music does not provide the same broadly available iframe playback contract as YouTube or Spotify. Pacefold can preserve and attempt to contain your official Amazon URL, but Amazon can still refuse to render it inside another application.

## Core reliability retained

- Quiet, non-persistent notifications with contextual Clear, Done or Log actions.
- Durable, deduplicated service-worker action queue.
- Live-session hydration, distance-look and movement cadence.
- Nine profiles, preparation routines, prayer calculations, meals and personal pauses.
- Default Muslim profile with Hanafi Asr, Toronto defaults, noodle preparation, desk meals, hydration and away breaks.

## Repository release format

The tested core source tree remains stored as a checksum-verified Base64 release under `release/`. GitHub Actions reconstructs it, verifies SHA-256, runs the existing core suite, materializes the Notebook surface from compressed reviewable source, injects it into `/app/`, and then audits setup isolation, all buttons, notebook persistence/editing, OneNote payloads, Amazon URL handling, provider containment, cue semantics, guardian recovery and 390 px layout.

Core release SHA-256:

`50c4c2787300102704d577e6e221909e307866522d59422d13871a55085d63e7`

Notebook version:

`15.6.0`

## Install

1. Open `https://rbt4.github.io/pacefold/` in Microsoft Edge.
2. Complete setup before installing or using the lower workspace.
3. Install through **… → Apps → Install Pacefold** and pin it when desired.
4. Fully close and reopen the installed application once after deployment so the new service worker and 15.6 shell activate.

## Privacy

No Pacefold account, analytics or advertising. Rhythm data, notebook entries, sync queue, preferences and diagnostics remain on the device. Weather requests contain forecast coordinates. Provider playback is delivered directly by the selected official provider. Microsoft page content is sent only when OneNote synchronization or Windows Share is explicitly enabled.

## Version

Pacefold Notebook 15.6.0 over Pacefold core 15.2.1
