# Pacefold

**Your day, quietly kept.**

Pacefold is a private, offline-ready workday clock for rhythm, notes, care and focus.

## Current release

**Pacefold 25.1.0 — Page refinement**

- one direct application runtime and one application stylesheet
- clock-first launch with analog and digital time plus live seconds
- Day Unfold progress with a moving sun and scheduled markers
- location- and timezone-aware prayer rhythm with Hanafi Asr support, or generic/custom moments
- coloured quiet cues for prayer, water, preparation, away, meal, eyes and movement
- one-tap water, preparation, away, meal, eye and movement logging
- calendar-backed local Daybook with inline editing, category filters and monthly activity context
- a daily story, balance view and richer workday timeline
- a focused Now surface for waiting cues, active timers, weather and the next scheduled moment
- a simplified Settings control centre with a live setup and data-health overview
- JSON export/restore and an optional live backup file in supported Edge/Chromium browsers
- local focus sound and optional OneNote copy
- installable offline PWA with no Pacefold account, analytics or advertising

Open the public site at **https://rbt4.github.io/pacefold/**.

## Spatial model

- **Clock:** home
- **Up:** Notes
- **Left:** Day log
- **Right:** Now
- **Down:** Settings

On a secondary page, the first directional action returns to Clock. The next directional action opens another page. Direct buttons can always open their named destination.

## Data compatibility

Pacefold 25 continues to read and write the established local keys:

- `pacefoldPrefsV15`
- `pacefold.notebook.entries.v2`
- `pacefold.dayflow.v1`

Legacy preference and note shapes are normalized in place. Existing settings, notes and compatible day-log events remain available after the release.

## Direct-source architecture

The public product lives in `src/`. Production no longer reconstructs a V15 archive or injects V19–V24 layers over it.

```bash
npm run build
npm run verify
node --test tests/core.mjs
```

The browser audit is `tests/browser-audit.cjs`. CI installs its pinned Playwright runtime, captures desktop/mobile screenshots, and tests clean launch, data migration, logging, notes, directional return, persistence and responsive overflow.

## Release workflow

`.github/workflows/pages.yml` is the only production workflow. A pull request builds and validates the exact direct source. A push to `main` runs the same validation before GitHub Pages deployment.
