# Pacefold 18.0.0 “Ma”

- Surface version: `18.0.0`
- Baseline workspace: `17.1.0`
- Integrated runtime: `15.8.0`
- Verified core version: `15.2.2`
- Enhancement entry point: `enhancements/inject.mjs`

The 18.0 release is entirely additive in `enhancements/`. The checksum-verified archive is unchanged. `pacefold-ma.css`, `pacefold-ma.js`, the synchronous self-hosted theme boot and the local variable-font subset are copied and cache-busted during injection. Injection remains idempotent.

The release gate runs the existing construction, notebook, resilience and integrated browser suites plus `enhancements/ma-audit.cjs`. The Ma suite covers single scheduler ownership, the minimum cue gap, four-hour drift, ribbon update cost, 340 × 150 wafer geometry, Window Controls Overlay fallback, forced colours, first paint, preference retention, Quiet DOM safety and single-copy injection.

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
