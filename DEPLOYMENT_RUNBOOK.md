# Deployment runbook

1. Change `canonical/` (plus tests/docs when required).
2. Open a pull request.
3. Require the canonical relic guard and full browser audit to pass.
4. Merge only when green.
5. `main` deploys the exact validated `canonical/` directory.
