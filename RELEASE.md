# Pacefold 15.1.0 verified release

- Version: `15.1.0`
- Archive: `Pacefold_v15.1.0_Repository_Backup.zip`
- SHA-256: `891d27d65ca08df8070545d658b5b61624718dd592c6417542c9767dd2230e93`
- Release parts: `release/pacefold-v15.zip.b64.part-00` through `part-08`

GitHub Actions concatenates and decodes the archive, verifies SHA-256, confirms that the version advanced from the previous deployed archive, and runs the build, static, browser-upgrade, notification-action, offline and responsive audits contained inside the release.

The archive contains the full static source tree, PWA manifest and shortcuts, service workers, action and notification icons, local pinned MSAL runtime and license, documentation, and the test/build scripts used for release validation.
