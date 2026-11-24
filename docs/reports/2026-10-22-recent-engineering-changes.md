# NK1 recent engineering changes — 2026-10-20 to 2026-10-22

Scope: this report summarizes the current `workpass206-runtime-evaluator-wiring` branch changelog and the explicitly recorded prior work. It is not a claim that every item is merged into `main`.

## 2026-10-22 — cognitive learning and evaluator hardening

- **WorkPass282 — P23 fingerprint canonicalization:** aligned candidate-payload and evaluation fingerprints between the P23 engine and independent evaluator; rejects non-finite numbers, cyclic structures, non-plain objects, and non-JSON-serializable values.
- **WorkPass283 — causal outcome tick binding:** requires the decision trace and its pre-action state to refer to the same world tick.
- **WorkPass284 — external causal-memory intake:** rejects invalid ticks, malformed metrics, and unsafe optional source/evidence identities rather than coercing them.
- **WorkPass285 — evaluator capability scope:** rejects verifier claims outside a task's declared required-capability set.
- **WorkPass255–260 (previously reported in the project handover):** animation-loop stabilization; stale sprite-load race fix; regression coverage; execution-directory identity protection; selective learning-integrity restoration; and replay-diversity selection. Exact commit SHAs and exact-head validation for these items must be read from their owning branch/PR before treating them as merged or verified.

## 2026-10-21 — verified learning data and controlled skill revision

- **WorkPass183:** local-model skill-revision candidate generator.
- **WorkPass185:** verified-session dataset export with train/validation separation and aggregate-only holdout reporting.
- **WorkPass186:** suppresses holdout aggregates below minimum outcome/seed evidence thresholds.
- **WorkPass187:** stable SHA-256 dataset content fingerprint; regression covers stability, change after new verified outcomes, and snapshot isolation.
- The larger Hermes/P23 path has also added signed verifier evidence, trusted shadow-run context, staged candidate lifecycle, independent evaluation gates, explicit approval boundaries, and rollback-oriented storage. These mechanisms are not equivalent to a complete autonomous self-improvement loop: trusted production execution, independently measured uplift, and authenticated activation still require end-to-end evidence.

## 2026-10-20 — experiment and memory-evaluation foundations

- Added reproducible matched experiment plans across task, seed, and method arms, with manifest-bound identity and duplicate/split leakage checks.
- Added seed-clustered outcome comparisons and deterministic bootstrap sensitivity intervals; promotion gates can require evidence across independent seeds and task families.
- Strengthened memory retrieval evaluation with explicit unanswerable queries, abstention/unsupported-retrieval metrics, dataset provenance fingerprints, and suppression of corrupt superseded memories.
- These are evaluation-integrity improvements; synthetic fixtures and metric-gate tests do not establish real-world learning uplift.

## Validation and integration boundaries

- Current branch changelog explicitly says WorkPass282–285 test/typecheck execution remains unverified; no learning-score uplift is claimed.
- Earlier reports state some GitHub Actions runs failed before exposing job steps/logs. Re-check exact-head Actions before marking any affected pass validated.
- Do not infer that work on a feature branch is merged into `main`. The project has multiple WorkPass branches and PRs; branch ownership and commit ancestry must be checked per change.
- No third-party code or dataset is claimed as copied by this summary. Research mechanisms are adapted selectively; license and data provenance remain prerequisites for direct reuse.

## Next implementation gates

1. Connect the canonical P23 learner to a production-owned cycle: observed failure → diagnosis → candidate generation → isolated execution → independent evaluation → explicit approval → activation/rollback.
2. Prove that the deployed scheduler uses the Core-owned trusted shadow execution API, not just that the API exists.
3. Run the exact branch-head tests and typecheck; publish CI evidence only when the run completes successfully.
4. Measure retention, transfer, repair quality, and task success on independently verified tasks and multiple seeds.
5. Consolidate perception, memory, drives, planning, ethical gating, action, reflection, and avatar state through shared typed state/event contracts rather than parallel engines.
