# Changelog

## Unreleased — Weather lens and one switcher

- **Hover any day for its weather.** A glass card shows the day's hourly temperature curve (night shaded, high and low marked), chance of rain as bars, precipitation total, wind with direction, UV and daylight. Hovering an hour on the dial's temperature ring shows that hour.
- **Radar.** The new Radar button (or clicking any day) opens a full weather sheet with a live radar scope from RainViewer: the past two hours of precipitation around you over an unlabelled dark map, with range rings, a sweeping beam, play/pause and a scrubber.
- **The next two hours.** A 15-minute Open-Meteo nowcast says when precipitation starts or eases, drawn as a small bar strip. When rain is coming, Clock's week panel says so.
- **The full sheet** adds humidity, wind, UV, air quality (Open-Meteo, US AQI), sunrise and sunset, and an interactive hourly chart for the next 24 hours or any of the seven days.
- **One fold switcher replaces the arrow pills.** Notes · Day · Clock · Now · Settings sit in a glass segmented control centred in the top bar, with drawn icons, a sliding thumb and the arrow key for each on hover. Phones get the same switcher as the tab bar. Hover-dwell navigation at the screen edges is gone.
- **A better way in.** The start page's "Open clock ⌃" is now a button with a live mini-dial (the sun sits where it is on the 24-hour face) and an animated edge. Scrolling down or swiping up on the start page also opens Clock.
- The content security policy allows only the added hosts: RainViewer's API and tiles, the CARTO map tiles and Open-Meteo air quality.

## Unreleased — Horizon

- **The Horizon Dial.** Clock is now a 24-hour instrument with solar noon at the top, so sunrise and sunset sit on a level horizon. Rings, from the outside in: hourly temperature (with rain marks), the workday, a daylight band where the sun (or moon at night) travels and your moments sit, quarter-hour ticks, and a sweeping seconds track around the digital time. Press and hold the dial to reveal moment names briefly in neutral privacy mode.
- **A living sky, on your daily photo.** The daily image now stays behind every screen, colour-graded by the real sun (sunrise/sunset from the forecast, or solar maths from your coordinates): night, blue hour, golden hour and noon blend continuously. A horizon glow follows the sun, stars and faint aurora appear after dusk, sun rays at golden hour, and the dial's horizon line continues across the screen.
- **The sky mirrors the weather.** Rain streaks, snow drifts, fog rolls and storms flicker when that is the current weather.
- **Design magic.** An iridescent aura breathes around the dial and quickens when something needs you; glass catches light under the cursor with an iridescent edge; the Daybook dock wears an animated rainbow edge while you write; rings draw in and panels rise out of a blur when Clock opens.
- **Glass everywhere.** Notes, Day log, Now and Settings sit on the same sky in frosted glass (white in light, smoked in dark).
- **Cues resolve by logging, and stop stacking.** Tapping a cue logs the activity and restarts its timer from now (water, distance look, movement; finished timers close; scheduled moments are marked kept in the day log). Only one cue shows at a time with "+N more". System notifications share one slot and offer Log / Later; Log works even when Clock is closed.
- Retired the old analog card, Day Unfold strip and rhythm card styles (95 rules), now replaced by the dial.

## Unreleased — Signature

- **Week ahead.** A seven-day forecast on Clock (the lower edge of the sky band) and on the scenic start page (a glass strip under search), from Open-Meteo: no key or account, best-match blending of national weather models, and already inside the app's security policy. Drawn, gently animated icons; temperature range bars coloured on a real temperature scale; precipitation chances; today's current temperature. Location names never appear on these surfaces. When weather is off, Clock offers a one-tap way to turn it on.
- **New type.** Outfit (display: time, dates, headings) with Geist (interface text), both OFL and self-hosted. Replaces the earlier serif trial and Inter in the app.
- **A crafted dial.** Numerals at 12/3/6/9, a brass-edged bezel, tapered hour and minute hands and a sweeping second hand with a small mechanical settle. The sweep never runs backwards at the minute.
- **Living light.** The page glow, the forest band and the Day Unfold sky follow the hour: dawn peach, daylight forest, dusk amber, and night moonlight with stars and a moon in place of the sun.
- **Folds you can feel.** Notes arrives from above, Day log from the left, Now from the right, Settings from below, and Clock returns from the opposite side.
- **Now countdown ring.** The empty half of the Now hero is a ring that fills from the previous moment to the next, with the time remaining at its centre.
- **Icon keys and a rhythm timeline.** The six quick keys have drawn icons (water, noodles, step away, meal, look far, move), and the rhythm list is a connected timeline.
- **Paper grain.** A faint grain across the page and the forest surfaces.

## Unreleased — One stylesheet, fixed folds

Design
- Replaced the 22 concatenated override stylesheets (≈270 KB, 3,189 `!important`) with one authored, token-based `src/app/pacefold.css` (≈90 KB, 10 `!important`).
- One palette, one type scale with an 11–12px floor (no more 6–9px labels), one card/button/chip system across Clock, Notes, Day log, Now, Settings, Music and dialogs.
- The scenic cover now uses the product typeface, stacks seconds/AM–PM beside the time, and keeps its controls legible over any photograph.
- Day Unfold no longer stretches the sun into an oval, and the progress arc now reaches the sun.
- Settings work days are real toggle chips; the Daily tab subtitle is visible; the rhythm privacy choices read as options, not shouted labels.

UX fixes
- Music opened *behind* the scenic cover, so the homepage Music button looked broken. It now opens above everything.
- Inside a fold, all four edge tabs used to show "Notes / Day / Now / Settings" but every one of them actually returned to Clock. Now only the way back shows, labelled "Clock", with the arrow pointing the right way.
- Hover-to-navigate could jump to another fold (and from Notes straight to Settings) when an edge appeared under a resting cursor, e.g. right after "Open clock". The dwell now only arms on real pointer movement and always travels through Clock.
- Phones and tablets get a bottom tab bar that includes Clock (it previously had no way home except the logo).
- Removed duplicate cue surfaces (window tray, title strip, in-card list, pop-up bloom) that repeated the "Needs you" guide; the stray blue dot under the header clock is gone.
- Clearer copy: "1 cue waiting" instead of "Quiet cues ready" while something is waiting, "Next in 14 min" instead of "Next · 0:14", Now names the waiting cue and disables Clear/Snooze when nothing waits, and browser-neutral permission/backup copy instead of "Edge".
- The header clock hides on Clock (the big clock is right there) and the Music dock stays in the header on every fold.

Desktop folio
- On wide screens Clock is now one object instead of five floating cards: a single sheet whose forest band holds the clock, Day Unfold and the rhythm rail, with the status line, a segmented strip of quick keys and the Daybook below, divided by hairlines.
- The app bar, Music dock and edge tabs align to the same column as the content; edge tabs sit in the margin instead of on top of cards.
- Day log's metrics form the lower half of the dark story band; Settings' summary is one strip.

Evening and polish
- New Appearance setting (Settings → Daily): System, Light or Dark. System follows the device; the choice is stored with preferences and included in backups. The dark folio keeps the forest instrument and a light dial so the hands stay legible.
- The "↓ Settings" pill now waits until Clock has been scrolled to its end instead of floating over the quick actions.
- The rhythm card explains the hidden press-and-hold that reveals moment names for a few seconds.
- Tighter clock colon, no redundant counts on the category chips you pick from when writing a note, no duplicate header time on phones, and the Now orbit no longer collides with the title on mobile.

Tests
- Retired 25 per-release test/verify scripts (V25–V30). Each was run against the current build and the pre-redesign build; all failed on stale version strings, deleted layer files or old hiding techniques, not real regressions.
- Carried their still-valuable checks into the V31 contracts: neutral-privacy leaks on Clock and Now, one stylesheet and runtime, water and inline-note persistence, arrow-key folds, first-run setup never blocking, the cover gone in the same frame on mobile, and the official player's ad-policy boundary.

## 31.0.0 — Origin

- Restored the scenic homepage as a true front cover and separated it from the working Clock.
- Rebuilt Clock as a quiet warm-paper folio with a deep-forest time instrument, analog and digital seconds, Day Unfold and a compact rhythm rail.
- Restored the original persistent lower Daybook with immediate capture, recent notes and carried work.
- Kept the six water, Noodles/Prep, Away, Meal, eyes and movement actions compact and one tap away.
- Preserved Notes up, Day Log left, Now right and Settings down, including direct links that bypass the cover.
- Prevented first-load focus theft and repeated setup while retaining every established local store and backup path.
- Replaced inherited recovery-era visual gates with a single desktop/mobile Origin contract covering layout, overflow, persistence and fold navigation.

## 27.1.0 — Final Form

- Consolidated the conception-to-current product invariants into `docs/ORIGIN_TO_FINAL.md` so future cleanup cannot silently erase original behavior.
- Preserved the giant daily-image Clock surface while locking it as a true single-screen surface instead of allowing scroll-through into the underlying app.
- Restored the original-profile **Noodles** timer identity while retaining generic **Prep** for other profiles.
- Integrated the original Brown hush, Rain glass, Soft fan and local-audio focus sounds inside the current Music picker.
- Kept YouTube/YouTube Music playlist playback, direct track selection, previous/next, seek, volume, shuffle, loop and local My Music.
- Added My Music/stream state to JSON and live backups and restore.
- Expanded custom-moment editing to all eight slots already supported by storage migration, preventing hidden rows from being lost during settings changes.
- Extended weather to a two-day horizon so the near-term rain window remains meaningful across midnight.
- Upgraded the live clock favicon/taskbar identity to carry several waiting cue colours instead of only the highest-priority cue.
- Corrected privacy-setting copy so Clock and Now accurately describe the same discretion rules.
- Expanded self-check coverage for the start surface, privacy, custom moments, Music/focus integration and My Music backup.
- Rolled the production service-worker cache while retaining durable cue and backup-handle databases.

## 27.0.0 — Clock-first surface and integrated player

- Made the giant Clock the dominant start surface over a locally packed daily Bing image.
- Added the Google/address omnibox and quick note without turning the start surface into another dashboard.
- Hardened rhythm discretion across Clock, Now, cue dots, window chrome and background cue mirrors.
- Refined Day Unfold, dial markers, cue contrast, weather context and same-point-yesterday Day Log comparison.
- Replaced the simple music link with an official YouTube IFrame API player for YouTube and YouTube Music links/playlists.
- Added playlist track selection, shuffle, loop and persistent local My Music.
- Added a live analog-clock favicon with discreet cue state.
- Added release/browser contracts for privacy, playlist interaction and desktop/mobile visuals.

## 26.0.0 — Re-integration

- Re-established Clock as the page left open during the day and strengthened the folding edge-navigation model.
- Re-integrated quiet cues, schedule context, Daybook and day-state presentation after V25 Recovery.
- Added explicit discretion controls for ambient schedule names and richer window-native cue behavior.

## 25.1.0 — Page refinement

- Reworked Notes with category filtering, monthly activity summaries, note insights and in-page editing.
- Added a Day Log narrative, work/away/meal/field balance strip, live session states and more readable timeline cards.
- Added a dedicated quiet-cue panel and timer controls to Now, with clearer next-moment guidance.
- Turned Settings into a control centre with setup summary cards, 12/24-hour selection and local data-health context.
- Improved mobile density, including a compact two-column quick-action dock and page-specific responsive layouts.
- Added a standard local build/preview/verify entrypoint and extended release validation for the refined surfaces.

## 25.0.0 — Recovery

- Replaced the layered V15–V24 production composition with one direct runtime and one app stylesheet.
- Made Clock the real initial document so no old product surface can flash before the current experience.
- Preserved established preference, notebook and day-log storage keys with explicit migration tests.
- Restored analog/digital time, live seconds, Day Unfold, the moving sun and schedule markers.
- Restored clock-centred directional navigation and deterministic return-to-Clock behavior.
- Rebuilt prayer/personal rhythm with timezone, location, Hanafi Asr, method, offsets and custom moments.
- Rebuilt coloured cue dots, silent notifications and taskbar/app badge updates.
- Rebuilt quick water, prep, away, meal, eye and movement actions with visible state and day-log writes.
- Rebuilt the calendar Daybook, search, editing, day log, focus blocks and daily export.
- Added versioned JSON restore plus an optional user-chosen live backup file.
- Restored a persistent local focus-sound bar and optional local-first OneNote copying.
- Replaced the historical service-worker asset list with the exact current shell.
- Added current desktop/mobile browser audits and visual captures for all five views.

## Earlier releases

V15–V24 remain in Git history. Their durable product ideas are summarized in `docs/ORIGIN_TO_FINAL.md`; their archive/injector implementation is intentionally not part of the current runtime.
# 30.0.1 — Homepage Restored

- restored the full-screen scenic surface as the default Pacefold homepage
- returned the large time/date, search, quick note, Music and Open Clock controls to that surface
- retained the Pacefold 30 atmospheric working Clock and warm-paper supporting views behind it
- added explicit desktop/mobile browser gates for homepage ownership, containment and first-load behavior
- bumped the service-worker cache and asset identity so installed copies receive the correction

# 30.0.0 — Quiet Clock

- merged the daily-image homepage and functional Clock into one atmospheric working surface
- removed the normal-launch cover barrier and the old startup flash path
- preserved Google/address search and quick note inside the working Clock
- rebuilt Clock hierarchy around one glass instrument, a compact rhythm rail, one guidance lane and six small actions
- standardized Notes, Day Log, Now and Settings on a warm-paper, high-contrast system even when the OS requests dark mode
- kept Notes above, Day Log left, Now right and Settings below with non-overlapping desktop and mobile folds
- retained all established local storage keys, backups, cue behaviour, prayer timing, Music and OneNote integration
- added first-screen density, dark-system contrast and mobile geometry browser gates
