# Research Ledger — V114

## Current research basis

- **Gated DeltaNet-2 (2026)** — separate channel-wise erase/write and adaptive decay; source and official NVIDIA implementation used as an associative-spine reference.
- **Preconditioned DeltaNet (2026)** — derives curvature-aware preconditioning for recurrent delta rules; this motivated the current learnable preconditioner and its saturation fix.
- **Kalman Delta Networks (2026)** — uncertainty-aware associative memory; current uncertainty controller is parameter-free and candidate-only.
- **TTTLA / ICML 2026** — reframes a broad class of KV-binding test-time training as learned linear attention; used as a reason to simplify rather than stack optimizer-like subsystems.
- **Cascading Eligibility Traces (ICLR 2026)** — motivates focused temporal credit dynamics; cascade remains candidate-only after mixed delayed-training evidence.
- **Selective Eligibility Traces (2026)** — supports non-uniform/per-sample credit selection; current selective mode remains candidate-only.
- **Raven (2026)** — sparse routing memory with input-dependent slot selection; informs current event-bank/routing direction.
- **delta-Mem (2026)** — compact online delta-memory reference; retained as upstream candidate rather than copied blindly.
- **Mamba-3 (2026)** — richer recurrence/state design reference; not instantiated in current trunk.
- **PCGrad** — reference for objective-gradient surgery.
- **GUA / Gradient-Update Alignment (2026)** — shows that an update can become conflicting after optimizer transformation; directly motivated V114 applied-update mismatch audit and post-update candidate.

## V113 → V114 decisions

### Retained/promoted engineering
- standalone current trunk;
- full parameter gradient coverage on representative objective;
- causal state carry;
- batch-local fast-weight semantics;
- event-bank isolation evidence;
- preconditioner trainability fix.

### Candidate-only
- temporal credit variants;
- synergy feedback;
- QED/address erase;
- uncertainty-aware write;
- EFLA;
- gradient post-update alignment.

## V114 evidence summary

- current tests: **40/40 PASS**
- total/trainable: **69,137 / 69,137**
- gradient element coverage: **100%**
- gradient parameter coverage: **100%**
- legacy current-path imports: **0**
- current recurrent owners: **1**
- raw AdamW update conflict after PCGrad: approximately **0.89–1.00** in the three-seed short probe
- post-update alignment candidate: approximately **0.14–0.43** one-step post-conflict in the same probe; no promotion yet

## Admission rule

Source/code audit → isolated implementation → matched baseline → ablation → multi-seed → stress → resource measurement → promotion or rejection.
