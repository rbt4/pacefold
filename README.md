# Pacefold

**Your day, quietly kept.**

Pacefold is a local-first, installable workday rhythm system. Version 15 keeps the clock visually dominant while adding a quiet Capture, Care, Sound and OneNote layer.

## Pacefold 15.1

- **Functional taskbar surface:** the installed-app badge shows minutes to the next cue, then a dot when action is waiting.
- **Notification actions:** context-aware Log, Done, Acknowledge, Start and Snooze controls work without focusing Pacefold.
- **Durable action queue:** notification clicks survive reloads and are deduplicated before changing local records.
- **Better visual language:** distinct notification icons for moments, hydration, preparation, away time, meals, eye care, movement and diagnostics.
- **Right-click shortcuts:** Log / clear current cue, Capture, Care and Sound.
- **Live clock surface:** the browser tab/app-window favicon renders the current time; Edge keeps pinned icon artwork static.
- **Kiroku capture:** notes, follow-ups, incidents, inspections, JHSC, construction, notifications, meetings and resources save locally first.
- **Optional Microsoft OneNote:** delegated `Notes.ReadWrite`, selected HSSys notebook/section, one dated page per day, offline queue and duplicate-safe retry.
- **Care and Sound:** break-aware 20-20-20/movement resets plus offline/local/direct focus audio and cue ducking.
- **Original rhythm preserved:** nine profiles, configurable preparation routines, hydration, meals, personal pauses and the private ledger remain.

## Honest Windows boundary

Microsoft Edge PWAs support taskbar badges, notification actions and right-click shortcuts. Windows does not let a website intercept a normal pinned-icon click before opening/focusing the app, distinguish single from double taskbar clicks, or continuously redraw the pinned icon face. Exact single-click/double-click/live-icon behaviour requires a native Windows tray companion.

## Default developer profile

The default preset remains Muslim calculated prayer times, Hanafi Asr, Toronto defaults, noodle preparation, desk-meal flow, hydration, away-break and private day-close logging.

## Repository release format

The exact tested source tree is stored as a checksum-verified Base64 release under `release/`. GitHub Actions reconstructs the ZIP, verifies SHA-256, rejects a non-advanced version, runs syntax/static checks and a real browser upgrade/action/offline audit, and only then deploys a clean Pages artifact.

Release SHA-256:

`ba417bfc5f93871d4f57322842f5ea3f7f1cfb59c5ed237c582972ad71119c88`

## Install

1. Open `https://rbt4.github.io/pacefold/` in Microsoft Edge.
2. Complete setup and install Pacefold through Edge **… → Apps → Install Pacefold** when needed.
3. Pin the installed app.
4. Right-click its icon for Pacefold quick actions. If Edge has not refreshed the new shortcuts, reopen the installed app; reinstall only if the old manifest remains stuck.

## Privacy

No Pacefold account, analytics or advertising. Activity records, notification-action history and settings remain on the device. Microsoft Graph is contacted only after optional OneNote configuration and sign-in; only written captures are synchronized.

## Version

Pacefold 15.1.2
