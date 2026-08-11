# Pacefold 25.1.0 refinement release

## Identity

- Public release: **25.1.0**
- Experience revision: **polish-r2**
- Product: **Pacefold — Your day, quietly kept**
- Public site: **https://rbt4.github.io/pacefold/**

## Recovery decision

Pacefold 24 loaded eleven application runtimes and twelve style sheets from six generations. Its service worker cached most of that obsolete stack. V25 replaces the composed product with direct source rather than adding another compatibility layer.

## What is restored

1. The clock is the initial document, eliminating the legacy-surface startup flash.
2. Live seconds, Day Unfold, the moving sun and scheduled markers stay on the primary face.
3. Notes, Day log, Now and Settings use the original directional model with Clock as the dependable centre.
4. Prayer times use the configured coordinates, timezone, twilight angle, per-prayer offsets and Hanafi or standard Asr.
5. Coloured cue dots and silent system cues represent their actual source.
6. Water, preparation, away, meal, eye and movement controls use explicit states and update the day log.
7. Daybook provides a note-count calendar, search, editing, deletion and recent notes on Clock.
8. Backups include preferences, notes and day-log data; supported browsers can maintain one user-chosen live file.
9. The mini focus-sound bar remains visible without opening another workspace.
10. Optional OneNote copying is local-first and no longer presented as active unless configured.

## What 25.1 refines

1. Notes has monthly activity context, category filters, word and entry summaries, and inline editing instead of browser prompts.
2. Day Log explains the day through a balance strip, narrative summary, clearer session states and a richer timeline.
3. Now combines the next moment, quiet cues, active timers, focus controls, schedule and weather into one decision surface.
4. Settings opens with a live setup overview, clearer section navigation, a clock-format control and local data-health details.
5. Mobile retains a compact two-column action dock and gives every secondary page a dedicated responsive layout.

## Release gates

- single-runtime and single-stylesheet contract
- no V15–V24 product assets in the public shell
- JavaScript syntax and local-reference validation
- Toronto DST and ordered prayer schedule tests
- legacy preference and note migration tests
- clean clock-only startup
- data action, note save and preference persistence tests
- two-step spatial return contract
- desktop and 390px mobile overflow checks
- visual captures for all five views at desktop and mobile sizes
