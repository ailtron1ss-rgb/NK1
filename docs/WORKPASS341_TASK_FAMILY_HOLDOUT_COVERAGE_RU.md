# WorkPass341 — per-family holdout task coverage

**Goal:** prevent a candidate from passing a family-specific promotion gate by repeating a few holdout tasks across many random seeds.

## Runtime path

1. `stage-verified-skill-candidate.mjs` requires an operator-owned policy keyed by skill ID.
2. Each configured family has both a minimum improvement threshold and a minimum distinct-task count; the family must exist in the holdout manifest.
3. The verifier only counts attempt-1 task IDs with paired baseline and candidate outcome evidence for the same task and seed.
4. The proposal includes the normalized policy and observed `familyTaskCoverage` in the canonical proposal digest.
5. Any family below its task-count floor rejects the proposal before candidate staging. Staging does not activate a skill.

## Validation added

- Direct proposal regression covers minimum family task floors, default floors for configured gain families, malformed task policy, and a low-coverage rejection.
- Production staging regression covers missing/malformed/untrusted family policy, a successful family gain with enough task breadth, and rejection when the task floor exceeds observed coverage.
- The checks are wired into `test:cognitive-integration-suite`; exact-head CI is pending.
