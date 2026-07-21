# Changelog

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
