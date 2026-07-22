# Pacefold 15.1.8 verified release

- Version: `15.1.8`
- Archive: `Pacefold_v15.1.8_Repository_Backup.zip`
- SHA-256: `b9caa6ed709871d602617d6027ecc50a9eda354294ab2e236bad962c108d0e9f`
- Release parts: `release/pacefold-v15.zip.b64.part-00` through `part-08`

GitHub Actions concatenates and decodes the archive, verifies SHA-256, confirms that the version advanced from the previous deployed archive, and runs the build, static, browser-upgrade, notification-action, offline and responsive audits contained inside the release.

The archive contains the full static source tree, PWA manifest and shortcuts, service workers, action and notification icons, local pinned MSAL runtime and license, documentation, and the test/build scripts used for release validation.
