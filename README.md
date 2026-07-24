# Pacefold

**One day, gently folded.**

Pacefold is a local-first, installable workday rhythm system. The verified core keeps the clock, schedule and one next useful action primary. Pacefold 15.8 brings the HSSys notebook, current cue, capture, contained media, weather, OneNote and diagnostics into one quiet integrated dock without turning the workday into another dashboard.

## Pacefold 15.8 — Integrated quiet dock

The permanent interface is one centered row, approximately 48 px tall:

- an origami pulse that reflects calm, new attention or an acknowledged waiting action;
- the current actionable cue only when something is waiting;
- one-line local-first capture;
- direct Notebook and contained Media access;
- one disclosure control for the remaining tools.

The compact command surface opens only when requested and contains the current cue, Capture, Notebook, Media, Weather, OneNote and local diagnostics. The original proven controls remain underneath as the source of truth, so 15.8 does not introduce parallel timers, storage or duplicate action implementations.

At 390 px, the dock condenses to the pulse, cue or capture field, and one controls button. The complete command surface remains available without horizontal overflow.

## Capture and HSSys notebook

Capture is always available and saves through the existing local-first notebook path. A leading slash routes the note without adding another picker:

- `/incident` → Incidents
- `/follow` → Follow-ups
- `/inspect` → Inspections
- `/jhsc` → JHSC
- `/construction` → Construction
- `/notification` → Notifications
- `/resource` → Resources

Unprefixed notes go to Daily. The full dated HSSys notebook retains search, section tabs, editing, completion and deletion.

## Functional taskbar state

The taskbar badge now has one stable meaning: **a new actionable cue has not been acknowledged yet**.

- Opening or focusing Pacefold can quiet the taskbar badge and close Pacefold notifications without completing the action.
- The first origami-pulse interaction on a new cue performs acknowledgement only.
- The next interaction opens the compact controls.
- **Done** is a separate explicit action and remains the only path that completes the current cue.
- The window title carries the clean actionable label, such as “Drink water” or “Look far,” rather than internal helper text.

Pacefold also adds PWA shortcuts for Current action, Capture, Notebook and Media wherever the installed manifest is available. Notification artwork is generated as source-specific PNG for more dependable Windows rendering.

## Keyboard access

- `Ctrl` + `Shift` + `Space` toggles the compact controls.
- `/` focuses Capture when no text field is active.
- `Escape` closes the compact controls.

## OneNote bridge

Local persistence always completes before optional Microsoft delivery. Pacefold uses these paths in order:

1. an existing Pacefold OneNote adapter;
2. an already-connected MSAL session with the required OneNote scopes;
3. Windows Share, where OneNote can be selected;
4. Copy Page for manual paste.

The intended destination remains the **HSSys** notebook and a **Pacefold** section. Identical page sends share one in-flight request, cross-window locks end when the real request settles or safely times out, and failed delivery never removes the local page. Pacefold does not store Microsoft passwords or access tokens.

## Contained player

- YouTube Music and Spotify use official embeds.
- Amazon accepts an official regional playlist, album, station or track URL, removes tracking parameters and preserves that exact cleaned link.
- Amazon playback remains best-effort because Amazon can refuse third-party framing.
- Pacefold never automatically opens an external player window.
- Local audio remains on-device and supports picker and drag-and-drop paths.

## Reliability retained from 15.7.1

- Malformed notebook data is removed only after a verified recovery copy succeeds.
- Setup owns the screen completely; rapid onboarding transitions cannot restore stale UI.
- Ordinary content containing “get started” cannot be mistaken for setup.
- Repeated diagnostics collapse into counted, privacy-redacted records.
- Duplicate capture, provider, cue and OneNote actions are centrally suppressed.
- Repeated injection replaces old assets and service-worker blocks instead of stacking them.
- The verified core remains the sole owner of Pacefold’s offline caches.

## Security and privacy

- Every original Pacefold action remains registered and audited.
- Provider URLs are restricted to official allowlists.
- Player frames use `no-referrer`, a narrow Content Security Policy and a sandbox that cannot escape through popups.
- Rhythm data, notebook entries, recovery copies, sync queue, preferences and diagnostics remain on the device.
- Weather requests contain forecast coordinates.
- Microsoft page content is sent only when OneNote synchronization or Windows Share is explicitly used.
- Pacefold contains no account system, analytics or advertising.

## Honest platform boundaries

Microsoft Edge PWAs support taskbar badges, notification actions and right-click shortcuts. Windows does not let a website intercept the pinned-icon click before the app receives focus, distinguish single from double clicks on the Windows taskbar itself, or continuously redraw the pinned icon face. Pacefold therefore makes acknowledgement, badge clearing, notifications, launch shortcuts and the in-app pulse seamless within the web-platform boundary. Exact pre-focus taskbar-click behaviour would require a native Windows companion.

Amazon Music does not provide the same generally available iframe playback contract as YouTube or Spotify. Pacefold can preserve and attempt to contain an official Amazon URL, but Amazon can still refuse to render it inside another application.

## Validation

GitHub Actions reconstructs the checksum-verified core release, runs the original static, browser, offline, notification-action and installed-upgrade suite, injects the integrated surface twice, and then requires three independent browser suites:

1. Notebook and provider integration;
2. destructive resilience and recovery injection;
3. integrated dock, taskbar semantics and desktop/mobile visual capture.

The 15.8 gate verifies exact single-root and single-dock architecture, slash capture exactly once, acknowledgement without false completion, second-interaction disclosure, explicit Done completion, Notebook proxying, root restoration, launch shortcuts, clean actionable labels, a dock no taller than 60 px and no 390 px overflow.

Core release SHA-256:

`50c4c2787300102704d577e6e221909e307866522d59422d13871a55085d63e7`

Surface version:

`15.8.0`

## Install

1. Open `https://rbt4.github.io/pacefold/` in Microsoft Edge.
2. Complete setup before installing.
3. Install through **… → Apps → Install Pacefold** and pin it when desired.
4. After 15.8 deploys, fully close every Pacefold and Edge PWA window once, then reopen Pacefold so the new worker, PNG notification assets, shortcuts and integrated shell replace cached 15.7 files.

## Version

Pacefold 15.8.0 integrated surface over Pacefold core 15.2.1
