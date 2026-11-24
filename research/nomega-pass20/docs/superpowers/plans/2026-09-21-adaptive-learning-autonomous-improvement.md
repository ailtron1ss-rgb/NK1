# NΩ 1.24 Adaptive Learning & Autonomous Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an executable, evidence-gated adaptive-improvement loop that connects neural proposal/learning, execution evidence, partial value, counterexample discovery, repair, adaptive environment generation, continual replay, promotion, lineage, and metaproductivity, while creating the measurable foundation for NΩ 1.25–1.30 neural self-improvement.

**Architecture:** Add focused V2/V1 research modules around the stable 1.23 execution spine instead of replacing verified runtime code. The integrated loop will route every experimental intervention through reproducible evidence collection, independent verification, holdout/OOD/non-regression checks, and promotion/rollback; research-only behavior remains opt-in until a measured benefit gate is satisfied.

**Tech Stack:** Python 3.10+, PyTorch >=2.0, stdlib dataclasses/json/hashlib/pathlib/random/statistics/time, pytest. No new runtime dependency is required.

**Spec:** `docs/superpowers/specs/2026-09-21-adaptive-learning-autonomous-improvement-design.md`

## Global Constraints

- `pyproject.toml` must report project version `1.24.0.dev0` for the implementation branch.
- `core/nomega/version.py` must report `PROJECT_VERSION = "1.24.0-dev"` and preserve `BASELINE_VERSION = "1.14.1"`.
- Existing 1.23 research interfaces must remain import-compatible unless a new V2 interface is added beside them.
- Value guidance stays opt-in until a benchmark demonstrates net verifier-work savings after inference overhead.
- Promotion must require independent evidence; a model-generated score alone cannot authorize promotion.
- Training, validation, holdout, OOD, and regression anchors must be represented as distinct partitions and persisted with provenance fingerprints.
- Canonical runtime artifacts are never modified in place by exploratory candidate generation; promotion copies an already-verified candidate artifact through the governed control plane.
- Every accepted self-improvement intervention must have a baseline hash, candidate hash, evaluator version, environment IDs, training-data fingerprint, random seeds, resource measurements, and a reproducible decision record.
- The implementation must remain CPU-executable on the existing environment; CUDA-only paths are forbidden for release tests.
- New production code requires a failing test first; every green unit test must be followed by the relevant project suite.

## Review Focus

1. **Stale release metadata:** every exposed version source and version assertion must agree on 1.24 development status without breaking the canonical governed-release marker.
2. **Trace corruption:** evidence records must remain deterministic, serializable, and independently reconstructable from the V1 trace/executor outputs.
3. **Value-model overconfidence:** uncertainty must increase for unseen families/prefixes and cannot silently convert into promotion evidence.
4. **Replay interference:** high reward rows with harmful transfer must be quarantinable, while immutable anchors remain selected.
5. **Self-improvement false positives:** a candidate that gains training score but regresses holdout/OOD, restart continuity, latency, or independent verification must be rejected and recorded.

---

## Repository Map Before Editing

The current implementation already contains the following reusable pieces:

- `core/nomega/execution_trace_v1.py` — independent TinyVM tracing.
- `core/nomega/partial_program_value_v1.py` — bootstrap ensemble value estimator.
- `core/nomega/counterexample_search_v2.py` — bounded search with optional value guidance.
- `core/nomega/verifiable_environment_forge_v1.py` — verified hard-row generation.
- `core/nomega/evolution_archive_v1.py` — bounded evolutionary archive/Pareto selection.
- `core/nomega/developmental_bottleneck_detector_v1.py` — evidence-oriented bottleneck ranking.
- `core/nomega/self_evolution_control_plane_v2.py` — evidence quorum/promotion and artifact replacement.
- `core/nomega/neural_execution_learning_lab_v1.py` — neural execution-learning experiment runner.
- `core/nomega/replay_scheduler_v1.py` and `adaptive_experience_memory_v3.py` — replay and transfer-aware memory.
- `core/nomega/experiment_registry_v2.py` — minimal experiment persistence.

The implementation should compose these pieces and add the missing interfaces rather than create a parallel runtime.

---

# Task 1: Establish 1.24 Release Hygiene and Reproducible Baseline

**Files:**
- Modify: `pyproject.toml`
- Modify: `core/nomega/version.py`
- Modify: `VERSION.json`
- Modify: `tests/test_nomega_1_15_upgrade.py:88`
- Create: `tests/test_release_version_consistency_v1.py`
- Create: `docs/releases/1_24_0/NOMEGA_1.24.0_UPGRADE_REPORT.md`

**Interfaces:**
- Produces `PROJECT_VERSION == "1.24.0-dev"`.
- Produces package metadata version `1.24.0.dev0`.
- Produces a machine-readable `VERSION.json` whose `version` equals `1.24.0-dev` and whose `baseline` stays `1.14.1`.

- [ ] **Step 1: Reproduce the existing stale assertion failure**

Run:
```bash
python -m pytest tests/test_nomega_1_15_upgrade.py::test_version_source_is_present -q
```
Expected: FAIL because the assertion still expects `1.18.0-dev` while `core/nomega/version.py` contains `1.23.0-dev`.

- [ ] **Step 2: Write the consistency test**

Add:
```python
import json
from pathlib import Path
from core.nomega.version import PROJECT_VERSION

def test_all_release_version_sources_are_124():
    root = Path(__file__).resolve().parents[1]
    pyproject = (root / "pyproject.toml").read_text()
    version_json = json.loads((root / "VERSION.json").read_text())
    assert PROJECT_VERSION == "1.24.0-dev"
    assert 'version = "1.24.0.dev0"' in pyproject
    assert version_json["version"] == "1.24.0-dev"
    assert version_json["baseline"] == "1.14.1"
```

- [ ] **Step 3: Update the version sources**

Set `project.version` in `pyproject.toml` to `1.24.0.dev0`, `PROJECT_VERSION` in `core/nomega/version.py` to `1.24.0-dev`, and `VERSION.json["version"]` to `1.24.0-dev`. Keep `status="research_only"` and `canonical_governed_release="1.13.1"`.

- [ ] **Step 4: Update the stale legacy assertion**

Change only the expected development version in `tests/test_nomega_1_15_upgrade.py` to `1.24.0-dev`; do not change unrelated legacy behavior.

- [ ] **Step 5: Verify the red/green transition**

Run:
```bash
python -m pytest tests/test_release_version_consistency_v1.py tests/test_nomega_1_15_upgrade.py::test_version_source_is_present -q
```
Expected: PASS with 0 failures.

- [ ] **Step 6: Run the complete existing suite before feature changes**

Run:
```bash
python -m pytest -q
```
Expected: capture the exact baseline count and any remaining pre-feature failures in the 1.24 report.

- [ ] **Step 7: Commit the release hygiene change**

```bash
git add pyproject.toml core/nomega/version.py VERSION.json tests/test_nomega_1_15_upgrade.py tests/test_release_version_consistency_v1.py docs/releases/1_24_0/NOMEGA_1.24.0_UPGRADE_REPORT.md
```

If the working copy has no Git metadata, preserve the exact change set without the commit command and record that limitation in the release report.

---

# Task 2: Add Execution Evidence V2

**Files:**
- Create: `core/nomega/execution_evidence_v2.py`
- Create: `tests/test_execution_evidence_v2.py`
- Reference: `core/nomega/execution_trace_v1.py`

**Interfaces:**
- `EvidenceStepV2(step:int, pc:int, op:int, error_class:str, progress:float, state_fingerprint:str)`
- `ExecutionEvidenceV2(trace_fingerprint:str, result:int, success:bool, halted:bool, steps:int, error_class:str, progress:float, verifier_ok:bool, cost_steps:int, trajectory_fingerprint:str, lineage_id:str, steps_detail:tuple[EvidenceStepV2,...])`
- `build_execution_evidence(trace: ExecutionTraceV1, *, verifier_ok: bool, lineage_id: str) -> ExecutionEvidenceV2`

- [ ] **Step 1: Write failing deterministic evidence tests**

```python
from core.nomega.execution_trace_v1 import trace_tinyvm_v1
from core.nomega.execution_evidence_v2 import build_execution_evidence

def test_execution_evidence_preserves_trace_identity():
    trace = trace_tinyvm_v1([(1,0,0),(13,0,0),(14,0,0)],[7])
    evidence = build_execution_evidence(trace, verifier_ok=True, lineage_id="c1")
    assert evidence.trace_fingerprint == trace.fingerprint
    assert evidence.success is True
    assert evidence.lineage_id == "c1"
    assert evidence.trajectory_fingerprint

def test_execution_evidence_is_serializable_and_deterministic():
    trace = trace_tinyvm_v1([(1,0,0),(13,0,0),(14,0,0)],[7])
    a = build_execution_evidence(trace, verifier_ok=True, lineage_id="c1")
    b = build_execution_evidence(trace, verifier_ok=True, lineage_id="c1")
    assert a.to_dict() == b.to_dict()
```

- [ ] **Step 2: Run tests and verify failure**

```bash
python -m pytest tests/test_execution_evidence_v2.py -q
```
Expected: FAIL because `execution_evidence_v2.py` does not yet exist.

- [ ] **Step 3: Implement evidence dataclasses and stable hashing**

Use SHA-256 over canonical JSON for state/trajectory fingerprints. `build_execution_evidence()` must classify an empty error as `"none"`, a trace error as `"runtime"`, a non-halted trace as `"incomplete"`, and preserve the V1 trace fingerprint without recomputing a conflicting value.

- [ ] **Step 4: Add progress estimation without changing semantics**

Use monotonic progress based on observed unique `(pc, op)` pairs and terminal verifier success. Keep the range `[0, 1]`; never infer semantic correctness from progress alone.

- [ ] **Step 5: Run the focused tests**

```bash
python -m pytest tests/test_execution_evidence_v2.py tests/test_execution_trace_v1.py -q
```
Expected: PASS.

---

# Task 3: Implement Partial Program Value V2 With Break-Even Accounting

**Files:**
- Create: `core/nomega/partial_program_value_v2.py`
- Create: `tests/test_partial_program_value_v2.py`
- Reference: `core/nomega/partial_program_value_v1.py`

**Interfaces:**
- `ValuePredictionV2(success_probability:float, remaining_progress:float, repairability:float, expected_cost:float, uncertainty:float)`
- `ValueFitReportV2(samples:int, ensemble:int, loss:float, uncertainty_mean:float, inference_ms:float)`
- `PartialProgramValueV2(root:Path, seed:int=..., ensemble:int=3)`
- `observe(...) -> int`
- `fit(...) -> ValueFitReportV2`
- `predict(...) -> ValuePredictionV2`
- `should_enable(*, expected_verifier_savings:float) -> bool`

- [ ] **Step 1: Write tests for prediction bounds and break-even gate**

```python
from pathlib import Path
from core.nomega.partial_program_value_v2 import PartialProgramValueV2

def test_value_v2_prediction_is_bounded(tmp_path: Path):
    v = PartialProgramValueV2(tmp_path, seed=11, ensemble=2)
    code = [(1,0,0),(13,0,0),(14,0,0)]
    for i in range(24):
        v.observe(i % 4, code, 0.3 + 0.01 * (i % 8))
    v.fit(epochs=2, batch_size=8)
    p = v.predict(0, code)
    assert 0.0 <= p.success_probability <= 1.0
    assert 0.0 <= p.remaining_progress <= 1.0
    assert 0.0 <= p.repairability <= 1.0
    assert p.expected_cost >= 0.0
    assert p.uncertainty >= 0.0

def test_value_v2_only_enables_when_savings_cover_inference_cost(tmp_path: Path):
    v = PartialProgramValueV2(tmp_path, seed=13, ensemble=2)
    v.last_inference_ms = 4.0
    assert v.should_enable(expected_verifier_savings=1.0) is False
    assert v.should_enable(expected_verifier_savings=8.0) is True
```

- [ ] **Step 2: Verify red**

```bash
python -m pytest tests/test_partial_program_value_v2.py -q
```
Expected: FAIL because the module and interfaces do not exist.

- [ ] **Step 3: Build the five-head network**

Reuse the V1 static features initially, but replace the scalar output with five heads. Train all heads against execution-derived targets; uncertainty is the variance across independent ensemble members.

- [ ] **Step 4: Measure inference cost during real prediction**

Wrap the V2 inference path with `time.perf_counter()`, persist the rolling mean in the report, and make `should_enable()` compare expected saved verifier calls against measured milliseconds through a configurable conversion factor stored in the V2 instance.

- [ ] **Step 5: Add anti-overconfidence behavior**

When a family has no observations or a prefix is unseen beyond the training feature distribution, increase epistemic uncertainty by a deterministic prior rather than lowering it.

- [ ] **Step 6: Run focused and V1 compatibility tests**

```bash
python -m pytest tests/test_partial_program_value_v2.py tests/test_partial_program_value_v1.py tests/test_counterexample_value_guidance_v1.py -q
```
Expected: PASS.

---

# Task 4: Build the Autonomous Repair Engine

**Files:**
- Create: `core/nomega/repair_engine_v1.py`
- Create: `tests/test_repair_engine_v1.py`
- Reference: `core/nomega/counterexample_search_v2.py`
- Reference: `core/nomega/execution_evidence_v2.py`

**Interfaces:**
- `RepairHypothesisV1(error_class:str, operator:str, rationale:str, priority:float)`
- `RepairCandidateV1(parent_hash:str, patch:tuple[tuple[int,int,int],...], hypothesis:str, local_verified:bool, counterexamples:int, independent_verified:bool, cost:int)`
- `RepairEngineV1(root:Path, seed:int=...)`
- `classify_failure(evidence) -> str`
- `propose_hypotheses(code, evidence) -> tuple[RepairHypothesisV1,...]`
- `repair(...) -> dict`

- [ ] **Step 1: Write the minimal one-error repair test**

```python
from core.nomega.repair_engine_v1 import RepairEngineV1

def test_repair_engine_fixes_simple_input_load_error(tmp_path):
    engine = RepairEngineV1(tmp_path, seed=21)
    broken = [(0,0,0),(13,0,0),(14,0,0)]
    result = engine.repair("sum3", broken, tapes=[[5,0,0,0,0,0,0,0]], max_candidates=4)
    assert result["attempted"] >= 1
    assert "decision" in result
```

- [ ] **Step 2: Verify red**

```bash
python -m pytest tests/test_repair_engine_v1.py -q
```
Expected: FAIL because the engine does not exist.

- [ ] **Step 3: Implement failure classification**

Map execution evidence to one of `syntax`, `runtime`, `semantic_mismatch`, `boundary_condition`, `timeout`, or `unknown`. Classification must be deterministic and independent from model scores.

- [ ] **Step 4: Implement bounded repair operators**

Use the existing acquisition mutation helpers rather than introducing a new bytecode grammar. Limit edits to one local mutation per hypothesis on the first repair round. Preserve the original program hash.

- [ ] **Step 5: Integrate counterexample verification**

For each candidate: execute against provided rows, invoke `CounterexampleSearchV2` for adversarial refinement when local verification passes, then independently execute the final candidate through both TinyVM and HVM paths before marking `independent_verified=True`.

- [ ] **Step 6: Persist repair lineage**

Store `original_hash`, `hypothesis`, `patch`, `counterexamples`, `verification`, `resource_cost`, and `decision` under `runtime/repairs_v1.jsonl` with append-only records.

- [ ] **Step 7: Run focused tests and regression suite**

```bash
python -m pytest tests/test_repair_engine_v1.py tests/test_counterexample_value_guidance_v1.py tests/test_nomega_1_16_repair_v2.py -q
```
Expected: PASS.

---

# Task 5: Add Adaptive Environment Forge V2

**Files:**
- Create: `core/nomega/adaptive_environment_forge_v2.py`
- Create: `tests/test_adaptive_environment_forge_v2.py`
- Reference: `core/nomega/verifiable_environment_forge_v1.py`
- Reference: `core/nomega/developmental_bottleneck_detector_v1.py`

**Interfaces:**
- `EnvironmentRowV2(tape:tuple[int,...], expected:int, difficulty:float, novelty:float, oracle_hash:str, partition:str)`
- `AdaptiveForgeReportV2(family:str, generated:int, accepted:int, train:int, holdout:int, ood:int, mean_difficulty:float, novelty:float, fingerprint:str)`
- `AdaptiveEnvironmentForgeV2(root:Path, seed:int=...)`
- `forge_targeted(family:str, *, bottleneck_score:float, uncertainty:float, count:int=...) -> AdaptiveForgeReportV2`

- [ ] **Step 1: Write partition and oracle integrity tests**

```python
from core.nomega.adaptive_environment_forge_v2 import AdaptiveEnvironmentForgeV2

def test_adaptive_forge_creates_distinct_partitions(tmp_path):
    r = AdaptiveEnvironmentForgeV2(tmp_path, seed=31).forge_targeted("sum3", bottleneck_score=.9, uncertainty=.8, count=12)
    assert r.accepted >= 3
    assert r.train + r.holdout + r.ood == r.accepted
    assert r.ood >= 1

def test_adaptive_forge_rejects_duplicate_rows(tmp_path):
    r1 = AdaptiveEnvironmentForgeV2(tmp_path, seed=31).forge_targeted("sum3", bottleneck_score=.9, uncertainty=.8, count=12)
    r2 = AdaptiveEnvironmentForgeV2(tmp_path, seed=31).forge_targeted("sum3", bottleneck_score=.9, uncertainty=.8, count=12)
    assert r2.novelty <= r1.novelty
```

- [ ] **Step 2: Verify red**

```bash
python -m pytest tests/test_adaptive_environment_forge_v2.py -q
```
Expected: FAIL because the new module does not exist.

- [ ] **Step 3: Reuse V1 oracle verification and add immutable oracle hashes**

Every accepted row must be generated only from an oracle verified through both TinyVM and HVM, and the oracle SHA-256 must be stored in the row.

- [ ] **Step 4: Add solver-relative difficulty calibration**

Measure candidate failure rate against the current bounded candidate pool. Target rows whose failure rate is between `0.35` and `0.85`; reject rows outside the range unless `bottleneck_score >= 0.9`, in which case retain the best verified separator.

- [ ] **Step 5: Add novelty and anti-duplication state**

Persist row fingerprints under `runtime/adaptive_environment_forge_v2.json`. A row already seen in any historical partition is never re-added to train or holdout.

- [ ] **Step 6: Add partition persistence**

Persist train/holdout/OOD partitions separately, and never reshuffle historical holdout/OOD rows when a later forge call occurs.

- [ ] **Step 7: Run focused forge tests**

```bash
python -m pytest tests/test_adaptive_environment_forge_v2.py tests/test_verifiable_environment_forge_v1.py -q
```
Expected: PASS.

---

# Task 6: Build the Unified Learning Experiment Protocol

**Files:**
- Create: `core/nomega/learning_experiment_protocol_v1.py`
- Create: `tests/test_learning_experiment_protocol_v1.py`
- Modify: `core/nomega/experiment_registry_v2.py`

**Interfaces:**
- `ExperimentRequestV1(id:str, bottleneck:str, hypothesis:str, intervention:str, seed:int, baseline_hash:str, dataset_fingerprint:str)`
- `EvaluationBundleV1(baseline:dict, candidate:dict, independent_runs:int, seeds:tuple[int,...], trajectory_hashes:tuple[str,...], holdout_id:str, ood_id:str, artifacts:tuple[str,...])`
- `ComparisonResultV1(accepted:bool, gain:float, reasons:tuple[str,...], metrics:dict)`
- `LearningExperimentProtocolV1(root:Path)`
- `run(request, evaluator, candidate_factory) -> ComparisonResultV1`

- [ ] **Step 1: Write the provenance and rejection tests**

```python
from core.nomega.learning_experiment_protocol_v1 import LearningExperimentProtocolV1

def test_protocol_rejects_missing_holdout_or_ood(tmp_path):
    p = LearningExperimentProtocolV1(tmp_path)
    decision = p.compare(
        baseline={"holdout": .70, "ood": .60},
        candidate={"holdout": .75, "ood": .61},
        quorum={"independent_runs": 2, "trajectory_hashes": 3, "seeds": (1,2,3), "holdout_id": "", "ood_id": "ood"},
    )
    assert decision.accepted is False
    assert "holdout_or_ood_identity" in decision.reasons
```

- [ ] **Step 2: Verify red**

```bash
python -m pytest tests/test_learning_experiment_protocol_v1.py -q
```
Expected: FAIL because the protocol does not exist.

- [ ] **Step 3: Implement `ExperimentRequestV1` and deterministic experiment IDs**

Hash the canonical JSON of bottleneck, hypothesis, intervention, baseline hash, dataset fingerprint, and seed tuple. Do not use wall-clock time in the identity.

- [ ] **Step 4: Implement evidence collection**

The evaluator callback returns metric dictionaries and artifact paths. The protocol computes artifact SHA-256, records random seeds, environment IDs, evaluator version, and dataset fingerprints in `runtime/experiments_v3.jsonl`.

- [ ] **Step 5: Implement comparison gates**

Require holdout gain, verified-rate non-regression, OOD non-regression, restart continuity, latency bound, memory bound, and independent-run quorum. Return all failed gate names in `reasons`.

- [ ] **Step 6: Extend ExperimentRegistryV2 without breaking its API**

Add `record_provenance(**metadata)` and `fingerprint_mapping(mapping)` helpers while preserving `record()` and `summary()`.

- [ ] **Step 7: Run protocol and registry tests**

```bash
python -m pytest tests/test_learning_experiment_protocol_v1.py tests/test_self_development_control_plane_1_9_7.py -q
```
Expected: PASS.

---

# Task 7: Add Continual Learning Controller With Anti-Interference Replay

**Files:**
- Create: `core/nomega/continual_learning_controller_v1.py`
- Create: `tests/test_continual_learning_controller_v1.py`
- Reference: `core/nomega/adaptive_experience_memory_v3.py`
- Reference: `core/nomega/replay_scheduler_v1.py`

**Interfaces:**
- `ReplayPartitionV1(name:str, immutable:bool, records:int, fingerprint:str)`
- `RetentionReportV1(before:dict, after:dict, forgetting:dict, restart_ok:bool)`
- `ContinualLearningControllerV1(root:Path, seed:int=...)`
- `build_partitions(...) -> dict[str, ReplayPartitionV1]`
- `select_replay(...) -> list[dict]`
- `measure_retention(before, after) -> RetentionReportV1`

- [ ] **Step 1: Write a harmful-replay regression test**

```python
from core.nomega.continual_learning_controller_v1 import ContinualLearningControllerV1

def test_continual_controller_preserves_anchors(tmp_path):
    c = ContinualLearningControllerV1(tmp_path, seed=41)
    records = [
        {"key":"anchor","family":"sum3","verified":True,"status":"validated","reward":.8,"confidence":.9},
        {"key":"harmful","family":"hard","verified":True,"status":"validated","reward":.99,"confidence":.99,"transfer_to_current":-0.9},
    ]
    chosen = c.select_replay(records, current_family="hard", anchor_keys={"anchor"}, max_items=1)
    assert chosen[0]["key"] == "anchor"
```

- [ ] **Step 2: Verify red**

```bash
python -m pytest tests/test_continual_learning_controller_v1.py -q
```
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement immutable partition tracking**

Build train, calibration, holdout, OOD, regression, and repair partitions from explicit record metadata. Holdout/OOD/regression fingerprints are frozen after first creation.

- [ ] **Step 4: Add transfer-aware replay scoring**

Combine the existing `TransferAwareReplaySchedulerV1` score with anchor priority and a hard negative-transfer quarantine. A replay item with `transfer_to_current < -0.2` cannot outrank an immutable anchor.

- [ ] **Step 5: Add retention measurement**

For each immutable family compute `forgetting = max(0, before_verified_rate - after_verified_rate)`. A restart test must reload the model/memory artifact and reproduce the post-training evaluation within the configured tolerance.

- [ ] **Step 6: Run continual-learning tests**

```bash
python -m pytest tests/test_continual_learning_controller_v1.py tests/test_replay_scheduler_and_evolution_diagnostics_1_9_8.py -q
```
Expected: PASS.

---

# Task 8: Add Metaproductivity and Evolutionary Lineage Metrics

**Files:**
- Create: `core/nomega/metaproductivity_v1.py`
- Create: `tests/test_metaproductivity_v1.py`
- Reference: `core/nomega/evolution_archive_v1.py`

**Interfaces:**
- `LineageRecordV1(candidate_hash:str, parent_hash:str|None, cycle_id:str, verified_gain:float, compute_cost:float, repair_success:bool, transfer_gain:float)`
- `MetaProductivityReportV1(descendant_yield:float, verified_gain_per_compute:float, repair_success_rate:float, transfer_gain:float, diversity:float, time_to_next_improvement:float)`
- `MetaproductivityTrackerV1(root:Path)`
- `record(...) -> str`
- `report(...) -> MetaProductivityReportV1`

- [ ] **Step 1: Write descendant-yield and diversity tests**

```python
from core.nomega.metaproductivity_v1 import MetaproductivityTrackerV1

def test_metaproductivity_rewards_productive_lineages(tmp_path):
    t = MetaproductivityTrackerV1(tmp_path)
    t.record(candidate_hash="a", parent_hash=None, cycle_id="c0", verified_gain=.0, compute_cost=1.0, repair_success=False, transfer_gain=0.0)
    t.record(candidate_hash="b", parent_hash="a", cycle_id="c1", verified_gain=.1, compute_cost=1.0, repair_success=True, transfer_gain=.05)
    t.record(candidate_hash="c", parent_hash="a", cycle_id="c2", verified_gain=.1, compute_cost=1.0, repair_success=False, transfer_gain=.02)
    report = t.report("a")
    assert report.descendant_yield > 0.0
    assert report.verified_gain_per_compute > 0.0
    assert report.diversity > 0.0
```

- [ ] **Step 2: Verify red**

```bash
python -m pytest tests/test_metaproductivity_v1.py -q
```
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement lineage persistence**

Write append-only JSONL records and compute family-independent metrics over descendants within a bounded window.

- [ ] **Step 4: Implement metaproductivity metrics**

Compute descendant yield, verified gain per compute unit, repair success rate, transfer gain, branch diversity using candidate hashes, and time-to-next-improvement from cycle timestamps.

- [ ] **Step 5: Integrate metric capture with experiment provenance**

Expose `metaproductivity` in the evaluation bundle so promotion can record whether an intervention merely improved the current task or also created productive descendants.

- [ ] **Step 6: Run focused tests**

```bash
python -m pytest tests/test_metaproductivity_v1.py tests/test_self_development_control_plane_1_9_7.py -q
```
Expected: PASS.

---

# Task 9: Implement the Integrated Self-Improvement Loop

**Files:**
- Create: `core/nomega/self_improvement_loop_v1.py`
- Create: `tests/test_self_improvement_loop_v1.py`
- Reference: Tasks 2–8 modules
- Reference: `core/nomega/self_evolution_control_plane_v2.py`
- Reference: `core/nomega/developmental_bottleneck_detector_v1.py`

**Interfaces:**
- `SelfImprovementCycleV1(bottleneck:str, hypothesis:str, intervention:str, experiment_id:str)`
- `SelfImprovementResultV1(accepted:bool, gain:float, bottleneck:str, experiment_id:str, decision:str, evidence:dict)`
- `SelfImprovementLoopV1(root:Path, seed:int=...)`
- `run_cycle(metrics:dict, candidate_factory, evaluator) -> SelfImprovementResultV1`

- [ ] **Step 1: Write the end-to-end rejection test**

```python
from core.nomega.self_improvement_loop_v1 import SelfImprovementLoopV1

def test_self_improvement_loop_rejects_training_gain_without_ood_gain(tmp_path):
    loop = SelfImprovementLoopV1(tmp_path, seed=51)
    def evaluator(candidate):
        return {"holdout": .8, "ood": .40, "verified_rate": .90, "latency_ms": 10.0, "memory_mb": 10.0, "restart_delta": 0.0}
    result = loop.run_cycle(
        metrics={"raw_neural_verified_rate": .4, "repair_verified_rate": .5, "ood_coverage": .3},
        candidate_factory=lambda request: {"candidate":"x"},
        evaluator=evaluator,
    )
    assert result.accepted is False
    assert "ood" in result.decision
```

- [ ] **Step 2: Verify red**

```bash
python -m pytest tests/test_self_improvement_loop_v1.py -q
```
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Connect bottleneck detector to experiment creation**

Select `primary` from `DevelopmentalBottleneckDetectorV1.analyze(metrics)` and derive a deterministic intervention hypothesis from its action string. Do not invent a new intervention when the detector already reports one.

- [ ] **Step 4: Run candidate generation and evidence collection in isolation**

The loop must create a baseline snapshot before candidate generation and an independent candidate snapshot after generation. Candidate code or models remain isolated artifacts until promotion.

- [ ] **Step 5: Run comparison and promotion gates**

Pass the snapshots through `LearningExperimentProtocolV1`, then through `SelfEvolutionControlPlaneV2`. Promotion occurs only when both the experiment evidence quorum and the control-plane gates pass.

- [ ] **Step 6: Persist cycle lineage and metaproductivity**

Record the cycle, parent/candidate hashes, evidence paths, decision, and metaproductivity report under `runtime/self_improvement_cycles_v1.jsonl`.

- [ ] **Step 7: Add rollback test**

Create a regression where candidate acceptance is forced false after artifact creation and assert that the baseline file hash remains unchanged.

- [ ] **Step 8: Run integrated tests**

```bash
python -m pytest tests/test_self_improvement_loop_v1.py tests/test_self_development_control_plane_1_9_7.py tests/test_replay_scheduler_and_evolution_diagnostics_1_9_8.py -q
```
Expected: PASS.

---

# Task 10: Make Neurality Causally Measurable

**Files:**
- Create: `core/nomega/neural_causality_benchmark_v1.py`
- Create: `tests/test_neural_causality_benchmark_v1.py`
- Modify: `core/nomega/neural_execution_learning_lab_v1.py`
- Reference: `core/nomega/neural_program_trainer_v5.py`

**Interfaces:**
- `NeuralAblationReportV1(baseline:dict, neural:dict, frozen:dict, delta:dict, causal:bool)`
- `NeuralCausalityBenchmarkV1(root:Path, seed:int=...)`
- `run_ablation(families, trainer_factory, evaluator) -> NeuralAblationReportV1`
- `milestone(report) -> str` returning one of `N0`, `N1`, `N2`, `N3`, `N4`, `N5`.

- [ ] **Step 1: Write the N1 causal-ablation test**

```python
from core.nomega.neural_causality_benchmark_v1 import NeuralCausalityBenchmarkV1

def test_neural_ablation_marks_causal_when_decisions_change(tmp_path):
    b = NeuralCausalityBenchmarkV1(tmp_path, seed=61)
    report = b.compare(
        baseline={"verified_rate": .40},
        neural={"verified_rate": .60},
        frozen={"verified_rate": .41},
    )
    assert report.causal is True
    assert report.delta["neural_vs_frozen"] > 0.0
```

- [ ] **Step 2: Verify red**

```bash
python -m pytest tests/test_neural_causality_benchmark_v1.py -q
```
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement controlled ablation accounting**

The benchmark must compare active neural, frozen-neural, and baseline configurations on the same task IDs, same seeds, same verifier, and same resource budget. Causality requires an intervention-induced change beyond the configured tolerance, not merely a nonzero score.

- [ ] **Step 4: Define the evidence ladder**

Implement exact milestone logic:
- `N0`: trainable neural module exists and executes.
- `N1`: active-vs-frozen intervention changes decisions.
- `N2`: training improves held-out verified behavior over frozen baseline.
- `N3`: online adaptation improves unseen tasks without direct task leakage.
- `N4`: neural subsystem selects informative data/budget choices with measured efficiency gain.
- `N5`: repeated autonomous cycles produce accepted reproducible improvements with rollback on regressions.

- [ ] **Step 5: Add experiment integration**

Extend `NeuralExecutionLearningLabV1` report output with `neural_causality`, `milestone`, `train_partition_fingerprint`, `holdout_partition_fingerprint`, `ood_partition_fingerprint`, and `restart_verified`.

- [ ] **Step 6: Run neural causality and existing lab tests**

```bash
python -m pytest tests/test_neural_causality_benchmark_v1.py tests/test_neural_execution_learning_lab_v1.py tests/test_neural_program_trainer_v5.py -q
```
Expected: PASS.

---

# Task 11: Connect Neural Learning to the Closed-Loop Controller

**Files:**
- Modify: `core/nomega/neural_execution_learning_lab_v1.py`
- Modify: `core/nomega/developmental_bottleneck_detector_v1.py`
- Create: `tests/test_neural_closed_loop_integration_v1.py`
- Reference: Tasks 5, 6, 7, 9, 10

**Interfaces:**
- `NeuralExecutionLearningLabV1.run(...)` returns a report containing `experiment_id`, `evidence_bundle`, `partitions`, `causality`, `metaproductivity`, and `promotion_decision` fields in addition to the existing fields.

- [ ] **Step 1: Write an integration test that proves bottleneck-directed sampling**

```python
from core.nomega.neural_execution_learning_lab_v1 import NeuralExecutionLearningLabV1

def test_neural_lab_targets_primary_bottleneck(tmp_path):
    report = NeuralExecutionLearningLabV1(tmp_path, seed=71).run(
        ["sum3"], hidden=24, epochs=2, preference_epochs=1,
    )
    assert report.version == "neural-execution-learning-lab-v2"
    assert report.experiment_id
    assert report.primary_bottleneck
    assert report.partitions["holdout"] >= 1
```

- [ ] **Step 2: Verify red**

```bash
python -m pytest tests/test_neural_closed_loop_integration_v1.py -q
```
Expected: FAIL against the current V1 report shape.

- [ ] **Step 3: Expand the report schema compatibly**

Keep every existing `LearningLabReportV1` field and add the new evidence fields. Do not rename existing JSON keys used by earlier tooling.

- [ ] **Step 4: Route learning rows through the continual-learning controller**

Use the adaptive replay selection only for research-mode training rows. Immutable holdout/OOD/regression rows are never sampled into training.

- [ ] **Step 5: Route forged environments through the experiment protocol**

Every forged environment batch receives a fingerprint, partition identity, oracle hash, and difficulty summary before it can influence promotion.

- [ ] **Step 6: Run integration plus all neural lab regressions**

```bash
python -m pytest tests/test_neural_closed_loop_integration_v1.py tests/test_neural_execution_learning_lab_v1.py tests/test_verifiable_environment_forge_v1.py tests/test_partial_program_value_v1.py -q
```
Expected: PASS.

---

# Task 12: Create the 1.24 End-to-End Benchmark and Release Gate

**Files:**
- Create: `tools/benchmark_1_24_adaptive_learning.py`
- Create: `tests/test_benchmark_1_24_adaptive_learning.py`
- Modify: `docs/releases/1_24_0/NOMEGA_1.24.0_UPGRADE_REPORT.md`
- Modify: `README.md`

**Interfaces:**
- CLI `python tools/benchmark_1_24_adaptive_learning.py --families sum3 xor3 --seed 2401`
- Produces `runtime/benchmark_1_24_adaptive_learning.json`.
- Report contains baseline/candidate, N-level, holdout/OOD/retention, search cost, repair rate, metaproductivity, promotion decision, and exact artifact hashes.

- [ ] **Step 1: Write CLI smoke test**

```python
import json
import subprocess
import sys
from pathlib import Path

def test_benchmark_124_emits_machine_readable_report(tmp_path):
    script = Path("tools/benchmark_1_24_adaptive_learning.py")
    out = subprocess.run([sys.executable, str(script), "--root", str(tmp_path), "--families", "sum3", "--seed", "2401"], capture_output=True, text=True)
    assert out.returncode == 0
    report = json.loads((tmp_path / "runtime" / "benchmark_1_24_adaptive_learning.json").read_text())
    assert report["version"] == "1.24.0-dev"
    assert "promotion" in report
    assert "neural_milestone" in report
```

- [ ] **Step 2: Verify red**

```bash
python -m pytest tests/test_benchmark_1_24_adaptive_learning.py -q
```
Expected: FAIL because the benchmark script does not yet exist.

- [ ] **Step 3: Implement benchmark orchestration**

Measure the same candidate population with and without V2 value guidance; execute repair-only and integrated modes; run at least three seeds for promotion evidence; preserve the small-data regime as a diagnostic instead of forcing value guidance on.

- [ ] **Step 4: Add regression checks**

Require the full project test suite, the stale-version fix, neural milestone report, immutable partition identities, and a clean promotion decision record.

- [ ] **Step 5: Update the 1.24 report**

Document measured deltas, not aspirations. Explicitly distinguish completed engineering gates from capability measurements.

- [ ] **Step 6: Run the release benchmark**

```bash
python tools/benchmark_1_24_adaptive_learning.py --families sum3 xor3 --seed 2401
python -m pytest -q
```
Expected: benchmark command exit 0. The suite must be 0 failures before a successful release claim.

---

# Task 13: Package the Updated Archive and Integrity Manifest

**Files:**
- Create: `NOMEGA_1.24.0_DEV_REAL_UPGRADE.zip`
- Create: `NOMEGA_1.24.0_DEV_REAL_UPGRADE.sha256`
- Include: source, tests, docs, runtime experiment reports, benchmark output, and this plan/spec/release report.

- [ ] **Step 1: Verify release tree contains no Python cache artifacts**

Run:
```bash
find . -type d -name __pycache__ -prune -print
```
Remove only generated caches from the package copy; do not remove project source.

- [ ] **Step 2: Run the final suite from a clean extracted copy**

Extract the generated ZIP into a fresh directory and run:
```bash
python -m pytest -q
```
This is the actual release verification, not the source-tree result.

- [ ] **Step 3: Compute SHA-256**

```bash
sha256sum NOMEGA_1.24.0_DEV_REAL_UPGRADE.zip > NOMEGA_1.24.0_DEV_REAL_UPGRADE.sha256
```

- [ ] **Step 4: Verify archive integrity**

```bash
sha256sum -c NOMEGA_1.24.0_DEV_REAL_UPGRADE.sha256
unzip -t NOMEGA_1.24.0_DEV_REAL_UPGRADE.zip
```
Expected: both commands exit 0.

---

# Task 14: Write the 1.25–1.30 Neural Self-Improvement Roadmap Into the Release

**Files:**
- Create: `docs/roadmaps/NOMEGA_1.25_1.30_NEURAL_SELF_IMPROVEMENT_ROADMAP.md`
- Modify: `docs/releases/1_24_0/NOMEGA_1.24.0_UPGRADE_REPORT.md`

- [ ] **Step 1: Specify 1.25 Neural Causality & Credit Assignment**

The implementation target is execution-grounded credit assignment, multi-head value/uncertainty, token/operation-level attribution, controlled ablation, and verified policy improvement.

- [ ] **Step 2: Specify 1.26 Online Continual Learning**

The target is uncertainty-triggered replay, adaptive sample selection, anti-forgetting constraints, frozen evaluation partitions, and automatic rollback. The roadmap must explicitly document that replay alone is not guaranteed to prevent forgetting and may be harmful when sample/task relationships are unfavorable.

- [ ] **Step 3: Specify 1.27 Neural Self-Optimization**

The target is a learnable controller for data mix, curriculum difficulty, exploration budget, inference batching, and model routing under measured quality/compute objectives.

- [ ] **Step 4: Specify 1.28 Autonomous Repair Learning**

Train a neural repair policy on verified failure→counterexample→repair trajectories with explicit stop/backtrack actions and independent verification.

- [ ] **Step 5: Specify 1.29 Open-Ended Controlled Capability Evolution**

Maintain branching self-improvement lineages, metaproductivity scoring, diverse archive selection, sandboxing, and promotion gates.

- [ ] **Step 6: Specify 1.30 Integrated Self-Development**

Make the closed loop repeatable across multiple cycles: bottleneck discovery → targeted environment → neural learning/repair → independent evaluation → promotion/rollback → archive → next bottleneck.

---

# Verification Matrix

After implementation, verify every task with fresh commands and record exact outputs in the release report.

| Gate | Evidence | Release condition |
|---|---|---|
| Version consistency | version test + full suite | 0 stale-version failures |
| Execution evidence | V2 tests | deterministic fingerprints |
| Value V2 | fit/predict/break-even tests | bounded outputs + measured gate |
| Repair | repair + counterexample tests | independent verifier path |
| Forge V2 | partition/novelty tests | immutable holdout/OOD |
| Experiment protocol | provenance/gate tests | reproducible decision object |
| Continual learning | retention/replay tests | anchors preserved |
| Metaproductivity | lineage tests | descendant metrics persisted |
| Integrated loop | end-to-end tests | rejection + rollback proven |
| Neural causality | ablation tests | explicit N milestone |
| Release benchmark | CLI + full suite | exit 0 |
| Archive | checksum + unzip -t | exit 0 |

# Explicit Research-to-Implementation Mapping

1. **AlphaEvolve:** preserve a program archive, multiple proposal pathways, automated evaluators, and evolutionary selection rather than single-shot self-editing. urlAlphaEvolve research overviewhttps://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/
2. **Darwin Gödel Machine:** keep sandboxed branching self-modification and empirical validation, but keep canonical promotion evidence-gated rather than permitting unrestricted runtime self-mutation. https://arxiv.org/abs/2505.22954
3. **Huxley-Gödel Machine:** measure descendant productivity, not just immediate benchmark score. https://arxiv.org/abs/2510.21614
4. **EvoEnv / environment synthesis:** make environments reusable executable objects with independent oracle verification, solver-relative difficulty, staged validation, and novelty checks. https://arxiv.org/abs/2605.14392
5. **Agent-World:** connect capability-gap detection with targeted environment generation and repeated learning cycles. https://arxiv.org/abs/2604.18292
6. **Continual-learning evidence:** keep replay adaptive and measured because replay can help or harm forgetting depending on sample/task relationships; retain immutable anchors and explicit retention evaluation. https://arxiv.org/abs/2506.04377
7. **SBCO-style verifier-grounded harness optimization:** treat parts of the self-improvement harness itself as optimizable under verifier feedback rather than assuming self-reference is always required. https://arxiv.org/abs/2608.10157

# Definition of “100%” for the Roadmap

100% means all explicitly defined engineering gates for the current release are implemented, tested, reproducible, and promoted only when evidence thresholds are met. It does **not** mean that a system has reached a universal ceiling of intelligence, consciousness, or generality.

The neurality ladder remains:

- **N0:** neural component exists.
- **N1:** neural intervention changes system decisions.
- **N2:** neural training improves held-out verified behavior.
- **N3:** online adaptation improves unseen tasks without leakage.
- **N4:** neural subsystem improves learning/search efficiency itself.
- **N5:** repeated autonomous improvement cycles yield reproducible verified gains with rollback and lineage.

# Self-Review

- [x] The plan contains no unresolved placeholders; every implementation step specifies an exact action, interface, file, or verification command.
- [x] Every planned new production component has an explicit file path and test file.
- [x] Interfaces are named before later tasks consume them.
- [x] Existing V1 components remain backward-compatible unless explicitly extended.
- [x] Version drift is handled as the first task.
- [x] Small-data value-model overhead remains a measured gate, not a forced runtime decision.
- [x] Promotion uses independent evidence, holdout/OOD, resource, restart, and provenance checks.
- [x] The plan covers execution evidence, value, repair, forge, continual learning, metaproductivity, integration, neural causality, benchmarking, packaging, and 1.25–1.30 roadmap work.
- [x] The plan does not claim that code completion alone proves consciousness or unrestricted general intelligence.
