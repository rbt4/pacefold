# Pacefold 15.1.6 verified release

- Version: `15.1.6`
- Archive: `Pacefold_v15.1.6_Repository_Backup.zip`
- SHA-256: `ceae7e8d0202cd1fb4e266668089ce811548b5d93b9f09ff53d6999d4edcff6f`
- Release parts: `release/pacefold-v15.zip.b64.part-00` through `part-08`

GitHub Actions concatenates and decodes the archive, verifies SHA-256, confirms that the version advanced from the previous deployed archive, and runs the build, static, browser-upgrade, notification-action, offline and responsive audits contained inside the release.

The archive contains the full static source tree, PWA manifest and shortcuts, service workers, action and notification icons, local pinned MSAL runtime and license, documentation, and the test/build scripts used for release validation.
