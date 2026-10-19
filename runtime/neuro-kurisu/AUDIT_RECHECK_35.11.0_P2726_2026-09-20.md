# Final recheck — Neuro-Kurisu 35.11.0 / P2726

Дата: 2026-09-20

## 1. Release identity

- application: `35.11.0`
- organismCore: `100.2.0-context-model-replay-p2726`
- internal NeuralExperienceBranch state: `23`
- global state schema: `201`
- phase: `Stage-93/Context-Conditioned-Model-Replay/P2726`

## 2. Реальный код, добавленный/изменённый в проходе

### P2726AutonomousContinualFabric

- context-conditioned action models: context × action running mean/uncertainty/confidence;
- 8-D online latent transition model per action;
- latent-model confidence/uncertainty feeds shallow lookahead;
- replay policy mixture: priority/context/novelty/random;
- replay policy adapts online to novelty, boundary, forgetting pressure and resource budget;
- persistence/restore of all new state.

### NeuralExperienceBranch

- internal state version 22 → 23;
- P2726 latent state passed through full decision and microTick paths;
- prior latent state persisted into outcome bridge;
- existing P2724 selective replay and structural plasticity remain in the real neural update path.

## 3. Regression evidence

`P2726_CONTEXT_MODEL_REPLAY=PASS outcomes=240 contexts=3 ctxModelSamples=240 latentSamples=240 latentConf=0.5442 replay=96/240 replayUsed=494 mix=0.365,0.308,0.230,0.098 entropy=0.9350 planDepth=2 rollouts=14 trajectoryDiff=67.0240 restartOutcomes=240`

`P2724_AUTONOMOUS_CONTINUAL=PASS outcomes=188 contexts=3 switches=17 novelty=0.3001 boundary=0.2299 planDepth=1 rollouts=7 replay=96/188 replayUsed=373 replayDiv=0.3383 cfConf=0.4284 structuralGain=0.0388 wake=2 prune=0 rewire=2 mobilePressure=0.6502 trajectoryDiff=45.5274 restartOutcomes=188`

`P2724_MOBILE_ENDURANCE=PASS cycles=1500 outcomes=750 elapsedMs=3528.7 maxGrowthMB=24.7 endGrowthMB=45.3 replay=96 replayUsed=1014 mobilePressure=0.6600 hotResidency=0.6956 restartOk=1`

`P2720_ADAPTIVE_LIFELONG=PASS outcomes=72 contextNovelty=0.0167 match=0.9814 sparse=0.2017 protected=0.2693 delayConf=0.9832 modelConf=0.7902 trajectoryDiff=9.3487 restartOutcomes=72`

`P2716_DEEP_INTEGRATION=PASS outcomes=144 phase=stable phaseConfidence=0.8256 learningScale=0.5134 protection=0.2664 delayConsensus=0.4443 taskShift=0.0728 diff=39.4681`

`P2716_CONTINUAL_BATTERY=PASS expForgetA=0.0395 ctlForgetA=0.0668 expForgetB=0.0000 ctlForgetB=0.0027 interleave=-0.0001 shift=0.0558 interference=0.0247 protected=0.2707 phase=stable delayConsensus=0.5591 trajectoryDiff=7.4196`

`P2716_PROMOTION_GATE=PASS outcomes=96 external=1.00 eligible=1 reasons=1`

`P2708_DEEP_LEARNING_COUPLING=PASS diff=15.80256 mean=-0.00000 rms=0.03500 coupled=0.0923 epistemic=0.4943 normUpdates=3456`

`P2708_CONTINUAL_FACTORIAL=PASS expForgettingA=0.0322 ctlForgettingA=0.0267 expGeneralization=1.0000 ctlGeneralization=1.0000 trajectoryDiff=1.3922`

`P2708_LONG_HORIZON_CLOSURE=PASS warmedMedianRatio=1.435 firstMedianMs=12.39 lastMedianMs=17.78 p95Approx=153.41 heapGrowth=4.022`

Additional PASS: P2702 personality, P2703 global workspace, P2705 homeostasis, P2706 online credit, P2707 cascade.

## 4. Static/release audits

- `doctor` PASS
- `typecheck` PASS
- `audit:full` PASS
- `audit:architecture` PASS — sourceFiles=1582, canonicalFiles=509, missing=0, cycles=0, legacyLeakage=0
- `audit:integrity` PASS — files=3511
- `audit:contract` PASS
- `verify:release-source` PASS
- `audit:forensics` PASS — activeFiles=3490, empty=0, duplicateContent=0, duplicateNames=0, pathMarkers=0, staleMarkers=0
- `audit:syntax` PASS — js=1095, sh=6, json=240
- `audit:hygiene` PASS — files=3505, errors=0, warnings=0
- `manifest:archive` PASS — files=3751
- `audit:archive` PASS — missing=0, hashMismatches=0, extra=0

## 5. Что считать результатом, а что нет

Результатом является фактически связанный кодовый контур с persistence, synthetic regression coverage и измеримым отличием experimental/control trajectory.

Не является результатом: доказательство сознания, универсальное снижение forgetting, физическая Android/Termux performance, полноценный latent world simulator или доказательство biological equivalence.

## 6. Текущий приоритет следующего прохода

1. независимая replay factorial: no replay / random / context-only / adaptive;
2. A→B→C→A, interleaved, sparse delayed reward, noisy verification, distribution shift;
3. non-parametric/learned context allocation вместо фиксированного набора прототипов;
4. richer latent world model with intervention edges;
5. 500–2000 cycle physical Termux/Android measurements with heap/thermal throttling evidence.
