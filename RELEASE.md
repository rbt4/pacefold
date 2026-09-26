# Pacefold 31.0.0 — Origin (with the Horizon updates on main)

## Identity

- Public release: **31.0.0**, experience revision **origin-r1**. The work listed under "Unreleased" in `CHANGELOG.md` is live on `main` but has not been given a new version number yet.
- Product name: **Pacefold**; the installed app's window chrome stays the discreet **Clock**.

## What Pacefold is now

- **Start page.** The daily photo with a greeting, the time, the day in one line (weather, rain coming, next moment), search, a quick note and the week ahead.
- **Clock.** The Horizon Dial: a 24-hour dial with solar noon at the top, the hourly temperature, the workday, your moments and the sun or moon, over the photo graded by the real sky. The week ahead sits on the left; the cue stack and one-tap keys on the right; the Daybook composer on the horizon.
- **Weather.** Hover a day or an hour for detail; the Radar sheet has official Environment Canada radar (RainViewer elsewhere), a 15-minute nowcast, air quality and an hourly chart. The sky itself shows the current weather.
- **Cues.** A stack of quiet cues. Logging one records it and says when the next is due; Later hides just that kind for 15 minutes. One system notification with Log / Later.
- **Getting around.** One fold switcher (Notes · Day · Clock · Now · Settings), arrow keys, ⌘K command bar and a Z focus view.
- **Continuity.** Preferences, notes, logs, cue state, timers, backups, OneNote and Music stores are unchanged from earlier releases.

## Release gate

```bash
npm run build
npm run verify
```

CI also runs the startup smoke test and the desktop and mobile browser contract (`tests/v31-origin-browser.cjs`) before Pages deploys.
