# Pacefold

**Your day, quietly kept.**

Pacefold is a local-first Progressive Web App for a calm workday rhythm. Version 15 adds a quiet capture surface with optional Microsoft OneNote sync, break-aware ergonomic care, an optional sound layer and expanded themes without turning the clock into a dashboard.

## Pacefold 15

The clock remains the primary interface. A low-attention dock exposes four systems only when needed: **Capture**, **Care**, **Sound** and **OneNote**. Pacefold Original—Muslim prayer rhythm, Hanafi Asr, Toronto default and a 30-minute noodle timer—remains the developer default.

### Kiroku capture and OneNote

- Capture notes, follow-ups, incidents, inspections, JHSC items, construction items, notifications, meetings and resources without leaving the clock.
- Save locally first, including an in-progress draft that survives an app update.
- Optionally append to one dated page per day in a chosen OneNote section through Microsoft Graph delegated `Notes.ReadWrite` access.
- Retry queued items when online and detect a stable capture ID before appending, preventing duplicate retry writes.
- Keep the workday activity ledger local; only capture text, time and category are synchronized.

OneNote requires a one-time Microsoft Entra single-page-app registration and sign-in. No client secret is used. See [ONENOTE_SETUP.md](./ONENOTE_SETUP.md). University tenant policy may require administrator approval.

### Ergonomic care

- 20-20-20 distance-look cues.
- Guided position and movement resets every 30, 45, 60 or 90 minutes.
- Break-aware suppression: an away session, meal or scheduled pause resets the movement clock.
- One-signal priority, session-based care timing and a due-only taskbar indicator by default.

### Optional sound layer

- Offline generated Brown hush, Rain glass and Soft fan textures.
- Session-only local audio or a saved direct HTTPS audio source.
- Media Session controls and optional ducking when an important Pacefold cue appears.
- No fake control of Spotify, YouTube Music or Amazon Music.

### Themes

Sekkei, Washi and Sumi remain, joined by Moss, Dusk and a four-colour custom palette. The Japanese influence stays behavioural: Ma, Andon, Kiroku, Kaizen and Hansei—not decorative cliché.

### Guided setup

The setup no longer depends on Edge firing `beforeinstallprompt`.

1. Open `https://rbt4.github.io/pacefold/app/?setup=1`.
2. Choose a rhythm profile.
3. Choose a preparation routine and duration.
4. Choose interface comfort and distance-look cues.
5. Optionally test notifications.
6. Use the native install prompt when available, or follow the displayed Edge Apps path.

### Rhythm profiles

- **Pacefold Original** — location-aware Islamic prayer rhythm plus the original noodle timer.
- **Everyday** — neutral workday resets.
- **Mindfulness** — meditation, breathing and reflection moments.
- **Muslim** — calculated Fajr, Dhuhr, Asr, Maghrib and Isha.
- **Jewish, Christian, Hindu and Buddhist** — editable personal reminders, explicitly not official denominational or religious time rulings.
- **Custom** — up to six user-labelled personal moments.

### Configurable preparation timer

Noodles remain the original default. Presets include tea, coffee, food prep, steep/brew and custom. Labels, completion wording and duration can be changed without replacing the mature timer engine.

### Display comfort

Pacefold can adapt only its own interface with Auto, Neutral, Warm and Dim modes. It can also offer optional distance-look cues and open Windows Night light through a user action. A browser app cannot directly recolour an entire monitor or guarantee medical eye-strain benefits.

### Install, updates and notifications

- Root-scoped Edge PWA installation.
- Automatic update checks after launch, periodically while open, on focus, visibility return, reconnect and page restore.
- One controlled reload after a verified service-worker update.
- Optional notifications with an immediate test and actual permission reporting.
- Quiet essentials-only notifications by default: silent, non-persistent, source-specific and limited to one contextual **Clear / Done / Log** action. Every-cue coverage remains an explicit option.
- Notification actions are queued durably and deduplicated before they update the local ledger; clearing an alert also clears Pacefold's taskbar indicator.
- The taskbar stays empty until a cue is due, then shows a dot. A live countdown remains available as an opt-in setting.
- Right-click taskbar shortcuts expose **Log / clear current cue**, **Capture**, **Care** and **Sound**.
- The browser tab/window favicon renders the real current time. Edge keeps the pinned PWA icon artwork static and does not allow a website to override normal single-click/double-click taskbar behaviour.
- The app should remain open or minimized for scheduled JavaScript cues.
- Workplace policy may block installation, notifications, background activity or taskbar badges.

## Japanese operating system

- **Ma** — protect meaningful intervals.
- **Andon** — stay quiet until one cue needs attention.
- **Kiroku** — maintain an accurate private local record.
- **Kaizen** — offer one optional practical adjustment at a time.
- **Hansei** — close the day without a score.

## Taskbar and notification controls

- **Empty by default** — future cues do not occupy the taskbar.
- **Dot badge** — one cue or active timer needs attention.
- **Optional number badge** — users who want it can enable a minutes-to-next-cue countdown, up to 99 minutes.
- **Notification first button** — records the context-appropriate response and clears Pacefold alerts without focusing the app.
- **Notification body** — opens Pacefold.
- **Right-click icon** — opens the quick-action menu for logging/clearing, Capture, Care and Sound.

## Keyboard controls

- **W** — log 2–3 sips
- **C** — open quick capture
- **M** — open ergonomic care
- **O** — open the sound layer
- **N** — start or inspect the selected preparation routine
- **B** — start or finish an away break
- **L** — start a desk-meal window
- **Shift+L** — start an away lunch
- **P** — start or finish the current scheduled-moment pause
- **Enter** — perform the highest-priority action
- **S** — snooze or add five minutes
- **R** — temporarily reveal labels
- **H** — plain-clock cover
- **,** — settings

## Building

`app/app.js` is the source of truth:

```sh
node scripts/build.mjs
node scripts/validate.mjs
```

The browser now loads `app/app.js` directly. `build.mjs` synchronizes the service-worker version and `validate.mjs` verifies the direct source, manifest, assets, worker shell and DOM references.

## Privacy

No Pacefold account, analytics or advertisements. Profiles, activity records, notification deduplication and suggestions remain in browser storage. Microsoft Graph is contacted only after the user configures and signs into the optional OneNote connection; only captures are synchronized.

## Version

Pacefold 15.2.1
