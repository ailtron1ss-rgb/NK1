# V88 → V89 NEXT FRONTIER

## PASS 89 — Strong End-to-End Continual Qualification

### A. External task quality
- real `sklearn_digits` sequential streams;
- split/permute/rotate transformations;
- fixed target transforms with no task-ID input;
- learnability gate before forgetting interpretation.

### B. Replay strategy tournament
- current-only;
- fixed replay;
- V86 coverage-aware;
- V87 model-aware utility;
- V88 cached model-aware utility.

### C. Metrics
- final task quality;
- positive forgetting;
- adaptation rate;
- BWT/FWT;
- replay recovery;
- utility cache hit rate;
- probe compute;
- replay forward/backward compute;
- optimizer compute;
- wall-clock and RAM.

### D. Stress
- A→B→C→A→B→C;
- long phases;
- repeated reversal;
- rare-surprise insertions;
- replay starvation;
- capacity pressure;
- transient-state lesion + replay reconstruction.

### E. Architecture gate

После qualification — compute-matched:
1. V80 GRU;
2. V82 selective-delta;
3. compact alternative recurrence;
4. only then external Mamba-3 / linear-recurrent families.

No architecture promotion based on tiny synthetic recurrence cosine differences.
