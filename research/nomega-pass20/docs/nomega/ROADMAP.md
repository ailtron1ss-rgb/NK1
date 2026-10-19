# NΩ-Core roadmap

## Phase Ω0 — executable baseline
1. Freeze legacy Nullseed behavior.
2. Run NΩ smoke tests and record parameter/latency baseline.
3. Reconcile version metadata.

## Ω1 — trainable executive
1. Train router from Nullseed traces.
2. Add task difficulty and uncertainty targets.
3. Save/load router checkpoint.

## Ω2 — symbolic bridge
1. Add bounded HVM adapter.
2. Generate candidate programs through NeuralInvent.
3. Verify candidates through HVM execution.

## Ω3 — learned memory
1. Replace hashed baseline retrieval with a trainable compact encoder.
2. Distill successful episodes into program memory.
3. Learn retrieval utility.

## Ω4 — dynamic compute
1. Train early-exit / halting head.
2. Optimize quality per CPU/NPU budget.
3. Add hardware profiles for low / medium / high devices.

## Ω5 — mobile compression
1. BF16/FP16 where supported.
2. INT8 and mixed precision.
3. Structured pruning + distillation.
4. Benchmark peak RSS, cold-start time, latency and energy.

## Ω6 — research hypotheses
- learned neural/symbolic routing
- memory-to-program conversion
- verifier-guided generation
- recurrent + symbolic latent workspace
- search-policy compression

Each hypothesis must beat the fixed Ω0 baseline on a preregistered benchmark.
