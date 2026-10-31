# CleanRL — evaluation protocol intake

- Upstream: https://github.com/vwxyzjn/cleanrl
- Inspected: repository `LICENSE`; repository-level approach to compact, reproducible RL experiments and evaluation.
- License: MIT; notice retained.
- Adaptation: a small native TypeScript-runtime-compatible benchmark compares no replay, task-balanced replay, and prioritized replay on the same five deterministic task-order seeds; reports mean and standard deviation of held-out task mean absolute error.
- No CleanRL Python/PyTorch implementation was copied. This is a methodology adaptation, not algorithm parity or an external benchmark score.
- The experiment is synthetic and intentionally small; it validates measurement plumbing and enables a fair internal comparison, but does not prove real-world learning improvement.


## License evidence clarification — 2026-10-31

The upstream repository-level [LICENSE](https://github.com/vwxyzjn/cleanrl/blob/master/LICENSE) is a composite file (approximately 15.9 KB) containing the root MIT notice followed by additional third-party, code-specific license notices. The local `LICENSE` in this intake directory (1,075 bytes) matches only the leading root MIT portion; it is not a complete copy of the upstream file. The intake scope records no CleanRL source code copied into NK1, only methodological/algorithmic adaptation. Therefore do not describe the entire upstream repository as single-license MIT, and do not treat the local file as a complete upstream license inventory. Human review must decide whether to retain this partial root notice or replace it with a complete, scope-appropriate notice. No redistribution approval is recorded here.
