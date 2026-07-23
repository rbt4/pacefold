# Pacefold

**Your day, quietly kept.**

Pacefold is a local-first, installable workday rhythm system. The verified core keeps the clock, schedule and one next useful action primary. Pacefold Kanso 15.4 removes the redundant Hub/dashboard layer and adds one restrained work strip underneath the core.

## Pacefold Kanso 15.4

- **One surface, not several mini-apps:** the old three-card Hub and duplicate Capture/Care/Weather tabs are gone. Capture and audio remain persistent; everything else opens in one contextual drawer.
- **Andon action:** one large readable state translates the live core cue into Hydrate, Look far, Move, Prayer, Meal, Prepare or Step away. Animation appears only while a real action is waiting.
- **Always-open Kiroku capture:** notes, follow-ups, incidents, meetings and resources save locally without leaving the clock. `Ctrl+Shift+Space` focuses capture from anywhere in the app.
- **OneNote without fragile Graph dependence:** Windows Share can send the daily Markdown to OneNote, while clipboard, dated Markdown export and an optional OneDrive-synced folder remain available. There is no redundant OneNote mini-app or permanent OneNote button.
- **Quiet media rail:** local audio, drag-and-drop, progress, volume and Media Session controls remain at the lowest edge. YouTube Music, Spotify and Amazon Music are honest external launch options rather than pretend embedded players.
- **Weather as context:** a small cached temperature glance stays visible. The three-day forecast and radar open only when requested; radar no longer loads during every Pacefold start.
- **Behavioural Japanese influence:** Ma preserves space, Kanso removes duplication, Andon communicates one exception, and Kaizen records small useful actions without punitive backlog. There is no fake decorative Japan theme.
- **Host-aware visual system:** the surface adapts to light/dark host themes, time of day and broad weather state using restrained material, larger custom line icons and contextual motion.
- **Local diagnostics only when needed:** storage, secure context, folder bridge, service worker, notifications and surface errors are available behind a warning indicator that remains hidden when healthy.

## Corrective reliability work

- Landing-page injection was removed; Kanso loads only in `/app/`.
- Badge acknowledgement is separated from cue completion: focusing Pacefold clears the Windows badge but does not silently complete the live action.
- The document observer ignores Kanso-owned mutations and coalesces cue/legacy scans to one animation frame.
- Forecast uses a 20-minute local cache; radar is lazy, cached separately and timeout-bounded.
- Redundant compact legacy Capture/Care/Sound/OneNote dock controls are suppressed only when they are clearly edge/dock shortcuts. Settings remain accessible.
- The guardian restores the surface after legacy body replacement without reacting to every internal surface update.
- Existing 15.3 capture, folder and volume data are preserved.

The detailed fault analysis is in [`AUDIT_15_4.md`](AUDIT_15_4.md).

## Core 15.2 reliability retained

- Quiet, non-persistent notifications with contextual Clear, Done or Log actions.
- Durable, deduplicated service-worker action queue.
- Live-session hydration, distance-look and movement cadence without late-launch backlog.
- Focused Today, Rhythm, Tools and App settings.
- Nine profiles, preparation routines, prayer calculations, meals, personal pauses and the private ledger.

## Honest Windows boundary

Microsoft Edge PWAs support taskbar badges, notification actions and right-click shortcuts. Windows does not let a website intercept a normal pinned-icon click before opening/focusing the app, distinguish single from double taskbar clicks, or continuously redraw the pinned icon face. Pacefold therefore clears the badge when the app receives focus and keeps the real action visible in the Andon surface until it is handled. Exact pre-focus single-click/double-click/live-icon behaviour requires a native Windows tray companion.

## Default developer profile

The default preset remains Muslim calculated prayer times, Hanafi Asr, Toronto defaults, noodle preparation, desk-meal flow, hydration, away-break and private day-close logging.

## Repository release format

The tested core source tree remains stored as a checksum-verified Base64 release under `release/`. GitHub Actions reconstructs it, verifies SHA-256, runs the existing syntax/static/notification/offline/installed-upgrade browser suite, injects Kanso from `enhancements/`, and then runs a dedicated browser audit for architecture, capture, lazy weather, badge acknowledgement, guardian restoration and responsive layout.

Core release SHA-256:

`50c4c2787300102704d577e6e221909e307866522d59422d13871a55085d63e7`

Kanso version:

`15.4.0`

## Install

1. Open `https://rbt4.github.io/pacefold/` in Microsoft Edge.
2. Complete setup and install Pacefold through Edge **… → Apps → Install Pacefold** when needed.
3. Pin the installed app.
4. Fully close and reopen the installed app once after the 15.4 deployment so the service worker activates the new shell. Reinstall only if Edge still serves the older shell after a full close and reopen.

## Privacy

No Pacefold account, analytics or advertising. Activity records, captures, notification-action history, preferences and diagnostics remain on the device. Weather requests contain only the configured forecast coordinates. Folder synchronization starts only after the user selects a folder and grants write access; Pacefold writes dated Markdown files there and does not receive access to the rest of OneDrive.

## Version

Pacefold Kanso 15.4.0 over Pacefold core 15.2.1
