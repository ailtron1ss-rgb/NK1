# Neuro Kurisu — cross-source learning integration roadmap

Scope: continue integrating mechanisms into the existing P23 learning/revision lifecycle. This is an implementation queue, not a promise that upstream mechanisms are already integrated. Preserve the current branch/PR boundary; do not merge to the default branch without explicit approval.

## Completed in this branch (through WorkPass222)

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
