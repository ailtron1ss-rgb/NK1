# P2734 — Final Audit Recheck

Дата: 2026-09-20

## Release truth

- application: 35.12.0
- release: P2734
- organism core: 100.3.0-self-optimizing-continual-p2734
- schema: 202
- NeuralExperienceBranch internal state version: 24

## Code evidence

`P2734_SELF_OPTIMIZING_CONTINUAL=PASS outcomes=320 contexts=6 switches=32 fast=0.6965 meta=0.1983 info=0.3010 ensemble=0.2526 replayFeedback=320 replayMix=0.250,0.252,0.250,0.248 entropy=1.0000 consolidations=613 consGain=0.6932 regret=0.0285 calibration=0.7742 trajectoryDiff=46.2479 p2724OnlyDiff=0.0008 restartOutcomes=320`

`P2726_CONTEXT_MODEL_REPLAY=PASS outcomes=240 contexts=3 ctxModelSamples=240 latentSamples=240 latentConf=0.5443937350686496 replay=96/240 replayUsed=493 mix=0.365,0.308,0.230,0.098 entropy=0.9350 planDepth=2 rollouts=14 trajectoryDiff=62.8415 restartOutcomes=240`

`P2724_MOBILE_ENDURANCE=PASS cycles=1500 outcomes=750 max host heap growth=27.0 MB end growth=37.6 MB restartOk=1`

`P2720_ADAPTIVE_LIFELONG=PASS outcomes=72 sparse=0.2032 protected=0.2701 delayConf=0.9857 modelConf=0.7915`

Smoke and typecheck both PASS.

## Static/structural audit

- audit:full — PASS, files=3508, canonicalFiles=510, errors=0, warnings=0
- audit:architecture — PASS, sourceFiles=1584, canonicalFiles=510, missing=0, cycles=0, legacyLeakage=0
- audit:integrity — PASS, files=3514, release=35.12.0, schema=202
- audit:forensics — PASS, activeFiles=3493, empty=0, duplicateContent=0, duplicateNames=0, staleMarkers=0
- audit:hygiene — PASS, errors=0, warnings=0
- audit:syntax — PASS, JS=1096, SH=6, JSON=240
- audit:contract — PASS
- audit:archive — PASS, manifestFiles=3754, missing=0, hashMismatches=0, extra=0
- verify:release-source — PASS

## Recovered audit issue

The first archive verification after the code/test migration reported seven hash mismatches in historical regression tests because the archive manifest was stale. No source files were missing and no unexpected files existed. The manifest was regenerated from the final tree; subsequent `audit:archive` returned PASS with zero mismatches.

## Known technical debt

1. Context switching is intentionally sensitive and generated 32 switches in 320 synthetic outcomes; hysteresis/false-boundary tuning remains open.
2. P2708 continual factorial remains a negative counterexample on one synthetic battery; no universal anti-forgetting claim is made.
3. Mobile endurance is host evidence only; physical Termux/Android thermal/RSS/GC evidence is still open.
4. Latent world model is still shallow/action-conditioned rather than a rich intervention-capable simulator.
5. Global workspace, embodiment, self-model and autonomy remain less mature than the online learning substrate.

## Resource-pressure comparison

Standalone smoke remains PASS. Measured max RSS:
- P2726 baseline: 599,772 KB
- P2734: 632,528 KB
- delta: 32,756 KB (~5.5%)

The P2734 controller itself stores bounded six-context state and small action/capsule tables, so this delta is not evidence that the entire memory floor comes from P2734. The broader runtime already has a high host-memory floor. Combined long-chain execution can timeout under resource pressure even when each heavy component passes independently.
