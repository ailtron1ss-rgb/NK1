# NK1 learning integration — WorkPass (2026-10-30)

## Scope and source discipline

This branch is an isolated selective-port workspace created from `workpass70-source`. It does not merge `feature/learning` and does not modify `main` or a GitHub Release. The source branch was deliberately kept as the integration base because `feature/learning` is heavily diverged (876 commits ahead / 338 behind in the comparison observed on 2026-10-30); those counters describe Git history, not implementation quality.

## Ported components

The following source files were copied from `feature/learning` into the isolated integration branch:

- `LearningTrustBoundary.ts` — plain-data snapshots and safe learning identity validation at trust boundaries.
- `PairedSeedConfidence.ts` — paired-seed confidence intervals for candidate comparisons.
- `LearningRobustMetrics.ts` — task/family-balanced robust summaries, keeping diagnostic aggregates separate from promotion authority.
- `LearningFitnessJournal.ts` — append-only decision/fitness evidence for inspecting why a candidate was accepted, rejected or deferred.
- `LearningLifecycleJournal.ts` — durable lifecycle events, including activation intent and crash-recovery reconciliation.
- `CorrectionRuleMemory.ts` — reviewed correction memory; observations are not promoted to durable rules without the configured review verifier.

Focused regression files were ported for paired-seed confidence, fitness journal, robust metrics, lifecycle journal, lifecycle reconciliation and Hexis correction memory.

## Integration added

- Added npm scripts under `test:learning-integration` to run the focused regressions as one repeatable suite.
- Added `.github/workflows/workpass-learning-integration.yml` to run runtime typecheck and the focused suite on the integration branch / relevant PR changes.

## Explicitly not yet wired

This pass intentionally does **not** replace the source `P23LearningEngine.ts` with the heavily modified `feature/learning` version. That file's changes depend on coordinated changes to reflection taxonomy, independent evaluator, SkillLearnBench adapter, outcome ledger, candidate store and lifecycle orchestration. Porting it alone would create a misleading half-integration. The six new components are present and their test suite is wired, but runtime ownership/invocation from P23 and autonomous self-development remains the next integration stage.

## Validation status

- GitHub file writes: completed and returned commit SHAs.
- Runtime typecheck: pending CI.
- Focused learning regression suite: pending CI.
- Real-model / real-environment learning uplift: not measured.
- Independent holdout uplift: not claimed.
- Production sandbox, verifier and scanner deployment: not established by this branch.

## Next engineering sequence

1. Run the focused workflow and repair any source-compatibility failures.
2. Port the compatible P23 integration in dependency order: trust boundary and correction memory; reflection taxonomy; evaluator robust metrics; paired-seed gate; fitness/lifecycle journal sinks; P23 orchestration; host-owned evaluator bootstrap.
3. Add runtime wiring tests proving the real OrganismRuntime feeds verified outcomes into learning and that generated candidates cannot self-approve.
4. Add bounded retries/backoff and store reconciliation only after inspecting the source candidate-store contract.
5. Run paired RU/EN tasks across multiple seeds and independent task families, with immutable holdout isolation, cost/latency tracking and rollback checks.
6. Promote only after exact-head CI and independent holdout evidence pass. Do not refresh the Release ZIP until the chosen source SHA is validated and the release artifact is rebuilt and verified.

## Evidence rule

A passing deterministic regression establishes the tested software contract only. It does not establish that the underlying model learned a transferable skill, that the organism improved in an independent environment, or that the system has consciousness.
