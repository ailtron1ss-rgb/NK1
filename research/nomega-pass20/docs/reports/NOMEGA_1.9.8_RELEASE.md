# NΩ 1.9.8 — Transfer-Aware Multi-Timescale Replay + Evolution Diagnostics

## Release classification
**FACT/MEASURED release.** This release contains real code changes connected to the canonical execution-guided path. It does **not** claim a downstream neural-learning improvement where the paired experiment measured zero gain.

Parent: **1.9.7**

## Executive result
The main bottleneck after 1.9.7 was no longer candidate generation itself; it was deciding **which accumulated experience should be replayed and how to avoid harmful transfer**. NΩ 1.9.8 adds a bounded transfer-aware replay scheduler and an evolution-trace diagnostics layer, then validates both at component level and at the neural A/B level.

The component benchmark is positive. The small downstream neural A/B is neutral. Therefore the scheduler is integrated and usable but remains **not promoted as a proven neural-learning gain**.

## Real code changes
### Added
- `core/nomega/replay_scheduler_v1.py`
- `core/nomega/evolution_diagnostics_v1.py`
- `core/nomega/replay_ablation_v1.py`
- `tests/test_replay_scheduler_and_evolution_diagnostics_1_9_8.py`
- `tests/test_replay_ablation_1_9_8.py`
- `RESEARCH_NOTES_1_9.8.md`
- `NOMEGA_1.9.8_BUILD_MANIFEST.json`

### Modified canonical path
- `adaptive_experience_memory_v3.py`
  - optional transfer-aware replay API;
  - multi-timescale decision integration.
- `execution_guided_program_learning_v1.py`
  - replay mode selection;
  - replay mode surfaced in cycle evidence;
  - evolution diagnostics attached to verified repairs.
- `self_development_orchestrator_v1.py`
  - replay-interference action added to bottleneck planning.
- `developmental_bottleneck_detector_v1.py`
  - replay-interference metric.
- `core/nomega/__init__.py`
  - public exports.
- `NOMEGA_GOVERNANCE.json`
  - release lineage and lifecycle requirements updated to 1.9.8.

Dedicated new-code volume: approximately **366 LOC** across the three new core modules, plus integration/test/documentation changes.

## Architecture
### Replay path
`verified experience -> transfer matrix -> fast/medium/slow timescale -> anchor guard -> negative-transfer penalty -> per-family cap -> ranked replay decision -> persistent decision lineage`

### Evolution path
`failed program -> bounded mutation/search -> verified candidate -> parent/child trace -> edit-mechanism classification -> mechanism evidence`

The second path deliberately does not equate a benchmark gain with a novel algorithmic invention.

## Measured evidence
### Test inventory
- Python source files: **236**
- canonical `core/nomega` Python files: **171**
- test files: **31**
- collected tests: **175**

### New/core regression
- `32/32` selected new/core tests passed.
- `test_nomega_program.py`: **2/2** passed.
- `test_nomega_train.py`: **2/2** passed.
- `compileall`: **PASS**.
- governance: **PASS**, `0` canonical failures and `88` legacy warnings.

### Component replay benchmark
12 deterministic scenarios using identical candidate pools:
- adaptive better: **12/12**;
- static better: **0/12**;
- ties: **0/12**;
- mean transfer-utility delta: **+1.0**;
- anchor preservation: **12/12**.

Interpretation: **component-selection evidence only**, not downstream learning proof.

### Equal-compute neural A/B
Seed `19881`, identical architecture, memory bootstrap, epochs and holdout:
- static replay paired coverage delta: **0.0**;
- transfer-aware replay paired coverage delta: **0.0**;
- both restart deltas: **0.0**.

Promotion decision: **research-only**.

The correct conclusion is that the new scheduler improved the replay-selection objective in the controlled component benchmark, but the current neural training budget was not sufficient to demonstrate a causal end-to-end learning gain.

## Failure/technical-debt state
### Legacy silent exceptions
Governance still reports **88 legacy `except ...: pass` warnings** outside canonical `core/nomega`. They are explicitly tracked and are not declared repaired.

### Full suite
The entire 175-test suite can be collected successfully. Historical monolithic execution still exceeds the current execution window. This release therefore **does not claim 175/175 executed in one run**.

### Downstream replay gain
Not proven. Equal-compute A/B = 0.0/0.0.

## Engineering estimates — not intelligence scores
| Area | Estimate | Evidence basis |
|---|---:|---|
| Governance/evidence discipline | 94/100 | machine governance + lineage + explicit negative results |
| Execution-guided repair | 80/100 | verified repair loop + operator transfer evidence |
| Evolution search | 76/100 | bounded portfolio + archive + operator policy |
| Persistent procedural memory | 74/100 | verified storage/retrieval/quarantine/restart |
| Transfer-aware replay | 68/100 | component benchmark positive; downstream gain unproven |
| Developmental bottleneck detection | 64/100 | persistent bottleneck history + replay interference metric |
| Self-development orchestration | 59/100 | planning/control plane is integrated but still bounded |
| Pure neural grounding | 34/100 | major OOD/causal bottleneck remains |
| OOD generalization | 56/100 | TaskSpec + execution-guided OOD infrastructure; uneven neural results |
| Metacognition/self-model | 38/100 | statistics/evidence exist; causal self-model incomplete |
| World model | 30/100 | infrastructure exists; downstream action utility insufficiently proven |
| Mobile readiness | 45/100 | benchmark harness exists; real target-phone measurement still pending |
| Architecture coherence | 57/100 | canonical path improved; historical duplication remains |
| Overall engineering maturity | **61/100** | project-level estimate, not intelligence |

## Work completion
### This 1.9.8 release scope
**100% of planned code scope implemented and tested at the selected regression level.**

### Overall project objective
**Estimated 58–62% engineering maturity**, because the central requirement — persistent, self-directed, causal improvement on unseen tasks — remains only partially demonstrated.

### Code work in this cycle
- 3 new canonical core modules;
- 5 existing canonical modules integrated/extended;
- 2 new test files;
- governance, manifest, research and evidence updates;
- ~366 LOC in dedicated new core code, excluding modified existing files.

## Next high-value development frontier
### 1. Model-time replay
Track optimizer-update magnitude and schedule replay from model evolution rather than raw step count.

### 2. Transfer-aware unlearning
Add local memory removal/quarantine when the same memory repeatedly harms a target family.

### 3. Downstream multi-seed replay experiment
Run static vs transfer-aware vs model-time replay under equal compute with at least 3 seeds and locked holdout.

### 4. Mechanism-level evolutionary evaluation
Use evolution diagnostics to determine whether gains come from structural novelty, recombination, retuning or reintroduction.

### 5. Causal self-model
Connect:
`capability -> failure -> cause -> intervention -> result -> policy update`.

### 6. Mobile runtime
Move from host measurement to real Android/Termux device traces: p50/p95 latency, RSS/PSS, cold start, thermal state and energy proxy.

### 7. World-model action utility
Judge world-model changes only by downstream planning/recovery/data-selection gains.
