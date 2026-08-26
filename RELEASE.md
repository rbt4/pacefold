# Pacefold 30.0.1 — Homepage Restored

## Identity

- Public release: **30.0.1**
- Experience revision: **homepage-restored-r2**
- Product name in the discreet app window: **Clock**

## What changed

- The full-screen atmospheric homepage is restored as the normal first surface.
- Its large clock, date, search, quick note, Music entrance and explicit Open Clock action are again inside the scenic layer.
- Opening Clock reveals the working Clock without a lingering cover or legacy-frame flash.
- Direct Notes, Day, Now and Settings links still bypass the homepage.
- Analog and digital time, seconds, Day Unfold, rhythm, quiet guidance and one-tap actions fit as one first-screen composition.
- Search and quick note remain on the homepage in a subordinate command bar.
- Notes, Day Log, Now and Settings now share one warm-paper design with explicit dark-system contrast protection.
- The six actions are compact controls rather than dashboard tiles; the redundant Daybook summary stays out of the Clock.
- Desktop folds remain at the physical edges. Mobile uses one in-flow four-view strip that cannot overlap editors or settings.
- Existing preferences, notes, logs, cues, timers, backups, OneNote copy and Music stores remain unchanged.

## Release gate

```bash
npm run build
npm run verify
```

CI additionally runs startup, Guided Fold, recovery geometry, mobile recovery and the Pacefold 30 Quiet Clock browser contract before Pages deployment.
