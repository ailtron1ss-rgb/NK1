# CleanRL — evaluation protocol intake

- Upstream: https://github.com/vwxyzjn/cleanrl
- Inspected: repository `LICENSE`; repository-level approach to compact, reproducible RL experiments and evaluation.
- License: MIT; notice retained.
- Adaptation: a small native TypeScript-runtime-compatible benchmark compares no replay, task-balanced replay, and prioritized replay on the same five deterministic task-order seeds; reports mean and standard deviation of held-out task mean absolute error.
- No CleanRL Python/PyTorch implementation was copied. This is a methodology adaptation, not algorithm parity or an external benchmark score.
- The experiment is synthetic and intentionally small; it validates measurement plumbing and enables a fair internal comparison, but does not prove real-world learning improvement.
