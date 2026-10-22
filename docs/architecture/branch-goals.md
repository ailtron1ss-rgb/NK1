# NK1 branch goals and merge gates

Updated: 2026-10-22. `ailtron1ss-rgb/NK1` is the only implementation source of truth. Research repositories are references; adapted code and evidence must land in NK1.

## `main` — release baseline
- **Goal:** reproducible runtime, canonical action and memory owners, safe persistence, and a clean-machine start path.
- **Exit gate:** install/start/typecheck/tests are demonstrated on the target commit; migration path is documented; no unresolved duplicate owners; CHANGELOG updated.
- **Do not merge:** an unexecuted test suite or an unreviewed stack of dependent draft PRs.

## `rebuild` — unified organism architecture
- **Goal:** converge core, memory, motivation/goals, embodiment, self-model and validation into one recurrent contract: Perceive → Attend → Recall → Predict → Motivate → Plan → Act → Verify outcome → Reflect → Consolidate.
- **Memory:** MemoryOS2 remains the canonical writable memory authority; other memory subsystems are adapters, projections, indexes, or candidates until explicitly merged.
- **Motivation/goals:** one drive owner and one canonical endogenous goal lifecycle; no parallel goal stores.
- **Embodiment:** voice/avatar reflect the same committed internal state and selected action; they do not create a second emotional truth.
- **Exit gate:** a replayable trace demonstrates an internally generated goal, policy-gated action, correlated outcome, durable episode, and independently evaluated skill candidate.

## `workpass206-runtime-evaluator-wiring` — stacked causal/runtime foundation (PR #55)
- **Goal:** harden independent skill evaluation, causal experience integrity, embodiment and runtime boundaries.
- **Exit gate:** focused tests execute, evaluator evidence is independent, branch dependencies are reconciled, and promotion remains gated.

## `workpass286-multiscale-brain-system-plan` — unified brain loop and grounded autonomous repair (PR #56)
- **Goal:** connect the architecture map, evidence lanes, resource-aware P23 repair, action-correlated postconditions, micro-cycle lifecycle, and deterministic experience provenance.
- **Current verified-in-code invariants:** micro-cycle heartbeats do not claim action credit; action-conditioned outcomes require post-state action identity and a bounded consistent success signal; external claims do not change trusted learning aggregates; imports without source IDs use deterministic content identity.
- **Not yet proven:** exact ActionGateway execution ID + decision ID + tick flowing through verifier into the same causal experience record and then through consolidation to P23; real self-initiated end-to-end task; held-out improvement.
- **Exit gate:** run the relevant Node 24 workflow and typecheck on the exact PR head; trace exact execution/decision/tick lineage end-to-end; demonstrate grounded consolidation and independently evaluated candidate staging without automatic activation.

## `workpass172-hermes-compound-revision-orchestrator` — skill evolution (PR #45)
- **Goal:** error/trajectory → diagnosis → repair plan → staged candidate → isolated execution → independent evaluation → explicit promotion/rollback.
- **Porting rule:** adapt Hermes Self-Evolution's trace-guided repair and constrained candidate search; keep NK1's verifier, evidence lineage, holdout and approval owners.
- **Exit gate:** repeatable held-out improvement across seeds, bounded regression, complete candidate provenance, and promotion only through the canonical approval gate.

## Shared integration rules
1. Each state has one authoritative owner; integrations connect owners rather than adding competing subsystems.
2. Separate untrusted hypothesis, observed event, verified outcome, consolidated memory and evaluated skill candidate as distinct evidence states.
3. A heartbeat is not an action receipt. A tool receipt is not proof of intended external effect. A staged candidate is not an activated skill.
4. Record research source, adapted mechanism, exact NK1 files, and actual validation outcome separately.
5. Percentages describe engineering maturity only; they do not measure consciousness. Track autonomy through observable, replayable behavior.