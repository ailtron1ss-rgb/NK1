# NeuroCore V125 — Memory Truth + Decontamination

## Real changes

1. Added parameter-free per-slot key fingerprints to unified sparse memory.
2. Added canonical `read_only()` memory path; qualification no longer reimplements production read logic.
3. Added deterministic partial-route collision probe and liveness gate.
4. Kept fingerprint candidate out of default dense-only trunk promotion.
5. Fixed stale package metadata and release pointers (`1.25.0`, `v125-memory-truth`).
6. Kept legacy engines out of current and made candidate/reference status explicit.

## Qualification

Current tests: see release manifest after final run.
Executable stubs: 0.
Inert enabled features: PASS.
Registry truthfulness: PASS.

## Decision

Fingerprinting is candidate-only. It shows measurable collision reduction, but broader end-to-end and runtime qualification is deferred to V126.
