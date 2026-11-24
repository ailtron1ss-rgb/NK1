# V88 Changelog

## 2026-09-24 — Sparse Model-Aware Utility Cache

- added bounded per-slot utility refresh controller;
- sparse probe cadence with cache hits;
- stale/new-slot refresh logic;
- gradient-norm spike early refresh;
- probe candidate ranking by staleness/priority/uncertainty;
- no new trainable parameters;
- checkpoint state for V88 scheduler;
- current-frontier gate: 19/19 V86–V88 tests PASS;
- 3-seed matched V87 vs V88: wall-clock −3.21% mean; V88 refresh events 3/run vs V87 6/run;
- task-level superiority intentionally NOT claimed.
