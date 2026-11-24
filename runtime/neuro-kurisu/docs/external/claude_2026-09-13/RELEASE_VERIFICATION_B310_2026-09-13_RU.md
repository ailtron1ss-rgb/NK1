# B310 Release Verification

ZIP release is allowed only after:
- B310 source-credit test PASS
- B310 migration PASS
- B309 arbitration PASS
- B308/B307/B306/B305/B304/B302 regressions PASS
- B298 closed-loop PASS
- typecheck PASS
- architecture/integrity/forensics/hygiene/contract/syntax PASS
- function liveness and parameterized probes PASS
- UI/server smoke PASS
- final archive integrity check PASS

Known limitation: cumulative heavy suite may exceed the container process budget. Isolated critical tests are the authoritative release evidence.
