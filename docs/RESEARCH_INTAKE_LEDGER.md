## WorkPass403 — paired-seed replication inside candidate task families (2026-10-23)

- **Source evidence:** Google's [RLiable](https://github.com/google-research/rliable) recommends interval estimates and robust aggregates rather than only point estimates when runs are few, and provides stratified-bootstrap confidence intervals, IQM, performance profiles and probability-of-improvement metrics. [SkillLearnBench](https://arxiv.org/abs/2604.20087) measures skill quality, trajectory and task outcome across verified tasks and reports nonuniform gains between tasks/methods. [Hermes Agent Self-Evolution](https://github.com/NousResearch/hermes-agent-self-evolution) keeps candidate evaluation and promotion behind separate guardrails.
- **NK1 gap:** WorkPass402 required two distinct tasks per canonical family on each split, but those tasks could each have only one seed. Family coverage was present, yet replication across random initialization / stochastic execution was absent.
- **Adaptation:** `IndependentSkillCandidateEvaluator.ts` adds `IndependentEvaluationFamilySeedCoverageOptions`. A seed counts only when the candidate's trusted run bindings show that same seed for every distinct task in a family. The comparator uses common seeds, not a union across task-local seeds; missing labels/too few tasks cannot silently pass a requested seed gate. New report counters distinguish families evaluated, families with adequate seed coverage, and failures.
- **Production integration:** `P23LearningEngine.approveIndependentlyEvaluatedSkillCandidate` now hardcodes a minimum of three common paired seeds for each sufficiently sampled family in both validation and holdout, alongside two-task/one-family structural coverage. Caller-generated payloads cannot weaken this requirement.
- **Regression/CI:** WorkPass225 creates an improved two-seed family candidate and proves it remains ineligible under a three-seed policy, while a paired three-seed case passes coverage. WorkPass402 end-to-end promotion test additionally proves a two-seed candidate is blocked before store approval. P26 already triggers on/runs both test files.
- **Limitations:** Three seeds are only a structural minimum, not a significance threshold. The RLiable approach suggests the next research pass should add stratified bootstrap confidence intervals, IQM / probability of improvement, and deterministic paired-seed reports on a larger task set. No performance improvement is claimed; Actions logs are unavailable.
- **Artifact:** [WorkPass403 paired-seed family coverage](WORKPASS403_PAIRED_SEED_FAMILY_COVERAGE_RU.md).

---

## WorkPass402 — wire family coverage into the actual P23 promotion authority (2026-10-23)

- **Discovery:** WorkPass400/401 correctly added family regression and coverage controls to the common candidate gate, but the authoritative `P23LearningEngine.approveIndependentlyEvaluatedSkillCandidate` called `compareMatchedIndependentEvaluations` with the default options. That left production activation compatible with reports whose family-level check was not performed.
- **Fix:** `compareMatchedIndependentEvaluations` now accepts and forwards `SkillLearnBenchCandidateGateOptions`. The actual P23 promotion entry point hardcodes `minimumValidationFamilies: 1`, `minimumHoldoutFamilies: 1`, `minimumValidationFamilyTasks: 2`, and `minimumHoldoutFamilyTasks: 2`; no candidate-controlled option can weaken this rule. Missing/insufficient family evidence fails closed before promotion.
- **Provenance:** The evaluator resolves task families from the canonical `experimentAuthority.manifest` rather than trusting caller-supplied task labels; the WorkPass213 regression in `workpass203-independent-candidate-evaluator.mjs` verifies canonical `summarization` overwrites a caller-forged label.
- **Regression/CI:** `workpass225-matched-independent-evaluation.mjs` tests that strict minima flow through the comparator and missing family labels produce both coverage failures. `workpass402-production-promotion-family-gate.mjs` additionally exercises `P23LearningEngine.approveIndependentlyEvaluatedSkillCandidate`: advisory scoring accepts improved reports under legacy defaults, but the actual activation route rejects the same valid envelopes when canonical family provenance is missing, before store approval. P26 path filters and Node.js 24 steps now cover both tests.
- **Research evidence:** [SkillLearnBench](https://arxiv.org/abs/2604.20087) evaluates skill quality, trajectory and task outcome across verified tasks from 15 subdomains and reports nonuniform gains; [Hermes Agent Self-Evolution](https://github.com/NousResearch/hermes-agent-self-evolution) emphasizes candidate guardrails separate from promotion.
- **Limitations:** Two tasks in one family per split are a minimum provenance/coverage check, not sufficient statistical evidence. Production calibration still needs paired seeds, uncertainty intervals, and a versioned canonical manifest. Current Actions runs fail without exposed steps/logs; runtime success is unverified.
- **Artifact:** [WorkPass402 production family gate](WORKPASS402_PRODUCTION_FAMILY_GATE_RU.md).

---

## WorkPass401 — explicit strict mode for task-family provenance (2026-10-23)

- **NK1 gap:** WorkPass400 computes family-level regression only when canonical `taskFamily` metadata is present. Guessing family from task ID would be unsafe, but a production caller also needs a way to ensure expected family-level evaluation did not silently become a no-op.
- **Adaptation:** `SkillLearnBenchAdapter.ts` adds `minimumValidationFamilies` and `minimumHoldoutFamilies`. Each counts only families with enough distinct tasks according to the configured per-family task minimum. Coverage below a requested floor rejects the candidate using explicit reason codes.
- **Compatibility:** Defaults are 0 so older/test-only reports without family provenance preserve behavior; benchmark/production profiles should set a positive minimum and supply family labels from the canonical manifest. Family identity is never invented.
- **Regression:** P29 now asserts that missing family labels produce zero evaluated families and block eligibility when strict validation and holdout coverage are required. Negative and fractional minimums are rejected.
- **Research connection:** SkillLearnBench's multi-domain task structure supports explicit stratified evaluation; Hermes Self-Evolution's separation of candidate improvement and guarded promotion motivates making the evaluator profile explicit.
- **Limitations:** This code does not prove a supplied family label is canonical on its own; production should bind it from the independent evaluator/manifest fingerprint. Actual test/typecheck runs remain unverified because GitHub Actions jobs expose no step logs.
- **Artifact:** [WorkPass401 strict family coverage](WORKPASS401_STRICT_FAMILY_COVERAGE_RU.md).

---

## WorkPass400 — prevent regression across a validation task family (2026-10-23)

- **Source evidence:** [SkillLearnBench](https://arxiv.org/abs/2604.20087) uses 20 verified tasks across 15 sub-domains and evaluates skill quality, execution trajectory and task outcome; its results report that gains vary across tasks and model setups. [Hermes Agent Self-Evolution](https://github.com/NousResearch/hermes-agent-self-evolution) describes candidate evaluation under explicit test/size/semantic guardrails before review/promotion.
- **NK1 gap:** WorkPass399 vetoed large regressions on individual validation tasks, but a collection of moderate regressions within one task family (each below the per-task tolerance) could still be hidden by larger gains in another family.
- **Adaptation:** `SkillLearnBenchAdapter.ts` now uses shared `summarizeFamilyRegressions` for validation and holdout. It averages repeat trials per task, averages task-level means per family, and applies `maximumValidationFamilyRegression01` (default 0.10) when at least `minimumValidationFamilyTasks` (default 2) tasks have family provenance. Report additions: `validationFamiliesEvaluated`, `validationFamilyRegressions`; the gate rejects with `validation-family-regression-exceeds-tolerance`.
- **Regression:** P29 builds two families where family A's tasks each decline by 0.16 (under the 0.20 per-task veto) but family B improves enough for the overall mean to rise. Validation task regressions remain zero; family regression is counted and eligibility is rejected. Also covers NaN threshold fail-closed behavior.
- **Compatibility and limits:** Family labels are not inferred from task names. Missing family provenance stays outside the family veto, but the existing paired aggregate/task gates still apply. Defaults are engineering choices and require paired multi-seed calibration and noise estimation; no experimental improvement is claimed.
- **CI:** P26 path/step wiring already includes this adapter and P29 test. Action execution remains unverified while current jobs expose no step list/log URL.
- **Artifact:** [WorkPass400 implementation notes](WORKPASS400_VALIDATION_FAMILY_REGRESSION_RU.md).

---

## WorkPass399 — reject hidden validation-task regressions (2026-10-23)

- **Source evidence:** [SkillLearnBench paper](https://arxiv.org/abs/2604.20087) evaluates skill quality, trajectory and task outcome across verified tasks; it also reports that continual-learning gains are not consistent across tasks/methods. [Project benchmark description](https://github.com/cxcscmu/SkillLearnBench) motivates task-level rather than only aggregate reporting.
- **NK1 gap:** paired macro-average validation improvement could hide a strong regression on one task when gains on other tasks compensate. NK1 already had minimum distinct validation coverage, aggregate holdout regression, safety veto and sampled holdout-family regression, but no per-task validation veto.
- **Adaptation:** add configurable `maximumValidationTaskRegression01` (default 0.20). Average repeated trials per task, compute paired baseline/candidate composite delta for each task, and reject eligibility if any task crosses the tolerance. The report now includes `validationTaskRegressions`; invalid thresholds fail closed.
- **Regression/CI:** P29 includes a case with two improving tasks and one sharply regressing task where the overall mean still improves. Existing P26 path/step wiring includes this test.
- **Limits:** 0.20 is an NK1 engineering default, not a constant prescribed by SkillLearnBench. It must be calibrated using paired seeds and a fixed task suite; test execution remains unverified while current Actions jobs expose no steps/logs.

## WorkPass398 — snapshot promotion envelopes and approval before property access (2026-10-23)

- **Source evidence:** [Hermes Agent Self-Evolution](https://github.com/NousResearch/hermes-agent-self-evolution) uses a reviewable evolution workflow with explicit testing/size/semantic guardrails and separate promotion; [Reflexion](https://arxiv.org/abs/2303.11366) treats reflections as experience-guided proposals rather than self-verified truth.
- **NK1 gap:** `approveIndependentlyEvaluatedSkillCandidate` accessed caller-owned baseline/evaluation fields before taking a plain-data snapshot; a getter/Proxy could execute before digest/provenance checks. The finalizer passed the caller's approval object directly to the store.
- **Adaptation:** snapshot both evaluation envelopes through `LearningTrustBoundary.snapshotPlainData` before field access and snapshot the approval before the store call. Add focused regressions asserting getter counts remain zero and malformed input cannot reach store activation.
- **Scope:** no upstream source code or new runtime dependency was copied. Signatures, independent evaluation fingerprints, exact staged-payload matching and the store's authenticated approval/shadow checks remain the promotion authorities.
- **Limits:** plain-data checks guard input handling; they do not substitute for a production-isolated evaluator/verifier/safety scanner. Exact-head tests/typecheck remain unverified.

## WorkPass397 — close lower-level promotion bypass for reflective revisions (2026-10-23)

- **Gap:** disabling report-only `approveReflectiveVerifiedSkillCandidate` did not by itself stop a caller from using the generic `approveVerifiedSkillCandidate` API on a staged reflective revision.
- **Adaptation:** reject revision candidates carrying `revisionProvenance` in the generic API and make the independently evaluated path call a private finalizer after the matched-envelope/evidence/approval gates have passed.
- **Regression:** the P23 promotion-gate test verifies the generic call fails before the backing store's approval callback. This complements WorkPass394's report-only path denial.
- **Limits:** runtime test/typecheck execution has not been confirmed; no promotion or learning performance claim is made.

---

## WorkPass396 — end-to-end writeback and explicit activation separation (2026-10-23)

- **Fresh upstream issue/PR review:** the [Hermes Agent Self-Evolution issue list](https://github.com/NousResearch/hermes-agent-self-evolution/issues) currently includes reports that evolution can become a no-op (#141) or fail to write the optimized skill text back (#172, #175), and its PR history includes fixes to validate the complete skill file including frontmatter (#185, #187). These are failure modes of the evolution loop, not just benchmark concerns.
- **NK1 regression adaptation:** the P23 end-to-end fixture already used genuine signed outcome evidence, a real promotion proposal, independent evaluation and the versioned candidate store. It now additionally asserts that the exact changed payload passed to the independent evaluator is the payload persisted on the staged candidate.
- The same test asserts that candidate status remains `staged` and the active set stays empty after evaluation. The generator cannot activate its own output; authenticated shadow evidence and the separate explicit approval path remain required.
- No upstream source file was copied; the lesson was added as a regression to NK1's native candidate lifecycle. Test execution is still unverified while GitHub Actions jobs expose no step-level logs.

## WorkPass395 — compatibility check for host-owned class providers (2026-10-23)

- Added an integration fixture whose `configured` and `generate` methods live on the provider prototype, matching the shape of the existing `OpenAICompatibleLocalChatProvider` class.
- The direct generator trust boundary now has coverage for both sides of the compatibility contract: descriptor-based resolution must accept normal prototype methods, while request/response/provider accessors must be rejected without executing getters.
- The P26 workflow's new local generator regression step runs this test because the source/test paths are now part of the trigger filter. The check is committed but not executed successfully yet due the continuing missing Action step/log records.

## WorkPass394 — harden the direct local-model generator boundary (2026-10-23)

- **Implementation gap found:** the P23 engine protected the main reflective revision flow, but `generateLocalSkillRevision` is also a callable module entry point. Direct callers could previously pass accessor-backed request data that `JSON.stringify` would read, or a provider response whose `text` getter executed during parsing.
- **Fix:** request data is detached through `LearningTrustBoundary.snapshotPlainData` before field reads/JSON serialization. The provider's `configured` and `generate` methods are resolved from property descriptors (own or prototype) so accessor capabilities are rejected without invoking getters. Provider response objects are detached before their `text` field is read. Missing providers preserve the original not-configured diagnostic.
- **Tests:** added request getter, response getter and provider capability getter regressions, each asserting the getter count stays zero; retained the absent-provider and unconfigured-provider error cases.
- **CI:** the existing Node.js 24 P26 workflow now triggers on the local generator source/test and runs `test:p23:local-model-skill-revision-generator` explicitly. This covers the direct generator entry point as well as the P23 engine's outer boundary.
- No new dependency/upstream file copy was needed. Tests remain execution-unverified while current Actions jobs expose failure conclusions without step lists/log URLs.

## WorkPass393 — runtime API contract: diagnostic memory versus eligible evidence (2026-10-23)

- Updated the `OrganismRuntime.compoundSkillRepairEvidence` API comment to state that it returns bounded non-holdout diagnostic observations, including failed/ineligible attempts. It does not certify them for generation.
- The P23 coordinator owns the eligibility transition: filter `revisionEligible` → run the strict canonical snapshot/validator → fingerprint → prepare generator/evaluator inputs → candidate staging gate.
- This aligns implementation and documentation after WorkPass391, prevents future callers from treating every returned row as generator-ready, and preserves useful error experience without weakening activation/promotion authority.

## WorkPass392 — distinguish repeated trials from independent task coverage (2026-10-23)

- **Research rationale:** [AFTER](https://github.com/DavydenkoGr/AFTER) and [SkillLearnBench](https://github.com/cxcscmu/SkillLearnBench) emphasize generalization across task families/contexts and task-level evaluation, rather than allowing repeated runs of a single easy case to dominate the evidence.
- **Implementation:** the SkillLearnBench candidate gate now requires at least two distinct paired validation tasks by default. The `minimumValidationTasks` option is configurable, validated as a positive safe integer, and the report includes `validationTaskCount`. Repeats increase paired trial count but not distinct-task coverage.
- **Decision:** under-covered validation adds `validation-task-coverage-insufficient` and blocks eligibility even if the validation gain is large and the holdout gate would otherwise pass. Existing macro-average scoring, paired exact trial matching, safety hard-gate, family-level holdout regression and explicit approval remain intact.
- **Regression:** the P29 gate test now repeats two trials for one task, demonstrates improved outcomes relative to baseline, and confirms the candidate remains ineligible because only one distinct validation task is represented. Invalid zero task minimum is also rejected.
- The P26 workflow already runs the updated P29 gate test on Node.js 24. The test is committed but not execution-verified due to unavailable job step logs.

## WorkPass391 — separate diagnostic repair memory from revision evidence (2026-10-23)

- **Design principle:** error-memory should preserve useful observations even when an attempt is not yet suitable for automated skill revision. A failed repair with no valid alternate tool is still diagnostic experience, but must not be promoted to a generator input.
- **Implementation:** `OrganismRuntime.compoundSkillRepairEvidence` now returns the deterministic bounded newest-96 diagnostic window, including noneligible records, instead of passing every record through the promotion-only canonicalizer. The coordinator first filters by `revisionEligible` and only then invokes `canonicalCompoundRepairEvidence`, which remains strict about identities, selected/candidate tool membership, confidence and timestamp.
- Candidate-tool sets are normalized at the runtime observation boundary; deterministic ordering for same-time records remains. This avoids allowing a legitimate empty-choice failed attempt to break the whole repair-observation API while preserving the trust boundary for skill revision.
- **Regression:** the 120-row runtime fixture now includes a newest noneligible record with an empty candidate-tool set and confirms it remains visible in diagnostic memory while marked `revisionEligible: false`. The coordinator still fingerprints only the eligible rows.
- This adapts evidence/experience separation principles reflected in [Reflexion](https://arxiv.org/abs/2303.11366), [Voyager](https://arxiv.org/abs/2305.16291), and [Hermes Agent Self-Evolution](https://github.com/NousResearch/hermes-agent-self-evolution). No upstream code was copied and no dependency was added.
- CI remains wired but execution-unverified; current Actions jobs still have no retrievable step logs, so this regression must be confirmed by an actual runner before declaring the branch complete.

## WorkPass390 — reject unchanged skill revisions before expensive evaluation (2026-10-23)

- **Upstream mechanism/risk reviewed:** [Hermes Agent Self-Evolution](https://github.com/NousResearch/hermes-agent-self-evolution) uses an iterative generate → evaluate → refine skill loop. The loop is only meaningful when the generated artifact is actually different, fingerprinted, and passed through independent evaluation; accepting unchanged output wastes execution budget and can make a supposed evolution pass a no-op.
- **NK1 implementation:** P23 now canonicalizes and compares the detached generated payload with the exact source-candidate payload before the independent evaluator is invoked. An unchanged artifact raises the existing `reflective revision payload is unchanged from its source candidate` error before sandbox spend. The later stage-time equality check remains as defense in depth.
- **End-to-end regression:** the WorkPass389 integration fixture uses signed Ed25519 outcome artifacts, a genuine evidence-backed promotion proposal and the real versioned candidate store. It asserts that accessor-bearing generator/evaluator responses do not invoke their getters or stage candidates, that a no-op payload never calls the evaluator, and that a changed, detached payload with a matching independent-evaluation fingerprint can stage as a shadow candidate.
- **Scope/validation:** this is a local integration regression using fixture keys and fixture verifier services, not a production benchmark or measured learning gain. The P26 Node.js 24 workflow is wired to run it. Actual test execution remains unverified while Actions job records do not provide step lists or retrievable logs.

## WorkPass388–389 — verify the revision loop as one connected lifecycle (2026-10-23)

- Replaced self-referential `typeof` casts on detached baseline/candidate/fresh-evaluation snapshots with explicit input/return-type contracts to reduce ambiguity in the TypeScript boundary.
- Added `workpass383-p23-revision-generator-boundary.mjs`: the fixture creates a real signed-evidence promotion proposal, stages a source candidate in the versioned store, then tests three connected outcomes:
  1. An accessor-bearing generator result is rejected before it reaches the independent evaluator, without invoking its getter or staging a candidate.
  2. An accessor-bearing independent-evaluator result is rejected before its fingerprint/reports are read, without invoking its getter or staging a candidate.
  3. A detached generated payload with a matching evaluation fingerprint and nonempty validation/holdout reports can stage as a new versioned candidate while the source remains distinct.
- The test is wired into P26 Learning Validation and its path filter on Node.js 24. It is a focused integration regression using fixture evidence/verifier services—not a production learning benchmark.
- Attempted repository-local validation is still blocked: the environment has no checkout and cannot resolve github.com from the shell. GitHub Actions has also returned failure conclusions without step lists or log URLs; I retried the latest P26 job once and the replacement job again exposed no steps/logs. The test is committed but not execution-verified.

## WorkPass386–387 — bounded windows and shared measurement trust boundary (2026-10-23)

- **Repair-history bounded window:** the runtime collects its newest 96 eligible repair observations before applying the strict canonical validator. Equal-timestamp ties use a stable canonical JSON row key and locale-independent ordering. This preserves the original bounded-history contract while keeping digests deterministic.
- **Regression evidence:** the coordinator regression now exercises the real `OrganismRuntime.prototype.compoundSkillRepairEvidence` method with 120 valid eligible repair rows and checks that the newest 96 are retained; it also covers malformed row inputs.
- **Longitudinal metric trust:** `ContinualLearningMetrics` now reuses `LearningTrustBoundary.snapshotPlainData` so task/score data is detached before aggregation. Accessors do not execute, invalid/cyclic/sparse records fail closed, and non-finite scores are rejected before the growth curve is computed.
- **Research linkage:** [EvoAgentBench](https://github.com/EverMind-AI/EvoAgentBench) treats growth over repeated checkpoints as a key self-evolution evaluation axis. NK1's normalized area-under-curve and first-to-last delta complement final score, forgetting and transfer. These are descriptive metrics; no causal uplift claim is inferred.
- **CI path:** P26 Learning Validation already includes the runtime/coordinator and continual metric sources/tests; the focused regression steps are wired to Node.js 24. Execution is still unverified because the available Actions records have no step list/log URL.

## WorkPass382–385 — complete more of the learning evidence chain (2026-10-23)

### New sources checked
- **EvoAgentBench** — [repository](https://github.com/EverMind-AI/EvoAgentBench), [paper](https://arxiv.org/abs/2607.05202). The project measures longitudinal self-evolution through growth curves, ability transfer and error avoidance rather than relying on one final snapshot. NK1 already had a checkpoint/task matrix, forgetting and transfer measurements; this pass adds a normalized area-under-learning-curve score and endpoint delta into that same metrics object.
- **Hermes Agent Self-Evolution** — [repository](https://github.com/NousResearch/hermes-agent-self-evolution) and examples from [issue/PR history around no-op/failed evolution wiring](https://github.com/NousResearch/hermes-agent-self-evolution/pulls). The current upstream project highlights why generated output must be validated end-to-end: a candidate can appear to run while the optimized output is unchanged or discarded. NK1 keeps its own explicit unchanged-payload rejection and this pass strengthens the data boundary on the exact generated artifact before independent evaluation and staging.
- **AFTER** — [repository](https://github.com/DavydenkoGr/AFTER). Its emphasis on transfer across task families remains reflected in NK1's manifest-bound family holdout gate.

### Implemented
- Compound-repair canonicalization now accepts a bounded plain-data batch only, validates identity/diagnosis/context/action fields, requires unique valid candidate-tool IDs, unit confidence and a nonnegative safe-integer observation timestamp, then applies locale-independent ordering before the digest.
- P23 payload canonicalization now performs descriptor-only reads, rejects sparse/custom arrays and accessors, bounds recursion/node/text usage, and preserves the established error codes for cycles and non-finite numbers.
- `generateAndStageReflectiveSkillRevision` snapshots baseline/candidate/options before evaluation, snapshots the generator result before hashing, and snapshots independent-evaluator output before reading fingerprints or report arrays. The exact detached payload is fingerprinted, independently evaluated, then passed to staging; staging still requires separate verified evidence and promotion approval.
- Continual metrics now include per-checkpoint mean performance, normalized trapezoidal area under that curve, and first-to-last checkpoint delta. Area for a single checkpoint is defined as that one observed score.
- Added explicit regressions for hostile payloads/evidence, sparse arrays, accessor non-invocation, malformed repair confidence/tool lists, longitudinal growth curves, and the single-stage edge case.
- Extended the existing Node.js 24 P26 workflow so these regressions run when their source/test files change. No additional dependency or copied upstream source file was required; the useful mechanisms were integrated into the current NK1 interfaces.

### Integration / validation caveat
- Source and regression updates are committed, but tests are **not execution-verified**. The current GitHub Actions connector still returns failure conclusions with `steps: null` / `logs_url: null`; those statuses do not identify a failing test or prove a compiler error.
- Before claiming functional completion, obtain actual step-level output for typecheck and the focused regressions. The new area-under-curve value is descriptive evidence, not causal attribution or proof of autonomous consciousness.

## WorkPass380–381 — host-independent ordering for reproducible learning (2026-10-23)

- Canonical compound-repair evidence fingerprints and learning-curriculum tie-breaks now use direct UTF-16 code-unit ordering instead of locale-sensitive `localeCompare`. Host locale differences cannot silently change the sort order and alter a SHA-256 digest or next-task ordering.
- Added a focused curriculum regression for equal-score, case-mixed/Unicode identifiers. Existing coordinator regressions cover evidence-row, property insertion and candidate-tool ordering invariance.
- The research connection is reproducibility as a learning-system property: deterministic replay and stable skill provenance require the same input evidence to produce the same canonical decision on different hosts. No new dependency or upstream source code was added.
- Test cases are committed but remain unverified in execution: current Actions job records report failure without step entries or retrievable logs.

## WorkPass379 — family-provenance downgrade prevention (2026-10-23)

- Matched baseline/candidate trial reports now require exact family-provenance parity: both may omit family for legacy aggregate-only evaluation, or both must carry the same canonical family. If only one side carries a family, candidate evaluation fails closed.
- The candidate gate validates the detached baseline/candidate/options envelope after snapshotting, so null, array or otherwise invalid runtime inputs produce a bounded boundary error rather than an unhelpful downstream property-access failure.
- Added regressions for one-sided family-label omission and null gate options. These are integrity/diagnostic improvements, not measured learning gains; the test runner remains unverified because workflow jobs do not expose step-level logs.

## WorkPass378 — shared trust boundary for candidate evaluation inputs (2026-10-23)

- Reused the existing NK1 LearningTrustBoundary snapshot primitive in SkillLearnBench rather than creating a parallel validator.
- Trial inputs, aggregate report lists, baseline/candidate gate envelopes and gate options are detached before field access. The canonical family label therefore cannot invoke a getter or be rewritten by a retained reference during aggregate/family scoring.
- Sparse arrays and accessor/proxy-backed values fail closed; no behavior relies on calling `structuredClone` on untrusted objects.
- Added regression assertions that getter-backed task family, report fields, gate envelope and options are never invoked, and that sparse report batches are rejected. The shared P26 Node.js 24 workflow already covers the relevant adapter and P29 test paths.
- This is a safety/integrity improvement only; it is not evidence of better task performance. CI/local test execution remains unverified because recent GitHub Actions job records have not exposed steps or retrievable logs.

## WorkPass376–377 — manifest-bound family-level holdout gate (2026-10-23)

### Source mechanisms adapted
- **AFTER — A Benchmark for Skill Evolution Frameworks** — [GitHub](https://github.com/DavydenkoGr/AFTER). Task/role/context transfer is a distinct property from aggregate success; a candidate needs task-family evidence, not only an average score.
- **SkillLearnBench** — [GitHub](https://github.com/cxcscmu/SkillLearnBench) and [paper](https://arxiv.org/abs/2604.20087). Keep task success, trajectory quality and skill quality separate, macro-average by task, and evaluate generated skills against independent baselines.
- This combines with NK1's existing canonical manifest and untouched validation/holdout split; no upstream code was copied and no new dependency was introduced.

### Implementation
- SkillLearnBench trial reports now optionally carry task-family provenance. The independent evaluator sources the family from the canonical VerifiedOutcomeLedger task manifest, overriding caller-supplied family strings when the manifest is present.
- Task family is included in the independent evaluation-plan fingerprint, so changing family attribution changes the evaluation identity instead of silently relabeling outcomes.
- The candidate gate now calculates paired macro means per family when that family has at least the configured number of distinct holdout tasks (default two). A family regression larger than the configured tolerance (default 0.10) blocks candidate eligibility even if the aggregate holdout score is unchanged.
- Missing family provenance on legacy reports keeps the existing aggregate gate and does not fabricate family labels. Conflicting family labels within a task or across matched baseline/candidate reports are rejected.
- Detailed family names and per-family holdout scores are not exposed in optimizer-facing feedback. The gate emits only a generic generalization warning plus aggregate counts, preserving the holdout isolation contract.

### Regression coverage / remaining evidence
- Added a contrived but important anti-masking case: two memory tasks regress, two perception tasks improve by a compensating amount, so overall holdout delta is exactly zero; the family gate must still reject the candidate.
- Added a test that caller-supplied task families cannot override canonical manifest family labels.
- Wired the independent evaluator regression into the focused P26 workflow, alongside family-gate test coverage already run by the Hermes candidate-gate step. The workflow uses Node.js 24.
- Test execution remains unverified: Action runs have continued failing without step lists/log downloads. Once a working runner is available, confirm these regressions and the runtime typecheck before considering this gate complete.

## WorkPass374–375 — canonical revision evidence + skill-evolution research (2026-10-23)

### Newly reviewed systems and research
- **WikiSkill: Compiling Agent Experience into Persistent Knowledge for Skill Evolution** — [arXiv:2608.27454](https://arxiv.org/abs/2608.27454). The paper emphasizes separating raw execution experience, accumulated reusable knowledge, and executable skills, then consolidating the knowledge between attempts. NK1 already has distinct experience rows, repair evidence, reflective hypotheses, and versioned skill candidates; this pass tightened the evidence identity between those stages rather than merging all of them into one untyped prompt.
- **AFTER — A Benchmark for Skill Evolution Frameworks** — [repository](https://github.com/DavydenkoGr/AFTER). Its emphasis on transfer across role/task/context and holdout boundaries supports NK1's decision not to call repeated same-context errors “transfer”; the curriculum's family mix must be measured separately from task success.
- **Meta-Agent — Continual harness optimization** — [repository](https://github.com/canvas-org/meta-agent). Its fast task-harness loop and slower proposer/skill evolution are a useful split for future NK1 work; the current patch preserves the existing trusted generator/evaluator boundary and does not allow generated skills to activate themselves.
- **SkillLearnBench** — [repository](https://github.com/cxcscmu/SkillLearnBench) and [benchmark paper](https://arxiv.org/abs/2604.20087). Its separation of task success, trajectory quality, and skill quality informs future evaluation needs; no numeric uplift is asserted without measured baseline/candidate reports.

### WorkPass374–375 implementation
- Added a shared canonicalizer and fingerprint function for P23 compound-repair evidence. Both the coordinator and runtime now use the exact same representation.
- Canonicalization stabilizes the row ordering (including equal timestamps), property layout, and the ordering of candidate tool sets. The runtime still retains only the newest 96 eligible repair records.
- This prevents harmless storage/order variations from appearing as new repair evidence and producing duplicate skill-revision attempts; a material evidence/diagnosis change still changes the SHA-256 fingerprint.
- Regression coverage now checks row-order, property-insertion-order, and candidate-tool-order invariance, plus sensitivity to a real diagnosis change.
- The focused coordinator regression is included in the P26 Learning Validation workflow path filter and run steps. The workflow is configured on Node.js 24.
- No upstream source file was copied and no runtime dependency was added; the extracted ideas were adapted to NK1's typed evidence and candidate-lifecycle contracts.

### Validation status
- Test changes and workflow config are committed but **not execution-verified**. Recent GitHub Actions runs continue to expose `steps: null` and no retrievable logs. This prevents distinguishing runner integration failure from a program/test failure.
- Next priority: obtain an actual runner with step-level logs; then run the P23 engine, compound repair coordinator, SkillLearnBench adapter, paired holdout and replay ablation checks on a fixed protocol. Preserve candidate promotion as a separate signed approval operation.

## WorkPass373 — sparse replay snapshot quarantine (2026-10-23)

- Hardened persisted replay-vector parsing against a JavaScript edge case: Array.prototype.every skips missing sparse slots, which could make a nominally 16-element array contain fewer than 16 actual feature values.
- The parser now explicitly materializes/checks all 16 indices against the normalized numeric contract; malformed rows are rejected by the existing state restore sanitizer. A regression test covers this quarantine behavior.
- This is a data-integrity safeguard, not a learning-quality gain claim. Latest checked Actions rerun finished with failure but still exposed no steps or logs, so test execution remains unverified.

## WorkPass372 — replay snapshot persistence and legacy recovery (2026-10-23)

- Added regression coverage for schema-v1 round-trip behavior: new replay feature vectors survive snapshot/restore, restored snapshot-bearing experiences remain replayable, and older experience rows that omit the optional fields still restore and use the compatibility fallback.
- This directly applies the reproducibility principle from [CleanRL](https://docs.cleanrl.dev/) to persisted agent-learning state: a saved experience should preserve the features that influenced sampling, rather than silently depending on a later trace object.
- No schema version bump or dependency change was needed because the new fields are optional and bounded by the current parser. Tests are committed, not claimed as executed; current Actions runs have not exposed step-level results.

## WorkPass371 — minimal-trace compatibility follow-up (2026-10-23)

- Inspection of the compact P23 integration fixtures showed that some trusted trace shapes omit reasoningSignals. Replay feature capture now uses optional access and a neutral causal-strength prior when this metadata is absent.
- The focused P23 curriculum fixture is already part of the committed regression script and exercises a compact state/trace. A fresh successful execution is still required; I did not infer a pass from source inspection.
- Current PR comparison remains divergent from integration (73 commits ahead, 5 behind at the latest inspected head). Do not merge until the ancestry discrepancy is reconciled and the new learning regressions produce step-level evidence.

## WorkPass370 — CI coverage for the modified P23 learning path (2026-10-23)

- The existing P26 Learning Validation workflow did not include the P23 learning-engine, reflection-curriculum, shared trust-boundary, or the two affected P23 test files in its pull-request path filter. This meant P23-only edits would not reliably trigger that workflow.
- Added those sources/tests to the path filter and added two explicit execution steps for replay-integrity and reflection/curriculum regressions. The workflow already pins Node.js 24.
- Prior associated runs show failed conclusions but expose neither step lists nor retrievable logs (steps: null, log download returns BlobNotFound). This is an observability/execution blocker, not proof that the new P23 tests failed. After this workflow commit, verify fresh runs have a runner and named steps before treating CI as a valid signal.

## WorkPass364–369 — replay provenance and diverse active curriculum (2026-10-23)

### Sources reviewed this pass
- **Hermes Agent Self-Evolution** — [repository](https://github.com/NousResearch/hermes-agent-self-evolution) and [plan](https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/PLAN.md). The documented direction emphasizes evidence datasets, train/validation/holdout separation, size constraints, semantic preservation, and review before activation. NK1 retains the stronger existing verified-promotion boundary; generated content remains a proposal rather than runtime authority.
- **Reflexion** — [arXiv:2303.11366](https://arxiv.org/abs/2303.11366). Reflective text/feedback is retained as experience to affect future decisions without requiring weight updates. NK1 adaptation: do not turn a reflection into a verified label, and preserve the source outcome/feature snapshot used for later replay.
- **Voyager** — [paper](https://arxiv.org/abs/2305.16291) and [project](https://voyager.minedojo.org/). Its automatic curriculum and reusable skill library inform NK1's family-aware ranking so one repeated failure class does not monopolize the next-learning queue.
- **CleanRL** — [official documentation](https://docs.cleanrl.dev/). Reproducibility and explicit benchmark implementation inform our distinction between code changed, test assertions added, and measured pass/effect evidence. No benchmark gain is claimed by this patch.

### Decisions and implementation
- P23 LearningExperience now optionally stores a bounded replay feature vector, goal-pressure score, and causal-strength score alongside the recorded outcome. These are captured at ingestion, making new replay selection less dependent on a later mutable trace object.
- The replay entry-point now joins incoming trace handles to stored experiences by ID, tick, selected action, and context. Failed joins are excluded before selection; the persisted experience supplies reward/outcome features.
- Schema version remains 1 with optional fields and a checked fallback for pre-existing records; no migration that invalidates old state was introduced.
- Experience ingestion rejects non-canonical identity/time/action data and non-unit predictions or outcome labels instead of clamping invalid external values into training examples.
- Learning targets now have normalized scores and are interleaved by family after score-sorting within each family. The top overall repair remains first; if only one family is available, ranking remains score-ordered.
- Tests added for forged/stale replay joins, feature snapshot shape, out-of-range labels, non-finite predictions, score bounds, and family coverage. These test cases are committed, but their execution is not claimed until CI or a local test run returns a verifiable result.
- No upstream source code was copied, and no external runtime dependency was added. These are architecture adaptations to existing NK1 interfaces.

### Completion evidence / remaining work
- **Implemented:** 6 source/test/documentation passes (WorkPass364–369) on feature/learning.
- **Not yet measured:** test execution, type-check, real replay-quality uplift, independent benchmark results, live skill-generation/evaluation run, full end-to-end autonomous learning loop.
- **Next:** run the focused P23 scripts in an environment where the GitHub runner actually executes steps; resolve any failures from real logs; then measure baseline-vs-new replay selection on a fixed dataset and only retain changes that preserve holdout/regression gates.

## WorkPass361–362 — reflection confidence, provenance and transfer semantics (2026-10-23)

### Reviewed sources

- **Hermes Agent Self-Evolution**, [skill evolution orchestrator](https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/evolution/skills/evolve_skill.py), [plan](https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/PLAN.md), [package manifest](https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/pyproject.toml), MIT-listed project. Relevant mechanisms: generate/evolve candidate skills, measure baseline and candidate, keep validation separate from holdout, enforce size/safety constraints and refuse deployment when constraints fail.
- **Reflexion**, [paper](https://arxiv.org/abs/2303.11366). Relevant mechanism: keep natural-language/feedback reflections in episodic memory to guide later attempts. In NK1 a reflection is only a hypothesis, never a trusted label.
- **Voyager**, [paper](https://arxiv.org/abs/2305.16291). Relevant mechanisms: automatic curriculum, persistent executable skill library, iterative refinement from environment/error feedback and self-verification.
- **CleanRL**, [documentation](https://docs.cleanrl.dev/). Relevant research practices: reproducible seeded experiments, transparent implementations and measured benchmarks.

### NK1 adaptation decision

- Kept one canonical TypeScript P23 engine and its existing verified candidate / independent-evaluator / signed-shadow / explicit-approval lifecycle. No duplicate Python/DSPy optimization runtime or upstream code was vendored in this pass.
- Added a descriptive Wilson pass-rate interval to reflection outputs while explicitly marking that temporal dependence may invalidate classical independent-sample interpretation. Its interval only widens/reduces heuristic confidence; it never grants candidate promotion.
- Made the pass threshold explicit and aligned the public `ReflectionHypothesis` interface with emitted metric fields.
- Added provenance identifying the total valid occurrence count separately from the recent sample count and its tick window; evidence IDs now correspond to the exact sample used for those metrics.
- Separated recurrence/repair value and information gain from transfer evidence. Both reflection and evidence-debt targets report `transfer01=0` absent independently measured cross-context/held-out transfer.
- Extended P23 regressions for identity collisions, malformed scores, accessors, revoked proxies, oversized inputs, the recent-window boundary and transfer semantics; corrected the suite completion marker.

### Validation state

The source, test and documentation changes are committed on `feature/learning`, and the P23 aggregate command includes the focused regression file. Actions API results available during this pass show workflow jobs failing with no exposed steps/log detail. Thus the new suite/typecheck remains **unverified**, not passed. No performance/transfer uplift or consciousness claim is made. `main` and the Release ZIP remain unchanged.

## WorkPass356 — trustworthy regression reporting

- Corrected the experiment-plan regression runner so its success marker is emitted only after all appended trust-boundary, evidence-replay, atomicity and size-budget assertions finish.
- No dependency added. Actual CI execution is still unavailable until GitHub Actions assigns a runner.

## WorkPass355 — strict train/validation/holdout separation

- Corrected a subtle evaluation leakage: the local skill optimizer previously received numeric holdout deltas and a holdout-specific target. Repeated cycles could use that feedback to tune to the supposedly untouched test set despite withholding individual cases.
- NK1 adaptation: optimizer inputs now contain validation evidence only plus a fixed policy assertion that holdout results are withheld; holdout aggregate values, regression direction, reasons and target weights are not sent to the generator. The evaluator still uses holdout internally for the final eligibility/safety gate.
- This is consistent with leakage-resistant experimental practice: keep test data for final comparison, not iterative model selection. No external code or dependency added.
- Regression tests are wired into the main P23 learning command but remain unverified due to CI jobs failing before runner assignment.

## WorkPass354 — capability-envelope contract

- Explicit function capabilities in autonomous repair-provider envelopes must themselves be own data properties. Accessor-backed generator fields are rejected without invocation; the normalized optional config field is omitted when not supplied.
- This preserves the boundary between untrusted repair evidence and callable generation/evaluation permissions. No external dependency or copied source code.

## WorkPass353 — provider capability/data separation (2026-10-23)

- The autonomous repair coordinator now uses a shared envelope boundary that separates JSON-like provider data from two retained function capabilities (revision generator and independent evaluator). Arbitrary provider getters cannot mutate the evidence snapshot by being read during validation.
- This completes a key safety adaptation of Hermes-style trace→revision→independent evaluation: provider suggestions remain untrusted data, while generation/evaluation functions remain explicit capabilities; neither grants promotion authority.
- No upstream code was copied and no dependency added. Exact-head test execution remains unverified.

## WorkPass352 — bounded evidence payloads (2026-10-23)

- Extended the shared learning trust boundary with an aggregate text budget in addition to depth/node limits, so large primitive strings and many medium-sized fields cannot evade structural size controls.
- Added regression coverage for per-value and aggregate overflow. No third-party code or package dependency added.
- The suite is committed but remains unverified until a hosted runner executes it.

## WorkPass351 — atomic experiment evidence commits (2026-10-23)

- The learning evaluator now submits its whole validation/holdout outcome set to one ledger transaction. This preserves the experiment as a single evidence unit and prevents late duplicate-receipt rejection from leaving partial measurements.
- Adaptation from reproducible-experiment practice: a run is accepted only when the complete, internally consistent evidence batch is valid. This is an NK1 implementation change; no third-party code has been vendored.
- Exact-head tests remain unverified due the previously observed GitHub runner-allocation failure.

## WorkPass350 — unify learning evidence trust boundaries (2026-10-23)

- Reused a single NK1-owned snapshot/identity policy at both candidate execution evaluation and the verified-outcome ledger instead of allowing each subsystem to interpret mutable JavaScript objects independently.
- Added receipt-level uniqueness to the ledger: one evidence reference can support one accepted measurement only. This prevents replaying the same artifact as distinct method/seed outcomes from fabricating a paired-learning signal.
- Research fit: Hermes Agent Self-Evolution's trace-to-revision-to-evaluation separation and CleanRL's reproducibility discipline support this design direction; upstream source code was not copied. No external runtime dependency was added.
- Verification status: code and regression wiring committed, exact-head tests unrun because Actions runner startup remains blocked. Learning gains remain unmeasured.

## WorkPass349 — close the evaluator snapshot wiring gap (2026-10-23)

- Bound the manifest/schedule validation loop to the detached task collection rather than the caller-owned configuration array, and capped own-key enumeration in object snapshots.
- Added getter-side-effect regression coverage for safety-scanner output and wired independent evaluator + timeout/trust-boundary tests into the aggregate P23 learning command.
- Status: committed source/test wiring only; exact-head execution remains unverified because the runner-startup issue is outside this branch.

## WorkPass348 — source-grounded learning boundary improvements (2026-10-23)

- [Hermes Agent Self-Evolution](https://github.com/NousResearch/hermes-agent-self-evolution) — its documented flow evolves a skill from traces and evaluates candidate variants behind regression and review gates. NK1 adaptation in this pass: keep candidate generation distinct from independent validation and promotion, and harden the trace/evaluation envelope; upstream code was not copied.
- [CleanRL documentation](https://docs.cleanrl.dev/) — emphasizes reproducible experiments through explicit seeding, logged implementation detail and benchmark comparison. NK1 adaptation: bind learning runs to bounded normalized task/trial/method identities and preserve evidence provenance; this pass does not claim a CleanRL algorithm or dataset integration.
- [Letta memory & dreaming](https://docs.letta.com/configuration/memory) — describes persistent, versioned memory and separate idle-time consolidation. Relevant future cross-branch work: map the same provenance discipline onto learning-to-memory consolidation without mixing candidate output with durable memory.
- [Implementation status] Only the independent-evaluation data-boundary hardening is implemented in WorkPass348. These sources are research references; code/data licensing, full reproducibility study, dependency choice and measurable learning uplift remain open. No new dependency was added.

## WorkPass266 — primary-source metadata check for memory and neuroscience candidates (2026-10-22)

- [AMA-Bench, ICML 2026](https://proceedings.mlr.press/v306/zhao26bs.html) — publisher record describes long-horizon memory over agent/environment trajectories (states, actions, observations and tool output). Use its protocol as a candidate for trajectory-grounded evaluation; code/data integration has not been performed.
- [Mem2ActBench, ACL 2026](https://aclanthology.org/2026.acl-long.370/) — the paper evaluates whether remembered preferences and task state ground later tool selection and parameters. This matches the planned memory-to-action task family. Upstream code/data and license still require review.
- [Memora / From Recall to Forgetting, ACL 2026 Findings](https://aclanthology.org/2026.findings-acl.1337/) — the publisher record identifies Forgetting-Aware Memory Accuracy (FAMA), which penalizes reliance on obsolete or invalidated memory. Add stale-fact use as a distinct failure metric; do not treat the metric as already implemented.
- [MemoryArena, ICML 2026](https://proceedings.mlr.press/v306/he26am.html) — interdependent multi-session agent/environment tasks provide a candidate for testing memory → action → feedback rather than passive recall alone.
- [A brain-wide map of neural activity during complex behaviour, Nature 2025](https://www.nature.com/articles/s41586-025-09235-0) — large-scale standardized recordings span 621,733 neurons, 699 probes, 139 mice, 12 laboratories and 279 brain areas. These are mouse decision-task data, not a complete map of the human brain.
- [Synaptic connectomics: status and prospects, Nature Reviews Neuroscience 2025](https://www.nature.com/articles/s41583-025-00957-8) — supports multiscale circuit research while emphasizing conceptual/technical constraints; connectome structure alone is not a working functional theory.

**Status:** publisher metadata/abstract reviewed on 2026-10-22; source-code, benchmark dataset, license and reproducibility review remain OPEN. These stay RESEARCH QUEUE / SCIENTIFIC REFERENCE, not accepted dependencies. No package installation or code vendoring is implied.

---

# NeuroCore — upstream research and source-intake ledger

## WorkPass265 — current memory/science benchmark intake (2026-10-22)

The following recent sources expand the evaluation design. Their presence here records a research candidate, not verified upstream integration. Before copying code or data, check the upstream revision, dataset/model license, provenance, installation footprint and privacy requirements.

| Source | Mechanism or evaluation idea | Proposed NK1 use | Status |
|---|---|---|---|
| [AMA-Bench, ICML 2026 / PMLR](https://proceedings.mlr.press/v306/zhao26bs.html) | Long-horizon memory over agent/environment trajectories, including states, actions, observations and tool outputs | Extend the current retrieval-only view with trajectory-linked recall and later task success; keep manifests and outcomes reproducible | RESEARCH QUEUE; protocol/data license review required |
| [Mem2ActBench, ACL 2026](https://aclanthology.org/2026.acl-long.370/) | Whether remembered preferences and task state correctly ground later tool choice and parameters | Add a memory-to-action task family to the independent RU/EN evaluation; measure success and parameter-grounding errors | RESEARCH QUEUE; code/data/license review required |
| [Memora, ACL 2026 Findings](https://aclanthology.org/2026.findings-acl.1337/) | Remembering, reasoning and recommending over evolving personal histories; Forgetting-Aware Memory Accuracy penalizes stale-memory reliance | Add tests for fact supersession, old preference expiry and confident use of invalidated facts | RESEARCH QUEUE; inspect metric definition and evaluation protocol first |
| [MemoryArena, ICML 2026 / PMLR](https://proceedings.mlr.press/v306/he26am.html) | Interdependent multi-session tasks in which earlier environment interactions should improve later actions | Evaluate the closed memory → action → verified outcome loop, not passive conversation QA alone | RESEARCH QUEUE; task/license/reproducibility review required |
| [International Brain Laboratory, Nature 2025](https://www.nature.com/articles/s41586-025-09235-0) | Standardized brain-wide recordings during a complex perceptual-decision-action task | Study interaction traces across sensation, prior expectation, feedback, choice and action; mouse data are not a human connectome | SCIENTIFIC REFERENCE; no direct architecture copy |
| [Synaptic connectomics: status and prospects, Nature Reviews Neuroscience 2025](https://www.nature.com/articles/s41583-025-00957-8) | Limits and prospects of multiscale circuit reconstruction | Use connectomics as a constrained hypothesis source; require behavioral predictions and ablations rather than region-name analogies | SCIENTIFIC REFERENCE; no direct architecture copy |

### Candidate acceptance rule

For each candidate, record the exact paper/version and code/data revision, license, task families, split rules, metric definitions, baseline, compute/storage budgets and known limitations. Run a small representative slice first. Keep the candidate only if it identifies a failure or yields reproducible behavior that the current baseline misses. Never tune on the final holdout or assume a benchmark's reported result transfers automatically to NeuroCore.


**Purpose:** keep research actionable across chats. This ledger is a queue of candidates, not a claim that all listed ideas are integrated or superior. Read [NEUROCORE_START_HERE.md](../NEUROCORE_START_HERE.md) and [AGENTS.md](../AGENTS.md) before adding candidates.

**Decision labels:** `INTEGRATED` = integrated into canonical owner and tested; `ADAPT` = candidate worth adapting; `RESEARCH-ONLY` = inspect in isolation; `REJECT` = evidence/constraints do not justify it; `UNRESOLVED` = not enough evidence. A repository being present under `legacy/` or `research/` is not proof of integration.

## Active priority: memory quality, revision and learning

| Candidate / source | URL | Mechanism to inspect | NeuroCore integration target | Current status / next evidence |
|---|---|---|---|---|
| MemoryAgentBench (2025; updated 2026) | https://arxiv.org/abs/2507.05257 | Accurate retrieval, test-time learning, long-range understanding, conflict resolution/selective forgetting | `MemoryOS2`, benchmark and promotion gates | **ADAPT** — convert task categories into held-out suites; require same corpus, leakage checks and per-case results |
| Memora / FAMA (ACL 2026) | https://arxiv.org/abs/2604.20006 | Penalize stale/invalidated memory use | `MemoryOS2` revision-aware retrieval | **ADAPT** — paired fact-A → fact-B revision; query current and historical timestamps separately |
| MINTEval (May 2026) | https://arxiv.org/abs/2605.18565 | Multi-target interference and aggregation across evolving evidence | Memory retrieval, learning credit, evidence fusion | **ADAPT** — test conflicting targets, order/shuffle invariance and selective forgetting |
| AgeMem (ACL 2026) | https://aclanthology.org/2026.acl-long.981/ | Learned short-/long-term memory management | Existing memory residency and consolidation owner | **RESEARCH-ONLY** — compare learned management with deterministic policy under equal budgets; do not add another memory store |
| Existing NeuroCore retrieval experiment | `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalExperiment.ts` | Paired bootstrap sensitivity across fixed seeds | Canonical `MemoryOS2` | **IMPLEMENTED** — seeds resample intervals; they do not train the retriever. Prior `recallDelta=0` remains a hard block on uplift claims |

## Continual skill learning and evaluation (2026-10-20)

| Candidate / source | Evidence / license | NK1 adaptation | Decision |
|---|---|---|---|
| SkillLearnBench | https://github.com/cxcscmu/SkillLearnBench ; MIT license declared upstream. 20 verified tasks / 100 instances, with skill quality, execution trajectory and task outcome scored separately. | Use the three-stage diagnostic pattern for a future small NK1 task set: skill artifact validity, actual skill invocation/trajectory, and independently verified outcome. Do not import Docker/API-heavy runner into the dependency-light runtime without a separate harness review. | **ADAPT PROTOCOL; CODE NOT VENDORED** |
| ContinualSkillBench | https://arxiv.org/abs/2608.03874 ; five domains with sequential, cross-task skill reuse. Reports gains vary by model/domain; explicit skill libraries do not consistently outperform retained context/feedback. | Require order variation, context-only vs explicit-skill ablations, transfer tasks and per-domain reporting. A written/promoted skill is not evidence of a reusable abstraction. | **ADAPT EVALUATION DESIGN** |
| Berkeley Continual Learning Bench | https://sky.cs.berkeley.edu/project/continual-learning-bench/ ; expert-validated task sequences where tasks interact and the system may change during evaluation. | Prioritize versioned task streams and online update boundaries over isolated single-task fixtures; compare frozen and adaptive controls on identical sequences. | **RESEARCH-ONLY; TASK/VERIFIER LICENSE REVIEW REQUIRED** |

NK1 adaptation from this research in WorkPass116: add seed-clustered paired outcomes so task cells within a run do not inflate the independent sample count. This is a measurement-integrity improvement, not evidence that any learning strategy is better. The upstream benchmark datasets, task code and Docker/API integrations were not copied.

## Continual-learning evaluation refresh (2026-10-21)

| Candidate / source | Evidence / license | NK1 adaptation | Decision |
|---|---|---|---|
| retention-bench | https://github.com/symbolfarm/retention-bench ; public research workbench extending CL-Bench; repository describes a hard process reset with only an on-disk survive-directory preserved and distinguishes retained records from integrated capability. Verify the current upstream LICENSE and dependency pin before any code reuse. | NK1 already has a matched hard-reset retention evaluator (WorkPass115). Next integration is protocol-level: run real subprocess resets, separate intact-store from wiped-store arms, and report a gain curve over reset frequency; do not treat an in-process snapshot/restore test as equivalent to a hard reset. | **ADAPT PROTOCOL; NO CODE COPIED** |
| AgentMemoryBench | https://github.com/solomoon313/AgentMemoryBench ; upstream repository reports offline, online, replay, transfer and repair modes over code-, web-, embodied- and dialogue-grounded tasks; verify exact dataset provenance and task-level licenses before importing any instances. | Map NK1's existing outcome matrix onto explicit online gain, replay forgetting, cross-family transfer and repair-after-incorrect-feedback reports. Keep external task sets held out; never train on evaluator answers/verifiers. | **ADAPT EVALUATION MATRIX; DATA NOT COPIED** |

WorkPass133 code finding: the bootstrap stream identity previously included every observed seed ID, including incomplete seeds that were excluded from the estimate. That allowed irrelevant partial evidence to perturb the deterministic resampling stream even though the paired sample and point estimate were unchanged. The implementation now binds the stream identity to complete paired seeds only, and a regression compares the same complete sample with and without extra incomplete-seed rows. This is a reproducibility/evidence-isolation correction, not a learning gain.

## Language model and neural architecture candidates

| Candidate / source | URL | Mechanism to inspect | Target / adaptation boundary | Current status / next evidence |
|---|---|---|---|---|
| Mamba / state-space models | https://github.com/state-spaces/mamba | Selective state-space sequence modeling, recurrent inference and memory/latency tradeoffs | Local model integration and sequence-processing candidates; benchmark against current backend rather than assuming a second foundation model belongs in runtime | **RESEARCH-ONLY** — inspect upstream revision, license, GPU/CUDA requirements and real inference costs |
| Flash Linear Attention (FLA) | https://github.com/fla-org/flash-linear-attention | Linear-attention kernels and recurrent sequence layers | Candidate for offline/local research or compatible model backend; do not copy CUDA kernels into a Node runtime | **RESEARCH-ONLY** — test hardware and packaging compatibility first |
| RWKV-7 | https://github.com/BlinkDL/RWKV-LM | Recurrent language-model inference and long-context tradeoffs | Model/backend tournament, not a parallel identity or memory owner | **RESEARCH-ONLY** — compare model license, VRAM, throughput, quality and context retention |
| Titans: Learning to Memorize at Test Time | https://arxiv.org/abs/2501.00663 | Test-time learned memory and surprise-based updates | Research candidate for learning/memory ablations | **RESEARCH-ONLY** — specify a small controlled task; test transfer, forgetting and compute cost before integration |
| Preconditioned DeltaNet / gated fast-weight updates | https://github.com/fla-org/flash-linear-attention | Stable fast-weight updates, matrix conditioning and linear-attention variants | Experimental learning candidate only; must not bypass verified outcome pipeline | **RESEARCH-ONLY** — identify exact upstream module/commit, license, numerical tests and baseline before porting |
| MoBA (Mixture of Block Attention) | https://github.com/MoonshotAI/MoBA | Block-level sparse attention and routing | Candidate for model-side long-context experiments, not a new memory database | **RESEARCH-ONLY** — verify repository status, implementation compatibility, sparse-routing quality and latency |

## Existing source projects / integrations already represented in the repository

| Source | Repository / path | Intended use | Current status / next evidence |
|---|---|---|---|
| Will | https://github.com/mindot-ai/will; retained source under `legacy/input-archives/will-main-2026-10-08/` | Adapt useful action/runtime/tool protocol ideas through existing Will adapters | **IMPLEMENTED / VERIFY PER CAPABILITY** — source presence is not enough; test actual call path, error behavior, idempotency and permissions |
| Hexis | retained source under `legacy/input-archives/hexis-main-2026-10-08/` | Inspect memory ingestion, retrieval evaluation, embeddings and provenance patterns | **RESEARCH-ONLY / PARTIAL ADAPTATION** — audit license and exact source lineage; existing code comments identify deferred embedding-worker inspiration, but each port needs attribution and regression |
| NeuroCore v126 and earlier snapshots | `legacy/snapshots/neurocore-v126/` and `legacy/snapshots/neuro-kurisu-35.30/` | Preserve prior behavior, compare implementations and recover provenance | **REFERENCE ONLY** — do not make snapshots a second production owner |
| Existing local language backend | `runtime/neuro-kurisu/src/server/local-language-backend-policy.mjs` and provider adapters | Route configured local `llama.cpp` first with bounded cooldown and explicit fallback | **IMPLEMENTED; LIVE INFERENCE UNPROVEN** — run opt-in fake-provider HTTP smoke, then actual local model smoke on Dell G3 |
| MemoryOS2 canonical owner | `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts` | One writable memory store with lexical/fuzzy/concept/entity/graph/temporal ranking and explicit semantic-index maintenance | **IMPLEMENTED; UPLIFT UNPROVEN** — do not call legacy 48-dimensional hash vectors semantic embeddings |

## Required intake record for every new candidate

Create a row or linked detail page with all fields below before treating the candidate as actionable:

- **Identity:** name, canonical URL, repository owner, release/commit/revision, date checked.
- **Provenance:** license, license compatibility, attribution requirements, dependency chain, upstream source files and their hashes where practical.
- **Claim:** exact mechanism, what it is intended to improve, and what the upstream evidence actually measures.
- **Boundary:** canonical NeuroCore owner to change; API/data/state contracts; whether code is vendored, adapted, wrapped or used only as a benchmark.
- **Risks:** hardware/runtime assumptions, memory/latency/energy costs, numerical stability, privacy, security, interference, catastrophic forgetting, licensing and maintenance burden.
- **Experiment:** reproducible baseline, same data and budget, held-out cases, ablation/counterfactual, confidence interval, failure cases and rollback.
- **Decision:** integrate / adapt / research-only / reject, with measured result and rationale.

## WorkPass131 — execution-attestation context binding (2026-10-21)

| Candidate / source | Mechanism observed | NK1 adaptation | Status |
|---|---|---|---|
| [in-toto Attestation Statement v1](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md) and [framework spec](https://github.com/in-toto/attestation/blob/main/spec/README.md) | An authenticated statement binds a claim to an explicit subject and typed predicate; consumers evaluate the binding, not just the existence of an envelope/signature. | Extended the existing signed shadow-evidence verifier so a receipt must match independently resolved run ID, task ID, seed, manifest fingerprint and runtime version, in addition to candidate/version/payload identity and Ed25519 signature. No upstream code or dependency was copied; this is a narrow contract adaptation. | **IMPLEMENTED; execution unverified** — regression covers each mismatched context field after durable-store reconstruction. Production resolver still must be wired to the trusted supervisor/run ledger. |
| [The Update Framework security model](https://theupdateframework.github.io/security.html) | Freshness and rollback protection require state/context beyond a valid signature. | Reinforces that cryptographic authenticity alone is insufficient; NK1 continues to require durable state and revalidation before promotion. No TUF client or metadata protocol was imported. | **DESIGN INPUT** — no claim of full TUF conformance. |

## Next research pass

1. Build a source-level call graph for the canonical runtime and identify one actual bottleneck from traces/tests before selecting a new architecture.
2. Audit all candidate upstream revisions and licenses before importing code; the URLs above are starting points, not completed license review.
3. Turn MemoryAgentBench/Memora/MINTEval/AgeMem into separate revision, interference, test-time-learning and forgetting tests without merging them into one score.
4. Build a fair local model/backend tournament on Dell G3 (i5 + GTX 1650): model/license, RAM/VRAM, cold/warm latency, output quality on held-out Russian/English tasks, cancellation and recovery.
5. Only then prototype the highest-value neural architecture candidate behind an adapter, with a measured ablation and a clean rejection path.

**Evidence boundary:** this ledger records what to investigate and why. It does not claim that all candidates have been fetched, license-audited, reproduced, integrated or shown to improve NeuroCore.


## Additional architecture queue preserved from prior NeuroCore passes

These names were explicitly proposed for NeuroCore research. Where the exact upstream paper/repository is not unambiguously identified, the entry says so instead of inventing a URL or pretending the source was audited.

| Candidate | Canonical source / starting point | Mechanism to inspect | Integration boundary | Status / acceptance gate |
|---|---|---|---|---|
| Mamba-3 MIMO / SSD | https://github.com/state-spaces/mamba and https://github.com/fla-org/flash-linear-attention | MIMO state-space sequence mixing, SSD formulation, state/cache behavior | Model-side sequence layer or backend experiment; not a second memory owner | **RESEARCH-ONLY** — resolve exact upstream file/revision, license, supported hardware and parity tests |
| MoBA router | https://github.com/MoonshotAI/MoBA | Block routing and sparse attention allocation | Long-context model experiment | **RESEARCH-ONLY** — measure routing recall, latency and worst-case memory; no production port yet claimed |
| Preconditioned DeltaNet KKT / WY / triangular solve | https://github.com/fla-org/flash-linear-attention | Numerically stable fast-weight update, KKT/WY representation and `solve_tril` path | Isolated training/update kernel or offline experiment | **RESEARCH-ONLY** — inspect exact source and tests; verify conditioning, finite gradients and correlated-key behavior |
| Gated Oja | Canonical upstream not yet resolved; search literature and maintained implementations before import | Local Hebbian/online plasticity with bounded gating | Existing canonical learning/plasticity owner only | **UNRESOLVED** — establish source lineage and compare against no-learning / classic Oja / delta-rule controls |
| Test-Time Training (TTT) | https://arxiv.org/abs/2407.04620 | Test-time parameter updates and adaptation dynamics | Offline model candidate or bounded adapter; must not mutate identity/policy without verified outcome | **RESEARCH-ONLY** — assess task transfer, data leakage, compute and rollback |
| Gated Sparse Attention (GSA) | Canonical source/revision not yet resolved | Gating plus sparse attention allocation | Model-side candidate, separate from canonical memory retrieval | **UNRESOLVED** — first identify exact paper/repository; do not conflate similarly named methods |
| Native Sparse Attention (NSA) | https://arxiv.org/abs/2502.11089 | Hardware-aligned, trainable sparse attention | Long-context model candidate | **RESEARCH-ONLY** — inspect released code/license and compare quality/latency on equal context and hardware |
| LIRA uncertainty/write gating | Exact LIRA source/revision not yet resolved | Uncertainty-aware decision to write, revise, defer or abstain | Memory write policy / evidence-confidence gate | **UNRESOLVED** — resolve exact acronym/source; require calibration, false-write and missed-write tests |
| HiPPO credit / memory projection | https://arxiv.org/abs/2008.07669 | Online projection of history into compact state | Experimental temporal-credit or sequence-state path | **RESEARCH-ONLY** — compare to current temporal memory and recurrent baselines; no claim of drop-in compatibility |
| DPLR / IPLR gradient arbitration | Exact project-specific implementation/source to be identified | Structured state-space parameterization and arbitration among gradient/update channels | Offline learning candidate; not a new canonical policy store | **UNRESOLVED** — document mathematical definition and source before implementing |
| RWKV-7 / Goose | https://github.com/BlinkDL/RWKV-LM | Recurrent inference, state carry and memory/throughput tradeoffs | Alternative local model/backend tournament | **RESEARCH-ONLY** — exact Goose checkpoint/repository, license, quantization and VRAM needs must be verified |
| Fused loss / fused update kernels | Exact upstream kernel depends on chosen training stack; inspect FLA and framework implementations | Reduce memory traffic and kernel-launch overhead | Training/benchmark code only; no assumed benefit in Node runtime | **RESEARCH-ONLY** — benchmark end-to-end, not just kernel microbenchmarks |
| Context Parallelism | Exact implementation depends on selected model/training stack; inspect upstream framework docs/source | Split long-context processing across devices/ranks | Multi-GPU training/inference only when hardware supports it | **RESEARCH-ONLY** — likely not directly useful to single-GPU GTX 1650 inference without evidence |
| MEMO snapshot artifacts | Local historical artifact noted in prior work as `memo_0.3.0_darwin_arm64`; canonical upstream/license not yet established | Snapshot/replay or memory tooling behavior | Provenance and compatibility investigation; not a production dependency by filename alone | **UNRESOLVED** — locate source, inspect license, checksum, platform and actual invocation before reuse |
| `erase_control.py` | Existing project-specific candidate name; exact canonical source path/revision must be re-resolved in repository tree | Controlled forgetting/erasure semantics and audit trail | Canonical memory owner; must preserve required historical evidence where policy demands | **UNRESOLVED** — distinguish deletion, supersession, quarantine and retention; test all four |
| Learned anti-forgetting / memory interference | MemoryAgentBench and MINTEval above, plus maintained continual-learning baselines | Transfer, catastrophic forgetting, interference and reversal | Existing learning/memory owner with held-out tasks | **ADAPT** — no new module until a repeatable failure case and a baseline comparison exist |

These entries intentionally separate known source starting points from names whose exact upstream is unresolved. Before any code port, record the actual URL/revision, license, files inspected, behavior reproduced and decision in this ledger. The fact that a candidate appeared in an earlier plan is not proof it exists upstream in the assumed form.


## Adjacent-science intake — cognitive systems, neuroscience and control (2026-10-20)

These references are starting points for translating functional hypotheses into testable software experiments. They do **not** prove that a biological mechanism can or should be copied into NeuroCore. Record the exact claim, competing interpretation, adaptation boundary and falsifiable test before implementation.

| Research / primary source | What it contributes as a hypothesis | Possible NeuroCore experiment | Caution / status |
|---|---|---|---|
| McClelland, McNaughton & O'Reilly (1995), *Why there are complementary learning systems in the hippocampus and neocortex* — https://doi.org/10.1037/0033-295X.102.3.419 | Complementary fast episodic learning and slower extraction of regularities can reduce interference in connectionist models. | Compare fast episodic store + slow consolidation against one-rate learning; measure transfer, interference, stale fact persistence and recovery. | **ADAPT** as a systems hypothesis, not a literal hippocampus/neocortex implementation. Must compare equal storage/compute budgets. |
| Rao & Ballard (1999), *Predictive coding in the visual cortex* — https://doi.org/10.1038/4580 | Hierarchical prediction and residual-error signals as one functional account of visual processing. | In a future multimodal path, compare prediction/error-guided attention with a plain input pipeline on labelled novelty and correction tasks. | **RESEARCH-ONLY** until a real sensory signal and meaningful error measure exist; text-generated “prediction error” is not sensory grounding. |
| Friston (2010), *The free-energy principle: a unified brain theory?* — https://doi.org/10.1038/nrn2787 | A broad framework connecting inference, action, learning and uncertainty through variational free energy. | If planning/perception needs a common uncertainty/cost formalism, compare a narrowly specified expected-cost policy with existing explicit risk/budget policy. | **RESEARCH-ONLY**. This is a broad and debated framework, not an automatically useful universal objective. See critical discussion such as https://doi.org/10.1038/nrn2787-c1. |
| Dehaene & Changeux (2011), *Experimental and theoretical approaches to conscious processing* — https://doi.org/10.1016/j.neuron.2011.03.018 | Reviews global neuronal workspace accounts and empirical approaches to conscious access. | Only use as a source of operationally testable hypotheses about availability/broadcast of information across subsystems and reportable access. | **RESEARCH-ONLY** for cognitive architecture; not a consciousness test. Passing software integration tests does not establish subjective experience. |
| MemoryAgentBench (2025; updated 2026) — https://arxiv.org/abs/2507.05257 | Benchmark task families for memory retrieval, test-time learning, long-range understanding and forgetting-related behavior. | Independent RU/EN held-out task suites with fact revision, multi-hop, interference, selective forgetting and calibrated abstention. | **ADAPT**; inspect current benchmark version, dataset license, split design and leakage risks before reuse. |
| Memora / FAMA (ACL 2026) — https://arxiv.org/abs/2604.20006 | Memory update/retrieval behavior under stale or invalidated evidence. | Pair fact A→fact B updates with queries before/after the validity boundary; measure false-current and false-historical answer rates. | **ADAPT** after verifying publication details and exact benchmark protocol. |
| MINTEval (2026) — https://arxiv.org/abs/2605.18565 | Multi-target interference and aggregation as memory evolves. | Shuffle insertion order, add distractors/conflicts, and compare per-target accuracy plus calibration. | **ADAPT**; do not tune against the final holdout. |
| AgeMem (ACL 2026) — https://aclanthology.org/2026.acl-long.981/ | Learned memory management and short/long-term allocation. | Compare existing deterministic residency/consolidation owner against a learned manager under equal RAM, latency and data budget. | **RESEARCH-ONLY** until deterministic baseline and safe rollback exist. |

### Additional research lanes to explore continuously

1. **Episodic and semantic memory:** event sourcing, temporal databases, provenance, knowledge graphs, contradiction resolution, source reliability, temporal query semantics, memory compaction and reversible summaries.
2. **Learning and forgetting:** complementary learning systems, replay scheduling, continual learning, meta-learning, test-time adaptation, selective erasure, stability/plasticity trade-offs and distribution shift.
3. **Uncertainty and decision theory:** calibration, selective prediction/abstention, Bayesian decision theory, conformal prediction, risk-sensitive planning, value of information and out-of-distribution detection.
4. **Causal reasoning:** interventions, counterfactuals, causal graphs, treatment of confounders, credit assignment and separation of correlation from verified action outcome.
5. **Control and robotics:** feedback control, model-predictive control, state estimation, partial observability, active perception, safety envelopes and system identification. Use only when a real action/sensor loop exists.
6. **Cognitive control:** working-memory limits, interference, task switching, inhibition, metacognition and error monitoring; operationalize each as a benchmark rather than naming a module after a brain region.
7. **Speech and interaction:** turn-taking, interruption handling, streaming latency, diarization where relevant, phoneme/viseme alignment, prosody, accessibility and perceptual quality evaluation.
8. **Distributed systems:** event sourcing, transactional outbox/inbox, sagas, idempotency, durable workflows, exactly-once illusions, crash consistency and reconciliation after ambiguous outcomes.
9. **Security and privacy:** threat modeling, least privilege, untrusted memory/tool output, secret redaction, data lifecycle, prompt injection, software supply-chain integrity and auditability.
10. **Evaluation science:** preregistration of hypotheses, blind test sets, paired comparisons, confidence intervals, effect sizes, negative controls, ablations, leakage detection and reproducibility.

### Translation gate from science to code

For each idea, answer before implementation:
- What concrete failure in the current canonical owner motivates it?
- What would falsify the hypothesis?
- Which baseline and same-budget candidate will be compared?
- Which data split is held out and who/what protects it from tuning?
- What adverse effects must be measured (latency, RAM/VRAM, forgetting, privacy, reliability)?
- What result causes rejection or rollback?
- Is the mechanism actually necessary, or can a simpler change solve the observed failure?

Do not count a reference as “used” until a source revision/paper protocol is inspected, a testable hypothesis is recorded, and an experiment or explicit rejection decision is linked.


## WorkPass132 — bootstrap sensitivity for seed-clustered skill learning (2026-10-21)

| Candidate / source | Mechanism observed | NK1 adaptation | Status |
|---|---|---|---|
| [SkillLearnBench (COLM 2026)](https://github.com/cxcscmu/SkillLearnBench) — MIT license declared upstream | Controlled comparisons of skill methods; separates artifact quality, execution trajectory and verified task outcome; reports gains vary by task/domain and self-feedback can drift. | Preserve NK1's separate evidence and outcome layers; do not use a single aggregate as proof that a skill generalizes. WorkPass132 adds a more conservative uncertainty requirement at the seed-cluster outcome layer. | **PROTOCOL ADAPTED; no benchmark tasks/code copied** |
| [SkillsBench v1.1](https://www.skillsbench.ai/) | Matched with-skill/without-skill evaluation over diverse tasks shows strong variation by domain and negative deltas on some tasks. | Keep baseline pairing, task-family breakdowns and explicit no-skill/control arms; never infer uplift from skill creation or invocation alone. | **DESIGN INPUT** |
| [Storage-aware replay evaluation protocol](https://www.mdpi.com/2504-4990/8/7/212) | Uses equal-byte budgets, strongest-baseline comparison, pre-specified non-inferiority and bootstrap confidence intervals with multiple-comparison correction. | Adapt only the bootstrap sensitivity idea to NK1's existing seed-clustered outcome deltas; no replay algorithm or external code copied. Equal-byte replay tournament and multiplicity correction remain future work. | **NARROW ADAPTATION IMPLEMENTED; not full protocol conformance** |

### Code and acceptance boundary

- `VerifiedOutcomeLedger.ts` now computes a deterministic 4,000-resample percentile interval over seed-level paired deltas. Its PRNG seed is derived from method/split/family identity and observed deltas so identical input yields identical output.
- The independent unit remains the seed aggregate; incomplete seeds are excluded as before. A single independent seed produces no bootstrap interval.
- `VerifiedSkillPromotion.ts` requires both the existing small-sample Student-t lower bound and the bootstrap lower bound to be above zero, as well as existing minimum-gain, evidence-authentication, task-coverage, seed-coverage and family-regression gates.
- Regression tests assert determinism, interval bracketing and no confidence interval for one seed, and require the positive bootstrap lower bound in the accepted promotion fixture.
- **Not proven:** bootstrap intervals do not fix tiny or biased samples, verifier bias, task leakage, multiple-comparison inflation, or poor benchmark representativeness. No live learning run has been measured by this change; it is a stricter admission/evaluation rule, not a performance gain.


## WorkPass134 — manifest-bound outcome ingestion (2026-10-21)

- Added a canonical fingerprint equality check between the caller-supplied task manifest and the `VerifiedOutcomeLedger` manifest before signed outcome ingestion. Malformed and substituted manifests fail closed before the ledger is mutated.
- Tightened runtime task-manifest validation: non-empty string identity fields, a supported `train|validation|holdout` split, and a SHA-256 prompt fingerprint are required. Unknown split labels can no longer silently disappear from expected evaluation coverage.
- Added regression cases for side-manifest substitution, duplicate task IDs, unknown split labels, and whitespace-only family names.
- Research relationship: manifest-bound, controlled evaluation and signed-provenance principles; protocol adaptation only, no upstream code or dataset copied.
- **Verification boundary:** code and tests committed; runtime execution, typecheck and exact-head Actions are still unverified. No learning uplift is claimed.
- Report: `docs/WORKPASS134_MANIFEST_BOUND_OUTCOME_EVIDENCE_2026-10-21.md`.


## WorkPass135 — reflective revision and reproducible learning intake (2026-10-23)

| Source | Mechanism inspected | NK1 mapping / decision | Status |
|---|---|---|---|
| [NousResearch Hermes Agent Self-Evolution](https://github.com/NousResearch/hermes-agent-self-evolution) | Uses execution traces to guide targeted skill revisions, then evaluates variants behind constraints before selecting a candidate. Its README describes a PR/review boundary for changes. | NK1 already has a canonical revision path in `P23LearningEngine.generateAndStageReflectiveSkillRevision`: the generated payload is fingerprinted, independently re-evaluated on validation and holdout, then staged as a new candidate; promotion remains separate. Keep this separation and do not auto-promote from a process exit code or self-reported score. No upstream code or datasets copied in this pass. | **MECHANISM MAPPED; no new algorithm claimed** |
| [CleanRL](https://github.com/vwxyzjn/cleanrl) | Emphasizes seeded, reproducible experiments and benchmarked algorithm comparisons. | Preserve deterministic seed accounting and same-baseline comparisons; test the scheduler's single-flight boundary so concurrent wakes do not launch duplicate executions or hide bad caller state. | **PROTOCOL REFERENCE; no source copied** |

### WorkPass338 outcome

- Runtime input validation now precedes in-flight deduplication; valid concurrent requests still coalesce to a single process run.
- Added behavioral regression coverage for invalid and valid overlapping calls.
- P26 learning validation workflow is aligned to Node.js 24.
- **Unverified:** no executed test result, performance uplift, autonomous learning improvement or promotion quality is claimed until the owning job can run on an assigned runner.


## WorkPass136 — defensive parsing at the reflective-evaluation boundary (2026-10-23)

- The skill-revision evaluator validates actual runtime observation objects instead of calling string methods on unchecked values.
- Malformed extra rows are rejected and counted; they cannot crash a batch or inflate the independent paired sample. Invalid top-level collection/config shapes fail explicitly.
- Upstream context: Hermes Agent Self-Evolution uses trace-guided candidate generation behind test/constraint gates; CleanRL emphasizes controlled, reproducible comparison. NK1 retains its own independent signed-evidence and holdout lifecycle. These are design references, not code copied in this pass.
- **Unverified:** runtime tests and typecheck await actionable GitHub Actions runner logs.


## WorkPass137 — preserve manifest version through skill-revision scoring (2026-10-23)

- Propagated the exact manifest `taskVersion` into each observation passed to the revision gate.
- The gate now pairs only identical `taskId + taskVersion + seed + first-attempt` records, preventing a reused task ID from making different prompt/task definitions look like a matched experiment.
- Regression covers mixed-version baseline/candidate rows and malformed version identity. The main promotion path still requires signed evidence, current-manifest matching, seed-level confidence bounds and separate explicit approval.
- **Unverified:** runtime tests and typecheck have not executed because the current Actions job exposes no runner steps/logs.


## WorkPass138 — global receipt identity at the reflective evaluation gate (2026-10-23)

- Treat normalized `evidenceRef` as the unique receipt identity across method labels, verifier labels and task rows. A single receipt can never manufacture a baseline/candidate pair by being relabelled.
- Regression ensures a reused baseline receipt does not contribute a candidate outcome; paired task/version sampling remains bound to the manifest version.
- This is an evidence-integrity adaptation to NK1's signed outcome lifecycle. No upstream code was copied.
- **Unverified:** executable regression and typecheck await a functioning Actions runner.


## WorkPass139 — order-independent collision rejection for skill evidence

- The reflective evaluation gate now counts task/method/seed and evidence-reference collisions before scoring. Every collision is excluded rather than selecting whichever row arrives first.
- This removes an input-order channel in which conflicting outcomes or a receipt reused across tasks/methods could influence the score. Clean evidence keeps the same scoring path.
- Regression covers duplicates both within a task/method key and across task/method labels. Signed-ledger authentication and task-version binding remain required upstream.
- **Unverified:** the owning test suite and typecheck have not run; Actions exposes no runner steps/logs.


## WorkPass140 — canonical identity guard at the evaluation boundary (2026-10-23)

- Reject task/version/family/method/verifier/evidence identifiers that are not already NFKC-normalized, rather than allowing compatibility-form aliases to produce distinct pairing keys.
- Regression uses full-width compatibility characters as a malformed task ID and requires the row to be excluded without changing the valid comparison.
- This is a narrow identity-integrity control for matched learning evidence; it does not establish external verifier correctness or measured learning uplift.
- **Unverified:** exact-head runtime tests/typecheck remain blocked by Actions jobs with no executable steps.


## WorkPass141 — data-only object boundary for reflective learning evaluation (2026-10-23)

- Evidence rows and evaluation options are snapshotted from plain own data properties. Getters/accessors are rejected without execution; thrown proxy reflection traps are converted to invalid-row rejections.
- This keeps input parsing deterministic and prevents external object behavior from running inside the scorer. It complements task-version pairing, global evidence-reference uniqueness and order-independent duplicate rejection.
- **Unverified:** executable regression and typecheck await a runner-backed Actions result.


## WorkPass142 — connect P23 background repair to the canonical clock registry (2026-10-23)

- Reconciled `OrganismRuntime` and `RuntimeClockScheduler`: the P23 compound-repair clock ID now appears in both the `RuntimeClockKind` type and runtime allow-list.
- Added a regression against the exact production clock ID and its execution counter.
- This makes the opt-in scheduled repair path registrable; resource gating, independent candidate evaluation, signed shadow evidence and explicit activation approval remain separate controls.
- **Unverified:** the clock regression/typecheck awaits an executable Actions runner.


## WorkPass143 — single-source registry for runtime scheduler identities (2026-10-23)

- Made runtime clock identifiers a single exported constant map; the type union and allow-list derive from the same source.
- Rewired OrganismRuntime registration and start calls to those constants, including the P23 background repair clock, preventing duplicated string literals drifting apart again.
- **Unverified:** actual execution/typecheck remains blocked by runner allocation failures.
