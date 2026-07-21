# Pacefold 14 verified release

- Version: `14.0.0`
- Archive: `Pacefold_v14_Repository_Backup.zip`
- SHA-256: `2d038b43e42a30308a22cd329e59dec94310232ed0209c3c07132ef617746e32`
- Release parts: `release/pacefold-v14.zip.b64.part-00` through `part-09`, followed by `part-10-00` through `part-10-07`

GitHub Actions concatenates the parts in lexical order, decodes the archive, verifies the whole-file SHA-256, and then runs the build and validation scripts contained inside the release.

The archive contains the full static source tree, PWA manifest, service workers, icons, documentation, and test/build scripts used for local validation.
