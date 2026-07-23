# Security and privacy

Pacefold is a static, local-first Progressive Web App. It has no Pacefold server-side application, account system, analytics endpoint, advertising SDK or remote JavaScript dependency.

## Release integrity

The Pages workflow reconstructs the pinned core archive and rejects it unless its SHA-256 matches the reviewed build. The independently versioned Origami layer is reconstructed from compressed repository parts. Syntax, static, notification-action, offline, installed-upgrade, icon-replacement, encryption, hostile-URL and responsive browser tests must pass before deployment.

The release injector generates the installed-app and notification PNG files itself, rewrites the real generated notification references, and writes a machine-readable report. Deployment fails when fewer than three source-specific notification references are proven to have changed.

## Local data

Core preferences, activity records, notification deduplication, notification-action history, profiles and custom moments remain in same-origin browser storage. The service-worker action queue contains only cue identity, source, action and timestamp and expires old entries.

Foldstream uses a checksummed transactional primary and backup record. Existing legacy captures are normalized before migration. Imports are size-limited and must pass product/format/integrity checks before replacement.

## Private Fold encryption

Private Fold is optional. When enabled:

- AES-GCM encrypts the complete Foldstream payload;
- PBKDF2-SHA-256 derives the key from the user passphrase using 310,000 iterations and a random salt;
- every encryption uses a fresh random IV;
- the passphrase and derived key are never persisted;
- plaintext Foldstream, backup and legacy capture keys are removed only after encrypted persistence succeeds;
- the in-memory key is discarded on lock or close;
- repeated unlock failures cause a temporary in-memory pause;
- exported encrypted backups contain the ciphertext metadata, not plaintext entries.

This protects stored text against casual local inspection while Pacefold is locked. It does not protect an unlocked page, a compromised browser profile/device, malicious extensions with page access, screen capture, keylogging or memory inspection.

## Remote network boundaries

The generated Origami application removes Microsoft Graph and Microsoft login origins from its Content Security Policy. The old OneNote surface is retired. A user-confirmed cleanup can remove local keys whose names match OneNote, Graph-note or MSAL configuration; it cannot and does not delete data stored by Microsoft.

Allowed remote functions are deliberately narrow:

- Open-Meteo forecast requests and RainViewer radar images receive configured coordinates only and omit credentials.
- Spotify content loads only after the user submits a URL that passes an exact Spotify host/type/identifier parser. Pacefold creates the canonical official embed URL and discards submitted query parameters.
- YouTube content loads only after the user submits an accepted YouTube/YouTube Music host and valid video or playlist identifier. Pacefold uses the privacy-enhanced `youtube-nocookie.com` embed origin.
- Amazon Music is not embedded because a generally available secure playback integration is not available.

Pacefold does not load arbitrary iframe URLs. Frames are sandboxed, use strict referrer handling and receive media/presentation permissions only. Camera, microphone, geolocation and arbitrary top-navigation permissions are not granted. `object-src` is disabled and `base-uri` is restricted to self.

## Reporting

Do not place personal capture content, passphrases, tokens or private workplace information in a public issue. Report a reproducible security problem with the affected version, browser, steps and sanitized evidence.
