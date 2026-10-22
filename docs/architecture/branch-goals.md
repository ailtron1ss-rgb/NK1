# NK1 branch goals and integration boundaries

Updated: 2026-10-22. The repository `ailtron1ss-rgb/NK1` is the only source of truth for implementation commits.

## Stable branch

### `main` — reproducible release baseline
- **Goal:** a clean-machine reproducible NK1 runtime with one canonical cognitive loop, persisted continuity, tested safety gates, and documented setup.
- **May accept:** reviewed, tested integration commits or completed rebuild milestones.
- **Exit gate:** required runtime tests and typecheck pass; clean install/startup is demonstrated; no duplicate subsystem owners or unresolved migration path; CHANGELOG and migration notes updated.
- **Must not accept:** speculative architecture-only commits that replace unverified behavior without a migration path.

## Architecture rebuild lane

### `rebuild` — integrated organism architecture
- **Goal:** converge the six architecture islands—core, memory, motivation, embodiment, self-model, validation—into one event/state contract.
- **Core:** Perceive → Appraise → Attend → Recall → Predict → Motivate → Plan → Act → Observe outcome → Reflect → Consolidate.
- **Memory:** one canonical experience/event provenance path, with working, episodic, semantic and procedural memory coordinated by the existing consolidation controllers.
- **Motivation/goals:** one drive computation owner and one canonical endogenous goal generator/lifecycle; do not create competing goal stores.
- **Embodiment:** voice/avatar render the same committed internal state and selected action, not a separate emotion truth.
- **Self/validation:** self-model updates are evidence-gated; evaluation and activation remain separate.
- **Exit gate:** a replayable end-to-end trace proves that an internally generated goal can pass policy gates, produce an authorized action, record a grounded outcome, and alter a candidate skill only after independent evaluation.

## Active stacked integration lane

### `workpass206-runtime-evaluator-wiring` — causal learning and runtime contract integration
- **Current role:** feature branch used by open PR #55; its base is `workpass203-independent-candidate-evaluator`, so it is a stacked integration branch, not a direct replacement for `main`.
- **Goal:** harden causal experience intake, independent skill evaluation, embodiment contracts, and the shared cognitive/motivation boundaries without introducing duplicate owners.
- **Current sub-goal:** reject false-complete cognitive cycles (invalid/duplicate stage identities, invalid or repeated ticks), normalize persisted drive state, and feed confidence-weighted intrinsic motivation into the canonical B272 goal genesis.
- **Exit gate:** the focused cycle, motivation, and B272 integration tests execute successfully; PR base/head and all stacked dependencies are reconciled; integration does not bypass independent evaluation or explicit activation approval.

### `workpass172-hermes-compound-revision-orchestrator` — skill self-evolution lane
- **Goal:** close the error-to-skill loop: real trace → diagnosis → repair plan → staged candidate → isolated run → independent evaluation → reviewed promotion/rollback.
- **Porting rule:** adapt Hermes Self-Evolution's trace-driven reflection and constrained candidate search; keep NK1's own typed evidence, holdout separation, and approval boundary. Do not copy a second agent runtime into NK1.
- **Exit gate:** measured improvement on held-out tasks across repeated seeds, no regression beyond declared bounds, candidate provenance retained, and activation only through the canonical promotion gate.

## Shared merge policy
1. Workstreams can progress in parallel, but each capability has one canonical owner and one persisted state schema.
2. Feature branches are not release-ready merely because their commits exist; branch and CI state must be checked before merge.
3. Keep research extraction distinct from integration claims: reference, adapted mechanism, changed NK1 files, and validation result are recorded separately.
4. Do not report consciousness as an engineering fact. Track observable autonomy, continuity, causal learning, calibrated confidence, and safe initiative as measurable milestones.
