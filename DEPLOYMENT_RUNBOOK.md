# Pacefold deployment runbook

Pacefold publishes through `.github/workflows/pages.yml`. There is no scheduled, issue-triggered or marker-only deployment path.

## Normal release

1. Build and review the release on a branch.
2. Merge the approved pull request into `main`.
3. Confirm **Build, verify and publish Pacefold 24** starts for the merge commit.
4. If GitHub did not create a push run, open the workflow and choose **Run workflow → main**.
5. Wait for `validate` and `deploy` to succeed.
6. Verify the public website, `/app/`, `pacefold-experience.txt` and the service-worker release marker before calling it live.

## Diagnose before changing code

### Hosted runner was never acquired

Symptoms include:

- `The job was not acquired by Runner of type hosted`
- `Internal server error`
- cancelled job with no executable steps
- failure while resolving GitHub action downloads before checkout

This is GitHub infrastructure, not a Pacefold assertion. Retry the exact failed workflow or job. Do not create another product commit merely to make another run.

Useful connector actions:

- `GitHub.fetch` — inspect workflow runs, deployments and the current `main` SHA
- `GitHub.fetch_workflow_run_jobs` — determine whether a runner reached any steps
- `GitHub.fetch_workflow_job_steps` — locate the first named failing stage
- `GitHub.fetch_workflow_job_logs` — read the first genuine assertion
- `GitHub.rerun_failed_workflow_run_jobs` — retry infrastructure-only failures
- `GitHub.rerun_workflow_job` — retry one isolated job when appropriate

### A named Pacefold stage failed

Read the first failure and repair that current contract on a branch. Do not bypass the release gate and do not revive a historical audit that no longer represents the public product.

### Merge exists but no workflow appears

Use the existing `workflow_dispatch` trigger on `pages.yml` directly.

## Release principles

- One public product and one production workflow.
- Preserve local user data across releases.
- Keep infrastructure failures separate from product failures.
- Retry infrastructure; repair genuine current-product assertions.
- Do not call a release live until GitHub Pages succeeds and the public files are verified.
