# Music Magic r8

Music remains an official YouTube / YouTube Music IFrame API player with local saved links and local focus sounds.

## r8 behavior

- Album artwork drives a deterministic ambient room treatment without reading pixels from cross-origin media.
- Official YouTube playback remains visible as a compact source preview.
- Playlist rows gain local UI thumbnails from `i.ytimg.com` using the playlist video IDs returned by the official player API.
- Player states are mirrored into Clock for readable Playing / Paused / Buffering / Error status.
- A low-volume, locally generated lounge intermission can be started manually.
- After an explicit YouTube player error, the local intermission may start for up to 30 seconds if the user has already interacted with audio.
- Buffering never starts replacement audio.
- r8 does not inspect, skip, mute, cover, or otherwise alter YouTube advertising.

The existing `pacefold.stream.v1` state and My Music library remain compatible.
