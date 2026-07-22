# Pacefold 14.0.1 verified release

- Version: `14.0.1`
- Archive: `Pacefold_v14.0.1_Repository_Backup.zip`
- SHA-256: `2169d7650cd3cd2c3227acc068c2f2481dfe5719e3faa1e95f70baec38b214e8`
- Release part: `release/pacefold-v14.zip.b64.part-00`

GitHub Actions concatenates the parts in lexical order, decodes the archive, verifies the whole-file SHA-256, and then runs the build and validation scripts contained inside the release.

The archive contains the full static source tree, PWA manifest, service workers, icons, documentation, and test/build scripts used for local validation.
