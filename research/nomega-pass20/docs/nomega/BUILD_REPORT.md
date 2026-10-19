# NΩ-Core 0.1.0 build report

## Implemented in this build

- Shared `LatentState` contract.
- Small trainable `CognitiveRouter` with expert, difficulty, uncertainty, novelty and compute heads.
- Bootstrap routing priors for math/program tasks before learning.
- Adaptive reasoning depth.
- Recurrent latent workspace (`GRUCell`).
- Episodic/semantic/program-compatible persistent memory with hashed baseline retrieval.
- Explicit memory trust rule: retrieval cannot become a final answer without a verified-memory policy.
- Heuristic, memory, NeuralInvent and symbolic experts.
- Bounded HVM adapter for explicit programs.
- Safe structured verifier; no arbitrary Python evaluation.
- Text + vision + audio adapters feeding the same latent contract.
- Mobile hardware profiles and abstract compute budgets.
- Parameter/size reporting and optional dynamic INT8 deployment helper.
- Router training prototype from synthetic task-type traces.
- NΩ benchmark and CLI commands.
- Regression tests for routing, verification, persistence, anti-memory-hallucination, modalities and router training.

## Baseline measurements in this environment

- NΩ total parameters: ~189k float32 parameters (~0.72 MiB for raw parameters; optimizer/checkpoint overhead is additional).
- New NΩ tests: 7/7 passed.
- NΩ smoke benchmark: 3/5 structured arithmetic cases verified; open-ended tasks correctly abstain rather than fabricate.
- Example arithmetic latency on the test CPU: ~0.5–2 ms per simple symbolic case (environment dependent).
- Legacy `doctor`: PASS.

## Known limitation

The existing legacy stochastic benchmark has a repository-level contract mismatch: the current `external_bench.run_bench` returns `n=19` while `tests/test_ladder_contract.py` expects `n=5`. This build does not alter legacy benchmark semantics just to force a green test.

## Not yet claimed

This is not yet a trained general-purpose language model, vision-language model or AGI. The architecture is executable and extensible; the main foundation-model training stage is still ahead.
