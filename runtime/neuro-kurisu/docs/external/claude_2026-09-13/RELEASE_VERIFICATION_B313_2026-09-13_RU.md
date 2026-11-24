# RELEASE VERIFICATION B313 — 13.09.2026

## Functional gates
PASS:
- typecheck
- B313 longitudinal divergence
- B313 migration
- B312 decision handoff
- B312 organism handoff
- B311 policy ecology
- B310 source credit
- B306 autonomous causal
- B305 critical path
- B298 closed loop
- UI smoke
- server smoke

## Static gates
PASS:
- function liveness: 175
- parameterized: 899/933, failures 0
- semantic coverage: 38 VERIFIED / 3781 functions
- evidence coverage: 0.0668
- architecture: 1168 source / 392 canonical, missing 0, cycles 0
- integrity: 2469 files, schema 127
- forensics: duplicate content 0, duplicate names 0, stale markers 0
- hygiene: 0 errors / 0 warnings
- release contract
- syntax: JS 795 / SH 5 / JSON 202
- release source
- archive manifest: 2694 files

## Long-run caveat
The aggregate sequence of all heavy benchmarks may exceed the current container resource/time budget. Individual gates above are the reproducible release evidence.
