# NK1 — Bounded self-improvement candidate population engine

**Date:** 2026-11-13  
**Repository:** `ailtron1ss-rgb/NK1`  
**Base branch:** `workpass70-source`  
**Base SHA:** `1e83a011fc677ff20f2348570322bd562181d9ff`  
**Aspect branch:** `aspect/self-improvement-population-engine-20261113`  
**Status:** design approved by the user; implementation not yet started.

## 1. Purpose and measurable outcome

Add a bounded, NK1-native multi-candidate search stage to the existing P23 reflective skill-revision lifecycle. One repair/reflection cycle must be able to propose a small set of meaningfully different revisions, evaluate those revisions on the same immutable **validation-only** task set, retain nondominated candidates in a deterministic Pareto archive, and send at most one selected candidate to the existing full independent validation + fresh holdout gate.

The feature improves the *search process*, not the organism's weights or consciousness. It must never mark a candidate as active, issue an approval, or bypass the existing signed shadow-evidence and explicit promotion authority.

### Acceptance criteria

1. A default run considers at most 3 unique candidates; a hard limit of 4 is enforced.
2. Every candidate is generated from the same source skill and immutable validation evidence, with a distinct deterministic variation descriptor and stable candidate fingerprint.
3. Candidate generation, ranking, Pareto dominance, and tie-breaking do not receive or inspect holdout reports, holdout task IDs, holdout scores, holdout case content, or holdout deltas.
4. Candidate validation uses the same fixed task/trial/seed manifest, independent executor, verifier and safety scanner. Any safety violation blocks that candidate from the Pareto archive.
5. Duplicate payload fingerprints are not re-evaluated and do not consume a full-evaluation slot.
6. Selection is deterministic for the same input records and configuration.
7. Exactly one selected payload, if any, is passed through the existing P23 final full evaluator; that path performs the current validation/holdout checks and stages a versioned candidate only when all existing gates pass.
8. No candidate is promoted or activated by this feature. Existing authenticated approval, signed shadow receipts, compare-and-swap and rollback remain authoritative.
9. Search failure, timeout, provider error, validation mismatch or persistence failure is fail-closed: no selected candidate is returned as staged unless the canonical P23 method actually stages it.
10. Tests demonstrate holdout non-interference, deterministic Pareto selection, bounded work, safety vetoes, duplicate suppression and no-activation behavior.

## 2. Repository evidence and existing owners

The base tree already contains the following authorities. The new feature must compose them instead of creating parallel owners:

- `OutcomeReflectionCurriculum.ts`: bounded error/surprise reflection and evidence-linked learning targets.
- `SkillRevisionPlan.ts`: validation-derived revision targets; holdout evidence can veto unsafe work but is not emitted as generator-facing task feedback.
- `P23LocalModelSkillRevisionGenerator.ts`: constrained local model generation and plain-data boundary.
- `IndependentSkillCandidateEvaluator.ts`: exact-payload sandbox execution, independent task verifier, safety scanner and bound evaluation fingerprints.
- `SkillLearnBenchAdapter.ts`: per-task success, skill-quality and trajectory-quality reports and paired candidate checks.
- `P23LearningEngine.ts`: authentic proposal verification, generation, fresh full evaluation, candidate staging, fitness gate and journals.
- `VersionedSkillCandidateStore.ts`: durable candidate lineage, idempotent staging, shadow evidence, explicit approval, activation and rollback.
- `LearningFitnessJournal.ts` / `LearningLifecycleJournal.ts`: existing aggregate fitness and lifecycle evidence.
- `P23CompoundRepairRevisionCoordinator.ts`: repair-evidence coalescing, durable failure backoff and the existing background revision entry point.

The current P23 reflective route generates one payload, independently evaluates that payload on validation and holdout, checks both gates, then stages it. It must remain the only route that stages the final selected candidate. The population search therefore adds a validation-only exploration stage before invoking that final route once.

## 3. Architecture and data flow

```text
P36 / repair evidence / reflection
              |
       existing P23 revision plan
              |
  immutable source + validation snapshot
              |
  bounded variation generator (K <= 4)
              |
  validation-only independent evaluation
              |
  per-task objective matrix + safety veto
              |
     deterministic Pareto archive
              |
     validation-only final selector
              |
  existing P23 full independent evaluation
       validation + fresh holdout
              |
       existing fitness gate
              |
    versioned staged candidate only
              |
      signed shadow + approval gate
              |
        explicit activation/rollback
```

### Components

**A. Population search orchestrator (proposed: `P23ReflectiveCandidatePopulationSearch.ts`)**

Owns one search run, including immutable input snapshot, variation index/seed, budgets, timeout/abort propagation, candidate deduplication, validation-only evaluation, archive update, deterministic selection and the single hand-off to P23. It does not own skill state or promotion.

**B. Pareto archive (proposed: `P23CandidateParetoArchive.ts`)**

Owns bounded, plain-data archive entries and deterministic objective comparison. It tracks only validation values. Each entry contains:
- run ID, candidate payload fingerprint, source payload fingerprint, variation ID and seed;
- validation manifest/plan fingerprints;
- hashed task/trial identity, task family when sourced from the trusted manifest, and three per-task measurements: task success, skill quality and trajectory quality;
- aggregate macro-by-task objectives, safety-veto status, lineage and bounded reason codes;
- archive decision (admitted, dominated, duplicate, rejected or budget-skipped).

It does not store raw prompts, task input, model chain-of-thought, user data or holdout rows. Archive size and retained per-task rows are bounded by configuration and validated on restore.

**C. Validation-only evaluation capability**

Uses the existing `CandidateSandboxExecutor`, `IndependentTaskVerifier`, `IndependentCandidateSafetyScanner` and canonical task manifest contracts. The population search's evaluator receives only validation tasks. It returns only validation reports and their validation-plan/payload fingerprints. It cannot access the holdout task list by closure or object reference.

**D. Existing P23 finalization**

After validation-only selection, a closure-backed generator returns the already selected payload to `P23LearningEngine.generateAndStageReflectiveSkillRevision`. The existing P23 method then performs one fresh full evaluation through the configured independent evaluator and stages the candidate only after its normal authenticated proposal, exact-fingerprint, safety, paired validation and holdout gates. The final result is reported as staged only when the canonical method returns a concrete candidate ID.

**E. Persistence and diagnostics**

Use the existing durable versioned candidate store for staged payloads and existing fitness/lifecycle journals for the final full evaluation and lifecycle. The validation-only archive receives its own bounded append-only journal/snapshot adapter; only fingerprints, hashed task identities, numeric validation measurements and reason codes are persisted. A journal that is configured but cannot be restored or appended blocks the search rather than silently degrading to volatile evidence. Ephemeral in-memory mode is permitted only when explicitly selected by the host/test configuration and is reported as non-durable.

## 4. Proposed TypeScript contracts

The exact exported names may be adjusted to match local naming conventions, but the boundaries below are required.

```ts
export interface PopulationSearchBudget {
  maxCandidates: number;       // integer 1..4; default 3
  maxGenerationCalls: number;  // no greater than maxCandidates
  maxEvaluationCalls: number;  // no greater than maxCandidates
  timeoutMs: number;           // positive bounded wall-clock deadline
  maxPayloadBytes: number;
  maxArchiveEntries: number;
  maxTaskRowsPerCandidate: number;
}

export interface ValidationObjectiveVector {
  taskSuccess01: number;
  skillQuality01: number;
  trajectoryQuality01: number;
}

export interface PopulationCandidateRecord {
  candidateFingerprint: string;
  sourceFingerprint: string;
  variationId: string;
  seed: number;
  validationManifestFingerprint: string;
  validationPlanFingerprint: string;
  objectives: ValidationObjectiveVector;
  perTask: Array<{
    taskKeyHash: string;
    taskFamily?: string;
    objectives: ValidationObjectiveVector;
  }>;
  safetyViolationCount: number;
  archiveStatus: 'pareto'|'dominated'|'duplicate'|'safety-rejected'|'invalid';
}

export interface ValidationOnlyCandidateEvaluator {
  evaluate(input: {
    payload: unknown;
    payloadFingerprint: string;
    validationTasks: readonly IndependentCandidateTask[];
    validationManifestFingerprint: string;
    signal: AbortSignal;
  }): Promise<{
    payloadFingerprint: string;
    validationPlanFingerprint: string;
    reports: SkillLearnBenchTrialReport[];
  }>;
}
```

The production implementation must use descriptor-safe/plain-data snapshots at all untrusted boundaries, verify that returned fingerprints match the submitted candidate and exact validation plan, reject duplicate or missing task/trial coverage, and accept only finite 0..1 measurements.

## 5. Search and selection semantics

1. Freeze the source candidate payload, P23 revision plan, validation reports, task manifest and validation-only evaluator identity at run start. Fingerprint those inputs.
2. Construct a small set of deterministic variation descriptors from the existing evidence-backed targets. Variations must be distinct (for example: minimal targeted repair, alternative ordering/structure, explicit edge-case reinforcement). Do not invent unrelated feature goals.
3. Generate each variant with the local configured provider. Every generator request contains source payload, validation evidence, evidence-linked targets, variation descriptor, and the holdout-withheld policy. It contains no holdout task, score, direction or result.
4. Canonicalize and fingerprint the candidate payload. Reject empty, malformed, over-budget, schema-breaking and source-identical outputs. Deduplicate before validation.
5. Evaluate each unique candidate on the same fixed validation tasks. Require exact paired task/trial coverage and trusted manifest binding. Do not compare candidates evaluated on different task sets or runtime fingerprints.
6. Build per-task objective vectors from the independent reports. Task-family labels come only from the trusted manifest. Safety violations are a veto, never a tradeable objective.
7. Candidate A dominates B only if A is no worse on all three validation objectives and strictly better on at least one, with the same validation identity and zero safety violations. Keep nondominated entries; trim over-capacity archives deterministically.
8. Choose the winner by a stable tie-break: Pareto rank, macro-average validation objective, minimum per-task objective, then lexical payload fingerprint. This tie-break is for validation-only exploration and cannot grant promotion eligibility.
9. If no unique safe candidate has a positive validation improvement over the source, return `no-improving-candidate` and do not stage.
10. Pass the winning payload into the existing P23 finalization route exactly once. Fresh holdout results are used only by the existing final gate; they are not returned to or used by the population selector.
11. Preserve rejected/dominated outcomes with bounded reason codes for diagnostics; do not retry identical payloads on the same immutable evidence fingerprint.

## 6. Failure, safety and concurrency behavior

- Default-deny on missing provider, validation evaluator, trusted task manifest or evidence binding.
- All callbacks receive an abort signal and are constrained by one wall-clock deadline; a timeout aborts the run and yields no selected candidate.
- One search per `skillId + sourceCandidateFingerprint + evidenceFingerprint` may be in flight. Identical calls coalesce; new evidence creates a new run after the old one settles.
- The source candidate and active version are re-read immediately before final staging. If either changed, discard the winner and require a fresh search.
- A failure to persist archive provenance or the final P23 journal prevents a success result.
- No automated approval, shadow success, activation, deletion of prior versions or rollback is performed by the search.
- Diagnostics distinguish `generated`, `validated`, `pareto-retained`, `selected`, `staged`, `shadow-verified`, `approved`, `active` and `released`. These are separate states, not one completion flag.

## 7. Tests and verification

Focused tests must cover:

- validation-only candidate generation: serialized requests contain no holdout task ID, case input, score, delta or direction;
- exact manifest/payload fingerprint binding and full paired validation coverage;
- three-objective Pareto dominance, non-dominance and deterministic tie-breaking;
- safety veto even when the other objectives improve;
- maximum-candidate, maximum-call, payload-size, archive-size and wall-clock budgets;
- duplicate payload suppression before evaluation;
- malformed provider output, accessor/proxy data, stale source version, evaluator timeout and archive persistence failure;
- only one selected payload reaches the canonical final P23 evaluator;
- canonical P23 rejects unauthentic proposal, stale evidence, holdout regression or invalid evaluation;
- staged candidates remain inactive until authenticated shadow evidence and explicit approval;
- restart/restore of the bounded archive preserves fingerprints and cannot convert stored diagnostics into authority.

Targeted checks: new archive and orchestrator tests, existing P23 local-model revision tests, independent evaluator tests, P23 verified lifecycle/store tests, typecheck and the relevant learning-validation workflow. Exact-head CI must be green before the aspect PR is marked ready.

## 8. Scope boundaries and later passes

This first implementation slice is limited to P23 reflective skill candidates and validation-only population search. It does not introduce a second optimizer runtime, change active skill resolution, rewrite P36's developmental evidence model, or claim weight-level neural plasticity.

Follow-on aspect passes, after this slice has measured value:
1. connect the search to P36 goal/agenda selection and P23 compound-repair scheduling;
2. add long-horizon strategy transfer, forgetting/drift and delayed-retention objectives;
3. expose self-improvement telemetry in the organism diagnostics and operator UI;
4. evaluate on a frozen RU/EN research-grade manifest with at least five paired seeds, independent holdout and ablations.

A research-grade improvement claim requires repeatable positive paired-seed results, no safety or family regressions, transfer/retention evidence and exact-release artifact parity. Passing synthetic fixtures alone is not evidence of real autonomous improvement.
