# Pacefold deployment recovery runbook

Pacefold deploys through `.github/workflows/pages.yml`. Releases are manual or push-driven; there is no scheduled deployment.

## Normal release

1. Merge the approved pull request into `main`.
2. In GitHub, open **Actions → Validate and deploy Pacefold 23.0.0 → Run workflow** and select `main` when a merge did not automatically create a run.
3. Wait for `validate` to pass. The `deploy` job then publishes GitHub Pages.
4. Verify `https://rbt4.github.io/pacefold/`, `pacefold-experience.txt`, and the service-worker revision before calling the release live.

## Diagnose before changing code

### Runner was never acquired

Symptoms:

- `The job was not acquired by Runner of type hosted`
- `Internal server error`
- the job is cancelled with no executable steps or logs

This is GitHub Actions infrastructure, not a Pacefold test failure. Retry the exact failed workflow/job. Do not change application code merely to create another run.

Connector actions used:

- `GitHub.fetch` — inspect recent workflow runs and the current `main` SHA
- `GitHub.fetch_workflow_run_jobs` — determine whether a job reached any steps
- `GitHub.fetch_workflow_job_logs` — read the first genuine failing assertion
- `GitHub.rerun_failed_workflow_run_jobs` — retry an infrastructure-only failure
- `GitHub.rerun_workflow_job` — retry one isolated failed/cancelled job when appropriate

### Validation reached a named test and failed

This is actionable. Read the job log, identify the first failing assertion, and fix that exact contract on a branch. Do not bypass or weaken unrelated release gates.

Known example: the historical Ma privacy audit timed out while waiting for a hidden legacy status element after Pacefold 23 correctly mounted the modern Clock. PR #52 preserved the entire historical audit and routed only its fixture through `?legacyAudit=1`.

### Merge exists but no workflow run appears

Use the existing `workflow_dispatch` trigger on `pages.yml` directly. Do not create scheduled tasks, repeated deployment issues, or marker-only application changes.

## Release principles

- Keep application failures separate from GitHub infrastructure failures.
- Retry infrastructure failures; repair genuine test failures.
- Deploy the exact approved `main` commit.
- Do not claim the site is live until the Pages deployment succeeds and the public build is verified.

## Current recovery

The Pacefold 23 release line includes PR #52's Ma legacy-audit routing fix. The issue-triggered deployment intermediary was removed because direct `pages.yml` dispatch is simpler and avoids consuming a second hosted runner.
