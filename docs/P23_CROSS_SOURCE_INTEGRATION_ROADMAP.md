# Neuro Kurisu — cross-source learning integration roadmap

Scope: continue integrating mechanisms into the existing P23 learning/revision lifecycle. This is an implementation queue, not a promise that upstream mechanisms are already integrated. Preserve the current branch/PR boundary; do not merge to the default branch without explicit approval.

## Completed in this branch (through WorkPass223)

- [x] Reuse SkillLearnBench-style task success, skill quality, trajectory quality and macro-averaged task metrics.
- [x] Bind evaluator runs to exact payload/task/environment/plan identity; require an independent verifier's explicit binding attestation.
- [x] Connect optional LearningExperimentPlan + VerifiedOutcomeLedger authority; require manifest, split, prompt fingerprint, method, seed and scheduled run identity.
- [x] Keep existing P23 revision staging/promotion authoritative; evaluator itself does not promote.
- [x] Snapshot caller-owned experiment plans and capture executor/verifier/scanner entry points.
- [x] Detach executor results before async verifier/safety I/O and snapshot repair evidence before provider calls.
- [x] Snapshot provider-owned proposal, baseline, and candidate-evaluation data before returning prepared revision inputs (WorkPass220); add a retained-reference mutation regression.
- [x] Freeze the evaluator's validated runtime/environment fingerprint at construction so later caller config mutation cannot relabel runs (WorkPass221); add regression coverage for post-construction config mutation.
- [x] Snapshot proposal, baseline, candidate-evaluation data, and options inside the coordinator itself before staging, even when a caller uses a provider without the independent-evaluation wrapper (WorkPass222); add a retained-reference mutation regression.
- [x] Add targeted evaluator/provider regression commands to the learning CI workflow.
- [x] WorkPass223: return the construction-time `environmentFingerprint` snapshot in evaluator provenance, not the mutable caller-owned config field. The existing WorkPass203 regression mutates the config after construction and asserts that provenance retains the original environment identity.

## Next implementation passes

### P0 — close the complete generation-to-promotion path
- Wire the production generator, sandbox executor, independent verifier and safety scanner through the existing runtime/coordinator, not a second learner.
- Ensure baseline and candidate are evaluated against the same immutable task/seed/environment plan; reject mismatched or provider-supplied unverifiable baseline evidence.
- Carry the independent evaluation envelope and digest into the existing P23 gate; do not record candidate-only outcomes as baseline evidence.
- Keep holdout inaccessible to generation, repair prompts, tuning and selection; only use it at the final comparison boundary.

### P1 — experiment integrity and decision quality
- Add matched-pair evaluation and per-task/seed joins so candidate-vs-baseline deltas cannot compare different trials.
- Add confidence intervals / bootstrap or Wilson bounds where their assumptions fit, and minimum sample/seed policy; never treat missing evidence as a zero-cost win.
- Add regression vetoes for safety, capability regressions, catastrophic task failures and distribution-shift indicators.
- Add a reproducible experiment manifest including model/tool/runtime versions, prompt/data fingerprints, seeds and resource budgets.

### P2 — source integrations with high leverage
- Hermes/Will: consolidate evidence binding, reflective reports, skill revision plans and promotion provenance in the existing lifecycle.
- SkillLearnBench: retain task-success, skill-quality and trajectory-quality dimensions, with macro-averaging to avoid task-rich families dominating.
- OpenHands/SWE-agent-style execution ideas: sandboxed tool execution, bounded retries, explicit action traces and recoverable execution failures; adapt only mechanisms that fit current runtime boundaries.
- DSPy/GEPA-style optimization: optimize prompts/policies only on training/validation evidence, with immutable experiment records and holdout untouched until final evaluation.
- AgentBench / WebArena-style task suites: use task families and environment-specific capability rubrics instead of one aggregate score.
- Research experimental alternatives (e.g. evolutionary search, verifier-guided repair, debate/critic ensembles) behind pluggable evaluators; keep them shadow-only until they beat a fixed baseline under matched evaluation and safety gates.
- Review licenses, dependency weight, local-model/VRAM cost and maintenance burden before importing upstream code; prefer narrow mechanism ports over vendoring entire projects.

### P3 — continual learning and memory integration
- Feed only verified, provenance-bound outcomes into the existing outcome ledger and replay/retention curriculum.
- Link skill-version provenance to source evidence, experiment IDs, rollback target and retention checks.
- Add forgetting/transfer tests across task families and capability-specific ablations; separate correlation from causal claims.
- Add bounded experiment scheduling driven by uncertainty/evidence debt, with explicit compute budgets and starvation protection.

### P4 — runtime deployment and operations
- Provide a concrete host adapter for real sandbox/verifier/scanner implementations and fail startup when production mode lacks them.
- Add cancellation, timeout, resource limits, retry/idempotency semantics and durable run identities.
- Run the targeted regression suite and typecheck in CI; investigate runner dispatch failures separately from code failures.
- Promote the PR from draft only after the complete path and checks are actually verified.

## Status discipline

- DONE means a code change exists on this branch; it does not imply CI passed.
- PARTIAL means the seam exists but a real production authority or end-to-end path is still absent.
- OPEN means no implementation claim is made yet.


## Cross-source integration matrix for the 120-direction plan

This matrix maps the broad integration catalogue to existing NK1 seams. It is intentionally a disposition map: a source name is a research target, not proof that its repository has been vendored or that the entire capability is production-complete.

| Direction family | Existing NK1 seam to reuse | Integration disposition |
|---|---|---|
| Agent loop, planning, tool execution | OrganismRuntime, PlanEngine, ActionGateway, embodied action executor | Reuse the canonical runtime and add bounded adapters; do not introduce a second action loop |
| Hermes/Will skill learning and reflection | P23LearningEngine, SkillRevisionPlan, HermesVerifiedEvidenceBinding, VersionedSkillCandidateStore | Port evidence binding, revision targets and skill-learning ideas into P23; keep promotion authority unchanged |
| Independent evaluation and benchmark suites | IndependentSkillCandidateEvaluator, SkillLearnBenchAdapter, LearningExperimentPlan, VerifiedOutcomeLedger | Preserve exact payload/task/environment binding, matched task/trial comparisons and untouched holdout |
| Persistent memory and consolidation | OfflineConsolidation, memory retrieval/consolidation subsystems, continuity and evidence ledgers | Connect memory records to provenance and task utility; avoid a parallel authoritative memory store |
| Replay, continual learning, forgetting/transfer | P23LearningEngine, ReplaySelectionPolicy, MultiSourceLearningMechanisms, evidence debt | Reuse bounded replay and seed-clustered evidence; add retention/transfer comparisons before changing defaults |
| Metacognition and uncertainty | OutcomeReflectionCurriculum, prediction calibration, evidence debt, causal trace ledger | Use measured prediction error and uncertainty to select verification work; do not treat self-reported confidence as proof |
| Emotional/motivational state | Organism needs/state, resource economy, goal pressure and social context | Integrate as functional control signals only when a measurable behavior change can be evaluated |
| Voice, vision and Live2D | LanguageOrgan, camera evidence processor, vision backend, embodiment and UI layers | Preserve existing perception/action interfaces; bind avatar state to real runtime state instead of animation-only imitation |
| Browser, coding and external tools | ActionGateway, tool schemas, postcondition verifier, operational journal | Require permissions, sandboxing, postconditions, cancellation and auditable action traces |
| Research, optimization, evolutionary search, critics | research bridge, candidate generation and P23 evaluator | Keep shadow-only; optimize on train/validation only; never grant experimental search direct promotion authority |
| Runtime reliability and resource limits | RuntimePerformanceGovernor, scheduler, checkpointing, file state store, recovery controller | Extend existing cancellation, budget and recovery boundaries rather than layering another supervisor |
| Security and provenance | RealityEvidenceLedger, verified outcome ledger, signed promotion approval, canonical fingerprints | Fail closed on missing identity, mismatched evidence, safety violations or unverified execution |

### WorkPass223 disposition

- **DONE (code):** corrected a provenance mismatch that allowed the returned evaluator report to read a later-mutated environment fingerprint despite the evaluator capturing the original fingerprint at construction.
- **PARTIAL:** the existing regression covers the mutation scenario, but this connector session did not execute it or run TypeScript checks.
- **OPEN:** verify the full generation → sandbox → independent verification → safety → matched comparison → staging → shadow evidence → signed promotion path using real host-provided authorities. No fake production adapters should be added merely to make the path appear complete.
