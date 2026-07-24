# Pacefold 15.7 resilience audit

## Scope

15.7 is a hardening release over the 15.6 HSSys Notebook. It does not add another destination or alter the quiet workday hierarchy. The pass targets failures that appear during setup transitions, repeated updates, damaged browser storage, rapid repeated input and multiple open Pacefold windows.

## Confirmed 15.6 weaknesses

### Guardian lifecycle mismatch

The main Notebook runtime recognized the verified core’s `data-onboard-profile` controls, but the separate guardian did not. A root preserved before onboarding could therefore be reattached while the core was still presenting setup.

### Stale-root restoration

The guardian retained the removed DOM root while setup was active. Reattaching that tree could preserve stale event listeners and pre-setup UI state rather than rebuilding against the configured host.

### Accumulating service-worker patches

The injector removed older Kanso and Origami tails but did not reliably remove the 15.6 Notebook tail. A later release could execute more than one notification wrapper and more than one activation handler.

### Overlay-owned cache deletion

The 15.6 appended activation handler deleted Pacefold-named caches that did not contain the overlay marker. Core caches do not use that marker, so the overlay could remove caches owned by the verified offline core.

### Startup ordering

The Notebook runtime was loaded with `async`. A recovery layer could not be guaranteed to inspect local storage before the Notebook parsed it.

### Unprotected repeated actions

The surface relied on individual handlers to avoid duplicate capture, sync, provider, cue and entry actions. Rapid clicks or two open Pacefold windows could submit the same operation more than once.

## 15.7 corrections

- Guardian setup selectors now include the verified core controls.
- Setup transitions clear the preserved root and force a fresh reconciliation afterward.
- Focus, visibility and bfcache returns trigger bounded reconciliation.
- Startup is ordered as guardian, resilience preflight, then Notebook runtime using `defer`.
- Malformed notebook JSON is copied to a bounded recovery slot before the active key is removed.
- Legacy entries missing a section are normalized to Daily.
- Recovery copies are pruned to the latest three.
- Rapid duplicate actions are suppressed by action-specific fingerprints and time windows.
- Provider locks include the active provider and URL, so a repeated Amazon load is blocked without blocking a different provider or URL.
- OneNote page delivery uses a short cross-window local lease.
- Error diagnostics retain only 20 privacy-trimmed messages and remove URLs.
- Service-worker additions use removable BEGIN/END blocks.
- Notification wrapping is guarded by an explicit worker registration marker.
- The overlay no longer deletes any cache; cache ownership remains with the verified core.

## Failure-injection contract

The release is blocked unless all of these pass:

- two consecutive injections produce one guardian, one resilience preflight, one Notebook runtime and one worker patch;
- the real core setup shows no lower workspace;
- a setup transition removes the current root and does not reattach its stale DOM tree;
- malformed notebook JSON is recovered without preventing startup;
- recovery storage remains bounded;
- legacy entries receive a valid section;
- two immediate capture submissions produce one captured entry;
- a foreign-window OneNote lease blocks sync;
- two immediate local sync clicks produce one OneNote payload;
- 25 recorded errors produce a 20-entry sanitized journal;
- two identical Amazon loads produce one contained frame;
- a different hostile provider URL is still evaluated and rejected;
- two immediate cue actions complete the cue exactly once;
- ordinary host body replacement restores one root;
- the full notebook remains usable at 390 px without horizontal overflow;
- the original checksum, static, notification-action, offline and installed-upgrade suite remains green.

## Boundary retained

Amazon Music can still refuse third-party framing. The resilience layer does not bypass that provider decision and does not fall back to an automatic external launch.
