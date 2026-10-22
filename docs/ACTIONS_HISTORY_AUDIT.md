# GitHub Actions history audit

The Actions page does not show the full root cause when a job ends before runner assignment or when GitHub does not provide step metadata. This tool separates those cases from failures that have an identifiable failed step.

## Run

On the branch containing this workflow, run the Actions History Audit workflow. A push to the audit branch also starts the workflow. The job uses Node.js 24 and the built-in Node APIs; no application dependency or lockfile is changed.

Required workflow permission: Actions read. The report is uploaded as an artifact named `nk1-actions-history-audit`.

## Coverage and limits

- Enumerates workflow runs using `per_page=100`, following successive pages until the API reports the end of the collection or the configured page limit is reached.
- Deduplicates run IDs and records the page count and API `total_count`; hitting the configured limit with another full page produces `PARTIAL`, not a false complete result.
- Fetches job summaries for each non-success/incomplete run up to the detail budget, then downloads logs for a bounded number of jobs with a failed step.
- Marks jobs that have no runner identity and no step rows as `runner-or-step-metadata-unavailable`. That classification is deliberately not a claim that application code caused the failure.
- Extracts only deduplicated diagnostic lines. Common GitHub token formats, bearer values and secret-like key/value pairs are redacted; full logs and environment dumps are not persisted.
- Writes both `actions-history-report.json` and `actions-history-report.md`.

Inputs are environment variables: `AUDIT_MAX_PAGES` (default 1000), `AUDIT_MAX_DETAIL_RUNS` (default 3000), `AUDIT_MAX_LOG_JOBS` (default 200), `AUDIT_REPOSITORY`, and `AUDIT_OUTPUT_DIR`. The repository value defaults to `GITHUB_REPOSITORY`; `GITHUB_TOKEN` must be present. On private repositories, the workflow token needs Actions read permission.

The inventory scan covers every available run page. Detail and log budgets are reported explicitly, because the API may expose a very large history and a missing log must not be interpreted as a passing test. Each run's latest job attempt is inspected; earlier attempts of a rerun are not expanded independently.

## Evidence semantics

- `COMPLETE` means the run-list pagination reached the end of the exposed API collection. It does not mean the workflows passed.
- `PARTIAL` means the page budget ended before the collection ended.
- `DEGRADED` means the run list completed but some job detail requests failed.
- A successful test job is evidence only for the code and commit actually checked out by that run.
- The report is diagnostic and read-only: it never re-runs jobs, changes workflow configuration, publishes releases, or merges pull requests.
