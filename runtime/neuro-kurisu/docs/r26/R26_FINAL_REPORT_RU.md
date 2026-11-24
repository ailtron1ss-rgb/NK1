# R26 — Hierarchical + Low-Rank + Causal Control

Application: `35.40.0`
Core: `100.32.0-r26-hierarchical-lowrank-causal`
State schema: `223`

## Реально интегрировано

### 1. Experience-constrained hierarchical planning
B262 теперь строит hierarchical rollout через префиксы, реально наблюдавшиеся в `episodes`, а затем оптимизирует оставшийся участок. Это предотвращает свободный high-level поиск по латентному action space, который может расходиться с low-level controller.

Matched benchmark: 32 samples; hierarchical regret `0.17`; flat regret `0.40`; regret uplift `0.575`; использовано `24` learned prefixes. Это внутренний engineering benchmark, не доказательство внешней обобщающей способности.

### 2. Diagonal + low-rank adaptive operator
R26 добавляет bounded low-rank correction рядом с diagonal curvature estimator и сохраняет snapshot/restore. Но matched convergence дало `0.13271556` для diagonal против `0.13273327` для low-rank, то есть `-0.00001771`. Поэтому low-rank correction **не включён в canonical runtime по умолчанию** и остаётся explicit experimental gate. Это принципиально: наличие механизма не считается доказанным улучшением.

### 3. Separate erase/write gates
Canonical B365 path работает через vectorized operator с независимыми erase/write gates. Matched gate ablation показывает, что gates действительно управляют downstream readout update path; write-only, erase-only и normal режимы сохраняются как воспроизводимые ablations. В R26 они не подменяют causal benchmark внешнего мира.

### 4. Mobile/runtime
1000-cycle endurance: slowdown `1.1808x`, p95 `94.18 ms`; operation evidence `165/165 verified`; mobile semantic equivalence PASS. `deviceCertified=false`: это не тест реального телефона.

### 5. Recurrent substrate
Bounded recurrent test: `512` updates, `reset=1`, saturation `0`, boundedness `1`. Recurrent lane остаётся promotion-gated и не заменяет canonical path без положительного matched evidence.

## Что не продвинуто

GPU/Triton KKT/WY, полноценный Mamba-3 SSD/MIMO и hardware-specific kernels не объявляются реализованными. Low-rank correction не promoted из-за отрицательного matched convergence result.

## Research basis

- Hierarchical Planning with Latent World Models — arXiv: `2604.03208`.
- Mind the Gap: Promises and Pitfalls of Hierarchical Planning in LeWorldModel — arXiv: `2607.12547`.
- Learning Multi-Timescale Abstractions for Hierarchical Combinatorial Planning — arXiv: `2605.17058`.
- Gated DeltaNet-2: Decoupling Erase and Write in Linear Attention — arXiv: `2605.22791`.
