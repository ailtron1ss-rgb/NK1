# B370 — REALITY GROUNDED NEURAL CLOSURE

## Summary
B370 deepens the existing B365 canonical neural substrate instead of creating another neural module.

## Added
- B365 grounded-observation state with explicit provenance.
- grounding action readout inside B365.
- sensor freshness/confidence/verification gating.
- active perception demand derived from evidence quality.
- expected-vs-actual transition learning.
- action/forecast neural readout updates from verified outcomes.
- runtime embodiment sampling now enters B365 grounding.
- runtime outcome now enters B365 transition learning.
- host-vs-device evidence guard remains explicit.

## Evidence
B370 direct causal policy L1: 0.796231.
Full-runtime grounding L1: 0.411215.
Transition updates: 40.
Device certification in current host: UNAVAILABLE.
Performance: 120 cycles, p50 4.373ms, p95 22.058ms, p99 37.690ms.

## Regression
B365/B366/B367/B368/B369 tests PASS after B370 changes.
Static release gates PASS.

## Limitations
No claim of physical Android execution is made from host evidence. Functional and phenomenal consciousness remain UNKNOWN.
