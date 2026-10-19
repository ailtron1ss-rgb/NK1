# NΩ 1.28.0 — Autonomous Repair Learning + Structural Plasticity

## Scope

This release connects the verified causal-neural learning stack from 1.25, continual plasticity from 1.26, and equal-budget self-optimization from 1.27 into a controlled autonomous repair loop.

## New working components

- `NeuralRepairPolicyV1`: ensemble neural ranking of repair operators with uncertainty and abstention.
- `AutonomousRepairLearningLoopV1`: execution evidence → candidate ranking → independent verification → replay of repair outcomes.
- `StructuralPlasticityControllerV1`: bounded grow/prune proposals over substrate synapses with transactional rollback and external utility gate.
- `benchmark_1_28_autonomous_repair_multiseed.py`: 3-seed × 3-family evaluation with pre/post policy comparison and fresh-process restart checks.

## Measured evidence

- Policy fitting: 3/3 seeds, 24+ samples each, ensemble=3.
- Verified repair rate: 1.00 before policy learning and 1.00 after policy learning in the controlled benchmark.
- Mean first-verified candidate rank: 2.0556 → 1.1111.
- Restart equivalence: 3/3.
- Structural transactions: 0 promoted, 3 rolled back under the positive-gain external gate.

The structural branch is therefore a real mutation/rollback mechanism, but it is not yet a demonstrated performance improvement. It remains research-only.

## Neurality gate

N1 remains supported by the causal evidence from 1.25. N2–N5 are not promoted here because this release does not establish a new held-out verified capability gain in the main neural execution stack.

## Failure discipline

The release includes explicit provenance for oracle rows, a mandatory deterministic repair fallback, and external promotion gates. Neural predictions are never treated as proof of correctness.

## Final evidence ledger

- 3 seeds × 3 repair families, with pre/post learned-policy passes.
- Policy fit on every seed: `True`; restart equivalence: `True`.
- Verified repair rate: `1.0000` → `1.0000`.
- Mean first-verified candidate rank: `2.0556` → `1.1111`.
- Structural transactions: `0` commits and `3` rollbacks under the positive-gain gate.

The rank improvement is evidence that the learned repair policy can improve search ordering on this controlled benchmark while preserving verifier-level repair quality. It is not evidence of general repair capability outside the measured families.
