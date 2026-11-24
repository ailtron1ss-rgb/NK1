# WorkPass294 — GitHub Actions history audit (2026-10-22)

## Scope and result

- Repository: `ailtron1ss-rgb/NK1`
- Branch inspected: `workpass206-runtime-evaluator-wiring`
- Open stacked PR: #55, based on `workpass203-independent-candidate-evaluator`; not a direct merge to `main`.
- GitHub Actions API reported **5,158 workflow runs**, returned as 52 pages at 100 runs/page (last page: 58 runs).
- Reviewed metadata for pages 1–52. Pages 1–24 contained 2,400 runs and every run in those pages had conclusion `failure`. Pages 25–32 were mixed; pages 32 onward include successful and cancelled runs as well as failures. This points to a sharp recent failure period, not a claim that all historical CI has always failed.
- Recent workflows repeatedly failing include WorkPass105 verified outcome ledger, WorkPass108/106 verified promotion gate, WorkPass110 continual-learning metrics, and WorkPass287–288 cognitive contracts.

## Concrete run inspection

Four recent runs were inspected:
- [WorkPass108/106 promotion gate](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39780527558), job `verified-promotion` (job ID 119830305923)
- [WorkPass287–288 cognitive contracts](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39780527403), job `cognitive-contracts` (job ID 119830305876)
- [WorkPass105 verified outcomes](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39780527399), job `verified-outcomes` (job ID 119830305449)
- [WorkPass110 continual-learning metrics](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39780527390), job `metrics` (job ID 119830307978)

All four jobs completed as failures almost immediately, with zero recorded steps and no runner name. The connected log-download action returned `BlobNotFound`; step-summary endpoints returned empty arrays. Therefore, the precise failure message is **not available from the currently exposed run artifacts**. Do not attribute the failures to Node, TypeScript, dependencies, or test assertions without a usable log or a rerun that records steps.

## Changes made

1. Added workflow-level concurrency groups to WorkPass105, WorkPass106/108, WorkPass110 and WorkPass287–288. Newer runs for the same workflow and PR/ref cancel superseded runs, limiting duplicate-run storms and resource waste.
2. Updated the WorkPass287–288 cognitive-contract workflow to Node.js 24 for consistency with the active Node 24 CI lane.
3. Kept the promotion/evaluation gates intact. No candidate promotion, test pass, or production readiness is claimed.

## Follow-up, ordered by leverage

1. Re-run one representative failing job after confirming GitHub Actions runner availability and inspect the job-level error. If it still creates zero steps, resolve the repository/account/runner execution issue before changing test code.
2. Once steps are available, fix the first reproducible underlying error and rerun the owning workflow.
3. Reconcile all stacked branches/PR bases before any merge; keep `main` unchanged until required checks and clean-start evidence pass.
4. Continue integration of the autonomous cognitive cycle only with traceable observation → prediction → goal → authorized action → grounded outcome → independent evaluation → controlled promotion.

## Limits

This is a complete metadata-page sweep, not a complete log-level diagnosis of all 5,158 runs. The Actions UI and available API results do not expose usable logs for the sampled latest failures, so per-run root causes remain unverified.
