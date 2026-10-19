# NeuroCore V126 — Consolidation Runtime + Decontaminated Current

Current frontier: **V126 / 1.26.0 / `v126-consolidation-runtime`**.

Current architecture remains one standalone causal trunk with one canonical recurrent associative owner. Sparse memory and plasticity/consolidation mechanisms are explicit candidates around that owner; historical engines remain outside current execution.

## Verification

- **95/95 current tests PASS**
- compileall: **PASS**
- verify_current: **PASS**
- checkpoint round-trip: **108/108**
- executable AST stub suspects: **0**
- inert enabled-config checks: **PASS**
- registry truthfulness: **PASS**
- recurrent owner count: **1**
- trainable parameters: **69 137**
- gradient coverage probe: **100% tensors / 100% elements**

## V126 changes

Fast→slow consolidation is now a real opt-in trainer path. Inert configurations are rejected. Sparse-memory writes use a functional sparse-delta update. Production and qualification share one canonical `read_only()` path. Version metadata uses one source-of-truth module. Stale V97 consolidation benchmark code is isolated in history.

## Evidence-based status

Consolidation, unified sparse memory and key fingerprint remain **candidate-only**. Current qualification proves execution/liveness, not task-level superiority. Sparse runtime also has no universal speedup claim; the flat-state representation remains a bottleneck for low-batch CPU execution.

## Next

**V127 — collision-resistant addressing, segmented sparse state, continual-learning qualification, and promotion gates.**
