# Pacefold 18.0.0 Ma surface over the verified 15.2.2 core

## Verified core

- Core version: `15.2.2`
- Archive: `Pacefold_v15.2.2_Repository_Backup.zip`
- SHA-256: `2fbb5c9b1df8369eddd4a7e1b791d60d6f58b1bf4d51665e288fb88ec9409d2b`
- Release parts: `release/pacefold-v15.zip.b64.part-00` through `part-08`

The core archive parts are unchanged. GitHub Actions concatenates and decodes them, verifies SHA-256, builds and validates the core, and then applies the enhancement layer through `enhancements/inject.mjs`.

## Surface release

- Surface version: `18.0.0`
- Runtime base: Pacefold `15.8` integrated runtime
- Workspace base: Pacefold `17.1` rhythm-first Sumi workspace
- New files: `pacefold-ma.css`, `pacefold-ma.js`, `pf-theme-boot.js`, `ma-audit.cjs`

The Ma layer adds the Day Ribbon, clock typography and digit fold, continuous light temperature, common meter primitive, Wafer density, Window Controls Overlay, one delivery scheduler, drift reconciliation, work-week day types, Fold Review, Quiet, ritual option menus, versioned backup/restore and storage guardrails.

## Notification ceiling

Pacefold retains non-sticky replace-don't-stack notifications, one waiting cue and work-hours suppression. The verified core remains the sole cue-completion owner; the 18.0 scheduler owns delivery ordering and spacing only.

A browser cannot guarantee cue delivery while the app is closed, suspended, heavily throttled, the laptop is asleep, or managed policy blocks notifications, badging or persistent storage. On return after a stale interval, Pacefold emits one plain status line, re-anchors desk cadences and does not deliver a backlog.

Pacefold 18.0 deliberately does **not** implement Periodic Background Sync or Notification Triggers. Their Edge support and managed-device availability are not reliable enough to justify a second partially working delivery path.

## Release validation

The existing integration workflow and the dedicated Ma workflow verify:

- unchanged core checksum;
- single-copy enhancement injection;
- self-hosted CSP-compatible assets;
- manifest Window Controls Overlay fallback;
- scheduler gap and priority behavior;
- zero-backlog drift reconciliation;
- transform-only Day Ribbon ticks;
- 340 × 150 Wafer geometry;
- forced-colour and reduced-motion floors;
- no theme flash or first-paint transition;
- additive preference migration;
- Quiet DOM redaction;
- notebook/player resilience and desktop/mobile geometry.

After deployment, fully close every Pacefold and Edge PWA window once before reopening the app.
