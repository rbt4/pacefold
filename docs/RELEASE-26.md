# Pacefold 26.0.0

Pacefold 26 changes the Clock from a navigation hub back into the ambient surface the app is meant to be.

## What moved

- The installed-window title bar is draggable again under Window Controls Overlay, with protected no-drag controls and system-button clearance.
- Windows notifications now use raster cue-specific icons and offer both Clear and Snooze 10m.
- Cue acknowledgement and snooze state is persisted in IndexedDB so notification actions survive a closed app window.
- Periodic Background Sync is registered when the installed browser grants the capability; the worker can recompute due cues from the mirrored local cue plan and deliver them without an open page. Unsupported/denied environments fall back silently to open-window cue delivery.
- The app bar keeps a stable cue footprint. Waiting cues also appear as time-positioned colour notches on the analog dial and can be cleared or snoozed without leaving Clock.
- Window Controls Overlay gets a three-pixel segmented cue strip and the neutral title `● Pacefold — N waiting` while cues are pending.
- Clock rhythm presentation now has Names, Neutral, and Hidden modes. Neutral is the default. It removes prayer names, location, calculation method, Asr method, and timezone from the Clock surface while preserving the schedule in Now and Settings. A deliberate hold/hover temporarily reveals names for six seconds.
- Day Unfold is now an SVG 600×120 arc. The sun moves along a real curve on a minute cadence, with progress, sky interpolation, glow/shadow, before/after-work positions, off-day treatment, and markers placed from the same path.
- Desktop edge navigation is now a set of delayed live preview rails with equivalent keyboard-focus behavior. Touch layouts use a separate bottom navigation component rather than sticky hover CSS.
- Daybook is a capture surface on Clock: Enter saves, Shift+Enter adds a line, context is attached automatically, open Follow-up/JHSC notes carry forward, pinned notes remain visible, and the two most recent notes are readable in place.
- Notes can be edited inline with an explicit dirty/saved state. Categories use counted chips and the new-note category set is editable in Settings.
- Day Log events link back to notes by note ID, with a same-minute fallback for older data.
- Rendering is scoped to the visible view. Hidden pages no longer rebuild on each tick, and hidden documents stop the one-second loop until a wall-clock catch-up on visibility return.
- Prefs, notes, dayflow, and cue state now have explicit v1 stored shapes with forward-only legacy migration.

## What changed underneath

- The hand-minified 25.1 runtime source is gone.
- Authoring source is split into readable modules under `src/modules/` and readable style additions under `src/styles/`.
- CI bundles modules with pinned esbuild and concatenates styles into one minified runtime and one shipped stylesheet.
- Source modules and helper core files are removed from the shipped site.
- A dedicated Pacefold 26 regression contract tests discretion, cue notches, edge keyboard previews, Clock capture/context, carry-forward, inline editing, Day Log note links, storage versions, SVG Day Unfold, WCO cue chrome, touch navigation, and closed-window worker behavior.

## Platform boundary kept explicit

A PWA cannot draw arbitrary per-cue coloured overlays on the Windows taskbar icon. Pacefold keeps the supported app badge count, uses cue-specific colour in Windows notification icons, uses colour notches inside the Clock, and uses a segmented cue strip inside Window Controls Overlay. It does not pretend the Windows taskbar itself is programmable from a PWA.
