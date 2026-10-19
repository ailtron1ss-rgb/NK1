# V87 → V88 NEXT FRONTIER

## PASS 88 — Compute-aware replay utility + long-horizon qualification

### A. Уменьшить utility probe cost
- probe only newly stale candidates;
- cache per-slot error/utility;
- refresh on model-update-mass spikes;
- hard cap probe FLOPs/forward calls per optimizer step.

### B. Сделать utility частью приоритета
- bounded priority modulation from utility EMA;
- preserve V86 input/target coverage floor;
- test whether model-aware priority survives across many updates.

### C. Real continual-learning qualification
- 3–5 seeds;
- longer A→B→C→A→B→C;
- same observation distribution, no task-ID;
- adaptation, positive forgetting, BWT/FWT, recovery;
- fixed replay / V86 / V87.

### D. Memory lesion
- destroy fast transient state;
- retain only canonical replay;
- compare recovery and recombination;
- separate state recovery from semantic memory retention.

### E. Architecture gate
After V88 qualification, perform compute-matched V80 GRU vs V82 selective-delta. Only after that consider Mamba/DeltaNet-derived alternatives.
