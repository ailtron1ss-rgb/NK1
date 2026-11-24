# NOMEGA Pass19 — Execution-Guided Learning

## Objective

Close the gap between NOMEGA's executable verifier, repair search, reusable skills,
neural program proposer, and evolutionary population layer without treating failures
as positive labels or allowing a candidate to verify itself.

## Canonical loop

`candidate -> execution -> counterexample -> bounded repair -> independent verification -> replay row -> neural update -> skill evidence gate -> coalition audit -> evolutionary island observation`

## Evidence rules

- A failed program is never used directly as a positive supervised target.
- A positive replay row is created only from a program that passes holdout, OOD,
adversarial, HVM agreement, three-seed evaluation, and fresh-process restart checks.
- Skill promotion remains delegated to `SkillGovernanceV1` / `CanonicalSkillLifecycleV1`.
- Evolutionary island routing affects search order and population retention only; it
cannot change verification truth.
- Coalition credit is currently measured as leave-one-out change in the best verified
skill selected for a family. It is not presented as compositional causal fusion.

## Runtime entry point

`NOmegaRuntime.omega21_execution_guided_cycle(...)`

Artifacts:

- `runtime/nomega_execution_guided_learning_v1.json`
- `runtime/nomega_execution_guided_learning_v1.jsonl`
- `runtime/nomega_causal_evidence.jsonl`

## Measured Pass19 result

A live `sum3` cycle produced failures, a verified parent-reversion repair, one
execution-guided training row, a changed neural checkpoint state digest, an `active`
skill admission, and a valid evidence ledger. This demonstrates the wiring of the
learning path; it does **not** establish pure-neural performance improvement.
