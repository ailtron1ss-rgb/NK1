# NΩ 1.26 Online Continual Learning & Neural Plasticity Implementation Plan

> **For agentic workers:** Native execution is pre-selected for this plan; implement task-by-task in this workspace. Steps use checkbox syntax for tracking.

**Goal:** Build a verified online continual-learning control loop that protects immutable evidence, measures interference/plasticity, selects replay with uncertainty/diversity/transfer signals, performs transactional updates with rollback, and proves restart equivalence.

**Architecture:** Add narrow V2/V1 evidence components around the existing neural trainer and continual controller. Keep research heuristics observable and promotion-gated. Route all online adaptation through an explicit transaction that snapshots state, evaluates new and old capabilities, and either commits or restores the exact pre-update state.

**Tech Stack:** Python 3, PyTorch, pytest, JSON runtime ledgers, existing NΩ TinyVM/neural trainer infrastructure.

**Spec:** `docs/superpowers/specs/2026-09-21-online-continual-learning-neural-plasticity-design.md`

## Global Constraints

- Immutable `holdout`, `ood`, and `regression` partitions are append-only and fingerprint-enforced.
- No production update without a failing test first.
- Promotion must use externally evaluated behavior, not only training loss.
- Online updates must respect equal-budget comparison in benchmark mode.
- Rollback must restore model, optimizer, replay-policy, registry generation, and evidence state.
- NΩ 1.26 may report N1/N2/N3 evidence only when the corresponding measured gates pass.
- No claim of universal continual-learning superiority; all strategies remain controlled variants.

## Review Focus

1. Immutable partition content mutation must be rejected rather than silently rebased; tested by registry mutation rejection.
2. Replay selection must protect anchors while avoiding family concentration; tested by diversity/cap constraints.
3. Interference diagnostics must distinguish gradient conflict from measured behavioral damage; tested with aligned and conflicting toy gradients.
4. Rollback must restore both model weights and optimizer state; tested by byte-level checkpoint fingerprint equality.
5. Restart equivalence must compare post-reload outputs and metrics against the original checkpoint; tested with deterministic and intentionally nondeterministic fixtures.

---

### Task 1: Immutable Partition Registry V2

**Files:**
- Create: `core/nomega/replay_partition_registry_v2.py`
- Test: `tests/test_replay_partition_registry_v2.py`

**Interfaces:**
- `ReplayPartitionRegistryV2(root: Path)`
- `register(records: Sequence[dict], partition: str, generation: str) -> dict`
- `verify_immutable(partition: str, records: Sequence[dict]) -> dict`
- `snapshot() -> dict`

- [ ] Write tests for first registration, identical re-registration, changed immutable payload rejection, train-generation mutation allowance, and snapshot persistence.
- [ ] Run `pytest tests/test_replay_partition_registry_v2.py -q` and verify RED because the module does not exist.
- [ ] Implement canonical semantic/payload fingerprints and persisted partition generation metadata.
- [ ] Run focused test again and verify GREEN.
- [ ] Add mutation error messages containing partition name and previous/current fingerprint.
- [ ] Re-run focused tests.

### Task 2: Stream Monitor + Plasticity/Interference Diagnostics

**Files:**
- Create: `core/nomega/online_stream_monitor_v1.py`
- Create: `core/nomega/neural_interference_monitor_v1.py`
- Create: `core/nomega/neural_plasticity_monitor_v1.py`
- Test: `tests/test_online_stream_monitor_v1.py`
- Test: `tests/test_neural_interference_monitor_v1.py`
- Test: `tests/test_neural_plasticity_monitor_v1.py`

**Interfaces:**
- `OnlineStreamMonitorV1.observe(sample: dict) -> dict`
- `OnlineStreamMonitorV1.decide() -> dict`
- `NeuralInterferenceMonitorV1.gradient_cosine(g1: Sequence[float], g2: Sequence[float]) -> float`
- `NeuralInterferenceMonitorV1.analyze(proposed: Sequence[Sequence[float]], anchors: Sequence[Sequence[float]]) -> dict`
- `NeuralPlasticityMonitorV1.measure(pre: dict, post: dict, fresh: dict, steps: int) -> dict`

- [ ] Write failing tests for four stream modes, cosine alignment/conflict, zero-vector safety, and plasticity-gap calculation.
- [ ] Run all three focused test files and verify expected RED.
- [ ] Implement bounded rolling uncertainty/reward/novelty tracking and deterministic mode selection.
- [ ] Implement memory-safe pairwise cosine diagnostics with aggregate conflict rates.
- [ ] Implement fresh-control based plasticity metrics.
- [ ] Re-run focused tests to GREEN.

### Task 3: Replay Policy V2

**Files:**
- Create: `core/nomega/continual_replay_policy_v2.py`
- Test: `tests/test_continual_replay_policy_v2.py`

**Interfaces:**
- `ContinualReplayPolicyV2.rank(records, current_family, anchor_keys, max_items, diversity_key='semantic_group') -> list[dict]`
- `ContinualReplayPolicyV2.explain(decision) -> dict`

- [ ] Write failing tests proving anchor quota, per-family cap, negative-transfer veto, uncertainty weighting, and semantic diversity.
- [ ] Run focused test and verify RED.
- [ ] Implement normalized score: anchor + uncertainty + interference reduction + diversity + transfer + recency + verified reward - negative transfer risk.
- [ ] Enforce hard vetoes before ranking fill.
- [ ] Persist explanation for every chosen row.
- [ ] Re-run focused test to GREEN.

### Task 4: Behavioral Anchor Regularization + Online Transaction

**Files:**
- Create: `core/nomega/online_adaptation_transaction_v1.py`
- Modify: `core/nomega/neural_program_trainer_v3.py`
- Test: `tests/test_online_adaptation_transaction_v1.py`

**Interfaces:**
- `OnlineAdaptationTransactionV1.begin(...) -> snapshot_id`
- `OnlineAdaptationTransactionV1.evaluate(metrics: dict) -> str` returning `commit|rollback`
- `OnlineAdaptationTransactionV1.rollback() -> dict`
- `OnlineAdaptationTransactionV1.commit() -> dict`
- `OnlineAdaptationTransactionV1.snapshot() -> dict`
- Trainer helper: `behavior_anchor_loss(current_logits, frozen_logits, mask, lambda_anchor) -> Tensor`

- [ ] Write failing test for rollback restoring a changed model plus optimizer state and for commit preserving the update.
- [ ] Run focused test and verify RED.
- [ ] Implement checkpoint serialization for model/optimizer/policy/registry/evidence metadata.
- [ ] Add functional anchor KL helper as an opt-in training term; default remains disabled for legacy behavior.
- [ ] Implement metric gate evaluation for new-task gain, retention, OOD, interference, restart and budget.
- [ ] Re-run focused tests to GREEN.

### Task 5: Restart Equivalence

**Files:**
- Create: `core/nomega/restart_equivalence_verifier_v1.py`
- Test: `tests/test_restart_equivalence_verifier_v1.py`

**Interfaces:**
- `RestartEquivalenceVerifierV1.capture(model_path: Path, eval_bundle: dict) -> dict`
- `RestartEquivalenceVerifierV1.verify(reloaded_outputs: dict, tolerances: dict | None = None) -> dict`
- `RestartEquivalenceVerifierV1.report() -> dict`

- [ ] Write failing deterministic equivalence and deliberate-mismatch tests.
- [ ] Run focused tests and verify RED.
- [ ] Implement checkpoint fingerprint plus structured output/metric comparison with tolerances.
- [ ] Store the exact evaluation bundle and environment fingerprint needed for replay.
- [ ] Re-run focused tests to GREEN.

### Task 6: Continual Controller Integration

**Files:**
- Modify: `core/nomega/continual_learning_controller_v1.py`
- Modify: `core/nomega/continual_learning_controller_v1.py` tests.
- Add: integration tests in `tests/test_continual_learning_controller_v2_integration.py`

**Interfaces:**
- Preserve `ContinualLearningControllerV1.build_partitions` compatibility.
- Add `build_immutable_registry(records) -> dict`.
- Add `select_replay_v2(...) -> list[dict]`.
- Add `record_transaction(result: dict) -> None`.

- [ ] Write failing integration test for registry mutation, adaptive replay, transaction decision and evidence persistence.
- [ ] Run integration test and verify RED.
- [ ] Wire new modules behind explicit V2 methods without breaking V1 call sites.
- [ ] Re-run integration test and existing controller tests.

### Task 7: Sequential Online Benchmark

**Files:**
- Create: `tools/benchmark_1_26_online_continual.py`
- Test: `tests/test_benchmark_1_26_online_continual.py`
- Create: `docs/research/NOMEGA_1.26_CONTINUAL_LEARNING_RESEARCH.md`

**Interfaces:**
- `run(seed, strategy, families) -> dict`
- Strategies: `naive`, `static_replay`, `adaptive_replay`, `adaptive_replay_anchor`, `adaptive_replay_anchor_interference`.
- Report includes per-phase gain, retention, OOD, plasticity-gap, conflict rate, rollbacks, restart equivalence, compute budget.

- [ ] Write failing test for deterministic strategy registry and report schema.
- [ ] Run focused test to RED.
- [ ] Implement bounded four-family stream: `sum3 -> xor3 -> mul2 -> sub_offset`.
- [ ] Equalize optimizer steps and collect fresh-control runs.
- [ ] Run 3-seed matrix for all strategies.
- [ ] Add research notes citing the 2025 replay/plasticity result, 2025 spectral-collapse result, and 2026 gradual-shift/growing-network results.
- [ ] Re-run focused benchmark tests.

### Task 8: Release 1.26 and Roadmap Integration

**Files:**
- Create: `docs/releases/1_26_0/NOMEGA_1.26.0_UPGRADE_REPORT.md`
- Modify: `docs/roadmaps/NOMEGA_1.25_1.30_NEURAL_SELF_IMPROVEMENT_ROADMAP.md` (if present; otherwise create)
- Create: `NOMEGA_1.26.0_BUILD_MANIFEST.json`
- Create: `NOMEGA_1.26.0_RELEASE_EVIDENCE.json`

- [ ] Run focused 1.26 tests.
- [ ] Run `python -m compileall core tools tests` in a clean release tree.
- [ ] Run release benchmark with 3 seeds and store exact metrics.
- [ ] Set N2/N3 evidence only from measured gates; otherwise record the exact missing gate.
- [ ] Remove `__pycache__`/`.pyc` from release tree.
- [ ] Create ZIP and SHA-256.
- [ ] Extract ZIP into a fresh directory and rerun release-critical tests plus compileall.
- [ ] Write manifest containing file count, hashes, test counts, benchmark evidence, and unresolved timeouts/failures.

## Verification Matrix

- New component tests: expected all pass.
- Existing 1.25 causal-learning tests: must remain passing.
- Existing continual/replay tests: must remain passing.
- Compileall: zero syntax errors.
- Release-critical extract test: zero failures.
- Full historical suite may be timeout-limited by environment; if so, report timeout rather than treating it as pass.

## Release Gate Semantics

NΩ 1.26 is a software release when the code/package gates pass. N2/N3 neurality milestones are separate evidence gates. A release may therefore be shipped with `milestone: N1`, `N2`, or `N3` depending on measured results.
