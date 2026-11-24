# PASS 2855 — R7.3 Runtime-Owned Neural Projection / Long-Horizon Allocation Stability — 2026-09-24

## Goal
R7.3 removes a specific source of detached snapshot/GC amplification without weakening durable recovery semantics: `NeuralExperienceBranch` and B269 are runtime-owned neural states, while `persisted.system` is the checkpoint image. Their durable copies are therefore refreshed once at the checkpoint boundary instead of after every hot mutation.

## Implemented

### 1. NeuralExperienceBranch durable-projection deferral
- Removed five hot-path assignments that deep-snapshotted `NeuralExperienceBranch` into `persisted.system` during the decision/outcome/replay path.
- Added `lastExperiencePressureMean01()` for a scalar runtime read, eliminating a stale persisted-state read and avoiding an additional diagnostic/snapshot path.
- The durable checkpoint path snapshots the branch once immediately before `PersistenceProjectionCoordinator.sync(...)`.

### 2. B269 durable-projection deferral
- Removed hot-path persisted assignments after normal B269 step/outcome operations.
- Existing local B269 snapshots required for causal computation remain intact.
- The checkpoint path refreshes `persisted.system.spikingPlasticNeuralB269` exactly once before durable projection.

### 3. Recovery contract
- Added `tests/r7-3-neural-projection-deferral.mjs`: NEB snapshot count stays `0` across an observe-only interval and increases by exactly `1` at a forced durable checkpoint; B269 receives exactly one additional snapshot for the same checkpoint while retaining its legitimate local hot-path snapshots.
- Added `tests/r7-3-neural-projection-restart.mjs`: four runtime cycles are flushed to `FileStateStore`, a fresh organism is started from the same durable file, and neural branch tick/cycle/input state is identical after restore.
- No reduction of crash recovery durability is introduced: the current runtime state is copied into the checkpoint image before recovery certification, integrity checks, stamping, and `store.save()`.

### 4. Endurance harness
Added `tests/r7-3-performance-endurance.mjs` with configurable budgets and forced-GC samples. Default budgets are deliberately broad enough to avoid pretending that this container is a phone while still catching major regressions:
- mean cycle latency <= 180 ms;
- p95 <= 320 ms;
- maximum sampled post-GC heap <= 160 MB.

## Before / after evidence

### Hot-path A/B against the exact R7.2 archive
Identical 12-cycle mobile-profile workloads were run twice per tree.

| Metric | R7.2 run A | R7.2 run B | R7.3 run A | R7.3 run B | Observation |
|---|---:|---:|---:|---:|---|
| Mean cycle ms | 97.32 | 96.51 | 85.77 | 86.51 | lower on both candidate runs |
| p95 cycle ms | 110.22 | 142.48 | 100.85 | 116.91 | lower on both candidate runs |
| Heap used MB | 116.8 | 116.7 | 110.7 | 111.0 | lower on both candidate runs |

Across the paired means, R7.3 is about 11.1% lower in average cycle latency and about 5.1% lower in measured heap used. These are controlled container A/B measurements, not phone benchmarks.

### Durable FileStateStore A/B
Six cycles followed by a forced file-backed checkpoint produced nearly identical durable payload sizes:
- R7.2: `2,970,173` bytes; checkpoint `186 ms`.
- R7.3: `2,970,055` bytes; checkpoint `193 ms`.

This confirms that the deferral does not materially shrink or weaken the durable state image and does not by itself claim a faster checkpoint. The optimization target is hot-runtime allocation/GC, not durability throughput.

### Long-horizon performance endurance
Controlled mobile-profile runs with forced-GC samples:

| Horizon | Result | Mean | p95 | Max post-GC heap |
|---|---|---:|---:|---:|
| 80 | PASS | 96.0 ms | 157.7 ms | 73.5 MB |
| 120 | PASS | 107.0 ms | below 320 ms budget | 79.2 MB |
| 160 | PASS | 107.4 ms | 182.1 ms | 84.5 MB |
| 200 | PASS | 117.9 ms | 203.2 ms | 87.4 MB |
| 240 | NOT ESTABLISHED | timeout in aggregate harness run | — | — |

The post-GC heap rises gradually through 200 cycles rather than showing the earlier extreme retained/allocation trajectory. The 240-cycle horizon remains an explicit next stress target.

## Functional regression evidence
- `TYPECHECK=PASS mode=tsc`
- `test:r7:guards` = PASS
- R7.3 projection-deferral guard = PASS
- R7.3 restart guard = PASS
- R7.2 UTF-8 byte-accounting regression = PASS
- canonical action-policy unit/live = PASS
- policy authority ledger = PASS
- R3 unified latent world + restart = PASS
- R4 temporal-credit authority + integration = PASS
- R5 memory lifecycle authority = PASS
- P2855 contextual policy and organism integration = PASS
- P2855 isolated ablation remains previously measured at `0.2667` ON vs `0.1667` OFF (+0.10 absolute); the aggregate `npm run test:p2855:ablation` batch can exceed the container aggregate timeout when run after many heavy tests, so that batch timeout is not used as a PASS/FAIL substitute for the isolated result.

## Architectural interpretation
The change strengthens the separation between **live causal runtime state** and its **durable checkpoint image**. This is preferable to lowering neuron count, deleting replay evidence, shortening memory history, or bypassing self/agency mechanisms merely to make performance numbers look better.

## Important non-claims
R7.3 does not establish consciousness, subjective experience, human-level intelligence, or readiness for unrestricted autonomous operation on a phone. The endurance harness uses a controlled observation workload and is therefore a performance/evidence surface, not a full autonomy validation.

## Next target
The next performance pass should investigate the degradation between 200 and 240+ cycles, with allocation sampling around `B269`, `NeuralExperienceBranch`, cognitive-domain closure, replay/eligibility structures and checkpoint recovery. The next optimization should be retained only if it preserves R3-R6 causal evidence and restart semantics.
