# Pacefold 24.0.0 release

## Release identity

- Public release: **24.0.0**
- Experience revision: **unified-r1**
- Product: **Pacefold — Quiet Workday Rhythm**
- Public site: **https://rbt4.github.io/pacefold/**

## What changed

Pacefold 24 consolidates the strongest ideas from the project into one current product:

1. The Clock becomes a complete day instrument with analog and digital time, live seconds, Day Unfold progress and a moving workday sun.
2. Prayer or personal rhythm appears as a timezone-aware schedule rather than a detached legacy status line.
3. The six quick actions use explicit states and write the current logging schema.
4. The Daybook remains visibly present as a lower fold with today’s totals and recent notes.
5. Notes, Worklog, Now, Settings and Sound share one visual language.
6. The public website, manifest, offline shell, version markers and app copy all identify the same release.
7. The former Ma public layer and its active release audit are removed from the production product.
8. The production gate now tests Pacefold 24 itself instead of historical visual surfaces.

## Compatibility

The checksum-verified local engine is preserved to protect existing preferences, notes and workday records. Pacefold 24’s rhythm kernel provides current quiet, cue, badge, backup and storage behaviour while maintaining compatibility with established local data adapters.

## Release gates

- source syntax and unsafe-DOM guard
- checksum reconstruction and engine validation
- idempotent V24 composition
- no former Ma public assets in the final app HTML
- current public website and manifest assertions
- timezone-aware ordered rhythm schedule
- analog clock, Day Unfold and visible Daybook fold
- quick-action schema write
- note save and fold reflection
- essential settings
- desktop and mobile overflow
- offline worker assets

## Deployment

The only production workflow is `.github/workflows/pages.yml`. A push to `main` or a manual workflow dispatch builds, verifies and deploys the exact current site.
