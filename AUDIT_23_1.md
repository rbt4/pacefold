# Pacefold 23 interaction restoration audit

## Root cause

The visible Pacefold 23 home controls were not the real controls. They were generic proxy buttons that searched for hidden V15/V19 elements and clicked whichever selector happened to exist. That created four user-visible failures:

1. **No clear action state.** “Water”, “Timer”, “Away” and “Meal” did not say whether a click would log, start, stop or return.
2. **No live tracking.** Water count, timer remaining time, active rest duration and meal duration were kept in preferences but not surfaced on the home clock.
3. **Cue ownership was split.** The Ma scheduler, V20 marker, V22 cue queue and V22 Daylight favicon all wrote overlapping notification state. Quiet mode could clear the native taskbar badge while another layer still believed a cue was waiting.
4. **A passing audit was not the same as a usable interface.** The prior browser audit verified that six buttons existed, but not whether their labels, counters and active states were understandable.

## Correction

The `action-dock-r1` layer adds one visible, compact control surface under the clock:

- **Log sip** shows today’s count against the configured target and logs in one click.
- **Timer** shows the configured duration, live remaining time, and a clear start/stop state.
- **Rest** becomes **Back** while active and shows elapsed time; the return click logs the completed rest.
- **Meal** shows elapsed time and clearly finishes/logs the session.
- **Eye reset** and **Move** are explicit one-click logs.
- **View log** opens the existing Worklog immediately.
- Source-coloured cue chips remain visible and actionable: blue water, green prayer, amber timer, teal rest, slate meal, purple eyes, green movement, and red review/diagnostic attention.
- The action layer uses the durable V22 cue queue and calls the scheduler’s preserved native badge functions directly, so Quiet mode no longer silently removes a waiting taskbar marker.

## Compatibility and safety

- Existing legacy controls remain in the document and remain the first execution path. The new dock invokes them so current timing, history and scheduler logic are preserved.
- A conservative local fallback is used only when a legacy target does not exist.
- No account, network, OneNote or external-storage behaviour was added.
- No raw `innerHTML` assignment or inline style-string construction was introduced.
- The established Pacefold 23 release marker remains unchanged, while the service-worker cache receives an `action-dock-r1` build suffix so installed PWAs cannot remain stuck on the previous bundle.
