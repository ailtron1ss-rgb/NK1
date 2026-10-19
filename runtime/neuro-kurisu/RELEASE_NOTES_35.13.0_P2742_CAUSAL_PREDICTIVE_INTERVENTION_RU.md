# Neuro-Kurisu 35.13.0 / P2742 — Causal Predictive Intervention

## Главный результат

P2742 добавляет замкнутый predictive/counterfactual/intervention слой поверх P2734/P2726.

Новая production-связь:

`latent → context → action-conditioned dynamics → uncertainty → epistemic/pragmatic action bias → real outcome → model update → counterfactual gap → replay utility → neural learning-rate gate`

## Реальные изменения кода

- `src/organism/cognition/P2742CausalPredictiveInterventionFabric.ts` — 8-D online latent dynamics, context models, action-conditioned reward/transition uncertainty, intervention scoring, counterfactual comparison и causal replay scoring.
- `NeuralExperienceBranch.beforeDecision()` — predictive controller участвует в action bias.
- `NeuralExperienceBranch.microTick()` — predictive controller обновляется в continuous cognition.
- `NeuralExperienceBranch.afterOutcome()` — модель получает фактические latent transitions/outcomes.
- bounded causal learning-rate gate: calibration/intervention value/resource pressure влияют на synaptic learning.
- replay gain дополнен model-surprise utility.
- snapshot/restore включает P2742.
- добавлен ablation API `setCausalPredictiveInterventionEnabled(false)`.

## Verification

`P2742_CAUSAL_PREDICTIVE_INTERVENTION=PASS`

- outcomes=445
- contexts=6
- context switches=5
- interventions=90
- high-information outcomes=78
- informationGain=0.4039
- transitionConfidence=0.4229
- modelCalibration=0.4049
- counterfactualGap=0.0520
- replayUtility=0.2768
- planningDepth=2
- restart=PASS
- process RSS≈218 MB

P2734 regression:

`P2734_SELF_OPTIMIZING_CONTINUAL=PASS outcomes=320 contexts=6 switches=32 fast=0.6966 meta=0.1984 info=0.3013 ensemble=0.2526 replayFeedback=320 replayMix=0.249,0.253,0.248,0.250 entropy=1.0000 consolidations=613 consGain=0.6650 regret=0.0285 calibration=0.7742 trajectoryDiff=37.5924 p2724OnlyDiff=0.0004 restartOutcomes=320`

P2726:

`P2726_CONTEXT_MODEL_REPLAY=PASS outcomes=240 contexts=3 ctxModelSamples=240 latentSamples=240 latentConf=0.5444 replay=96/240 replayUsed=493 mix=0.365,0.308,0.230,0.098 entropy=0.9350 planDepth=2 rollouts=14 trajectoryDiff=56.3090 restartOutcomes=240`

P2720:

`P2720_ADAPTIVE_LIFELONG=PASS outcomes=72 contextNovelty=0.0194 match=0.9783 sparse=0.2023 protected=0.2696 delayConf=0.9837 modelConf=0.7906 trajectoryDiff=10.9784 restartOutcomes=72`

P2716 continual:

`P2716_CONTINUAL_BATTERY=PASS expForgetA=0.0000 ctlForgetA=0.0753 expForgetB=0.0000 ctlForgetB=0.0026 interleave=0.0000 shift=0.0542 interference=0.0241 protected=0.2706 phase=stable delayConsensus=0.5592 trajectoryDiff=3.2967`

P2708 factorial:

`P2708_CONTINUAL_FACTORIAL=PASS expForgettingA=0.0000 ctlForgettingA=0.0294 expGeneralization=1.0000 ctlGeneralization=1.0000 trajectoryDiff=3.9845`

## Ограничения

- P2742 пока является online statistical predictive/intervention layer, а не полноценным структурным causal discovery system.
- В одном matched P2742 run разница full vs P2734-only по текущему edge-mass proxy была небольшой (~0.0005), поэтому нельзя утверждать большой прямой synaptic gain от P2742.
- Основной эффект P2742 сейчас виден через model calibration, epistemic action bias, intervention pressure, replay utility и learning gate.
- Host benchmark не заменяет реальный Android/Termux telemetry.
- Хорошие результаты forgetting в текущих regression runs не следует считать универсальными: эффект зависит от benchmark и режима задач.

## Research records

Обновлены:

- `RESEARCH/2026-09-20/P2742_CAUSAL_PREDICTIVE_INTERVENTION_RU.md`
- `RESEARCH/2026-09-20/SOURCES.json`
- `RESEARCH/2026-09-20/CURRENT_RESEARCH_AND_INTEGRATION_2026-09-20_RU.md`


## Финальный release audit

Static/release evidence: TYPECHECK, architecture, integrity, forensics, hygiene, syntax, release contract, release source and archive manifest all PASS. Final organism smoke and server smoke PASS in isolated project-native processes. P2724 mobile endurance: 1500 cycles / 750 outcomes, max heap growth 25.5 MB, end growth 40.8 MB, restart PASS.

Long combined chains remain resource-sensitive and are intentionally not represented as a single PASS. This is a tracked mobile/runtime debt rather than hidden evidence.
