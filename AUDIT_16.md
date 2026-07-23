# Pacefold 16 Origami audit

## Why 15.4 was rejected

Pacefold 15.4 fixed several real technical faults, but it still missed the product vision in four important ways:

1. Streaming was presented as a Pacefold feature but opened separate websites, breaking the hub concept.
2. Capture still behaved like a notebook/export utility rather than a frictionless extension of the workday rhythm.
3. The notification artwork work was not visibly tied to the generated installed application, so it was difficult to trust that the promised icon family reached Windows notifications.
4. The visual language was polished but generic. It did not make the name Pacefold feel inevitable or memorable.

Version 16 treats those as architecture failures, not preference tweaks.

## Product guardrail

Pacefold is not a general productivity dashboard, document editor or streaming client. It is a quiet workday rhythm system with four subordinate folds:

- **Action Fold:** one current cue, readable and actionable.
- **Foldstream:** capture without page or notebook administration.
- **Media Fold:** local or approved embedded playback without leaving Pacefold.
- **Weather Fold:** context, not a destination.

The verified core clock, rhythm and next useful action remain primary.

## Origami identity

The folded P uses one geometric family across:

- installed app icons at 192 and 512 pixels;
- maskable app artwork;
- browser favicon;
- Capture, Clear, Media and Settings shortcuts;
- default, hydration, eye-distance, movement, prayer, meal, preparation, away-time and diagnostic notifications;
- the in-app Pacefold rail and current-cue state.

The injector does not assume that the earlier source paths are named consistently. It scans actual generated JavaScript/service-worker literals, classifies references by cue keywords, rewrites them to generated Origami PNGs and records every changed reference. A release with fewer than three proven replacements fails.

## Media Fold decisions

### Spotify

Pacefold accepts supported Spotify URLs, validates the hostname and resource type, validates the identifier and constructs a canonical `open.spotify.com/embed/...` URL. Submitted query parameters are discarded. The iframe is sandboxed and receives only autoplay/encrypted-media/fullscreen permissions.

### YouTube and YouTube Music

Pacefold accepts supported YouTube hosts and extracts only a valid video or playlist identifier. It uses `youtube-nocookie.com` and preserves at least a 200 by 200 visible player. The iframe is sandboxed and receives only autoplay/encrypted-media/picture-in-picture/fullscreen permissions.

### Local audio

Local files use an object URL inside the page. Pacefold revokes replaced object URLs, exposes progress/volume controls and uses Media Session handlers when supported.

### Amazon Music

Amazon Music is omitted. Embedding the full site would be brittle and require weaker frame/navigation policy; its full playback integration is not generally available. The UI states this boundary rather than opening Amazon externally or pretending to provide a secure player.

## Foldstream decisions

The notebook/page/category hierarchy is removed. One input accepts normal text plus a small set of explicit slash commands. Entries are normalized, length-limited, capped, checksummed and stored transactionally.

The primary record is copied to backup before replacement. Reads verify checksum and fall back to backup. Legacy captures migrate through the same normalizer.

## Security threat model

### Addressed

- casual reading of locked Foldstream storage through optional AES-GCM encryption;
- partial/corrupt local writes through a checksummed primary and backup;
- arbitrary iframe injection through strict URL parsing and canonical construction;
- tracking/session query propagation from submitted media links;
- silent restoration of third-party remote players after restart;
- unintended Graph/login network access from the Origami shell;
- remote JavaScript supply-chain expansion;
- stale notification icon references;
- a taskbar focus event falsely completing an active cue;
- stale dialogs outranking the newest active cue;
- unbounded observer/guardian feedback;
- oversized or malformed backup import.

### Not claimed

- protection while the user has unlocked the vault;
- protection from malicious browser extensions or a compromised operating system;
- DRM bypass, background playback guarantees or subscription entitlement;
- dynamic per-cue replacement of the pinned Windows taskbar icon;
- exact single-click versus double-click interception before Windows focuses the PWA;
- deletion of Microsoft-hosted OneNote data.

## Browser regression gates

The Origami browser audit verifies:

- the public landing page remains untouched;
- the app mounts one versioned Origami surface;
- Pacefold/folded-P identity and hierarchy are visible;
- old notebook/card/tab language is absent;
- no external JavaScript is loaded;
- Foldstream primary and backup checksums agree;
- task completion persists;
- Spotify canonicalization, sandbox and containment;
- YouTube privacy-enhanced origin, minimum dimensions and containment;
- hostile media URLs cannot create frames;
- encrypted capture text is absent from every local-storage value;
- lock/unlock restores the encrypted entry;
- radar remains lazy;
- taskbar acknowledgement does not complete a live cue;
- the Origami cue action completes it exactly once;
- the guardian restores the surface after host body replacement;
- a 390-pixel viewport has no horizontal overflow;
- generated PNGs are structurally valid;
- actual generated sources reference source-specific Origami notification icons.

## Release decision

Pacefold 16 may merge only after the unchanged core audit and the complete Origami audit both pass on the exact final workflow. A successful branch build is required but does not by itself prove that the post-merge Pages deployment has propagated to every Edge cache.
