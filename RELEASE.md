# Pacefold 15.0.0 verified release

- Version: `15.0.0`
- Archive: `Pacefold_v15.0.0_Repository_Backup.zip`
- SHA-256: `65f8bada8b589c1858343ade0f2e8f2c38b8e5b6506dc411e68ac2ba2c20e98d`
- Release part: `release/pacefold-v15.zip.b64.part-00`

GitHub Actions decodes the archive, verifies SHA-256, confirms that the release version advanced from the previous deployed archive, and runs the build, static and browser-upgrade audits contained inside the release.

The archive contains the full static source tree, PWA manifest, service workers, icons, local pinned MSAL runtime and license, documentation, and the test/build scripts used for release validation.
