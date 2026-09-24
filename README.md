# Pacefold

**Your day, quietly kept.**

Pacefold is a private, local-first workday clock that keeps time, rhythm, notes, care cues and focus close without turning the day into a dashboard.

## Current release

**Pacefold 31.0.0 — Origin**

- normal visits open the full-screen scenic homepage first, with the large clock, date, search, quick note, Music and an explicit Clock entrance
- opening it reveals a distinct warm-folio workspace: a deep-forest analog + digital Clock, visible seconds, Day Unfold and rhythm; direct fold links may bypass the cover
- the persistent lower Daybook is again part of Clock, with immediate capture, recent notes and carry-forward work instead of a substitute summary
- Google/address search and scenic photography stay on the front cover so the working Clock can remain calm all day
- prayer rhythm with Hanafi Asr and deliberate privacy modes, plus everyday, mindful and up-to-eight custom moments
- coloured quiet cues for prayer/moments, water, noodles/prep, away, meal, eyes and movement
- a live clock favicon/taskbar identity that can carry several waiting cue colours at once
- original-profile **Noodles** timer, with generic **Prep** retained for other profiles
- one-tap hydration, meal, away, eye and movement logging plus focus and field sessions
- calendar Daybook with quick capture, categories, pin/carry-forward, editing, search and note context
- Day Log with work/focus/break balance, timeline and same-point-yesterday comparison
- Now with discreet schedule context, waiting cues, active timers and an across-midnight weather horizon
- one compact Music dock: YouTube/YouTube Music links and playlists, track picker, seek, volume, previous/next, shuffle, loop and local **My Music**
- the earlier local focus sounds preserved inside Music: Brown hush, Rain glass, Soft fan and a local audio file
- JSON backup/restore now includes My Music state, plus optional live backup file support in compatible Chromium browsers
- optional local-first OneNote copy through Microsoft Graph
- installable offline PWA with quiet notifications, no Pacefold account, analytics or advertising
- System, Light or Dark appearance (Settings → Daily), so an all-day clock stays calm in the evening

Public site: **https://rbt4.github.io/pacefold/**

## Spatial model

- **Clock:** home
- **Up:** Notes
- **Left:** Day log
- **Right:** Now
- **Down:** Settings

Directional movement always comes back through Clock, preserving the original “fold around a clock” idea rather than behaving like a conventional app menu.

## Data continuity is a product requirement

Pacefold intentionally continues to read and write its established local stores, including:

- `pacefoldPrefsV15`
- `pacefold.notebook.entries.v2`
- `pacefold.dayflow.v1`
- durable cue IndexedDB `pacefold-v26`
- live-backup handle IndexedDB `pacefold-v25`

Those historical names are compatibility anchors, not stale code to rename. Existing preferences, notes, logs, timer lineage and backup handles must survive releases.

## Direct-source architecture

The public product lives in `src/`. Production bundles one runtime and one stylesheet; it does **not** reconstruct the old V15–V24 archive/injector stack. Release 31 consolidates the scenic entrance, working Clock and persistent Daybook into one explicit Origin contract.

All styling lives in **one authored stylesheet**, `src/app/pacefold.css`, built from a small set of tokens (paper, ink, forest, cue colours, one type scale, one radius/shadow scale). The historical `src/styles/27-zzzz…` override layers are gone; change the relevant section of that file instead of adding a layer on top. `tests/v31-origin.cjs` fails if the layer directory returns or if `!important` starts creeping back.

```bash
npm install
npm run build        # bundles _site/
npm run verify       # static contracts, no browser needed
npm run preview      # serves _site on :4173
```

### Tests

Six files, all run by CI (`.github/workflows/pages.yml`) before Pages deployment:

| File | Kind | Guards |
| --- | --- | --- |
| `tests/core.mjs` | unit (`npm run verify`) | DST, ordered rhythm, preference/note migration, backup format |
| `tests/music-morphe-r9.cjs` | static (`npm run verify`) | Morphe bridge commands and companion-extension manifest |
| `tests/guided-fold-v28.cjs` | static (`npm run verify`) | Guided Fold wiring, Settings collapsed to Daily / Rhythm / Data |
| `tests/v31-origin.cjs` | static (`npm run verify`) | release identity, continuity stores, single stylesheet (no `src/styles` layers, `!important` ceiling), official-player ad policy |
| `tests/v28-startup-smoke.cjs` | Chromium | cold start, cover → Clock hand-off |
| `tests/v31-origin-browser.cjs` | Chromium, desktop + mobile | cover/Clock geometry, Music above the cover, one return edge per fold, neutral-privacy leaks on Clock and Now, water/note/inline-edit persistence, arrow-key folds, first-run setup, mobile tab bar, appearance persistence, Settings pill placement; writes screenshots |

The browser tests need Playwright with Chromium:

```bash
NODE_PATH=/path/to/node_modules node tests/v28-startup-smoke.cjs _site
NODE_PATH=/path/to/node_modules node tests/v31-origin-browser.cjs _site /tmp/pacefold-31-audit
```

Earlier per-release test scripts (V25–V30) were retired in favour of these contracts; they live in Git history.

## Product lineage

The durable ideas from the project’s conception through 31.0 are recorded in [`docs/ORIGIN_TO_FINAL.md`](docs/ORIGIN_TO_FINAL.md). Treat that document as a guardrail when simplifying or redesigning Pacefold.
