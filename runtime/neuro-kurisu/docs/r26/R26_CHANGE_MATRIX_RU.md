# R26 Change Matrix

| Область | Было R25 | Стало R26 | Evidence | Статус |
|---|---|---|---|---|
| Hierarchical planning | свободный 4+4 refinement | experience-constrained prefixes + fine planning | regret 0.17 vs 0.40 | promoted |
| Adaptive operator | diagonal curvature | diagonal + bounded low-rank experimental lane | 0.13271556 vs 0.13273327 | experimental |
| Canonical plasticity | scalar per-dim apply | vectorized operator path | R25 compatibility PASS | promoted |
| Erase/write | coupled heuristics | independently configurable gates | matched gate ablation PASS | promoted |
| Recurrent substrate | experimental | same promotion gate | saturation 0, bounded 1 | not promoted |
| Endurance | R25 1000-cycle | R26 vectorized 1000-cycle | slowdown 1.1808x, p95 94.18ms | PASS |
