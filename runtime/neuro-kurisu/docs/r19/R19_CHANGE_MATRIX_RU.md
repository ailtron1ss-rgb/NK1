# R18.1 → R19 — матрица изменений

| Surface | R18.1 | R19 | Реальный эффект |
|---|---|---|---|
| Memory conflict | implicit stale conflict, newest wins when signal high | provenance-aware arbitration | low-authority fresh evidence no longer blindly overwrites stronger evidence |
| Memory learning | adaptive weights | adaptive + anti-collapse projection | learning remains adaptive without single-feature domination |
| Decision trace | worldContextKey | worldContextKey + semantic hashes + invariants + outcome closure | operation-level replay/evidence becomes inspectable |
| Long horizon | 256-cycle baseline | 256-cycle R19 replay + restart | 1.54x first→last mean-time ratio; tick continuity after restart |
| Release metadata | 35.32.1/R18.1 | 35.33.0/R19 | current source, lock, manifest synchronized |
| Research | R18 memory/world sources | STALE + Memory Anchors + Adaptive Replay + Active Inference + All-Mem | explicit R20 experiments rather than speculative integration |

## Code footprint

R19 changes 18 existing files and adds 9 core/test/research/release files relative to the available R18.1 source snapshot used for this pass.

## Deliberate non-changes

- no second memory database;
- no external vector database dependency;
- no Mamba/SSM dependency in canonical runtime;
- no relaxation of mobile semantic equivalence tests;
- no claim of subjective consciousness.
