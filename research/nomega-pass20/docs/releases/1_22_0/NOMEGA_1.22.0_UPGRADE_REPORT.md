# NΩ 1.22.0-dev — Real Upgrade Report

## Main engineering changes

1. Added independent execution tracing (`core/nomega/execution_trace_v1.py`).
2. Added verifiable dense reward (`core/nomega/verifiable_dense_reward_v1.py`).
3. Added contract-checked structural gating (`core/nomega/program_contract_v1.py`).
4. Added semantic-equivalence candidate pruning (`core/nomega/semantic_prune_v1.py`).
5. Integrated contract + pruning into counterexample search.
6. Repaired `NeuralProgramTrainerV3` so padding after HALT is excluded from token loss, removing an immediate-HALT training shortcut.
7. Added execution-grounded pairwise preference trainer and evidence-gated experiment runner.
8. Corrected `ProgramEquivalenceV2` to use the canonical v2 execution path and an independent HVM cross-check.
9. Version advanced to `1.22.0-dev` / `1.22.0.dev0`.

## Measured results

- New focused tests: PASS.
- Repair benchmark after contract/pruning: 4/5 improvement cases = 80% in the five-case bounded corpus.
- Masked-loss neural experiment: no held-out verified coverage gain was demonstrated, so the neural checkpoint was **not promoted**.
- The non-promotion is intentional: evidence gates reject changes without demonstrated improvement.

## Known limitations

- The neural model remains weak on the current small synthetic family set without deterministic repair.
- Full legacy regression remains slower than the preferred release gate.
- Semantic pruning is sampled behavioral equivalence, not formal proof.
- Dense reward is currently used as a research training signal, not as a correctness authority.
