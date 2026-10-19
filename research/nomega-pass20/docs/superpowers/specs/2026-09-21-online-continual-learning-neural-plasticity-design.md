# NΩ 1.26 — Online Continual Learning & Neural Plasticity Design

Date: 2026-09-21
Baseline: NOMEGA 1.25.0-dev
Status: design review required before implementation

## 1. Intent and success criteria

NΩ 1.26 will turn the current replay/controller scaffolding into an externally measured online continual-learning system. The objective is not merely to add a replay buffer. The objective is to establish a reproducible neural adaptation loop that can acquire a new family while preserving verified prior behavior, detect harmful interference, measure loss of plasticity, survive process restart, and rollback an update as one transaction.

Success requires all of the following to be implemented and measured:

1. immutable holdout/OOD/regression identities;
2. stream-shift and novelty detection;
3. uncertainty-aware and interference-aware replay selection;
4. constrained adaptation with behavioral anchors;
5. plasticity diagnostics against a fresh-initialized control;
6. restart-equivalence verification;
7. transactional rollback;
8. multi-seed sequential benchmark;
9. explicit gates for retention, new-task gain, transfer, and efficiency.

NΩ 1.26 does not promote a strategy merely because training reward increases.

## 2. Approaches considered

### A — Replay-first stabilization
Keep the current trainer, improve replay ranking, protect immutable anchors and add rollback.

Pros: lowest architectural risk and fastest measurable retention improvement.

Cons: does not directly measure whether the neural substrate is losing the ability to learn new tasks.

### B — Parameter/behavior stability first
Add functional behavioral anchors and parameter-drift constraints, then layer replay around those constraints.

Pros: directly controls destructive model drift.

Cons: can over-stabilize the model and reduce plasticity; without replay and fresh-init controls the system can preserve old behavior while becoming unable to learn.

### C — Integrated online continual-learning loop (recommended)
Combine immutable partition enforcement, shift detection, uncertainty/interference/diversity-aware replay, functional anchor loss, plasticity monitoring, fresh-init control, transactional snapshots and rollback into one experiment protocol. Every online update runs under equalized optimizer/computation budget against a baseline control.

Pros: directly measures the stability/plasticity trade-off, supports the later self-optimization controller, and creates the missing evidence for NΩ's N2→N3 transition.

Cons: more instrumentation and more expensive benchmarks; this is intentional because the project goal requires evidence rather than proxy scores.

## 3. Architecture

```text
                  ┌──────────────────────────────┐
stream event ───> │ Stream / Shift Detector     │
                  └──────────────┬───────────────┘
                                 ↓
                  ┌──────────────────────────────┐
                  │ Uncertainty + Novelty Gate  │
                  └──────────────┬───────────────┘
                                 ↓
       ┌─────────────────────────┴────────────────────────┐
       ↓                                                  ↓
replay candidates                                  fresh-control branch
       ↓                                                  ↓
┌──────────────────────┐                      ┌────────────────────────┐
│ interference scorer  │                      │ same budget / init     │
│ diversity selector   │                      │ same new-task stream   │
│ anchor protection    │                      └───────────┬────────────┘
└──────────┬───────────┘                                  │
           ↓                                               │
    constrained update                                    │
           ↓                                               │
┌─────────────────────────────────────────────────────────────────┐
│ Retention + plasticity + transfer + OOD + efficiency evaluator  │
└───────────────────────────────┬─────────────────────────────────┘
                                ↓
                    ┌────────────────────────┐
                    │ Promotion / Rollback   │
                    └───────────┬────────────┘
                                ↓
              immutable evidence + restart check
```

## 4. Data and partition contract

Create `ReplayPartitionRegistryV2`.

Inputs are immutable records with fields:

`key, family, partition, payload_fingerprint, semantic_fingerprint, source_id, created_at`.

Rules:

- `holdout`, `ood`, and `regression` become append-only immutable sets;
- a later build with a changed fingerprint for an existing immutable partition is rejected, never silently accepted;
- train/replay data may evolve but gets a generation ID;
- every benchmark references exact partition IDs and fingerprints;
- the registry persists enough information to verify the same partitions after process restart.

## 5. Stream shift and novelty

Create `OnlineStreamMonitorV1`.

The monitor records:

`phase_id, family, sample_count, uncertainty_mean, uncertainty_p95, reward_mean, embedding_or_feature_shift, semantic_shift, novelty_score`.

A shift event can request one of four modes:

- `NO_UPDATE` — familiar distribution and no meaningful uncertainty;
- `MICRO_UPDATE` — mild uncertainty increase;
- `ADAPT` — persistent novelty/shift;
- `QUARANTINE` — evidence is insufficient or regression risk is high.

The mode is recorded before any optimizer step. It is not inferred after the result.

## 6. Replay policy V2

Create `ContinualReplayPolicyV2` on top of the existing transfer-aware scheduler.

The score must combine:

`anchor + uncertainty + expected interference reduction + diversity + positive transfer + recency + verified reward - negative transfer risk`.

The policy must enforce:

- per-family cap;
- anchor quota;
- minimum semantic diversity;
- uncertainty floor/ceiling;
- negative-transfer veto for strongly harmful source→target pairs;
- bounded total compute.

The policy must log the complete reason for every selected sample.

## 7. Interference measurement

Create `NeuralInterferenceMonitorV1`.

For a proposed online batch:

1. compute per-example gradient vectors or a memory-safe projection of them;
2. measure pairwise cosine conflict against the protected replay anchors;
3. estimate expected loss delta on anchor samples before the optimizer update;
4. optionally perform exact post-update anchor evaluation for the accepted batch.

The monitor returns:

`mean_alignment, conflict_rate, worst_conflict, expected_anchor_delta, measured_anchor_delta`.

Gradient diagnostics are evidence only; promotion depends on externally evaluated behavior.

## 8. Plasticity monitor

Create `NeuralPlasticityMonitorV1`.

For every stream phase measure:

- new-task verified gain;
- old-task verified retention;
- gradient norm distribution;
- parameter update norm;
- activation occupancy/sparsity summary;
- training-to-generalization gap;
- fresh-initialized control gain;
- adaptation efficiency per optimizer step.

Define:

`plasticity_gap = fresh_control_gain - incumbent_gain`.

Positive gap means the incumbent is learning less effectively than a fresh model under equal budget. This becomes a diagnostic, not an automatic failure, because a mature model may still be more data/compute efficient overall.

## 9. Functional anchor regularization

Add an optional `behavior_anchor_loss` to the neural trainer.

For immutable replay anchors, the incumbent model stores frozen teacher logits from the pre-update checkpoint. During adaptation the loss is:

`task_loss + lambda_anchor * masked_KL(current_logits, frozen_logits)`.

The anchor loss is applied only to verified protected rows and can be disabled for a controlled baseline run.

The release benchmark compares:

`naive`, `replay`, `replay + anchor`, and `replay + anchor + interference gate`.

No global winner is assumed.

## 10. Transactional online update

Create `OnlineAdaptationTransactionV1`.

Before updating, save:

- model weights;
- optimizer state;
- replay policy state;
- partition generation/fingerprints;
- pre-update metrics;
- random seeds;
- code/version fingerprint.

After updating, run retention/new-task/OOD/efficiency evaluation.

Commit only when all release thresholds are satisfied. Otherwise restore every saved state and record a `ROLLBACK` artifact.

## 11. Restart equivalence

Create `RestartEquivalenceVerifierV1`.

The verifier must:

1. capture a checkpoint and evaluation bundle;
2. terminate the live trainer state;
3. reload model/optimizer/replay/partition registry;
4. re-run the same evaluation bundle;
5. compare outputs and metrics with explicit tolerances;
6. reject promotion if the declared deterministic mode cannot reproduce the required evidence.

The existing `restart_ok` boolean is replaced by an actual equivalence report.

## 12. Benchmark design

Primary sequential benchmark:

`sum3 → xor3 → mul2 → sub_offset`.

Controlled variants:

1. naive online update;
2. static replay;
3. adaptive replay;
4. adaptive replay + behavioral anchor;
5. adaptive replay + anchor + interference gate.

Requirements:

- minimum 3 independent seeds;
- fixed immutable holdout/OOD/regression partitions;
- equal optimizer steps and comparable inference budget;
- fresh-init control for every phase;
- final restart-equivalence check;
- report phase-by-phase retention and plasticity.

## 13. Promotion gates

An online update may be promoted only if:

- new-task verified gain >= configured minimum;
- protected-family retention is not below the configured tolerance;
- OOD regression is within tolerance;
- interference veto is not triggered;
- restart equivalence passes;
- compute budget is within the declared limit;
- result is reproducible on the required seed quorum.

The exact thresholds are parameters in the benchmark configuration, not hard-coded into the neural model.

## 14. Relationship to the NΩ neurality ladder

NΩ 1.26 targets the transition toward N3 evidence:

- N1 remains the 1.25 causal-intervention result;
- N2 requires positive held-out verified behavior from neural training;
- N3 requires online adaptation on unseen stream phases without direct leakage while preserving prior capabilities.

NΩ 1.26 must not mark N2/N3 complete unless the corresponding benchmark gates pass.

## 15. Files expected in implementation

Create:

- `core/nomega/replay_partition_registry_v2.py`
- `core/nomega/online_stream_monitor_v1.py`
- `core/nomega/neural_interference_monitor_v1.py`
- `core/nomega/neural_plasticity_monitor_v1.py`
- `core/nomega/continual_replay_policy_v2.py`
- `core/nomega/online_adaptation_transaction_v1.py`
- `core/nomega/restart_equivalence_verifier_v1.py`
- `tools/benchmark_1_26_online_continual.py`

Modify only through tested interfaces:

- `core/nomega/continual_learning_controller_v1.py`
- `core/nomega/neural_program_trainer_v3.py`
- `core/nomega/neural_execution_learning_lab_v1.py`
- `core/nomega/neural_self_optimization_controller_v1.py`

Tests:

- `tests/test_replay_partition_registry_v2.py`
- `tests/test_online_stream_monitor_v1.py`
- `tests/test_neural_interference_monitor_v1.py`
- `tests/test_neural_plasticity_monitor_v1.py`
- `tests/test_continual_replay_policy_v2.py`
- `tests/test_online_adaptation_transaction_v1.py`
- `tests/test_restart_equivalence_verifier_v1.py`
- `tests/test_benchmark_1_26_online_continual.py`

## 16. Non-goals

NΩ 1.26 does not attempt to make the neural substrate universally general, conscious, or self-modifying. It does not automatically rewrite the canonical runtime. It does not treat replay, regularization, or any individual strategy as universally superior without controlled evidence.

## 17. Open review questions

1. Keep the recommended integrated C architecture?
2. Keep functional anchor loss as research-controlled and promotion-gated rather than always on?
3. Use the four-family sequential benchmark above as the primary 1.26 gate?

Approval of this spec authorizes creation of the implementation plan; it does not authorize code implementation until the plan is reviewed and the execution method is confirmed.
