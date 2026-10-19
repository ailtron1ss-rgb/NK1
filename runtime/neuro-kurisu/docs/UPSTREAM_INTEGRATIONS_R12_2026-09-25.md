# R12 upstream integrations — 2026-09-25

This pass intentionally integrates small, self-contained algorithmic ideas from permissively licensed upstream projects instead of adding new third-party runtime dependencies.

## Integrated directly as standalone TypeScript implementations

### Avalanche / ContinualAI — MIT
Upstream: https://github.com/ContinualAI/avalanche
Reference implementation: `avalanche/training/storage_policy.py`
Integrated into: `src/organism/system/UpstreamReplayPrimitives.ts`

- reservoir sampling for bounded replay;
- balanced exemplar capacity over observed groups.

Neuro-Kurisu specialization: groups are action/task keys and the mobile capacity remains bounded. The project does not vendor Avalanche code.

### Tianshou — MIT
Upstream: https://github.com/thu-ml/tianshou
Reference: `tianshou/data/buffer/prio.py`
Integrated into: `src/organism/system/UpstreamReplayPrimitives.ts`

- prioritized replay with `p_i^alpha` weighting;
- importance-sampling correction;
- deterministic bounded mobile sampler instead of importing a segment-tree dependency.

### DreamerV3 — MIT
Upstream: https://github.com/danijar/dreamerv3
Reference: `dreamerv3/agent.py` and `embodied/jax/heads.py`
Integrated into:
- `src/organism/system/UpstreamReplayPrimitives.ts`
- `src/organism/cognition/B365UnifiedNeuroCausalCore.ts`
- `src/organism/cognition/NeuromodulatoryPlasticitySubstrate.ts`

- symlog / symexp robust scalar transform;
- percentile-style robust normalization for replay priority/teaching signals.

The full Dreamer implementation was not copied: this runtime remains TypeScript/Node/Termux-oriented and uses only the relevant algorithmic primitives.

## Research-derived implementation, not source copied

### Bayesian continual learning / MESU — Nature Communications, 2025
Paper: https://www.nature.com/articles/s41467-025-60107-7

Integrated as an independent uncertainty-guided metaplasticity layer in `NeuromodulatoryPlasticitySubstrate`:

- synapse-level uncertainty state;
- uncertainty-scaled plasticity;
- slowly increasing importance/stability anchors;
- consolidation correction that resists unnecessary drift.

This is an original adaptation, not a copy of the authors' implementation.

## Reference-only projects due license boundary

### Norse — LGPL-3.0
https://github.com/norse/norse
Used for SNN architecture/reference only. Its source is not vendored into the private runtime.

### BindsNET — AGPL-3.0
https://github.com/BindsNET/bindsnet
Used for MSTDP/MSTDPET/eligibility-trace reference only. Its source is not vendored into the private runtime.

## Why no npm/Python dependency was added

The target runtime is Termux/mobile and currently operates without third-party runtime dependencies. The integrated algorithms are small enough to implement directly and keep the execution path deterministic, auditable and restart-safe.
