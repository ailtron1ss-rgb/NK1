# B316 Final Audit Status

STATUS: TARGETED RELEASE PASS / AGGREGATE LONG-RUNTIME LIMITED

## Functional

- B316 action-selective contextual scar: PASS
- B315 contextual long-horizon regression: PASS
- B315 migration: PASS
- B314 scar/recovery isolated regression: PASS
- B313 migration: PASS
- B298 closed-loop neural regression: PASS
- B305 96-cycle Termux-style host benchmark: PASS
- Typecheck: PASS

## Static

- Parameterized probes: 899/933 attempted, failures=0
- Semantic coverage: 38 VERIFIED / 3793 total functions, evidence coverage 0.0666
- Architecture: PASS - sourceFiles=1175, canonicalFiles=392, missing=0, cycles=0, legacyLeakage=0
- Integrity: PASS - files=2496, schema=127
- Forensics: PASS - duplicateContent=0, duplicateNames=0, staleMarkers=0
- Hygiene: PASS - errors=0, warnings=0
- Contract: PASS
- Syntax: PASS - js=801, sh=5, json=202
- Release source: PASS

## Runtime limitation

A full aggregate `audit:b316:reality` was started, but cumulative B314 runtime exceeded the host execution budget. The isolated B314 test had already passed before the aggregate timeout. Therefore the aggregate suite is NOT labeled PASS.

This release deliberately separates isolated functional evidence from cumulative harness capacity.
