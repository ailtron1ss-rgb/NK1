# NK1 Bounded Self-Improvement Candidate Population Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the current P23 reflective skill revision from one generated candidate to a bounded, deterministic validation-only candidate population search that hands at most one winner to the unchanged full P23 validation/holdout and staging gates.

**Architecture:** A pure Pareto archive owns validation-only objective vectors and deterministic dominance. A dedicated validation-only evaluator uses the existing sandbox, independent verifier, safety scanner, trusted validation manifest and trial-report adapter, without receiving holdout tasks or holdout authority. A population orchestrator generates up to three variants, deduplicates, evaluates against one immutable validation cohort, selects one improvement and passes it through the canonical P23 full evaluator exactly once.

**Tech Stack:** TypeScript, Node.js 24, `node --experimental-strip-types`, existing P23 learning contracts, GitHub Actions.

**Spec:** `docs/specs/2026-11-13-self-improvement-population-engine-design.md`

## Global Constraints

- A default run considers at most 3 unique candidates; a hard limit of 4 is enforced.
- Candidate generation, ranking, Pareto dominance, and tie-breaking do not receive or inspect holdout reports, holdout task IDs, holdout scores, holdout case content, or holdout deltas.
- Candidate validation uses the same fixed task/trial/seed manifest, independent executor, verifier and safety scanner. Any safety violation blocks that candidate from the Pareto archive.
- Duplicate payload fingerprints are not re-evaluated and do not consume a full-evaluation slot.
- Selection is deterministic for the same input records and configuration.
- Exactly one selected payload, if any, is passed through the existing P23 final full evaluator.
- No candidate is promoted or activated by this feature. Existing authenticated approval, signed shadow-evidence, compare-and-swap and rollback remain authoritative.
- Search failure, timeout, provider error, validation mismatch or persistence failure is fail-closed.
- No separate Python/GEPA runtime or new third-party dependency is introduced.

## Review Focus

- Mutable caller-owned payload/evidence mutated during awaited generator or evaluator calls: snapshot before the first asynchronous boundary and verify fingerprints after return.
- A validation evaluator accidentally configured with holdout tasks or plan data: reject every non-validation task and accept only a validation-only manifest/plan projection.
- Candidate objective rows with missing, duplicated or reordered task/trial coverage: require exact identity coverage against the frozen source validation cohort.
- A safety-violating candidate with excellent task/trajectory scores: safety is a hard veto and cannot be traded against other objectives.
- Concurrent or repeated calls for the same source/evidence: prevent duplicate expensive search/staging and keep candidate budget bounded.

---

### Task 1: Deterministic validation-only Pareto archive

**Files:**
- Create: `runtime/neuro-kurisu/src/organism/learning/P23CandidateParetoArchive.ts`
- Create: `runtime/neuro-kurisu/tests/p23-candidate-pareto-archive.mjs`
- Modify: `runtime/neuro-kurisu/package.json` (add focused test script)

**Interfaces:**
- Consumes: `SkillLearnBenchTrialReport` from `SkillLearnBenchAdapter.ts`; SHA-256 payload and validation-plan fingerprints.
- Produces: `P23CandidateParetoArchive`, `PopulationCandidateRecord`, `populationCandidateFromValidationReports(...)`, `dominatesValidationCandidate(...)`, `selectValidationParetoWinner(...)`.

- [ ] **Step 1: Write focused failing tests**
  - A candidate with objectives (task success .8, skill quality .7, trajectory .9) dominates one at (.7, .7, .8).
  - Candidates that trade off objectives remain nondominated.
  - Any safety violation is rejected even if all three scores are higher.
  - A repeated payload fingerprint with the same source and validation fingerprints is recorded as duplicate and never inserted twice.
  - Winner selection is stable across input-order permutations and uses lexical fingerprint as the final tie-break.
  - Different validation manifest/plan fingerprints cannot share an archive.
  - Missing/duplicate trial identities, non-finite scores, and oversized per-task rows reject the record.

- [ ] **Step 2: Verify RED**
  - Run: `node --experimental-strip-types tests/p23-candidate-pareto-archive.mjs`
  - Expected: assertion failure because the new archive exports are absent.

- [ ] **Step 3: Implement the minimum archive**
  - Store only validation objectives and hashed task/trial keys; never store raw prompts, inputs or holdout rows.
  - Compute objective vector from task-macro means: task success, skill quality and trajectory quality.
  - Apply strict Pareto dominance across all three objectives; safety violation count must be zero.
  - Bound archive entries to 16 and per-candidate task rows to 4096; deterministic trim by dominance, objective sum, minimum per-task score, then lexical fingerprint.
  - Snapshot all input reports with `snapshotPlainData`; reject malformed or non-finite values.

- [ ] **Step 4: Verify GREEN**
  - Run: `node --experimental-strip-types tests/p23-candidate-pareto-archive.mjs`
  - Expected: `P23_CANDIDATE_PARETO_ARCHIVE=PASS`.

- [ ] **Step 5: Run focused integration checks**
  - Run: `node --experimental-strip-types tests/p23-verified-skill-revision-gate.mjs`
  - Expected: existing reflective fitness gate remains unchanged and passes.

- [ ] **Step 6: Commit**
  - `feat(learning): add deterministic validation Pareto archive`

### Task 2: Independent validation-only candidate evaluator

**Files:**
- Create: `runtime/neuro-kurisu/src/organism/learning/ValidationOnlySkillCandidateEvaluator.ts`
- Create: `runtime/neuro-kurisu/tests/p23-validation-only-candidate-evaluator.mjs`
- Modify: `runtime/neuro-kurisu/package.json`

**Interfaces:**
- Consumes: `IndependentCandidateTask`, `CandidateSandboxExecutor`, `IndependentTaskVerifier`, `IndependentCandidateSafetyScanner`, `TaskManifestEntry`, `LearningExperimentPlan`, `VerifiedOutcomeLedger`.
- Produces: `ValidationOnlyCandidateEvaluationConfig`, `ValidationOnlyCandidateEvaluator`, `createValidationOnlySkillCandidateEvaluator(config)`.

- [ ] **Step 1: Write focused failing tests**
  - A config containing any task whose split is not `validation` is rejected before executor/verifier/scanner are called.
  - A valid validation-only task is executed, independently verified and safety-scanned, returning a report for exactly that task.
  - A failed or unbound verifier outcome becomes a failed task report; it cannot be represented as a successful report.
  - Candidate payload fingerprint mismatch rejects before sandbox execution.
  - The immutable validation manifest, plan and environment fingerprints are bound into the execution context.
  - Timeout aborts the in-flight sandbox/verifier/safety operation and rejects the evaluation.
  - Duplicate task/trial/run IDs and malformed capability/step IDs are rejected or fail the corresponding report closed.

- [ ] **Step 2: Verify RED**
  - Run: `node --experimental-strip-types tests/p23-validation-only-candidate-evaluator.mjs`
  - Expected: assertion failure because the new validation-only evaluator is absent.

- [ ] **Step 3: Implement the evaluator**
  - Define a config containing only validation tasks, a validation manifest and validation plan, independent executor/verifier/safety-scanner capabilities and environment fingerprint. Do not include a holdout task list, holdout plan, holdout reports or a full evaluator config.
  - Validate the plan with the existing `validateLearningExperimentPlan`; require `split === 'validation'`, task coverage, scheduled run binding, and manifest fingerprint match.
  - Snapshot tasks and host capability methods at construction; use descriptor-safe plain-data boundaries for all external results.
  - Execute each task with payload/task/plan/environment-bound context, require verifier binding, apply safety scan and build metrics with `evaluateSkillLearnBenchTrial`.
  - Use bounded service deadlines and propagate `AbortSignal`; do not convert timeout, malformed authority or scanner failures to success.
  - Return validation reports plus payload, manifest, plan and environment fingerprints only.

- [ ] **Step 4: Verify GREEN**
  - Run: `node --experimental-strip-types tests/p23-validation-only-candidate-evaluator.mjs`
  - Expected: `P23_VALIDATION_ONLY_CANDIDATE_EVALUATOR=PASS`.

- [ ] **Step 5: Run integration checks**
  - Run: `node --experimental-strip-types tests/p26-skilllearnbench-adapter.mjs` and `node --experimental-strip-types tests/p23-local-model-skill-revision-integration.mjs`
  - Expected: existing task report and local generator contracts still pass.

- [ ] **Step 6: Commit**
  - `feat(learning): add isolated validation-only candidate evaluator`

### Task 3: Bounded population search and canonical P23 hand-off

**Files:**
- Create: `runtime/neuro-kurisu/src/organism/learning/P23ReflectiveCandidatePopulationSearch.ts`
- Create: `runtime/neuro-kurisu/tests/p23-reflective-candidate-population-search.mjs`
- Modify: `runtime/neuro-kurisu/src/organism/learning/P23LearningEngine.ts`
- Modify: `runtime/neuro-kurisu/package.json`

**Interfaces:**
- Consumes: `P23CandidateParetoArchive`; `ValidationOnlyCandidateEvaluator`; `SkillRevisionPlan`; `SkillRevisionChatProvider`; existing `RevisedCandidateEvaluator`.
- Produces: `PopulationSearchBudget`, `PopulationSearchResult`, `runP23ReflectiveCandidatePopulationSearch(input)`; `P23LearningEngine.generateAndStageReflectiveSkillRevisionWithPopulation(...)`.

- [ ] **Step 1: Write focused failing tests**
  - A run generates no more than 3 candidates by default and never more than 4 even if a caller requests a larger value.
  - All candidate generation requests contain the same source payload, validation evidence and evidence-backed targets, but distinct deterministic variation IDs/instructions.
  - Serialized generator/evaluator requests never contain known holdout task IDs, task input, holdout scores or holdout deltas.
  - Duplicate candidate payloads are evaluated once and consume one unique-candidate slot.
  - No candidate with a safety violation enters the archive or can be selected.
  - A validation candidate must beat the source validation composite by a positive margin to be selected.
  - Timeout, generator failure, validation fingerprint mismatch or stale source fingerprint yields no winner and no final P23 call.
  - At most one winner reaches the canonical full evaluator, and the P23 method reports a staged result only when that method returns a concrete candidate ID.
  - A generated candidate remains staged/inactive; the search never calls approval, shadow or activation methods.

- [ ] **Step 2: Verify RED**
  - Run: `node --experimental-strip-types tests/p23-reflective-candidate-population-search.mjs`
  - Expected: assertion failure because the population search exports and P23 wrapper are absent.

- [ ] **Step 3: Implement the bounded search**
  - Use one immutable source/evidence/validation fingerprint tuple and a shared wall-clock deadline.
  - Default `maxCandidates=3`, hard cap 4; bound generation/evaluation calls, payload size, validation rows and archive size.
  - Generate deterministic variation descriptors: minimal targeted repair, alternate structure/order, and explicit edge-case reinforcement.
  - Run candidate evaluation only through the validation-only evaluator; verify exact payload/validation plan fingerprints and exact task/trial identity coverage.
  - Deduplicate fingerprints before evaluation; reject source-identical, malformed, unsafe or over-budget payloads.
  - Add safe candidates to the Pareto archive and choose a deterministic winner only when its validation composite improves on the frozen source baseline.
  - In P23, add a wrapper that supplies the selected payload to the existing `generateAndStageReflectiveSkillRevision` generator seam once. The existing method remains responsible for fresh full validation + holdout evaluation, fitness journaling, staging and evidence binding.
  - If no winner exists, fail with a stable `p23-population-no-improving-candidate` reason; do not call the full evaluator or stage a candidate.
  - Keep approval, signed shadow, activation and rollback out of the new code path.

- [ ] **Step 4: Verify GREEN**
  - Run: `node --experimental-strip-types tests/p23-reflective-candidate-population-search.mjs`
  - Expected: `P23_REFLECTIVE_CANDIDATE_POPULATION_SEARCH=PASS`.

- [ ] **Step 5: Run existing P23 regressions**
  - Run: `npm run test:p23:local-model-skill-revision-generator && npm run test:p23:local-model-skill-revision-integration && npm run test:p23:verified-skill-lifecycle`
  - Expected: existing P23 generation, lifecycle and promotion authority tests pass with the new wrapper.

- [ ] **Step 6: Commit**
  - `feat(learning): add bounded reflective candidate population search`

### Task 4: Runtime wiring, diagnostics, and exact-head CI

**Files:**
- Modify: `runtime/neuro-kurisu/src/organism/learning/P23CompoundRepairRevisionCoordinator.ts`
- Modify: `runtime/neuro-kurisu/src/organism/core/OrganismRuntime.ts` only where the existing revision entry point forwards configured provider capabilities.
- Modify: `runtime/neuro-kurisu/package.json`
- Modify: `.github/workflows/p26-learning-validation.yml`
- Create: `runtime/neuro-kurisu/tests/p23-population-revision-coordinator.mjs`

**Interfaces:**
- Consumes: validation-only evaluator capability and optional bounded search budget supplied by the existing trusted repair input provider.
- Produces: opt-in runtime wiring that uses population search only when an independently configured validation-only evaluator is present; otherwise preserve the existing single-candidate route unchanged.

- [ ] **Step 1: Write failing coordinator integration tests**
  - With a validation-only evaluator configured, the coordinator forwards the population capability exactly once and the final candidate is staged only by P23.
  - Without the validation-only evaluator, the existing single-candidate path is unchanged.
  - A missing validation task plan, invalid budget, stale repair evidence or persistence failure prevents population staging.
  - Concurrent identical repair evidence coalesces; new evidence cannot be hidden behind an older in-flight run.

- [ ] **Step 2: Verify RED**
  - Run: `node --experimental-strip-types tests/p23-population-revision-coordinator.mjs`
  - Expected: assertion failure because the population capability is not wired into the repair coordinator.

- [ ] **Step 3: Implement opt-in runtime wiring**
  - Add only an optional validation-only capability to the existing prepared revision input envelope; never pass the full holdout task collection into that capability.
  - Route to the population wrapper only when the explicit evaluator capability and budget are present; preserve the existing route otherwise.
  - Re-read canonical repair evidence/source identity before staging, relying on current coordinator backoff and in-flight coalescing.
  - Add diagnostics that distinguish generated, validated, Pareto-retained, selected and staged counts; do not infer active/released state from candidate staging.

- [ ] **Step 4: Update package and CI**
  - Add focused scripts for the three new tests and a combined `test:p23:candidate-population` script.
  - Add source/test paths and a workflow step to `.github/workflows/p26-learning-validation.yml`.
  - Add no external dependencies; lockfile should remain unchanged.

- [ ] **Step 5: Verify GREEN and exact-head checks**
  - Run: `npm run typecheck`
  - Run: `npm run test:p23:candidate-population`
  - Run: `npm run test:p23:learning`
  - Expected: all targeted checks and the existing P23 learning suite exit 0.
  - Then verify GitHub Actions on the exact PR head; do not mark Ready until the relevant exact-head jobs succeed.

- [ ] **Step 6: Commit**
  - `feat(runtime): wire bounded P23 self-improvement search`

## Completion boundary

This aspect branch is complete only when implementation, focused tests, typecheck and exact-head P26/P23 CI are green. The work remains a Draft PR until those checks are independently verified. Do not merge, alter `workpass70-source`, update `main` or publish a Release ZIP in this aspect pass. A research-grade improvement claim still requires a frozen RU/EN task manifest, at least five paired seeds, independent holdout, transfer/retention and ablation evidence.
