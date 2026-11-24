# Release B368 — Neural Temporal + Full Runtime Closure

## Summary
B368 is a large causal integration update over B367.

## Implementation
- B365 temporal trace/credit window.
- Delayed reward propagation.
- Learnable neuromodulatory context→action field.
- Ordinary full-runtime B365 causal participation.
- Full-path outcome learning and persistent neural state update.
- Explicit autonomousStep() and runAutonomousCycles().

## Evidence
B368 temporal/autonomous test: PASS.
B368 full-runtime B365 causal test: PASS.
B365 regression: PASS.
B366 regression: PASS 6/6.
B367 regression: PASS 6/6.
Restart: PASS.
Memory: PASS.
Static audits: PASS.

## Performance
8 host mobile-profile cycles: p50 546.824 ms, p95 656.311 ms, peak heap 143.81 MiB.

## Limitations
Physical Android/Termux not verified in this environment.
Phenomenal consciousness UNKNOWN.

## Release principle
No additional standalone neural module was created. B365 remains the canonical neural substrate.
