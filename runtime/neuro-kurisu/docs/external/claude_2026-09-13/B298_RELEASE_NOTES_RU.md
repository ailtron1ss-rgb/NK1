# B298 Release Notes — 2026-09-13

## Что реально изменено

1. Live world-transition learning bridge for B261/B262/B263/B264/B293/B294/B296/B297.
2. B296 switched from binary learning gate to continuous `learningRate01`.
3. B296 state now records eligible/suppressed learning cycles and last neuromodulated third factor.
4. MicroDream confidence no longer hardcoded `.32`; it is derived from world-model evidence, uncertainty, memory evidence and novelty.
5. Added `ActionOwnershipGraph` with B297/post-B297/finalization checkpoints.
6. Added `BIG_PASS_298` closed-loop integration test.
7. Added `audit:b298:closed-loop` package script.
8. Added updated progress scale V3.
9. Integrated four Claude PDFs and the new audit/evidence/research documents in this same external-document folder.

## Strict verification

- architecture PASS
- integrity PASS
- source hygiene PASS
- forensics PASS
- release contract PASS
- executable syntax PASS
- parameterized probe 914 attempted / 880 passed / 0 failed
- semantic coverage 3672 function-like / 38 VERIFIED / 839 INTEGRATION_ONLY / 259 UNSAFE_TO_AUTO_RUN / 2536 UNVERIFIED
- B298 closed-loop test PASS

## Important non-claims

B298 does not establish consciousness. It establishes a stronger live neural learning loop and more explicit causal/action provenance.
