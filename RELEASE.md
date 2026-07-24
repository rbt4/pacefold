# Pacefold 15.2.3 verified release

- Version: `15.2.3`
- Archive: `Pacefold_v15.2.3_Repository_Backup.zip`
- SHA-256: `371481fd6d36322158097348743e4da9f85367910a3528e65cc7902c3d73754b`
- Release parts: `release/pacefold-v15.zip.b64.part-00` through `part-08`

GitHub Actions concatenates and decodes the archive, verifies SHA-256, confirms that the version advanced from the previous deployed archive, and runs the build, static, browser-upgrade, notification-action, offline and responsive audits contained inside the release.

The archive contains the full static source tree, PWA manifest and shortcuts, service workers, action and notification icons, local pinned MSAL runtime and license, documentation, and the test/build scripts used for release validation.
