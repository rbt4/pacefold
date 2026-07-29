# Pacefold 20.0.1 — protected workday folio

- Surface version: `20.0.1`
- Preserved rhythm systems: `18.0.2`
- Integrated runtime: `15.8.0`
- Verified core version: `15.2.2`
- Enhancement entry point: `enhancements/inject.mjs`

## Release completion policy

An approved Pacefold implementation ships end to end by default. Work is not complete at a local worktree, commit, pushed branch, pull request, merge, or green validation run.

Completion requires the tested scope to be committed, pushed, merged into `main`, deployed through the production workflow, and verified on the cache-busted live page and app. The public page, app version, cache token, service worker, and release notes must agree, and the rendered live desktop and narrow/mobile surfaces must be inspected. The only exceptions are an explicit instruction to keep the work local, stop before release, or prepare review-only changes.

V20 is entirely additive in `enhancements/`. The checksum-verified archive is unchanged. The `pacefold-v20.css` and `pacefold-v20.js` layer loads after the retained V19.1 folio, scheduler, ribbon, preference, Quiet, Wafer, review, backup and storage systems. Injection remains idempotent.

The home surface is one continuous light folio. A clock with visible seconds, next cue, saved-location weather and the six Water, Timer, Away, Meal, Eyes and Move controls occupy the upper instrument. A permanent, roughly half-height notebook occupies the lower workspace. Notes are immediately writable; Sound replaces the notebook page in place. Neither uses a modal, blur scrim, flying sheet or ordinary close control.

The taskbar path now has one semantic state. Pending attention requests `setAppBadge()` without a number, allowing an installed Edge PWA on Windows to display its platform flag/dot. The same state is mirrored in the Pacefold brand, a visible dashboard marker and the favicon. Badging remains best effort and can be disabled by browser or workplace policy.

The notebook rail exposes a selectable automatic backup file. The working notebook remains in the current Edge profile's Pacefold site storage, while the protected JSON copy lives at the folder and filename the user selects. V20 stores the permitted file handle in browser-local IndexedDB, writes the versioned JSON after notebook and preference changes, refuses to overwrite it when local notebook storage is invalid, and recovers from it when storage is missing or corrupt. If Edge returns the file permission to `prompt`, the user must click **Reconnect backup** before recovery or writes can continue.

The active product contains no Japanese feature names or theme labels. Its visual language is Pacefold’s own: quiet neutral surfaces, clear information hierarchy, restrained colour by function and short material transitions.

OneNote delivery is retired. V19 removes its visible routes, makes queued delivery a no-op and removes Microsoft Graph from the app CSP. Existing preference fields remain readable for migration safety. Local capture, the full notebook, Copy day and `pacefold.backup.v1` remain.

The release gate runs construction, notebook, resilience, integrated, preserved-core, retained V19 and V20 browser suites. V20 covers the joined visual folio, visible seconds, empty-flag badging, synchronized fallback markers, selectable automatic backup, simulated local-storage recovery, desktop/mobile/Wafer containment, reduced motion, offline assets and single-copy injection.

## Notification ceiling

Notifications remain non-sticky, keep one retained toast, replace rather than stack, and stay inside configured work hours. Waiting state expires after `dueWindow`.

Pacefold does not implement Periodic Background Sync or Notification Triggers. Edge support is inconsistent and managed-device policy may block both. When the browser is closed, suspended, throttled or the laptop is asleep, exact notification delivery is not possible. On return, Pacefold reconciles elapsed wall time, drops stale low-priority backlog, resolves expired timers from stored timestamps and writes one consolidated status line.

Permission requests for notifications, persistent storage and app badging are best effort and degrade silently.

## Verified core archive

- Version: `15.2.2`
- Archive: `Pacefold_v15.2.2_Repository_Backup.zip`
- SHA-256: `2fbb5c9b1df8369eddd4a7e1b791d60d6f58b1bf4d51665e288fb88ec9409d2b`
- Release parts: `release/pacefold-v15.zip.b64.part-00` through `part-08`

GitHub Actions concatenates and decodes the archive, verifies SHA-256, confirms that the version advanced from the previous deployed archive, and runs the build, static, browser-upgrade, notification-action, offline and responsive audits contained inside the release.

The archive contains the full static source tree, PWA manifest and shortcuts, service workers, action and notification icons, local pinned MSAL runtime and license, documentation, and the test/build scripts used for release validation.
