# Changelog

## 15.0.0 — Care, sound and Kiroku underneath

- Added the quiet four-tool dock without turning Pacefold into a dashboard.
- Added local-first capture and optional Microsoft OneNote synchronization with offline queuing, dated pages and duplicate-safe recovery.
- Added break-aware movement resets, expanded eye care, generated/local/direct audio, media controls, cue ducking and new themes.
- Added update deferral for setup and capture, persisted unfinished capture text and v14-to-v15 migration.
- Added checksum, version-advance, static, mocked Graph, installed-upgrade, offline and responsive browser gates before deployment.

## 14.0.1 — Final reliability pass

- Anchored the landing-page Andon card to the hero artwork and removed desktop horizontal overflow.
- Prevented first-time service-worker activation from reloading onboarding and discarding in-progress setup choices.
- Restored the complete responsive onboarding design, including readable option cards, sticky mobile actions and a real three-step progress indicator.
- Bounded service-worker readiness during notification tests so workplace policy cannot leave setup waiting forever.
- Added a direct page-notification fallback and now reports a failed test accurately instead of claiming delivery.
- Added validation guards for the hero anchor, onboarding styles and bounded notification path.

## 14.0.0 — Profiles, routines, setup, and comfort

- Integrated and reviewed the Claude 13.1 upgrade.
- Restored a direct, validated `app/app.js` runtime and removed fragmented/gzip reconstruction.
- Added nine rhythm profiles, including secular, mindfulness, major-faith, and custom choices.
- Kept Pacefold Original—Muslim prayer schedule plus noodles—as the default developer preset.
- Added editable personal moments for non-Islamic profiles.
- Generalized noodle preparation into configurable routine presets and custom routines.
- Rebuilt setup as a three-step wizard that works even when Edge does not fire its native install event.
- Added interface comfort modes and optional distance-look reminders.
- Added a user-initiated Windows Night light settings shortcut without claiming browser-level monitor control.
- Expanded the public website to explain profiles, routine mixing, Andon cues, Kiroku logging, and privacy.
- Added validation that guards the direct runtime, manifest, icons, worker shell, references, and DOM bindings.

## 13.1.0 — Claude foundation

- Added location-aware prayer/Qibla calculations and consolidated application source.

## 13.0.0

- Hardened installation, automatic updates, notification diagnostics, and GitHub Pages validation.
