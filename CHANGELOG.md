# Changelog

## 27.1.0 — Final Form

- Consolidated the conception-to-current product invariants into `docs/ORIGIN_TO_FINAL.md` so future cleanup cannot silently erase original behavior.
- Preserved the giant daily-image Clock surface while locking it as a true single-screen surface instead of allowing scroll-through into the underlying app.
- Restored the original-profile **Noodles** timer identity while retaining generic **Prep** for other profiles.
- Integrated the original Brown hush, Rain glass, Soft fan and local-audio focus sounds inside the current Music picker.
- Kept YouTube/YouTube Music playlist playback, direct track selection, previous/next, seek, volume, shuffle, loop and local My Music.
- Added My Music/stream state to JSON and live backups and restore.
- Expanded custom-moment editing to all eight slots already supported by storage migration, preventing hidden rows from being lost during settings changes.
- Extended weather to a two-day horizon so the near-term rain window remains meaningful across midnight.
- Upgraded the live clock favicon/taskbar identity to carry several waiting cue colours instead of only the highest-priority cue.
- Corrected privacy-setting copy so Clock and Now accurately describe the same discretion rules.
- Expanded self-check coverage for the start surface, privacy, custom moments, Music/focus integration and My Music backup.
- Rolled the production service-worker cache while retaining durable cue and backup-handle databases.

## 27.0.0 — Clock-first surface and integrated player

- Made the giant Clock the dominant start surface over a locally packed daily Bing image.
- Added the Google/address omnibox and quick note without turning the start surface into another dashboard.
- Hardened rhythm discretion across Clock, Now, cue dots, window chrome and background cue mirrors.
- Refined Day Unfold, dial markers, cue contrast, weather context and same-point-yesterday Day Log comparison.
- Replaced the simple music link with an official YouTube IFrame API player for YouTube and YouTube Music links/playlists.
- Added playlist track selection, shuffle, loop and persistent local My Music.
- Added a live analog-clock favicon with discreet cue state.
- Added release/browser contracts for privacy, playlist interaction and desktop/mobile visuals.

## 26.0.0 — Re-integration

- Re-established Clock as the page left open during the day and strengthened the folding edge-navigation model.
- Re-integrated quiet cues, schedule context, Daybook and day-state presentation after V25 Recovery.
- Added explicit discretion controls for ambient schedule names and richer window-native cue behavior.

## 25.1.0 — Page refinement

- Reworked Notes with category filtering, monthly activity summaries, note insights and in-page editing.
- Added a Day Log narrative, work/away/meal/field balance strip, live session states and more readable timeline cards.
- Added a dedicated quiet-cue panel and timer controls to Now, with clearer next-moment guidance.
- Turned Settings into a control centre with setup summary cards, 12/24-hour selection and local data-health context.
- Improved mobile density, including a compact two-column quick-action dock and page-specific responsive layouts.
- Added a standard local build/preview/verify entrypoint and extended release validation for the refined surfaces.

## 25.0.0 — Recovery

- Replaced the layered V15–V24 production composition with one direct runtime and one app stylesheet.
- Made Clock the real initial document so no old product surface can flash before the current experience.
- Preserved established preference, notebook and day-log storage keys with explicit migration tests.
- Restored analog/digital time, live seconds, Day Unfold, the moving sun and schedule markers.
- Restored clock-centred directional navigation and deterministic return-to-Clock behavior.
- Rebuilt prayer/personal rhythm with timezone, location, Hanafi Asr, method, offsets and custom moments.
- Rebuilt coloured cue dots, silent notifications and taskbar/app badge updates.
- Rebuilt quick water, prep, away, meal, eye and movement actions with visible state and day-log writes.
- Rebuilt the calendar Daybook, search, editing, day log, focus blocks and daily export.
- Added versioned JSON restore plus an optional user-chosen live backup file.
- Restored a persistent local focus-sound bar and optional local-first OneNote copying.
- Replaced the historical service-worker asset list with the exact current shell.
- Added current desktop/mobile browser audits and visual captures for all five views.

## Earlier releases

V15–V24 remain in Git history. Their durable product ideas are summarized in `docs/ORIGIN_TO_FINAL.md`; their archive/injector implementation is intentionally not part of the current runtime.
# 30.0.0 — Quiet Clock

- merged the daily-image homepage and functional Clock into one atmospheric working surface
- removed the normal-launch cover barrier and the old startup flash path
- preserved Google/address search and quick note inside the working Clock
- rebuilt Clock hierarchy around one glass instrument, a compact rhythm rail, one guidance lane and six small actions
- standardized Notes, Day Log, Now and Settings on a warm-paper, high-contrast system even when the OS requests dark mode
- kept Notes above, Day Log left, Now right and Settings below with non-overlapping desktop and mobile folds
- retained all established local storage keys, backups, cue behaviour, prayer timing, Music and OneNote integration
- added first-screen density, dark-system contrast and mobile geometry browser gates
