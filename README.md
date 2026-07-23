# Pacefold

**Your day, quietly kept.**

Pacefold is a local-first, installable workday rhythm system. Version 15.3 keeps the clock and the next useful action visually dominant, then places Capture, Care, Sound and Weather in one persistent work strip instead of scattering them across separate mini-apps.

## Pacefold Hub 15.3

- **Always-open capture strip:** note, follow-up, incident, meeting and resource capture remains visible at the bottom without opening a tool panel.
- **Capture Bridge instead of OneNote dependence:** every item saves locally first, then can append to a selected OneDrive-synced Markdown folder, use Windows Share, copy to the clipboard or export as a dated Markdown file. OneNote remains an optional destination rather than a fragile sign-in requirement.
- **Persistent mini-player:** local audio controls stay at the lowest edge of the app, with direct launch options for YouTube Music, Spotify and Amazon Music.
- **Care without the bloat:** eye distance, movement and posture are reduced to three large, explicit reset actions. Pacefold does not manufacture missed-break debt or turn ergonomics into a second dashboard.
- **Weather glance:** a compact three-day forecast and latest radar preview live inside the hub, while the full weather experience opens in MSN Weather.
- **Readable action state:** one large contextual waiting indicator replaces cryptic mini-icons. Opening/focusing Pacefold clears the app badge, and the visible action can also clear or log the current cue.
- **Contextual motion only:** icons are larger and labeled; animation appears only while an action is waiting or has just been completed.
- **Audited core preserved:** prayer/rhythm profiles, preparation routines, hydration, meals, personal pauses, settings migration and the private ledger continue to run from the checksum-verified 15.2.1 core.

## Core 15.2 reliability retained

- **Quiet notifications:** alerts are silent, non-persistent and carry one context-aware Clear, Done or Log action without forcing Pacefold to the foreground.
- **Durable action queue:** notification actions survive reloads and are deduplicated before changing local records.
- **No late-launch debt:** hydration, distance-look and movement cadence begin from the live session instead of creating an instant reminder backlog.
- **Focused settings:** Today, Rhythm, Tools and App replace the previous 4,700-pixel single sheet.
- **Original rhythm preserved:** nine profiles, configurable preparation routines, hydration, meals, personal pauses and the private ledger remain.

## Honest Windows boundary

Microsoft Edge PWAs support taskbar badges, notification actions and right-click shortcuts. Windows does not let a website intercept a normal pinned-icon click before opening/focusing the app, distinguish single from double taskbar clicks, or continuously redraw the pinned icon face. Pacefold therefore clears the badge as soon as the app receives focus and exposes the current action inside the persistent strip. Exact pre-focus single-click/double-click/live-icon behaviour still requires a native Windows tray companion.

## Default developer profile

The default preset remains Muslim calculated prayer times, Hanafi Asr, Toronto defaults, noodle preparation, desk-meal flow, hydration, away-break and private day-close logging.

## Repository release format

The exact tested core source tree remains stored as a checksum-verified Base64 release under `release/`. GitHub Actions reconstructs the ZIP, verifies SHA-256, runs syntax/static checks and the existing browser upgrade/action/offline audit, injects the separately versioned Hub layer from `enhancements/`, and then runs an additional real-browser Hub smoke test before Pages deployment.

Core release SHA-256:

`50c4c2787300102704d577e6e221909e307866522d59422d13871a55085d63e7`

Hub version:

`15.3.0`

## Install

1. Open `https://rbt4.github.io/pacefold/` in Microsoft Edge.
2. Complete setup and install Pacefold through Edge **… → Apps → Install Pacefold** when needed.
3. Pin the installed app.
4. Reopen the installed app once after the 15.3 deployment so its service worker activates the new shell. Reinstall only if Edge continues to serve an older manifest or shell after a full close and reopen.

## Privacy

No Pacefold account, analytics or advertising. Activity records, captures, notification-action history and settings remain on the device. Weather requests contain only the configured forecast coordinates. Folder synchronization occurs only after the user selects a folder and grants write access; Pacefold writes dated Markdown files there and does not receive access to the rest of OneDrive.

## Version

Pacefold Hub 15.3.0 over Pacefold core 15.2.1
