# V126 ARCHIVE INDEX

## Current release

**V126 / 1.26.0 / `v126-consolidation-runtime`**

Current code is a single causal trunk with one canonical recurrent associative owner. Historical VXX implementations remain in history and are not instantiated by the current execution path.

## V126 real changes

- opt-in fast→slow consolidation is a real canonical trainer path;
- invalid inert consolidation configuration is rejected;
- sparse-memory write uses a functional sparse delta;
- production and qualification share the same sparse `read_only()` implementation;
- both current trainer modes share one post-optimizer controller path;
- version metadata has a single source of truth;
- anti-decoration audit includes executable-stub, inert-config, runtime-liveness, duplicate-owner and truthful-registry checks;
- stale V97 consolidation benchmark is isolated under `history/legacy_benchmarks`.

## Qualification

**95/95 current tests PASS** · compileall PASS · verify_current PASS · checkpoint 108/108 · decontamination PASS · executable stubs 0.

Evidence is stored under `evidence/`, with V126 release notes, research sources and next-frontier plan at the repository root.

## Next frontier

**V127 — Collision-Resistant Memory + Segmented Sparse Runtime + Continual-Learning Gate.**
