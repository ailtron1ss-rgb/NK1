# WorkPass93 — Hermes-inspired reflective learning gate

Date: 2026-10-21

## Selected source

- Hermes Agent: https://github.com/NousResearch/hermes-agent
- Self-Evolution pipeline: https://github.com/NousResearch/hermes-agent-self-evolution
- Fitness evaluator: https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/evolution/core/fitness.py
- Skill evolution loop: https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/evolution/skills/evolve_skill.py
- Design plan: https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/PLAN.md
- License: MIT, as declared by both repositories.

## Scope and source audit

The selected mechanism is the self-evolution pipeline, not the unrelated terminal, gateway, provider, chat, or deployment runtime of Hermes Agent. The source README and PLAN describe a workflow that selects an artifact, builds or loads an evaluation dataset, evolves candidates using reflective search, scores candidates across several dimensions, checks constraints, and proposes a PR instead of directly replacing the active artifact. The inspected fitness implementation uses correctness, procedure-following, conciseness, a length penalty, and textual feedback. The inspected skill evolution entry point separates training/validation/holdout data and includes constraint validation and a PR-oriented workflow.

The source project itself states that skill evolution is implemented while tool-description, system-prompt, code-evolution, and continuous-loop phases are planned. Therefore those planned phases are not represented here as existing upstream functionality.

The main Hermes Agent also has skill-management guards and background curation. These are useful references for write restrictions, read-before-write behavior, reversible archiving, and keeping autonomous maintenance isolated from the live session. They are not transplanted as Python modules because NK1's runtime and safety contracts are different.

## Adaptation in NK1

Extended the existing `SkillLearnBenchAdapter.ts` rather than creating a competing learning subsystem.

- Adds paired baseline/candidate comparison keyed by exact task ID and trial ID.
- Keeps validation and holdout evidence separate; a missing, mismatched, or empty holdout cannot pass.
- Rejects overlap between validation and holdout task IDs, validates component scores and aggregate consistency, checks verifier pass flags against pass rates, and uses collision-safe composite trial keys.
- Macro-averages task scores after normalizing task IDs, so repeated trials or whitespace variants cannot silently reweight a task.
- Uses a multi-axis score: 50% independently verified task success, 30% trajectory quality, 20% skill quality.
- Requires a minimum validation gain (default 0.005), caps tolerated holdout regression (default 0.02), and requires at least two distinct holdout tasks by default.
- Any candidate safety violation is a hard rejection, not something a higher aggregate score can offset.
- Produces structured feedback when task success, trajectory quality, skill quality, holdout performance, or safety is weak.
- Does not mutate, activate, or persist candidates. Eligibility is a recommendation for the existing approval/activation/rollback route; this keeps the source optimizer separate from authority to change the live system.
- Adds regression tests for leakage, forged aggregates, empty rubrics, duplicate trials, normalized task identity, and malformed runtime inputs; wires them into the existing P26 learning-validation workflow. No new runtime dependency is added.
- Rejects empty required-capability and expected-trajectory rubrics instead of allowing the zero-denominator ratio helper to score an empty reference as perfect.
- Hardens the existing aggregate API against duplicate task/trial evidence, malformed score values, and whitespace-split task groups.
- Makes trajectory completeness a distinct F1-like measure that penalizes both missing reference steps and unexpected actions; previously it duplicated key-point recall and failed to penalize extra actions.

## Validation status

The test is registered in package scripts and the learning workflow. A broader audit found the same pre-step failure on runs #32–#46 across successive commits on this PR: the job reports `runner_id: 0`, empty `runner_name`, `steps: []`, `logs_url: null`, and completion within roughly 1–4 seconds. Rerunning failed job from run #42 produced attempt 2 with the same signature. The newest runs #44–#46 also fail before steps. This strongly indicates the workflow job is failing before an actual runner starts, but the exact cause (repository Actions policy, hosted-runner allocation, account/quota, or GitHub-side issue) is not exposed by the available API response. It is not evidence that the new test or typecheck failed, because neither step started. Do not disable validation or weaken branch protections to mask this. No test/typecheck pass is claimed. The gate is a deterministic evidence comparator; it is not an implementation of DSPy/GEPA and does not generate candidate mutations by itself.

## Approximate progress

- Relevant Hermes self-evolution logic inspected: ~70% of the selected pipeline's main entry, scoring, plan, and constraints concepts; not a byte-by-byte audit of every file in the much larger Hermes Agent repository.
- Applicable evaluation-gate concepts adapted into NK1: ~65% of the selected evaluation/promotion-gate slice.
- Whole Hermes Agent transferred: ~5% by design; provider/runtime/CLI/gateway features are out of scope for the learning subsystem.
- Selected self-evolution pipeline fully reproduced: ~25%; GEPA-driven mutation, dataset construction/import, trace-aware optimizer loop, and PR automation are not yet implemented in NK1.

## Next high-value extraction

1. Add immutable, provenance-tagged evaluation datasets and explicit train/validation/holdout split persistence.
2. Convert failed task traces into structured diagnostic feedback without allowing candidate-authored claims to become verifier evidence.
3. Add candidate generation behind a pluggable optimizer interface; begin with deterministic/local mutations before optional API-based GEPA.
4. Bind evaluation evidence cryptographically to candidate digest, evaluator version, dataset version, and run ID.
5. Connect the gate to the existing approval/activation/rollback workflow only after locating and verifying its canonical entry point.
6. Measure multi-seed gains, regression frequency, safety failures, retention, and transfer on held-out tasks before claiming learning improvement.
