# Independent execution evidence — 2026-09-13

Environment: extracted B297 archive, Node 22.16.0, npm dependencies=0, no npm install performed.

## Passed targeted commands

- `npm run typecheck` — PASS
- `npm run audit:architecture` — PASS; sourceFiles=1124, canonicalFiles=382, cycles=0, missing=0, legacyLeakage=0
- `npm run audit:integrity` — PASS; files=2273, release=35.6.1, core=70.0.0-master-prompt-progress-engine, schema=127
- `npm run audit:forensics` — PASS; duplicateContent=0, duplicateNames=0, staleMarkers=0
- `npm run audit:hygiene` — PASS; warnings=0, errors=0
- `npm run audit:contract` — PASS
- `npm run verify:release-source` — PASS
- `npm run test:smoke` — PASS
- `npm run test:p15.5` — PASS; saves=4, bytes=6760188
- `npm run test:big-pass-297:executive` — PASS; cycles=1600, outcomeUpdates=400, commits=1600, meanSourceReliability=0.8, neural lesion fusedSignal01 ~0.09536 -> 0
- `npm run test:big-pass-297:core` — PASS; cycles=12, outcomeUpdates=6, persistence/lesion checks passed
- `npm run audit:b297:reality` — PASS
- `npm run audit:function-liveness` — PASS output; 3783 function-like declarations, 3754 with body, 214 zero-reference in current scan
- `npm run audit:function-parameterized-safe` — PASS; attempted=912, passed=878, failures=0, inputSynthesisNeeded=22, lifecycleNeeded=12, skipped=39
- `npm run audit:semantic-coverage` — PASS as an audit command, but the result exposes the major scientific debt: totalFunctions=3663, VERIFIED=38, INTEGRATION_ONLY=837, UNSAFE_TO_AUTO_RUN=259, UNVERIFIED=2529, verifiedRate01=0.0104, evidenceCoverage01=0.0675.

## Not claimed

`npm run audit:all` was started but did not complete within the independent 300-second execution window. No failure was logged before timeout. Therefore this audit does not claim an independently reproduced full audit:all PASS.

The historical B266 autoRun failure from Claude is not a current failure: the current P15.5 regression test passes. This is a resolved historical issue, not a current blocker.
