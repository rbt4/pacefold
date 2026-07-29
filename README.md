# Pacefold

**One workday, quietly contained.**

Pacefold is a local-first, installable dashboard for the shape of a working day. Its checksum-verified core owns schedules, cue completion, preferences and offline behaviour. Pacefold 19 brings the important functions back into one calm, coherent home:

- **Now** — a stable clock, date, next cue, Day Ribbon and saved-location weather share the top of the dashboard;
- **Rhythm** — Water, Timer, Away, Meal, Eyes and Move are equally visible, tactile controls with their full options intact;
- **Utilities** — Quick note, focus sound, Notes and Music stay within reach without occupying the dashboard at rest;
- **Growth** — a small module contract lets later tools join the utility area without replacing the clock or creating another layout owner.

OneNote delivery is retired. Quick notes, the full local notebook, Copy day and `pacefold.backup.v1` remain. The Microsoft Graph endpoint is not permitted by the V19 app shell.

## Pacefold 19 — workday dashboard

V19 is a product reset, not another decorative layer.

- Replaced the sparse clock canvas and permanent black player lane with one responsive dashboard card.
- Put live weather beside the clock and bound it to the latitude, longitude and location label already saved in Pacefold preferences.
- Kept hydration, the configurable preparation timer, away time, desk/away meals, eye care and movement as six first-class controls.
- Fixed clipped status copy and kept the Day Ribbon as supporting context rather than the whole product.
- Made Notes and Music focused, mutually exclusive sheets. Both disappear completely when closed.
- Restyled the music library as part of Pacefold instead of a disconnected black slab. Local audio, queues, playlists and honest streaming bookmarks remain.
- Removed Japanese product names and ornamental framing from current UI copy. The influence is limited to precise geometry, restraint and short material transitions.
- Kept Quiet, Wafer, weekday/day types, cue coalescing, drift reconciliation, Fold Review, backup/restore and storage guardrails.
- Added a V19 release audit for saved-location weather, core rhythm actions, local-only notes, focused music, responsive geometry, reduced motion and the extension contract.

## Pacefold 18.0 — Ma

The signature Day Ribbon is one continuous view of the configured workday. Spent time is inked paper, future time is raw paper, the current instant is a hairline, and recorded moments become creases or bands. Quiet keeps the shape of the day while removing its labels.

- One cue scheduler coalesces prayer, meal, preparation, water, eye and movement delivery behind a four-minute default gap. The verified core remains the only owner of cue completion.
- Returning after sleep or lock produces one plain summary, drops stale low-priority backlog and re-anchors those cadences without changing day totals.
- `workWeek` adds Desk, Field, Half day and Off schedules per weekday. A one-click status control changes today without rewriting the saved week.
- Wafer density reduces a roughly 340 × 150 installed window to the clock, one status line and a three-pixel ribbon, with a visible edge control for everything else.
- Quiet is a one-click surface control. It restores the previous privacy, density and notification settings exactly when turned off.
- Every ritual has a visible options chevron for mode, duration, snooze and skip-today actions. Existing Shift-click paths remain available.
- Fold Review adds the finished ribbon, three plain totals and one carry-forward line to the existing daily handoff. It has no score, streak or encouragement copy.
- Backup is now the versioned `pacefold.backup.v1` format and shows an add/overwrite/skip diff before restore.
- Storage use is checked before local-audio import. Persistence requests and unavailable browser capabilities fail quietly.
- A local variable-font subset keeps clock digits tabular, while solar elevation adjusts paper and ink temperature by a deliberately small amount every ten minutes.
- Edge can use Window Controls Overlay with a standalone fallback. Forced colours, reduced motion, reduced transparency and first-paint transition suppression are part of the release floor.

## Pacefold 17.1 — rhythm-first return

The visual overhaul in 17.0 left the original rhythm engine running but made the notebook feel like the product. 17.1 corrects that hierarchy.

- Pacefold always starts with the rhythm clock visible, regardless of the notebook's previous state.
- The original Noodles default and configurable preparation presets remain available at 5, 8, 10, 15, 20, 30, 45 and 60 minutes.
- Water, away, desk/away lunch, eye-care, movement, prayer and meditation controls remain first-class.
- Compact Capture saves quietly without opening the document.
- Opening Notebook creates a temporary integrated sheet, not a new browser popup.
- A successful note save folds the sheet closed after a short confirmation.
- Escape, clicking the clock, leaving the app, or one minute of inactivity also folds it closed.
- Unsaved composer text is retained locally and restored on the next notebook opening.
- Closing Music returns to the clock rather than reviving an earlier notebook state.

## Pacefold 17 — Sumi workspace

Pacefold now behaves like one coherent physical object anchored above the taskbar.

- Notebook and Music cannot remain expanded together. Opening either one folds the other away.
- Closing Music returns to the rhythm clock.
- The paper cover, notebook, black library and black footer share one width, one hinge and one geometry owner.
- A single 220 ms material fold replaces the slower five-region choreography.
- The clock quietly recedes behind an open work surface instead of competing with it.
- Warm off-white paper, charcoal ink, muted deep green and a Sumi-black player now form one identity.
- Conflicting restored state is contained visually even before runtime reconciliation finishes.
- Music menu accessibility state is synchronized on creation, toggling and root recovery.
- Reduced-motion mode removes the choreography without changing layout or functionality.

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
- a versioned `pacefold.backup.v1` containing safe preferences, notes, categories, playlist definitions, streaming links and rhythm history;
- a dry-run restore diff before any local data is changed.

**Copy day** is the intended handoff. At the end of the day, copy the assembled document and paste it into another notes app, a document, email or any other destination. Pacefold does not pretend that a cloud handoff succeeded when it did not.

## Local music

Music opens as a focused Pacefold sheet and disappears when closed. It does not reserve a permanent bottom lane or use the retired black-slab treatment.

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
- The JSON backup includes safe preferences, notes, categories, playlist definitions, streaming links and rhythm history.
- Audio blobs are not embedded in the JSON backup because that could create extremely large backup files.
- A playlist can reference only audio still stored in this browser.
- Browser storage quotas vary by device and administrator policy.
- Settings shows one approximate local-storage line, and audio import stops before crossing the browser storage guardrail.

Keep original audio files elsewhere and download periodic Pacefold JSON backups.

## Notifications and work hours

The 15.9 notification corrections remain in place:

- app badges use a nonnumeric attention flag;
- only one current Pacefold toast is retained;
- repeated cues replace rather than stack;
- notifications are non-sticky;
- work hours suppress badges, open notifications and waiting-cue emphasis;
- waiting-cue state expires after the configured due window instead of persisting;
- overnight work windows and active weekdays remain supported.

Pacefold does not use Periodic Background Sync or Notification Triggers. Edge support and managed-device policy are not dependable enough for them. Browser notifications can only be delivered while the browser gives the app execution time.

The verified core remains the only owner of completing the actual cue. The ribbon, notebook, player and review remain read-only observers.

## Desktop workspace

Pacefold 17 treats the installed app as one collision-free desktop workspace rather than several floating overlays.

- The player footer owns a reserved bottom lane and cannot cover the notebook.
- Music mode collapses the notebook to its paper cover, then inserts the library above the player.
- Closing Music returns to the prior Notebook or Compact state.
- Compact windows remove secondary player controls before the layout can overflow.
- Notebook toolbars, menus and note content use internal scrolling and width constraints rather than spilling outside the app.
- Compositor hints exist only during the short active fold.

The release audit checks exclusive surface state, restored accessibility state, fold cleanup, single-copy injection, cache-busting, collision prevention and desktop/mobile geometry.

## Install or refresh

1. Open the Pacefold GitHub Pages app in Microsoft Edge.
2. Complete setup before installing the PWA.
3. Install through **… → Apps → Install Pacefold** and pin it when desired.
4. After 19.0.0 deploys, fully close every Pacefold and Edge PWA window once.
5. Reopen Pacefold so the cache-busted dashboard replaces the older surface.

## Honest platform boundaries

A browser PWA cannot intercept Windows taskbar clicks before focus, distinguish taskbar single-click from double-click, or continuously redraw the pinned icon face. A native Windows companion would be required.

Browser timers also cannot guarantee exact delivery while the app is closed, heavily throttled or the laptop is asleep.

## Version

Pacefold 19.0.0 dashboard enhancement layer over the preserved Pacefold 18 cue and data systems, Pacefold 15.8 integrated runtime and verified 15.2.2 core archive.

Core archive SHA-256: `2fbb5c9b1df8369eddd4a7e1b791d60d6f58b1bf4d51665e288fb88ec9409d2b`.
