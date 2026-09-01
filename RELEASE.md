# Pacefold 31.0.0 — Origin

## Identity

- Public release: **31.0.0**
- Experience revision: **origin-r1**
- Product name: **Pacefold**; discreet installed-app chrome remains **Clock**

## What changed

- The scenic homepage is the front cover again, with its live clock, date, search, quick note, Music and explicit Open Clock action.
- Opening it reveals a separate working folio, not a second photograph: a deep-forest Clock, live seconds, Day Unfold and a compact rhythm rail.
- The original persistent lower Daybook is restored with immediate capture, recent notes and carry-forward work.
- The six small actions keep water, Noodles/Prep, Away, Meal, eyes and movement within one tap without becoming dashboard tiles.
- Notes remain up, Day Log left, Now right and Settings down; direct fold links still bypass the front cover.
- Ordinary startup does not autofocus or reopen setup, while existing preferences, notes, logs, cues, timers, backups, OneNote and Music stores remain unchanged.
- Desktop and mobile gates now verify the full origin contract, including cover ownership, seconds, persistence, fold links and overflow.

## Release gate

```bash
npm run build
npm run verify
```

CI additionally runs startup and the Pacefold 31 Origin desktop/mobile browser contract before Pages deployment.
