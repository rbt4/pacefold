# Pacefold

**One workday, quietly contained.**

Pacefold is a local-first, installable workday rhythm system. The checksum-verified core remains responsible for schedules, cues, preferences and offline behaviour. The 15.9 surface rebuilds the daily interface around the two compact windows the product actually needs: **Notes above and Music below**.

## Pacefold 15.9 — Notes above, Music below

The permanent interface is intentionally simple:

- an upper Notes window with an actionable Notes heading, the current cue, one-line capture, OneNote and compact controls;
- a lower mini-player that remains visible for local audio and contained music services;
- no HSSys-specific product language or destination naming;
- no duplicate dashboard, separate timer engine or parallel note store.

Existing local entries remain in the proven local-first storage path. Internal legacy keys are preserved for migration compatibility, but the user-facing product and generated OneNote destination are generic Pacefold.

## Upper Notes window

The upper window keeps the current work moment and note capture together without turning the app into a notebook dashboard.

- Write directly into **Write a note…** and press Enter.
- Slash prefixes still route notes without adding a permanent category picker:
  - `/incident`
  - `/follow`
  - `/inspect`
  - `/jhsc`
  - `/construction`
  - `/notification`
  - `/resource`
- Click the **Notes** heading for dated browsing, search, editing, completion and deletion.
- OneNote is optional; local saving always completes first.

The former top Notes button is removed because the heading itself now opens Notes. Duplicate Capture and Media tiles are also removed from the expanded controls; capture remains in the upper window and music remains in the lower player.

## OneNote reliability

The old proxy assumed that the Notes surface and its sync action would appear in under one second. That was not a realistic assumption on a managed work computer.

15.9 now:

- opens Notes when needed;
- waits for the real sync action for up to ten seconds using DOM readiness observation plus bounded polling;
- respects the existing cross-window sync lock;
- displays accurate preparing, busy, requested and unavailable states without claiming Microsoft success prematurely;
- keeps local notes even when Microsoft authentication or Graph delivery fails;
- generates a generic **Pacefold** notebook destination instead of HSSys.

Pacefold still does not store Microsoft passwords. Existing delegated Microsoft authentication and fallback paths remain unchanged.

## Lower mini-player

The proven media row is no longer hidden behind another button. It is restored as the permanent lower window.

- Local audio remains on-device.
- Drag-and-drop and file-picker loading remain available.
- YouTube Music and Spotify use contained official embeds.
- Amazon Music remains best-effort because Amazon can refuse third-party framing.
- Pacefold does not automatically open an external music window.

The upper Media shortcut is removed from the permanent row because it duplicated the lower player.

## Notifications and taskbar state

15.9 removes the meaningless hard-coded numeric **1** from the app badge. The taskbar state is now a flag: attention is waiting or it is not.

- Only one current Pacefold notification is retained at a time.
- Repeated cues replace the existing Pacefold toast instead of stacking.
- Notifications are explicitly non-sticky and non-renotifying.
- When Pacefold is active, notification cleanup runs on an eight-second bounded cycle.
- Opening, acknowledging, snoozing, completing or entering off-hours clears notification state without falsely completing the cue.
- **Done** remains the only action that completes the underlying cue.

## Work hours

The revamp reads the existing Pacefold workday preference structure, including common start/end and active-day fields, and supports overnight work windows.

Outside configured work hours:

- taskbar badges are suppressed and cleared;
- open Pacefold notifications are closed;
- new service-worker notifications are suppressed after the app publishes its work state;
- the waiting cue is visually quieted rather than presented as active work.

The work-state check reconciles every five seconds while the app is visible and immediately after Pacefold preference changes, focus restoration or local-storage updates.

## Visual system

The visual direction is restrained rather than decorative:

- one compact upper Notes window;
- one compact lower player window;
- opaque, readable surfaces that remain above Notes modal dimming layers;
- no overlapping cards or hidden duplicate media controls;
- responsive layouts for desktop and 390 px mobile widths;
- dark, light, forced-colour and reduced-motion support.

## Reliability and recovery

- The verified core remains the only owner of schedules, offline caches and action completion.
- The revamp mounts after the integrated surface and reattaches after bounded root recovery.
- Existing note data is not renamed, discarded or migrated destructively.
- Duplicate capture, OneNote and cue actions remain guarded.
- Service-worker patches remain idempotent and replace earlier injected blocks rather than accumulating.
- Runtime failures continue to report through the bounded, privacy-redacted resilience journal.

## Validation

GitHub Actions reconstructs the checksum-verified release, injects the surface twice, and runs the existing core, offline, notification, storage and recovery gates.

The integrated browser gate additionally verifies:

- exactly one upper Notes window and one lower mini-player;
- the Notes heading opens the real Notes surface;
- redundant top Notes/Media and expanded Capture/Media controls remain hidden;
- the Notes dock and player remain above notebook modal dimming layers;
- desktop and 390 px geometry without horizontal overflow;
- nonnumeric taskbar badge calls;
- notification replacement and off-hours suppression contracts;
- local capture and slash routing exactly once;
- generic Pacefold OneNote delivery;
- root recovery without duplicate docks or players;
- desktop and mobile visual captures.

## Install or refresh

1. Open the Pacefold GitHub Pages app in Microsoft Edge.
2. Complete setup before installing the PWA.
3. Install through **… → Apps → Install Pacefold** and pin it when desired.
4. After 15.9 deploys, fully close every Pacefold and Edge PWA window once, then reopen Pacefold so the new cache-busted assets and service worker replace 15.8.

## Honest platform boundaries

A browser PWA cannot intercept the Windows taskbar click before focus, distinguish taskbar single-click from double-click, or continuously redraw the pinned icon face. A native Windows companion would be required for those behaviours.

Browser timers also cannot guarantee exact delivery while the app is closed, heavily throttled or the laptop is asleep. Pacefold remains honest about that boundary rather than manufacturing stale alerts.

## Version

Pacefold 15.9.0 revamp surface over the verified Pacefold 15.8 integrated runtime and 15.2.2 core archive.
