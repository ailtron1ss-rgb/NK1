# WorkPass123 — authenticated evidence and controlled skill lifecycle

Date: 2026-10-21  
Branch: `workpass123-authenticated-skill-lifecycle`  
Parent: WorkPass122 promotion-gate hardening

## Implementation

- Added a process-local provenance registry populated only after `ingestSignedOutcomeArtifact` validates the Ed25519 signature, exact manifest fingerprint, task version, and trusted verifier key, and the canonical ledger accepts the outcome.
- Skill-promotion proposals now evaluate only rows with an ingestion-issued provenance receipt. If relevant holdout rows exist without such receipts, the proposal fails closed with `unauthenticated-outcome-evidence`; the proposal reports authenticated and unauthenticated row counts.
- Added `VersionedSkillCandidateStore`: proposal-bound candidate staging, stable candidate identity, shadow-run evidence, duplicate-run rejection, explicit approver identity/time, compare-and-swap against the active version, atomic persistence-adapter writes, prior-version preservation, and guarded rollback. The included adapter is intentionally in-memory; restart-safe deployments must supply a durable CAS adapter.
- Added a three-level holdout report keeping skill-artifact quality, execution trajectory, and verified task outcomes separate. It reports evidence coverage, task/seed coverage and missing-level reasons; it does not collapse all dimensions into one headline score.
- Added regressions for forged evidence references, signed verifier outcomes, incomplete seed/task coverage, candidate lifecycle transitions, approval audit retention, stale-version rejection, rollback restoration, and three-level report completeness.
- Registered the new modules/tests and branch in the WorkPass110 continual-learning workflow.

## Research adaptation

- [SkillLearnBench](https://github.com/cxcscmu/SkillLearnBench) separates skill quality, trajectory alignment, and deterministic task outcomes; its public benchmark uses verified tasks and includes a no-skill baseline. NK1 now has a matching report contract, but has not yet run the external benchmark.
- [Memento-Skills](https://github.com/Memento-Teams/Memento-Skills) documents isolated skill repair, guarded write-back, atomic deployment, audit history, and rollback. NK1 implements a typed candidate-store boundary rather than copying its Python/Flet runtime.
- Upstream code and datasets were not copied. This is design adaptation, not a claim of benchmark parity or a measured learning improvement.

## Important trust and integration boundaries

- Provenance receipts are process-local and intentionally do not survive ledger snapshot restoration. After restart, signed artifacts must be re-ingested and verified before they can support a promotion proposal.
- The candidate store is a standalone component and is **not yet wired into the production skill resolver**. Its in-memory persistence adapter is for tests/ephemeral use; production activation requires a durable atomic CAS adapter and an explicit integration point.
- The report validates input shape and evidence counts, not the truth of a caller-supplied quality rubric. The verifier/evaluator must supply those measurements from an auditable run.
- Shadow observations require a SHA-256 evidence fingerprint and unique run ID, but the generic store does not itself authenticate the shadow artifact. Production integration must bind those receipts to the canonical execution-evidence verifier.
- GitHub Actions is the test authority. Until a run completes successfully on this exact head, tests are wired but not confirmed passing. No learning uplift is claimed.

## Remaining items

1. Implement and connect a durable filesystem/SQLite-backed CAS adapter with crash-recovery tests.
2. Bind shadow-run fingerprints to the canonical execution-evidence verifier instead of accepting a caller-provided digest.
3. Integrate candidate staging/activation/rollback with the real skill resolver behind a feature flag, retaining a no-skill/context-only control.
4. Run sequential-task, transfer, retention/forgetting and efficiency experiments on independently verified holdouts; publish confidence intervals and per-family regressions.
