# Pacefold 15.4 corrective audit

## Vision guardrail

Pacefold is a quiet workday rhythm surface. The clock, current rhythm and one next useful action remain primary. Capture and audio stay available because they reduce switching; weather stays a glance; care remains contextual. Pacefold must not become a collection of mini-apps.

The Japanese influence is behavioural rather than decorative:

- **Ma:** preserve visual and cognitive space.
- **Kanso:** remove duplicate controls and expose only what is needed now.
- **Andon:** show one unmistakable attention state.
- **Kaizen:** record small useful actions without building a punitive backlog.

## 15.3 findings

### 1. Duplicate information architecture

The 15.3 Hub added Capture, Care and Weather tabs even though Capture was already permanently visible, audio was already permanently visible, and the verified core already contained Capture/Care/Sound entry points. The result was a second navigation system sitting on top of the first.

**Correction:** 15.4 has no Hub tabs and no three-card dashboard. There is one persistent work strip and one contextual drawer. Legacy compact Capture/Care/Sound/OneNote dock shortcuts are suppressed only when they are clearly edge/dock controls; settings remain available.

### 2. Duplicate branding

The Hub repeated the Pacefold name and tagline inside the application, competing with the core clock and existing brand.

**Correction:** the persistent strip contains no duplicate logo or tagline. The core remains the visual identity.

### 3. Care became another destination

Three manual care buttons reduced some bloat, but they still created a separate care destination beside the core cadence engine.

**Correction:** manual Care cards are removed. The Andon surface translates the live core cue into one readable action such as Hydrate, Look far, Move, Prayer or Meal.

### 4. Weather loaded too eagerly

15.3 requested both forecast and radar metadata during mount. Radar was therefore consuming network and CSP surface area even when the user never opened weather.

**Correction:** forecast uses a 20-minute local cache and refreshes quietly. Radar is lazy and loads only when Weather is opened. Both requests have hard timeouts and offline fallback.

### 5. Badge acknowledgement and cue completion were coupled

Focusing the installed app cleared the badge and also reset the Hub waiting state. That blurred two different concepts: acknowledging the taskbar indicator and completing the underlying action.

**Correction:** focus acknowledges the Windows badge only. The in-app Andon action remains until the real cue is handled. Completion clicks the core Clear/Done/Log/Start action when one is available.

### 6. Expensive global mutation scanning

15.3 watched the full document and rescanned cue candidates on every relevant mutation, including mutations originating inside the Hub. An idempotency patch prevented a hard feedback loop, but the architecture still performed unnecessary work.

**Correction:** scans are requestAnimationFrame-coalesced, mutations wholly inside the Kanso surface are ignored, and legacy suppression/cue detection share bounded scheduled passes.

### 7. Landing-page contamination

15.3 injected the Hub assets into both the marketing shell and the application shell even though the interactive surface is only needed in `/app/`.

**Correction:** 15.4 injects only into `/app/index.html`. The public landing page is untouched.

### 8. Weak visual hierarchy

The previous panel used three equal cards, many small buttons and several labels competing for equal importance.

**Correction:** 15.4 uses four levels only:

1. Core clock and rhythm.
2. One Andon action.
3. Always-open capture.
4. Quiet media rail and optional contextual drawer.

## 15.4 reliability changes

- Preserves all existing 15.3 local capture, folder-handle and volume keys.
- Adds a local error journal visible only when an actual surface issue exists.
- Adds secure-context, storage, folder, notification and service-worker checks.
- Adds drag-and-drop local audio and Media Session controls.
- Adds keyboard capture focus (`Ctrl+Shift+Space`) and play/pause (`Alt+P`).
- Keeps the guardian but reduces unnecessary restoration work.
- Extends the browser audit to reject the old card/tab architecture, prove landing-page isolation, test lazy radar, verify badge acknowledgement, restore after root removal and validate a 390px viewport.
