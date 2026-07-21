# Pacefold

**Your day, quietly kept.**

Pacefold is a local-first, installable workday rhythm system. Version 14 expands the original Muslim/noodle workflow into a configurable product while preserving the developer profile as the default.

## Pacefold 14

- **Nine rhythm profiles:** Pacefold Original, Everyday, Mindfulness, Muslim, Jewish, Christian, Hindu, Buddhist, and Custom.
- **Editable personal moments:** non-Islamic profiles use user-editable reminders rather than claiming official denominational or legal schedules.
- **Routine mixer:** noodles remain the default, with tea, coffee, food preparation, steep/brew, and custom routines.
- **Three-step setup:** rhythm, preparation routine, then comfort/install/notification choices.
- **Display comfort:** Auto, Neutral, Warm, and Dim interface modes, plus optional distance-look cues.
- **System boundary:** a browser app cannot directly control monitor colour temperature; Pacefold can open Windows Night light settings through a user action.
- **Private ledger:** prayer/meditation/moment pauses, hydration, meals, and away sessions stay in local browser storage.
- **Automatic updates:** installed copies check for new service workers while open and activate verified releases automatically.

## Default developer profile

The default preset remains:

- Muslim calculated prayer schedule
- Hanafi Asr
- Toronto defaults with optional location-aware calculations
- noodle preparation routine
- desk-meal flow
- hydration, away-break, and private day-close logging

## Repository release format

The exact tested source tree is stored as checksum-verified Base64 release parts under `release/`. GitHub Actions reconstructs the ZIP, verifies SHA-256, runs JavaScript and static audits, and only then deploys a clean Pages artifact.

Release SHA-256:

`2d038b43e42a30308a22cd329e59dec94310232ed0209c3c07132ef617746e32`

## Install

1. Open `https://rbt4.github.io/pacefold/` in Microsoft Edge.
2. Choose **Set up Pacefold** and complete the three steps.
3. Use **Install Pacefold** when Edge exposes the native prompt.
4. When it does not, use Edge **… → Apps → Install Pacefold**.
5. Pin the installed app from `edge://apps` when workplace policy permits.

## Privacy

No account, analytics, advertising, or external runtime APIs. Activity records and settings remain on the device.

## Version

Pacefold 14.0.0
