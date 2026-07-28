# Changelog

## 18.0.0 — Ma (間)

- Replaced the sequence dots and separate progress bar with one continuous workday ribbon: spent paper, raw paper, a true-position now marker, hour hairs, creases and completed-session bands.
- Added stable tabular clock typography, a single changing-digit minute fold, a still colon, discreet seconds hairline and the 340 × 150 Wafer density.
- Added continuous solar light temperature, one CSS-interpolated meter primitive, Windows High Contrast, reduced-transparency, reduced-motion and transition-free boot handling.
- Added Window Controls Overlay manifest support with full fallback and draggable/no-drag title-bar regions.
- Added one cue-delivery scheduler with priority, a four-minute default delivery gap, focus suppression, one defer-then-drop cycle and decaying waiting state. The verified core remains the only cue-completion owner.
- Added deliberate sleep/lock reconciliation: one return line, no backlog burst, cadence re-anchoring and silent resolution of elapsed stored timers.
- Added per-weekday work hours and Desk, Field, Half day and Off types, plus a one-click today-only override.
- Added Fold Review and merged the rhythm summary into Copy day without scores, streaks or encouragement copy.
- Added one-click Quiet with exact preference restoration and no cue/category detail left in the rendered DOM.
- Added visible ritual option menus while retaining existing Shift-click behaviour.
- Added `pacefold.backup.v1`, dry-run restore differences, schema migration, storage estimates, persistence requests and audio-import capacity guardrails.
- Added a dedicated Ma audit covering scheduler ownership, cue gaps, drift, ribbon cost, Wafer geometry, WCO fallback, forced colours, boot, additive preferences and Quiet.
- Kept Periodic Background Sync and Notification Triggers out of the product and documented the browser delivery ceiling.

## 17.1.0 — Rhythm-first return

- Restored the clock and its original workday rhythm as Pacefold's default home surface.
- Kept Noodles/custom preparation, hydration, away, meal, eye-care, movement and prayer/meditation engines intact and made their workline deliberately visible again.
- Changed the integrated notebook into a transient fold-out sheet instead of a persisted default screen.
- Fold the notebook closed after a successful save, on Escape, on a click back to the clock, when the app is hidden, or after one quiet minute of inactivity.
- Preserve unsaved notebook text locally across a fold, refresh or app restart.
- Keep compact Capture quiet: it saves to the notebook without opening the full document.
- Route the PWA Capture shortcut to the compact capture field and the Notebook shortcut to the full fold-out sheet.
- Close Music back to the rhythm clock instead of unexpectedly reopening a previous notebook.
- Cache-busted every injected asset and worker with the 17.1.0 surface release.

## 17.0.0 — Sumi workspace overhaul

- Replaced the competing 16.x surface layers with one explicit compact/notebook/music workspace contract.
- Made notebook and music mutually exclusive: Music folds the notebook away, and closing Music restores the prior notebook state.
- Reduced the five-plane, 620 ms choreography to one restrained 220 ms material fold with no bounce or cascading child animations.
- Joined the paper cover, notebook, black library and black footer under one width, hinge and geometry system.
- Added a focused open-surface state that quietly recedes the clock instead of leaving oversized clock fragments behind the notebook.
- Reworked the Japanese stationery hierarchy, writing surface, paper tabs, black audio library and core workday controls around warm paper, charcoal ink and one deep-green accent.
- Added stale-state containment so a restored or conflicting open state cannot overlap notebook content with the music library.
- Fixed restored music-drawer `aria-expanded` and accessible-label state.
- Added browser audit coverage for exclusive state transitions, aligned cover/library geometry and restored drawer accessibility.
- Cache-busted every injected asset and worker with the 17.0.0 surface release.

## 16.3.0 — Kinetic origami corrective release

- Replaced the shallow height-and-opacity effect with explicit opening and closing motion states.
- Added a five-stage notebook fold, alternating leaf hinges, central crease lighting, Pacefold-mark flip and paper-settle choreography.
- Rebuilt the local-audio drawer as a bottom-hinged black tray with staged header, navigation and body folds.
- Kept closing surfaces mounted for the full animation and clear motion markers after a bounded 620 ms window.
- Added `aria-expanded` state to notebook and player controls.
- Unified notebook, drawer and footer geometry under shared variables so every animation remains collision-free.
- Removed the visible notebook-tab scrollbar, refined page ruling, improved focus treatment and limited compositor hints to active motion.
- Added reduced-motion and forced-colour fallbacks for the new fold layers.
- Cache-busted every injected asset, stamped both workers and upgraded the release/audit contracts to 16.3.0.
- Restored the README core checksum required by the repository verifier.

## 16.2.0 — Unified desktop workspace

- Joined the notebook, player drawer and player footer into one centered desktop shell.
- Added cache-busted surface assets and worker release stamps.
- Reduced redundant notebook/player renders and prevented legacy surface reconciliation loops.

## 16.1.0 — Origami identity

- Added the folded Pacefold mark, paper tabs, notebook hinge styling and initial fold motion.

## 15.8.0 — Integrated quiet dock

- Replaced the layered permanent rail with one centered 48 px dock that exposes the current cue, local-first capture, Notebook, contained Media and one progressive-disclosure control.
- Added a compact command surface for the current action, Capture, Notebook, Media, Weather, OneNote and local diagnostics without creating parallel timers, storage or action implementations.
- Rebuilt the visual layer as an offline-safe Japanese notebook material with warm paper surfaces, subtle ruled texture, a refined origami mark and consistent embedded vector icons instead of platform-dependent glyphs.
- Added slash-routed capture for Daily, Follow-ups, Incidents, Inspections, JHSC, Construction, Notifications and Resources.
- Defined one taskbar meaning: the badge represents a new unacknowledged actionable cue.
- Made Quiet clear the app badge and Pacefold notifications without completing the underlying cue.
- Added Remind 10m, which keeps the cue unresolved, stores a local reminder lease and re-arms taskbar attention when the same action is still waiting.
- Kept Done as the only completion path and clear acknowledgement/reminder state after completion so future cues cannot inherit stale taskbar behaviour.
