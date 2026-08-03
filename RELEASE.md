# Pacefold 23.0.0 — complete stabilization

- Surface version: `23.0.0`
- Preserved Day Unfold and cue queue: `22.0.2`
- Preserved spatial base: `22.0.0`
- Integrated runtime: `15.8.0`
- Verified core version: `15.2.2`
- Enhancement entry points: `enhancements/inject.mjs`, `enhancements/inject-v22-hardening.mjs`, `enhancements/inject-v22-daylight.mjs`, `enhancements/inject-v23.mjs`

## Release completion policy

An approved Pacefold implementation ships end to end by default. Work is complete only after the tested scope is committed, pushed, merged into `main`, deployed through the production workflow, and verified on the cache-busted live page and app. The public page, app version, cache token, service worker and release notes must agree. The only exceptions are an explicit instruction to keep work local, stop before release or prepare review-only changes.

## What 23.0.0 fixes

The checksum-verified archive and sealed enhancement parts remain unchanged. V23 is a final additive stabilization layer that corrects lifecycle, layout, ownership, performance and release-truth faults found in the deployed 22.0.2 surface.

- Fresh setup is no longer hidden by the core's initial default-preference write. Only an onboarding marker or a meaningful prior snapshot identifies a returning user.
- The resting surface is again one calm clock. Up opens Notes, Left Worklog, Right Now, and Down Settings & Sound.
- The six original home actions are Water, Noodles/Timer, Away, Meal, Eyes and Move. Day type and Focus remain available on Worklog.
- A small analog seconds dial joins the numeric seconds and obeys the existing Seconds setting.
- Stale missed-moment copy routes into Worklog instead of remaining the main Clock message indefinitely.
- Notes keep unsaved drafts across reloads, offer previous/current/next month navigation and date filtering, and return to Clock after a successful save.
- Settings uses a release-independent hardening selector, preventing the version-stamp mismatch that clipped its third card in 22.0.2. Four advanced routes expose profile/routines, schedule/day types, protected backup and local Sound.
- Sound is visually contained in the current Pacefold paper or dark theme instead of switching to a detached black application.
- The durable source-aware cue queue is the only native badge writer. Quiet preserves the user's private taskbar cue preference while hiding sensitive in-window detail.
- Broad document mutation observation and sub-second rebuild loops were replaced with targeted observation, active-face rendering and slower reconciliation intervals.
- Active V21/V22 presentation assets are composed into `pacefold-v23.css` and `pacefold-v23.js`. The retained legacy assets and APIs remain available for compatibility, while the live page makes nine fewer stylesheet/script requests than 22.0.2.
- The public landing page, visible version, experience markers, worker revision and release documentation now agree on 23.0.0.

## Validation floor

The repository verifier once again runs in GitHub Actions. It reconstructs and validates the sealed core, checks immutable hub-part Git hashes, injects every retained layer twice where supported, injects V23 twice, verifies a single active bundle, validates offline cache membership and checks landing/release truth.

The browser gate covers:

- untouched first-run onboarding and returning-user startup;
- clock title, one visible face and six rhythm controls;
- Day Unfold and distinct source-coloured cue dots;
- note draft recovery, save-and-close, calendar navigation and date selection;
- complete Settings geometry and all four advanced routes;
- Seconds setting ownership and light-paper Sound containment;
- desktop, 390 px mobile and 340 × 150 Wafer containment;
- reduced motion, forced colours and console/page errors;
- retained notebook, resilience, dock/taskbar, privacy, V19 and V20 compatibility suites.

## Honest platform boundaries

Pacefold remains local-first and offline-ready. Browser notifications, App Badging, PWA installation, persistent file permission and background execution are best effort and may be blocked by Edge or workplace policy. Pacefold does not bypass those controls. Exact cue delivery is not possible while the browser is closed, suspended, heavily throttled or the laptop is asleep; Pacefold reconciles elapsed wall time on return.

Notes stay in this browser profile. A user-selected `pacefold.backup.v1` JSON file can protect safe preferences, notes, categories, playlist definitions, streaming links and rhythm history. Local audio blobs are excluded. File permission may require a new user gesture after an Edge restart.

## Verified core archive

- Version: `15.2.2`
- Archive: `Pacefold_v15.2.2_Repository_Backup.zip`
- SHA-256: `2fbb5c9b1df8369eddd4a7e1b791d60d6f58b1bf4d51665e288fb88ec9409d2b`
- Release parts: `release/pacefold-v15.zip.b64.part-00` through `part-08`

GitHub Actions concatenates and decodes the archive, verifies the SHA-256 and runs the archive's build, validation and preserved-core browser audits before applying the enhancement layers.
