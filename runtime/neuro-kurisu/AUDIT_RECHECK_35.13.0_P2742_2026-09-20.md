# P2742 — Final Audit Recheck

Date: 2026-09-20

## Release identity

- application: 35.13.0
- release: P2742
- organism core: 100.4.0-causal-predictive-intervention-p2742
- state schema: 203
- phase: Stage-95/Causal-Predictive-Intervention/P2742

## Production implementation

- new controller: `src/organism/cognition/P2742CausalPredictiveInterventionFabric.ts`
- integrated in `NeuralExperienceBranch.beforeDecision`
- integrated in `microTick`
- integrated in `afterOutcome`
- integrated in replay scoring
- integrated in neural learning-rate gate
- persisted in snapshot/restore
- explicit P2742 ablation API

## Tests executed

### P2742

`P2742_CAUSAL_PREDICTIVE_INTERVENTION=PASS outcomes=445 contexts=6 switches=5 interventions=90 highInfo=78 info=0.4039 transConf=0.4229 calibration=0.4049 cfGap=0.0520 replayUtility=0.2768 planningDepth=2 p2742Diff=0.0005 ctlDiff=55.6143 restart=445`

### P2734

`P2734_SELF_OPTIMIZING_CONTINUAL=PASS outcomes=320 contexts=6 switches=32 fast=0.6966 meta=0.1984 info=0.3013 ensemble=0.2526 replayFeedback=320 replayMix=0.249,0.253,0.248,0.250 entropy=1.0000 consolidations=613 consGain=0.6650 regret=0.0285 calibration=0.7742 trajectoryDiff=37.5924 p2724OnlyDiff=0.0004 restartOutcomes=320`

### P2726 / P2720

Both PASS in isolated processes.

### P2716 / P2708

Deep integration, continual battery and deep-learning coupling/factorial regression PASS.

## Resource evidence

P2742 test process:

- elapsed ≈22s
- max RSS ≈218 MB

Long combined test chains remain resource-sensitive. They are not treated as PASS merely because individual components pass.

## Final verification evidence

- TYPECHECK=PASS
- CLEAN_ARCHITECTURE=PASS sourceFiles=1587 canonicalFiles=511 missing=0 cycles=0 legacyLeakage=0
- RELEASE_CONTRACT=PASS
- SOURCE_HYGIENE=PASS files=3519 errors=0 warnings=0
- FORENSICS=PASS activeFiles=3504 empty=0 duplicateContent=0 duplicateNames=0 pathMarkers=0 staleMarkers=0
- CLEAN_INTEGRITY=PASS files=3525 release=35.13.0 core=100.4.0-causal-predictive-intervention-p2742 schema=203
- SYNTAX_JSON=PASS js=1098 sh=6 json=240 parser=typescript
- RELEASE_SOURCE=PASS application=35.13.0 core=100.4.0-causal-predictive-intervention-p2742 schema=203
- MANIFESTS_GENERATED canonical=511 source=1599
- ARCHIVE_MANIFEST=PASS files=3765 missing=0 hashMismatches=0 extra=0
- CLEAN_ORGANISM_SMOKE=PASS (separate process; host RSS ~654,612 KB)
- P2724_MOBILE_ENDURANCE=PASS cycles=1500 outcomes=750 maxGrowthMB=25.5 endGrowthMB=40.8 replay=96 replayUsed=1013 mobilePressure=0.6600 hotResidency=0.6956 restartOk=1
- SERVER_SMOKE=PASS with `node --experimental-strip-types tests/server-smoke.mjs`

## Audit policy

Final archive must be rejected until:

1. typecheck PASS;
2. architecture/integrity/hygiene/forensics/syntax/contract PASS;
3. manifests regenerated;
4. archive manifest has zero missing/hash/extra files;
5. `unzip -t` PASS;
6. SHA-256 recorded.


## Combined-chain policy

P2734/P2742 regression, mobile, smoke and server checks are intentionally executed in isolated processes for this release. Long sequential chains can accumulate RSS/GC pressure; a timeout in such a chain is not counted as PASS. The isolated evidence above is the release evidence used for this archive.
