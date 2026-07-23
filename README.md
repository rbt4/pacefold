# Pacefold

**Your day, quietly kept.**

Pacefold is a local-first, installable workday rhythm system. Its verified core keeps the clock, schedule, prayer/rhythm profile and one next useful action primary. Pacefold 16 adds an Origami layer that folds capture, media, weather and notification state into that rhythm instead of opening separate mini-apps.

## Pacefold 16 — Origami

### One identity

A folded **P** is now the Pacefold identity across the installed-app icon, maskable icon, browser favicon, shortcuts, notification artwork and the in-app rail. Hydration, eye distance, movement, prayer, meals, preparation, away time and diagnostics receive distinct folded notification glyphs while remaining visibly part of one family.

The installed taskbar icon is the static folded P. Windows taskbar badges remain a dot or number because a web app cannot redraw the pinned icon for every cue.

### Media Fold

Streaming no longer launches external service pages.

- **Spotify:** paste a Spotify track, album, playlist, artist, show or episode link. Pacefold validates it, removes tracking parameters and loads the official Spotify embed inside a sandboxed Media Fold.
- **YouTube:** paste a YouTube or YouTube Music video/playlist link. Pacefold converts it to a privacy-enhanced `youtube-nocookie.com` embed that stays inside Pacefold and respects the required embedded-player dimensions.
- **Local audio:** choose or drag an audio file into Pacefold. Playback, progress, volume and Media Session controls remain in the persistent bottom rail.
- **Amazon Music:** deliberately unavailable in the in-app player until Amazon provides a generally available secure playback integration. Pacefold does not iframe the full Amazon site or pretend that an unsupported player is reliable.

Remote players are never restored automatically after restart. A user must submit a service link for the current session, limiting unexpected network activity and stale third-party state.

### Foldstream, not a notebook

The previous notebook/export/folder concept is retired. Capture is now one chronological stream of small folded cards.

- Type naturally for a thought.
- Use `/task`, `/followup`, `/meeting`, `/incident`, `/link` or `/note` when a category matters.
- Pin, complete or delete directly in the stream.
- Today and earlier entries are separated without creating pages, sections, notebooks or synchronization setup.
- Existing 15.3/15.4 local captures migrate automatically.

`Ctrl+Shift+Space` focuses capture. `Alt+P` controls local audio.

### Private Fold

Capture remains local by default. Private Fold optionally encrypts Foldstream with AES-GCM using a key derived from a passphrase through PBKDF2-SHA-256 with 310,000 iterations.

- The passphrase and derived key are never stored.
- The key exists only in memory until Pacefold is locked or closed.
- After encryption succeeds, plaintext Foldstream and legacy capture keys are removed.
- Five failed unlock attempts create a temporary in-memory pause.
- Encrypted and unencrypted backups include integrity verification before replacement.
- Local writes are transactional: a checksummed primary copy and backup copy are maintained.

Private Fold protects stored capture text from casual local inspection. It does not claim to protect text while the app is unlocked, against a compromised browser/device, or against screen/keyboard monitoring.

### Weather Fold

A cached temperature glance stays in the rail. Forecast and radar remain inside Pacefold; radar loads only when Weather Fold is opened. Weather requests omit credentials and send only configured coordinates.

### Notification and taskbar repair

The release injector scans the generated core application and service workers for the actual notification icon references, replaces them with generated Origami artwork, updates the PWA manifest and shortcuts, and fails the build if it cannot prove that multiple source-specific references changed.

Focusing Pacefold acknowledges the Windows badge but does not silently complete the underlying cue. The folded-P action remains visible until Clear, Done, Log, Start or Acknowledge is applied exactly once.

## Security boundaries

- No Pacefold account, server, analytics, advertisements or remote JavaScript SDK.
- Content Security Policy permits only the required weather endpoints and sandboxed Spotify/YouTube frames.
- Microsoft Graph and Microsoft login origins are removed from the generated Origami application policy.
- Retired local OneNote/Graph/MSAL configuration can be removed through a user-confirmed cleanup action. This does not delete notes stored in Microsoft OneNote.
- Submitted streaming URLs are parsed against strict host, path and identifier allowlists. Arbitrary iframe URLs are rejected.
- Embedded players receive only the permissions needed for media playback; no camera, microphone or location permission is granted.
- Object embedding is disabled and the document base is restricted to self.

The complete design, threat and regression analysis is in [`AUDIT_16.md`](AUDIT_16.md). Security details are in [`SECURITY.md`](SECURITY.md).

## Verified core retained

Pacefold core 15.2.1 still provides:

- quiet notification actions and the durable exactly-once worker queue;
- profiles for secular, mindfulness, major-faith and custom rhythms;
- the default Muslim calculated-prayer/Hanafi/Toronto profile;
- preparation routines, hydration, meals, personal pauses and private day-close records;
- late-launch protection for hydration, eye-distance and movement cadence;
- installed-version migration and offline recovery.

## Honest Windows boundary

Microsoft Edge PWAs support static app artwork, taskbar badges, notification artwork/actions and right-click shortcuts. Windows does not let a website intercept a normal pinned-icon click before focus, distinguish single from double taskbar clicks, or continuously redraw the pinned icon face. Exact pre-focus custom click behaviour or a truly live icon requires a native Windows companion.

## Repository release format

The tested core source tree remains a checksum-verified Base64 archive under `release/`. Origami source is independently compressed and reconstructed from `enhancements/origami-source/`. GitHub Actions:

1. verifies and reconstructs the reviewed core;
2. runs core syntax, static, notification, offline and installed-upgrade tests;
3. reconstructs and injects Origami;
4. generates and validates the complete icon family;
5. proves source-specific notification references were replaced;
6. runs browser tests for media containment, hostile-URL rejection, Foldstream transactions, encryption, lazy radar, taskbar semantics, guardian recovery and 390 px layout;
7. deploys only after every gate succeeds.

Core SHA-256:

`50c4c2787300102704d577e6e221909e307866522d59422d13871a55085d63e7`

Origami version:

`16.0.0`

## Install and update

1. Open the Pacefold GitHub Pages site in Microsoft Edge.
2. Complete setup and use **… → Apps → Install Pacefold** when needed.
3. Pin the installed app.
4. After a 16.0 deployment, fully close every Pacefold window and reopen it once so the new service worker, manifest and icon shell activate.
5. Reinstall only if Edge still shows the previous icon or manifest after a full close/reopen and an Edge restart.

## Version

Pacefold Origami 16.0.0 over verified Pacefold core 15.2.1
