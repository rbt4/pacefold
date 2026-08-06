# Pacefold

**Your day, quietly kept.**

Pacefold is a private, offline-ready workday instrument. The clock remains the centre while Notes, Worklog, Now and Settings stay one deliberate direction away.

## Current public release

**Pacefold 24.0.0 — Unified Day Instrument**

- analog and digital clock with a live second hand
- Day Unfold workday arc with a moving sun and scheduled markers
- optional location-aware Islamic prayer rhythm or editable personal moments
- one-tap hydration, preparation timer, rest, meal, eye-reset and movement logging
- visible Daybook fold with today’s totals and recent notes
- focused Notes, Worklog, Now and Settings pages
- quiet taskbar/browser cues when the platform permits them
- local notes and records with downloadable backup
- installable PWA and offline shell
- no account, analytics or advertising

Open the public site at **https://rbt4.github.io/pacefold/**.

## Product architecture

Pacefold 24 has one public surface and one current release gate. A checksum-verified local engine remains underneath to preserve established preferences, notes and records. Historical visual experiments and compatibility tests no longer define the public product or block releases.

The former Ma product layer is not loaded by the public app. A small Pacefold 24 rhythm kernel supplies current quiet-mode, cue, badge, backup and storage behaviour while retaining compatibility with established local data contracts.

## Spatial model

- **Clock:** home
- **Up:** Notes
- **Left:** Worklog
- **Right:** Now
- **Down:** Settings and Sound

On a secondary page, the first directional action returns to Clock. The next action chooses another page. This keeps the clock as a dependable centre rather than turning the app into a long dashboard.

## Privacy

Pacefold is local first:

- no Pacefold account
- no analytics or advertising
- notes and workday records remain in browser storage
- local audio stays in the browser
- backups are downloaded or written only when the user asks
- weather requests go directly to the configured weather provider

See `SECURITY.md` and the public `privacy.html` page for boundaries.

## Build

The release reconstructs the checksum-verified engine, composes the current public surface, runs the Pacefold 24 browser audit, and publishes through GitHub Pages.

```bash
cat release/pacefold-v15.zip.b64.part-* | base64 --decode > /tmp/pacefold-v15.zip
mkdir _release
unzip -q /tmp/pacefold-v15.zip -d _release
node _release/scripts/build.mjs _release
node _release/scripts/validate.mjs _release
node enhancements/inject.mjs _release
node enhancements/inject-v22-hardening.mjs _release
node enhancements/inject-v22-daylight.mjs _release
node enhancements/inject-v23.mjs _release
node enhancements/inject-v24.mjs _release
```

The final public shell must report:

```text
24.0.0 unified-r1
```

## Release workflow

`.github/workflows/pages.yml` is the single production workflow. It validates the current product and deploys the exact verified site. Historical Ma, V19 and V20 browser suites are not production gates.
