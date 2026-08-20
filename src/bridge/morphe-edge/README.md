# Pacefold Music Bridge (r9)

This optional Manifest V3 extension gives Pacefold a privileged playback host on `music.youtube.com` while keeping the Pacefold PWA itself browser-only.

## Why it exists

Morphe's Android implementation works because it patches the YouTube Music host itself rather than trying to control a cross-origin iframe from outside. Pacefold cannot apply Android bytecode patches, so r9 uses the browser equivalent: a content script with page-level access in a dedicated YouTube Music tab.

The implementation is original Pacefold code. Morphe was used as an architectural reference for the feature set and interception point. No Morphe source is copied into this extension.

## Features

- Ad Shield: detects YouTube's in-player ad state, clicks available skip controls, suppresses promo surfaces, and advances/mutes ad media while the interruption is active.
- SponsorBlock: asks the public SponsorBlock API for non-music / sponsor segments and jumps over matching segments.
- Pacefold transport bridge: play/pause, previous/next, seek, volume and load a YouTube/YouTube Music URL from Pacefold.
- Persistent repeat-track option.
- Player state, artwork and metadata mirrored back into Pacefold.
- Existing official iframe player remains the fallback when this extension is not installed or bridge mode is off.

## Install in Edge or Chrome

1. Download or clone this repository.
2. Open `edge://extensions` (or `chrome://extensions`).
3. Enable Developer mode.
4. Choose **Load unpacked** and select `src/bridge/morphe-edge`.
5. Open Pacefold and its Music room, then choose **Use Morphe bridge**. The bridge opens or reuses a YouTube Music tab.

A managed work browser may disable unpacked extensions. Pacefold continues to use its official YouTube iframe fallback in that case.

## Privacy

The bridge stores only local settings and the engine tab id in extension storage. SponsorBlock lookups send the current YouTube video id to `sponsor.ajay.app` only when SponsorBlock is enabled. No Pacefold notes, work logs, settings, or other application data are sent.

## Reference

- Morphe patches: https://github.com/MorpheApp/morphe-patches
- SponsorBlock: https://sponsor.ajay.app/
