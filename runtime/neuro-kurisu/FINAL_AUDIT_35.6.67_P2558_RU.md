# FINAL AUDIT — Neuro Kurisu 35.6.67 / P2551–P2558

## Release identity
- Application: 35.6.67
- Organism core: 80.3.0-adaptive-neural-continuity-p2558
- State schema: 173
- Phase: Stage-51/Embodied-Causal-Memory/P2558

## Implemented code
- `src/organism/cognition/AdaptiveCausalMemoryPlanner.ts`
- `src/organism/cognition/NeuralExperienceBranch.ts`
- `src/organism/cognition/AdaptiveNeuralContinuityController.ts`
- `src/organism/system/ReleaseContract.ts`
- package + lock + manifests updated to 35.6.67/P2558

## New executable mechanisms
1. delayed outcome credit for retrieved memory;
2. learned memory-usefulness feedback;
3. action-conditioned semantic world rules;
4. similar-context causal matching and transfer;
5. matched-action counterfactual ledger;
6. selective foresight confidence gate;
7. bounded epistemic action residual;
8. action-value/confidence adaptation;
9. persistent causal planner state;
10. restart preservation of causal rules and transfer state.

## New tests
### P2551–P2558 causal memory lab
PASS
- 2400 updates
- 4 learned semantic rules
- 256 traces
- 11,394 matched causal comparisons
- transfer01 = 0.9567
- causalSensitivity01 = 0.2141
- longHorizonConsistency01 = 0.9200
- retainedForesight = 2400

### Neural branch integration
PASS
- 360 cycles
- 15 semantic rules
- 256 traces
- causalSensitivity01 = 0.1552
- transfer01 = 0.9055
- foresightQuality01 = 0.8878
- computeCost01 = 0.4196
- restart preserved rule/transfer state

### Performance
PASS
- 20,000 planner cycles
- ~23,095 cycles/s local Node benchmark
- 239,916 matched causal comparisons

## Regression suite
PASS
- typecheck
- B2522 neural experience branch
- B2522 runtime integration
- B2521 runtime
- B269 spiking/plasticity
- B365 unified neuro core
- P22 phone reliability
- current 30-step organism smoke with `--max-old-space-size=256`
  - CLEAN_ORGANISM_SMOKE=PASS
  - ~34.08 s
  - ~355,588 KB peak RSS on test host

## Structural/release audits
PASS
- architecture: canonicalFiles=444, missing=0, cycles=0, legacyLeakage=0
- integrity: PASS
- contract: PASS
- hygiene: 0 errors, 0 warnings
- syntax: 1016 JS / 6 SH / 216 JSON / 0 failures
- forensics: 0 duplicate content, 0 duplicate names, 0 stale/path markers
- brain audit: PASS
- lock: PASS
- full project audit: PASS, errors=0, warnings=0
- doctor: PASS
- release source: PASS
- archive manifest: PASS

## Known pre-existing issue
`tests/big-pass-320-mobile-durability.mjs` remains a legacy failure (`8 !== 14`) that reproduces on the 35.6.63 base. It is not attributed to P2551–P2558.

## Research retention
Fresh research is stored under:
`research/2026-09-18/P2551_P2558/`

## Epistemic status
All results are controlled engineering experiments. They do not establish subjective consciousness, biological equivalence, or human-level intelligence.
