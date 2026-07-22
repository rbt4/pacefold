# Pacefold 15.2.0 verified release

- Version: `15.2.0`
- Archive: `Pacefold_v15.2.0_Repository_Backup.zip`
- SHA-256: `9a45d8f9c89d18ff5595146ad8b9ac4a6df7cf2c255e6dd2c37c4c71c9f8a2a1`
- Release parts: `release/pacefold-v15.zip.b64.part-00` through `part-08`

GitHub Actions concatenates and decodes the archive, verifies SHA-256, confirms that the version advanced from the previous deployed archive, and runs the build, static, browser-upgrade, notification-action, offline and responsive audits contained inside the release.

The archive contains the full static source tree, PWA manifest and shortcuts, service workers, action and notification icons, local pinned MSAL runtime and license, documentation, and the test/build scripts used for release validation.
