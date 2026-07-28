# Pacefold

**One workday, quietly contained.**

Pacefold is a local-first, installable workday rhythm system. Its checksum-verified core owns schedules, cue completion, preferences and offline behaviour. Pacefold 18 makes the interval between moments visible without turning the app into a dashboard:

- **Rhythm** — the clock, Day Ribbon, scheduled moments, Noodles/custom prep, water, away, meals, eye care and movement remain the home surface;
- **Notebook** — the paper sheet opens only when requested, preserves drafts, and folds closed after saving or leaving it;
- **Music** — the black local library opens above the player and closes back to the rhythm clock.

There is no separate notebook popup, no account requirement and no cloud or OneNote dependency.

## Pacefold 18 — Ma (間)

The signature surface is the **Day Ribbon**. Its left edge is the configured work start, its right edge is work end, spent time is inked paper, time ahead is raw paper, and a hairline now marker moves at the true proportional position. Prayer, meal and completed-session data become creases and bands rather than dots or floating tooltips. Quiet preserves the shape of the day while removing its labels.

18.0 also adds:

- tabular clock figures, a single changing-digit minute fold and a still colon;
- discreet seconds as a hairline and Wafer mode for an approximately 340 × 150 pinned window;
- small solar light-temperature adjustments using the stored latitude and longitude;
- one CSS-interpolated meter primitive for water, meals, preparation, eyes and away;
- Window Controls Overlay support with a full standalone fallback;
- a single cue-delivery scheduler with priority, a default four-minute gap, focus suppression and one defer-then-drop cycle;
- deliberate sleep/lock reconciliation with one return line and no backlog burst;
- per-weekday hours and Desk, Field, Half day and Off types, plus a today-only one-click override;
- Fold Review and a rhythm block added above the existing Copy day Markdown;
- one-click Quiet with exact restoration of the prior privacy, clarity, badge and notification settings;
- visible ritual option menus for desk/away lunch, duration, snooze and skip today;
- `pacefold.backup.v1` with a dry-run restore preview;
- storage estimates, one persistence request and audio-import capacity checks;
- forced-colour, reduced-motion, reduced-transparency, no-theme-flash and no-first-paint-motion handling.

The clock uses the locally installed Segoe UI Variable/Segoe UI face through a unicode-scoped font definition. Pacefold does not distribute a font binary.

## Pacefold 17.1 — rhythm-first return

The visual overhaul in 17.0 left the original rhythm engine running but made the notebook feel like the product. 17.1 corrected that hierarchy.

- Pacefold starts with the rhythm clock visible, regardless of the notebook's previous state.
- The original Noodles default and configurable preparation presets remain available at 5, 8, 10, 15, 20, 30, 45 and 60 minutes.
- Water, away, desk/away lunch, eye-care, movement, prayer and meditation controls remain first-class.
- Compact Capture saves quietly without opening the document.
- Opening Notebook creates a temporary integrated sheet, not a new browser popup.
- A successful note save folds the sheet closed after a short confirmation.
- Escape, clicking the clock, leaving the app, or one minute of inactivity also folds it closed.
- Unsaved composer text is retained locally and restored on the next notebook opening.
- Closing Music returns to the clock rather than reviving an earlier notebook state.

## Sumi workspace

Pacefold behaves like one coherent physical object anchored above the taskbar.

- Notebook and Music cannot remain expanded together. Opening either one folds the other away.
- Closing Music returns to the rhythm clock.
- The paper cover, notebook, black library and black footer share one width, one hinge and one geometry owner.
- A single 220 ms material fold replaces slower multi-region choreography.
- The clock quietly recedes behind an open work surface instead of competing with it.
- Warm off-white paper, charcoal ink, muted deep green and a Sumi-black player form one identity.
- Conflicting restored state is contained visually before runtime reconciliation finishes.
- Music menu accessibility state is synchronized on creation, toggling and root recovery.
- Reduced-motion mode removes choreography without changing layout or functionality.

## Local notebook

The notebook is a working document rather than a launcher.

- It opens inside Pacefold and remains attached to the bottom of the app.
- Collapsing it leaves the capture row available.
- Existing notes continue to use `pacefold.notebook.entries.v2`.
- Older entries are enhanced in place with timestamps and category metadata; their IDs and text are retained.
- Local notes remain available without Microsoft authentication, Graph, OneNote or another service.

Every new note receives a stable local ID, local calendar date, creation and updated timestamps, category and Markdown-style formatting metadata.

The compact capture field accepts slash routing:

- `/incident`
- `/follow`
- `/inspect`
- `/jhsc`
- `/construction`
- `/notification`
- `/resource`

When **Smart** is selected, Pacefold uses conservative keyword rules to suggest an existing category. An explicit category or slash command always wins.

## Category tabs and document tools

Categories become notebook tabs along the bottom edge.

- **Today** shows the selected day.
- **All** searches across the notebook.
- **Pinned** collects important notes.
- Every used category receives its own tab and count.
- New categories can be created directly from the tab strip.
- A note can be reassigned from its own category menu.

The integrated document supports search, date navigation, edit, delete, pin, complete, note-level copy, category reassignment, headings, bold, italics, bullets, checkbox syntax, daily Markdown copy/download and local backup/restore.

**Copy day** is the intended handoff. Pacefold 18 places a short delimited rhythm summary above the notes so one paste into OneNote, Word, email or another destination carries both. Pacefold does not pretend that a cloud handoff succeeded when it did not.

## Separate local music bar

The bottom-most player is intentionally black and visually separate from the notebook while remaining part of the same app.

The primary workflow is local audio:

- add or drag multiple audio files;
- retain files in browser-local IndexedDB storage;
- build and reorder a queue;
- play previous, current and next tracks;
- seek and adjust volume;
- create named playlists;
- add the current track to a playlist;
- remove local tracks when no longer needed.

Streaming is secondary. Pacefold stores optional named web links, but it does not turn the local player into another embedded streaming dashboard.

## Local storage and backup

Notes and player state stay on the current browser profile.

- Clearing Pacefold site data can remove notes and locally stored audio.
- `pacefold.backup.v1` includes preferences excluding token/credential-shaped fields, notes, categories, playlist definitions, streaming links and rhythm history.
- Restore shows what will be added, overwritten, unchanged or skipped before writing anything.
- Audio blobs are not embedded in the JSON backup because that could create extremely large files.
- A playlist can reference only audio still stored in this browser.
- Browser storage quotas vary by device and administrator policy.
- Pacefold requests persistent storage once and handles refusal silently.
- Audio import is blocked before crossing the local capacity guardrail.

Keep original audio files elsewhere and download periodic Pacefold backups.

## Notifications and work hours

The 15.9 notification corrections remain in place:

- app badges use a nonnumeric attention flag;
- only one current Pacefold toast is retained;
- repeated cues replace rather than stack;
- notifications are non-sticky;
- work hours suppress badges, open notifications and waiting-cue emphasis;
- overnight work windows and active weekdays remain supported.

Pacefold 18 adds one delivery owner above those paths. Priority is prayer/meal, preparation expiry, water, eyes, then movement. Lower-priority cues inside `minCueGap` are deferred once and then dropped for that cycle. When the app has been hidden or untouched beyond `focusGraceMinutes`, desk-bound cues are suppressed and their cadence is re-anchored on return.

The verified core remains the only owner of completing the actual cue. Ribbon, notebook, player and review surfaces observe state; they do not complete reminders.

## Honest notification ceiling

A browser PWA cannot guarantee cue delivery while the app is closed, heavily throttled, the laptop is asleep or a managed policy blocks notifications, persistent storage or badging. Pacefold reports a return interval and skips backlog delivery rather than pretending those cues fired.

Pacefold does not implement Periodic Background Sync or Notification Triggers. Their Edge and managed-device reliability is not strong enough for a second delivery path.

## Desktop workspace

- The player footer owns a reserved bottom lane and cannot cover the notebook.
- Music mode collapses the notebook to its paper cover, then inserts the library above the player.
- Compact windows remove secondary player controls before layout can overflow.
- Notebook toolbars, menus and note content use internal scrolling and width constraints.
- Window Controls Overlay uses the available title-bar region when enabled and returns to the 17.1 geometry when unavailable or toggled off.
- Wafer shows only time, one status line and the three-pixel Day Ribbon until its visible edge affordance is clicked.

The release audits check exclusive surface state, accessibility state, fold cleanup, single-copy injection, cache-busting, collision prevention, desktop/mobile/Wafer geometry, scheduler ownership, cue gaps, drift, ribbon update cost, forced colours, boot and Quiet.

## Install or refresh

1. Open the Pacefold GitHub Pages app in Microsoft Edge.
2. Complete setup before installing the PWA.
3. Install through **… → Apps → Install Pacefold** and pin it when desired.
4. After 18.0 deploys, fully close every Pacefold and Edge PWA window once.
5. Reopen Pacefold so the cache-busted Ma surface and updated service worker replace the older release.

## Honest platform boundaries

A browser PWA cannot intercept Windows taskbar clicks before focus, distinguish taskbar single-click from double-click, or continuously redraw the pinned icon face. A native Windows companion would be required.

## Version

Pacefold 18.0.0 Ma workspace over the Pacefold 15.8 integrated runtime and verified 15.2.2 core archive.

Core archive SHA-256: `2fbb5c9b1df8369eddd4a7e1b791d60d6f58b1bf4d51665e288fb88ec9409d2b`.
