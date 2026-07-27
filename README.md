# Pacefold

**One workday, quietly contained.**

Pacefold is a local-first, installable workday rhythm system. Its checksum-verified core still owns schedules, cues, preferences and offline behaviour. Pacefold 16 keeps two deliberately separate local surfaces:

- an integrated working notebook anchored at the bottom of Pacefold;
- a bottom-most black local-audio player with its own queue, library and playlists.

There is no separate notebook popup and OneNote is no longer part of the primary notes workflow.

## Pacefold 16 — local workspace

The notebook is now a working document rather than a launcher.

- It opens inside Pacefold and remains attached to the bottom of the app.
- Collapsing it leaves the capture row and category tabs available.
- Existing notes continue to use `pacefold.notebook.entries.v2`.
- Older entries are enhanced in place with timestamps and category metadata; their IDs and text are retained.
- Local notes remain available without Microsoft authentication, Graph, OneNote or another service.

## Notes and timestamps

Every new note receives:

- a stable local ID;
- a local calendar date;
- a creation timestamp;
- an updated timestamp;
- a category;
- Markdown-style formatting metadata.

The compact capture field still accepts slash routing:

- `/incident`
- `/follow`
- `/inspect`
- `/jhsc`
- `/construction`
- `/notification`
- `/resource`

When **Smart** is selected, Pacefold uses conservative keyword rules to suggest an existing category. An explicit category or slash command always wins.

## Category tabs

Categories become notebook tabs along the bottom edge.

- **Today** shows the selected day.
- **All** searches across the notebook.
- **Pinned** collects important notes.
- Every used category receives its own tab and count.
- New categories can be created directly from the tab strip.
- A note can be reassigned from its own category menu without moving it through a separate screen.

The original section names remain compatible, including Follow-ups, Incidents, Inspections, JHSC, Construction, Notifications and Resources.

## Working-document tools

The integrated document supports:

- search;
- previous, next and today navigation;
- edit and delete;
- pin and complete;
- note-level copy;
- category reassignment;
- headings, bold, italics, bullets and checkbox syntax;
- daily copy as a structured Markdown document;
- daily `.md` download;
- full note/category/playlist/link backup as JSON;
- JSON backup import and merge.

**Copy day** is the intended handoff. At the end of the day, copy the assembled document and paste it into OneNote, Word, email or any other destination. Pacefold does not pretend that a cloud handoff succeeded when it did not.

## Separate local music bar

The bottom-most player is intentionally black and visually separate from the notebook while remaining part of the same app.

The primary workflow is local audio:

- add multiple audio files;
- drag files onto the player;
- retain files in browser-local IndexedDB storage;
- build and reorder a queue;
- play previous, current and next tracks;
- seek and adjust volume;
- create named playlists;
- add the current track to a playlist;
- remove local tracks when no longer needed.

Streaming is secondary. Pacefold stores optional named web links, but it does not turn the local player into another embedded streaming dashboard.

## Local storage boundaries

Notes and player state stay on the current browser profile.

- Clearing Pacefold site data can remove notes and locally stored audio.
- The JSON backup includes notes, categories, playlist definitions and streaming links.
- Audio blobs are not embedded in the JSON backup because that could create extremely large backup files.
- A playlist can reference only audio still stored in this browser.
- Browser storage quotas vary by device and administrator policy.

Keep original audio files elsewhere and download periodic Pacefold JSON backups.

## Notifications and work hours

The 15.9 notification corrections remain in place:

- app badges use a nonnumeric attention flag;
- only one current Pacefold toast is retained;
- repeated cues replace rather than stack;
- notifications are non-sticky;
- work hours suppress badges, open notifications and waiting-cue emphasis;
- overnight work windows and active weekdays remain supported.

The verified core remains the only owner of completing the actual cue. Notebook and player actions do not complete reminders accidentally.

## Desktop layout stabilization

Pacefold 16.1.1 treats the installed app as a desktop workspace rather than several floating overlays.

- The player bar owns a reserved bottom lane and cannot cover the notebook.
- On wide windows, an open music drawer sits beside the notebook.
- On compact desktop windows, the drawer receives a fixed lower lane and the notebook moves above it.
- Narrow fallback windows show one major surface at a time instead of stacking translucent layers.
- Notebook toolbars, menus and note content use internal scrolling and width constraints rather than spilling outside the app.
- Persistent compositor hints were removed from the large panels to reduce flicker, blurry text and stale animation layers.

The release audit checks that the stabilization layer is injected after the origami layer and that its collision-prevention contracts remain present.

## Install or refresh

1. Open the Pacefold GitHub Pages app in Microsoft Edge.
2. Complete setup before installing the PWA.
3. Install through **… → Apps → Install Pacefold** and pin it when desired.
4. After 16.1.1 deploys, fully close every Pacefold and Edge PWA window once.
5. Reopen Pacefold so the cache-busted desktop stabilization layer replaces the older surface.

## Honest platform boundaries

A browser PWA cannot intercept Windows taskbar clicks before focus, distinguish taskbar single-click from double-click, or continuously redraw the pinned icon face. A native Windows companion would be required.

Browser timers also cannot guarantee exact delivery while the app is closed, heavily throttled or the laptop is asleep.

## Version

Pacefold 16.1.1 desktop stabilization over the verified Pacefold 15.8 integrated runtime and 15.2.2 core archive.
