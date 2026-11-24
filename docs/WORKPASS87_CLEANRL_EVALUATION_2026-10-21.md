# WorkPass87 — reproducible replay evaluation protocol (2026-10-21)

## Source
[CleanRL](https://github.com/vwxyzjn/cleanrl), MIT. The repository's reproducibility-oriented, compact RL experiment style was adapted as an evaluation protocol; no Python/PyTorch code was copied.

## Changes
- Added `tests/p26-replay-ablation-benchmark.mjs`: paired comparison of no replay, balanced replay, and prioritized replay across five deterministic task-order seeds.
- Reports per-strategy mean and population standard deviation of held-out task MAE, plus per-run max error and update counts.
- Injected an RNG into prioritized replay options so the sampler can be reproduced in the experiment.
- Added the benchmark to the P26 learning validation workflow.
- Preserved MIT license and source intake notes.

## Interpretation boundary
This is a small synthetic diagnostic, not a broad benchmark or proof of quality improvement. It should provide the first comparable numbers for the three strategies once CI executes. CI evidence: workflow run 39555037574 completed with failure, but the job returned no step summaries and the log endpoint returned `BlobNotFound`; the cause is unresolved. The benchmark has not been confirmed as executed. A result should only be considered meaningful after a successful visible run, a larger task suite, held-out tasks, and real verified feedback outcomes.
