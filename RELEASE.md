# Pacefold 15.1.4 verified release

- Version: `15.1.4`
- Archive: `Pacefold_v15.1.4_Repository_Backup.zip`
- SHA-256: `bb3c8c6a0e949e7480460beb2028457e95cc84132fd86f6720c0c6d56e622b92`
- Release parts: `release/pacefold-v15.zip.b64.part-00` through `part-08`

GitHub Actions concatenates and decodes the archive, verifies SHA-256, confirms that the version advanced from the previous deployed archive, and runs the build, static, browser-upgrade, notification-action, offline and responsive audits contained inside the release.

The archive contains the full static source tree, PWA manifest and shortcuts, service workers, action and notification icons, local pinned MSAL runtime and license, documentation, and the test/build scripts used for release validation.
