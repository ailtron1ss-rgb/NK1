# Feature Learning — WorkPass329: close the verified learning loop

Status: implementation roadmap grounded in the current `integration` source snapshot; this document is not a claim that the loop is complete or validated.

## Target outcome

A real, repeatable cycle in the canonical P23 learning substrate:

`observed outcome → diagnosis → bounded revision candidate → isolated execution → independent validation + holdout → authenticated promotion or rollback → durable feedback`.

The category branch is `feature/learning`. Keep `main` untouched. The integrated source stack remains the reference for implementation; do not create a second learning engine.

## Existing implementation discovered

- `runtime/neuro-kurisu/src/organism/learning/P23LearningEngine.ts` is the learning integration point. It already composes replay selection, causal replay, outcome reflection, skill revision planning, verified evidence binding, independent evaluation and a versioned candidate store.
- `runtime/neuro-kurisu/src/organism/learning/VerifiedOutcomePromotionGate.ts` provides conservative paired-outcome gates: minimum paired task count, family coverage, aggregate gain, confidence lower bound and per-family regression ceiling.
- `runtime/neuro-kurisu/src/organism/learning/IndependentSkillCandidateEvaluator.ts` binds reports to candidate payload fingerprints, evaluation fingerprints, environment and plan; it checks validation/holdout trial coverage and requires verified bindings with zero safety violations.
- `runtime/neuro-kurisu/package.json` contains existing learning/replay and P23 test entry points. Prefer extending those canonical tests rather than introducing a competing test framework.

## Completion contract

A learning change is complete only when all applicable items are demonstrated in code and by exact-head evidence:

1. **Observe:** a real action/outcome is linked to a stable trace and persisted with provenance.
2. **Diagnose:** failure reason and uncertainty are explicit; missing evidence is not treated as success.
3. **Generate:** candidate is bounded, fingerprinted, deduplicated and staged without changing the active policy.
4. **Evaluate:** candidate and baseline use matched tasks/seeds/splits and the same environment/plan; validation and holdout are isolated.
5. **Verify:** outcome evidence is authenticated by a verifier distinct from the candidate executor; candidate payload and evidence lineage match exactly.
6. **Decide:** promotion is blocked for inadequate sample size, missing families, non-positive confidence, regressions, unsafe outcomes or any provenance mismatch.
7. **Activate:** explicit authorization and compare-and-swap are required; prior active version remains recoverable.
8. **Learn from the decision:** rejection, rollback and success become durable feedback, without allowing holdout outcomes to leak into training or confidence calibration.
9. **Recover:** restart, duplicate delivery, stale locks, partial writes and concurrent promotion are tested.
10. **Measure:** report task success, retention, transfer, regressions, calibration, sample sizes and uncertainty; never equate added memories, passing synthetic tests or a plan with learning improvement.

## Next code-first passes

- **P329-A — runtime reachability:** trace the live organism outcome path into P23 observation/diagnosis and verify that the learning engine is called in normal runtime, not only via tests or optional constructors.
- **P329-B — evidence lineage:** add end-to-end regressions proving one candidate fingerprint survives generation → shadow run → evaluator report → promotion proposal → activation.
- **P329-C — split isolation:** assert validation evidence cannot be relabelled as holdout and holdout rows never update training/replay state.
- **P329-D — durable lifecycle:** exercise restart and interrupted promotion using the production persistence adapter, including compare-and-swap conflict and rollback.
- **P329-E — upstream extraction:** compare Hermes Agent's error-to-repair loop and skill lifecycle, DSPy/GEPA's proposal/evaluation loop, and continual-learning replay methods. Record repository commit, exact files/mechanisms reused, license, modifications and tests; adapt only mechanisms that fit the single NK1 owner.
- **P329-F — operational validation:** run targeted learning regressions, runtime typecheck and exact-head Actions. Record observed run URLs/status, not expected results.

## Acceptance / progress accounting

- Source integration discovered: **present** in `integration` (see files above).
- Category branch completion: **not yet complete**.
- Exact-head CI for this work pass: **not run by this document change**.
- Measured learning uplift: **not established**.
- Consciousness or biological equivalence: **not established**; the project is an engineering research effort toward autonomous cognitive behavior.

Progress must be reported separately as (a) code integration, (b) runtime reachability, (c) independent evaluation, (d) deployment/release readiness. A single percentage must not hide an unverified gate.
