# Pacefold 15.6 corrective audit

## Executive finding

Pacefold 15.5 passed the tests that were written for its intended architecture, but those tests encoded several incorrect product decisions. The implementation was internally consistent while being wrong for the actual Pacefold vision and unsafe around the host setup lifecycle.

15.6 treats the reported behaviour as a release-blocking regression and changes both the product architecture and the browser contract.

## Root causes

### 1. The injected surface ignored setup ownership

15.5 appended a fixed, highest-z-index two-row surface whenever `/app/` loaded. It did not determine whether the verified core was showing setup, onboarding or the configured Today view. The surface also forced body padding and captured pointer events. This could obscure setup controls, make buttons appear dead and leave the user cycling through onboarding.

The guardian compounded the problem by restoring the removed surface after any host body replacement, including transitions performed by setup.

### 2. Amazon was deliberately non-editable

The Amazon field was rendered `readonly`, and its load action replaced the user intent with the Amazon Music home URL. The UI therefore could not accept the user’s playlist even though official Amazon Music URLs could be validated safely.

### 3. The notebook was explicitly designed not to be a notebook

15.5 described the Fold Stack as “Not a notebook” and offered only a chronological list with complete/delete actions. That contradicted the HSSys workspace concept: dated pages, meaningful sections, editing, retrieval and optional OneNote delivery.

### 4. OneNote was removed instead of made resilient

The removal reduced permissions but also removed the intended Microsoft workflow. The correct design is local-first capture with optional, retry-safe delivery—not Microsoft as a prerequisite and not no Microsoft path at all.

### 5. Button coverage was too indirect

The 15.5 audit clicked a few happy paths but did not prove that every rendered `data-pf-action` had a registered handler. A visually present control could therefore be dead without failing release validation.

## 15.6 corrections

### Setup isolation and recovery

- The workspace does not mount while a visible setup or onboarding surface exists.
- If setup appears after mount, the workspace and forced body padding are removed immediately.
- The guardian is setup-aware and only restores the workspace after onboarding is absent.
- Configured Pacefold state is snapshotted to a small IndexedDB recovery store. If localStorage unexpectedly disappears and the core returns to setup, the snapshot can be restored once before reloading.
- The public landing page remains untouched.

### Real HSSys notebook

The notebook now has dated pages and eight sections:

- Daily
- Follow-ups
- Incidents
- Inspections
- JHSC
- Construction
- Notifications
- Resources

It supports always-open capture, date navigation, section tabs, search, editing, completion and deletion. Existing local Folds/captures migrate into dated notebook entries.

### Optional OneNote bridge

Local persistence always completes first. OneNote delivery is layered on top through:

1. an existing Pacefold OneNote adapter;
2. an already-connected MSAL session with OneNote scopes;
3. Windows Share;
4. copy-page fallback.

Failed page syncs remain queued locally. The 15.6 surface does not store Microsoft access tokens or create a second credential form.

### Amazon playlist handling

- The field is editable.
- Only HTTPS URLs on official regional Amazon Music domains are accepted.
- Tracking parameters are removed before persistence.
- The exact cleaned playlist, album, station or track URL is loaded into the contained frame.
- Amazon may still refuse third-party framing; Pacefold retains the saved URL and explains the provider boundary instead of silently navigating away.

### Layout correction

The permanent UI is reduced to:

1. one compact Pacefold/Andon/capture row;
2. one lowest-edge media row.

The real notebook, full player, weather and diagnostics open only on request. Mobile layout stacks without horizontal overflow.

### Security correction

- Provider frames use strict official-domain allowlists.
- Content Security Policy limits frame and network origins.
- `allow-popups-to-escape-sandbox` is forbidden.
- External player windows are not opened automatically.
- Local audio stays on-device and supports picker and drag/drop paths.
- Diagnostics exclude notebook text and credentials.

## New release contract

The 15.6 audit fails unless all of the following are true:

- no injected surface is present during setup;
- the surface remounts after setup ends;
- every rendered action is registered;
- notebook entries save, render and edit;
- the OneNote bridge receives the correct HSSys page payload;
- the user’s Amazon playlist URL is preserved after safe cleanup;
- hostile provider URLs are rejected;
- the player opens no external windows;
- no frame can escape through popup permission;
- cue completion executes exactly once;
- guardian restoration does not duplicate the surface;
- the 390 px notebook layout has no horizontal overflow;
- the unchanged core checksum, static, notification, offline and installed-upgrade suite remains green.

## Platform boundary

Pacefold can use official YouTube and Spotify embed contracts. Amazon Music does not currently offer the same generally available embed guarantee, so exact Amazon playback inside Pacefold remains best-effort and provider-controlled. The application must never misrepresent that boundary or bypass it with a hidden external launch.
