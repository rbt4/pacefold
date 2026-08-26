# Pacefold 30.0.0 — Quiet Clock

## Identity

- Public release: **30.0.0**
- Experience revision: **quiet-clock-r1**
- Product name in the discreet app window: **Clock**

## What changed

- The atmospheric daily image is now the background of the working Clock, not a duplicate start cover.
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
