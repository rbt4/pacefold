# Pacefold

**Your day, quietly kept.**

Pacefold is a local-first, installable workday rhythm system. Version 15 keeps the clock visually dominant while adding a quiet Capture, Care, Sound and OneNote layer.

## Pacefold 15

- **Kiroku capture:** notes, follow-ups, incidents, inspections, JHSC, construction, notifications, meetings and resources save locally first.
- **Optional Microsoft OneNote:** delegated `Notes.ReadWrite`, selected HSSys notebook/section, one dated page per day, offline queue and duplicate-safe retry.
- **Care:** 20-20-20 distance looks plus break-aware guided position and movement resets.
- **Sound:** generated offline brown hush, rain and fan layers, local/direct audio, media controls and cue ducking.
- **Themes:** Sekkei, Washi, Sumi, Moss, Dusk and a custom palette.
- **Original rhythm preserved:** nine profiles, configurable preparation routines, hydration, meals, personal pauses and the private ledger remain.
- **Hardened updates:** installed-v14 upgrade, open-draft deferral, offline reload and storage migration are browser-tested in CI.

## Default developer profile

The default preset remains:

- Muslim calculated prayer schedule
- Hanafi Asr
- Toronto defaults with optional location-aware calculations
- noodle preparation routine
- desk-meal flow
- hydration, away-break, and private day-close logging

## Repository release format

The exact tested source tree is stored as a checksum-verified Base64 release under `release/`. GitHub Actions reconstructs the ZIP, verifies SHA-256, rejects a non-advanced release version, runs syntax/static checks and a real browser upgrade audit, and only then deploys a clean Pages artifact.

Release SHA-256:

`65f8bada8b589c1858343ade0f2e8f2c38b8e5b6506dc411e68ac2ba2c20e98d`

## Install

1. Open `https://rbt4.github.io/pacefold/` in Microsoft Edge.
2. Choose **Set up Pacefold** and complete the three steps.
3. Use **Install Pacefold** when Edge exposes the native prompt.
4. When it does not, use Edge **… → Apps → Install Pacefold**.
5. Pin the installed app from `edge://apps` when workplace policy permits.

## Privacy

No Pacefold account, analytics or advertising. Activity records and settings remain on the device. Microsoft Graph is contacted only after optional OneNote configuration and sign-in; only written captures are synchronized.

## Version

Pacefold 15.0.0
