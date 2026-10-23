# WorkPass328 — evidence checkpoint for upstream donor gate

**Date:** 2026-10-23  
**Branch:** workpass328-upstream-donor-gate  
**Pull request:** [#86](https://github.com/ailtron1ss-rgb/NK1/pull/86), draft, base rebuild  
**Head observed:** d86a756157b190ab05c396d0b2e0da2e8f73d07c  
**Status:** metadata/static checks inspected; Node test execution, TypeScript, and exact-head runtime behavior remain unverified.

## Implemented

- research/upstream-donors/registry.json — 27 donor and evaluation-source records.
- tools/verify-upstream-donor-registry.mjs — structural checks and fail-closed adoption policy.
- tools/verify-upstream-donor-registry.test.mjs — six Node built-in test cases, including the negative control for a runtime dependency without evidence.
- docs/NEUROCORE_DONOR_MAP_2026-10-23.md — Russian donor map and integration decisions.
- Root package scripts audit:upstream-donors / test:upstream-donors; both are included in audit:quick.
- .github/workflows/workpass71-validation.yml — path filters watch donor-registry/tool changes, and the workflow runs both commands directly.
- RESEARCH_INTAKE_LEDGER.md, CHANGELOG.md, AGENTS.md and NEUROCORE_START_HERE.md record the current checkpoint.

## Static evidence checked through GitHub file reads

- The registry parses as JSON and has 27 entries, 27 unique IDs and 27 unique URLs.
- All candidate URLs use HTTPS; decisions, integration modes and evidence statuses match the intake schema.
- No current donor is marked adopt or runtime-dependency.
- The root package.json parses as JSON; both scripts exist, and audit:quick includes both.
- The WorkPass71 workflow contains both donor validation steps and registry-path filters.
- Compared with rebuild, this branch is ahead by its implementation commits, behind by zero, and GitHub reports the draft PR as mergeable.

These are source/configuration checks only. They do not prove the Node tests pass, that licenses have been independently reviewed, or that any donor improves NK1.

## Exact-head Actions result

For the PR head observed above, the three latest workflow runs failed before a runner was assigned:

| Workflow | Run | Job symptom |
| --- | --- | --- |
| NeuroCore core regression validation | [39965423290](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39965423290) | runner_id=0, empty runner name, zero steps |
| WorkPass79 cognitive runtime regression | [39965423240](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39965423240) | runner_id=0, empty runner name, zero steps |
| WorkPass110 continual learning metrics | [39965423475](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39965423475) | runner_id=0, empty runner name, zero steps |

Consequently, the new donor validation commands have **not** been executed by hosted CI. The failure does not establish a code/test failure because no job steps ran. Account-level Billing & Licensing remains a hypothesis from the earlier WorkPass327 investigation, not a confirmed diagnosis.

## Required next steps

1. The account owner checks GitHub Settings → Billing & Licensing and the exact check-run annotation/support channel, because the repository connector could not retrieve the annotation payload.
2. When a runner is available, run node tools/verify-upstream-donor-registry.mjs and node --test tools/verify-upstream-donor-registry.test.mjs on the exact PR head.
3. Run runtime typecheck plus P23 candidate-store, verified-shadow-evidence, promotion-boundary and persistence tests.
4. Trace the production path for P23 candidate generation, real execution, independent evaluation, signed evidence, and approval. A registered interface or passing synthetic fixture alone is insufficient.
5. Do not promote a donor or increase learning scores until a frozen, independent benchmark shows an acceptable paired improvement without regression.
6. No release ZIP was downloaded, rebuilt, or published in this pass.
