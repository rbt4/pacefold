# Pacefold

**One day, gently folded.**

Pacefold is a local-first, installable workday rhythm system. The verified core keeps the clock, schedule and one next useful action primary. Pacefold Origami 15.5 turns the bottom surface into one coherent place for rhythm, quick Folds, weather and music without launching separate mini-apps.

## Pacefold Origami 15.5

- **Pacefold Player stays inside Pacefold:** local audio, YouTube and Spotify render inside the Pacefold sheet. URLs are parsed and converted only to official provider embed origins; arbitrary domains and external launch buttons are rejected.
- **Amazon Music compatibility frame:** Amazon Music remains inside a contained frame rather than opening another tab. Amazon’s generally available embedded-player support is limited, so the frame is best-effort and may be blocked by Amazon until its closed-beta Web Playback APIs become broadly available.
- **Folds, not a notebook:** the OneNote/Graph/folder/export concept is removed. The always-open field creates tiny local “Folds” that can be completed or removed without turning Pacefold into a document manager.
- **Origami identity:** a custom folded Pacefold mark now anchors the strip, expanded player, Fold Stack and fallback notification artwork.
- **Notification artwork that explains itself:** hydration, eye care, movement, prayer, meals, preparation and away time each receive distinct source-specific origami artwork instead of one ambiguous symbol.
- **One attention state:** the Andon surface still translates the newest active core cue into Hydrate, Look far, Move, Prayer, Meal, Prepare or Step away.
- **Weather remains context:** a cached temperature glance and three-day forecast stay inside Pacefold without becoming a second weather application.

## Security and error containment

- No OneNote, Microsoft Graph, OneDrive-folder permission or stored OAuth token.
- Provider URLs are validated against strict official-domain allowlists.
- Embedded providers use sandboxed iframes, `no-referrer`, and a narrow Content Security Policy.
- Pacefold never stores provider passwords, authentication cookies or access tokens.
- Local audio is played from a temporary object URL and is never uploaded.
- Surface errors are recorded locally without capture text or account data.
- Focusing Pacefold acknowledges the Windows badge but does not silently complete a real cue.
- The guardian restores the surface after core body replacement without duplicating it.

## Core 15.2 reliability retained

- Quiet, non-persistent notifications with contextual Clear, Done or Log actions.
- Durable, deduplicated service-worker action queue.
- Live-session hydration, distance-look and movement cadence without late-launch backlog.
- Focused Today, Rhythm, Tools and App settings.
- Nine profiles, preparation routines, prayer calculations, meals, personal pauses and the private ledger.

## Honest platform boundaries

Microsoft Edge PWAs support taskbar badges, notification actions and right-click shortcuts. Windows does not let a website intercept a normal pinned-icon click before opening/focusing the app, distinguish single from double taskbar clicks, or continuously redraw the pinned icon face. Exact pre-focus single-click/double-click/live-icon behaviour still requires a native Windows tray companion.

YouTube and Spotify provide official iframe players. Amazon Music’s full Web Playback APIs remain a closed beta, so Pacefold cannot honestly promise the same level of embedded Amazon playback without Amazon developer approval. Pacefold does not bypass provider restrictions or redirect the user out of the application.

## Default developer profile

The default preset remains Muslim calculated prayer times, Hanafi Asr, Toronto defaults, noodle preparation, desk-meal flow, hydration, away-break and private day-close logging.

## Repository release format

The tested core source tree remains stored as a checksum-verified Base64 release under `release/`. GitHub Actions reconstructs it, verifies SHA-256, runs the existing syntax/static/notification/offline/installed-upgrade browser suite, injects Origami from `enhancements/`, and then audits internal provider containment, Fold persistence, notification artwork, cue completion, guardian restoration and responsive layout.

Core release SHA-256:

`50c4c2787300102704d577e6e221909e307866522d59422d13871a55085d63e7`

Origami version:

`15.5.0`

## Install

1. Open `https://rbt4.github.io/pacefold/` in Microsoft Edge.
2. Complete setup and install Pacefold through Edge **… → Apps → Install Pacefold** when needed.
3. Pin the installed app.
4. Fully close and reopen the installed app once after the 15.5 deployment so the service worker activates the new shell and notification artwork.

## Privacy

No Pacefold account, analytics or advertising. Activity records, Folds, notification-action history, preferences and diagnostics remain on the device. Weather requests contain only the fixed forecast coordinates. Provider playback is delivered directly by the selected official provider inside its sandboxed frame.

## Version

Pacefold Origami 15.5.0 over Pacefold core 15.2.1
