# P2734 — Self-Optimizing Continual Loop

Дата: 2026-09-20

## Цель

P2734 переводит continual learning из набора отдельных эвристик в один замкнутый online-контур:

`context → fast learner → meta learner → action calibration → counterfactual regret → replay policy → actual replay selection → consolidation → neural plasticity → feedback`

Дополнительно контур получает `latent transition`, `information value`, `ensemble disagreement` и mobile/resource budget. Это сделано под ограничение Termux/Android: вместо тяжёлого внешнего meta-RL внедрена компактная stateful версия тех же принципов, пригодная для bounded on-device execution.

## Исследовательская основа

### Fast/meta learning
ICLR 2026 *Principled Fast and Meta Knowledge Learners for Continual Reinforcement Learning* предлагает dual-learner схему: fast learner адаптируется/переносит знания, meta learner отвечает за интеграцию и уменьшение catastrophic forgetting, включая adaptive meta warm-up.

Проект переносит принцип в лёгкую форму: `fastLearning01` управляет скоростью локальной адаптации, `metaLearning01` — медленным уровнем интеграции/стабилизации, а `metaWarmup01` изменяется по контексту и ошибке.

### Replay: what + when
Исследование *Learning to Replay* формулирует replay как closed-loop задачу: learner должен совместно решать, какие данные replay-ить и когда усиливать replay.

В P2734 это реализовано без PPO и тяжёлого meta-RL: четыре replay arms (`priority/context/novelty/uniform`) получают online utility feedback и выбираются UCB-подобным контроллером. Выбранный arm реально передаётся в P2724 replay sampler, поэтому meta-решение не остаётся диагностикой.

### Adaptive sample selection
ACL 2026 OASIS показывает пользу online selection информативных примеров с учётом redundancy. В P2734 это отражено через novelty/information/redundancy-sensitive replay utility и ограниченный coreset вместо полного replay.

### Information value / active inference
Работы по active inference и artificial reasoning мотивируют отдельное учёт expected information value. P2734 использует `informationValue01`, uncertainty, novelty, prediction error и ensemble disagreement как bounded epistemic component.

### Online world model
P2726 уже добавил context-conditioned action models и 8-D latent transition model. P2734 не дублирует этот слой, а использует его disagreement/calibration для fast/meta rates, counterfactual regret и replay pressure.

## Что внедрено в production code

1. `P2734SelfOptimizingContinualController.ts` — stateful fast/meta learner, context detector, action calibration, skill capsules, replay-arm controller, counterfactual regret, consolidation и mobile budgeting.
2. `NeuralExperienceBranch` state schema `24` — новое состояние persisted и восстанавливается после restart.
3. P2734 подключён к `beforeDecision`, `microTick` и `afterOutcome`, поэтому реально меняет learning scale и decision bias.
4. P2734 replay arm реально управляет `AutonomousContinualFabric.replaySamples(...)`.
5. Consolidation получает фактически выбранные replay samples и пишет их в context/action skill capsules.
6. Добавлена отдельная ablation API `setSelfOptimizingContinualEnabled(false)`.
7. Snapshot/restore проверяется отдельным restart test.

## Verification

`P2734_SELF_OPTIMIZING_CONTINUAL=PASS`

- outcomes=320
- contexts=6
- switches=32
- fast=0.6965
- meta=0.1983
- information value=0.3010
- ensemble disagreement=0.2526
- replay feedback=320
- replay mix=`0.250,0.252,0.250,0.248`
- replay entropy=1.0000
- consolidations=613
- consolidation gain=0.6932
- counterfactual regret=0.0285
- model calibration=0.7742
- full/control trajectory difference=46.2479
- full/P2724-only trajectory difference=0.0008
- restart outcomes=320

Регрессионный chain:

- P2734 PASS
- P2726 PASS: 240 outcomes; context-model=240; latent-model=240; replayUsed=493; planning depth=2; restart PASS.
- P2724 mobile PASS: 1500 cycles / 750 outcomes; max host heap growth 27.0 MB; end growth 37.6 MB; restart PASS.
- P2720 PASS: 72 outcomes; sparse=.2032; protected=.2701; delay confidence=.9857.
- P2716 deep PASS; P2716 continual PASS; P2716 promotion PASS; P2708 deep/long PASS.
- organism smoke PASS; typecheck PASS.

## Что результаты НЕ доказывают

- P2734 не доказывает сознание или феноменальный опыт.
- Synthetic benchmark gains нельзя переносить напрямую на реальный Android runtime.
- P2716 continual в одном matched synthetic run показывает более низкий forgetting proxy, но P2708 factorial содержит контрпример, где experimental forgetting хуже control. Следовательно, anti-forgetting эффект пока benchmark-dependent.
- 32 context switches из 320 outcomes указывают на необходимость отдельной hysteresis/false-boundary matrix; механизм работает, но его оптимальный порог ещё не установлен.

## Следующий экспериментальный слой

1. Независимая factorial matrix `no replay / uniform / context-only / adaptive`.
2. `A→B→C→A`, `A↔B` interleaving, sparse delayed reward, noisy verification, distribution shift.
3. Sweep context hysteresis threshold и сравнение false boundary / missed boundary.
4. Physical Termux instrumentation: RSS/heap/GC/latency/thermal throttling/restart.
5. Более богатый latent dynamics с intervention edges вместо только action-conditioned delta.
