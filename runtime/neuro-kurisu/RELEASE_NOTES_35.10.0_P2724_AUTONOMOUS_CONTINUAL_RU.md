# Historical release: Neuro-Kurisu 35.10.0 / P2724 — Autonomous Continual Cognitive Fabric

Дата: 2026-09-20

## Главное изменение

Этот релиз объединяет несколько раньше раздельных механизмов в один контур continual cognition:

`experience → context inference → boundary/interference → selective plasticity → compact replay → world-model lookahead → counterfactual credit → sparse structural plasticity → mobile budget → persistence`

## Основные изменения кода

- `src/organism/cognition/P2724AutonomousContinualFabric.ts`
- расширен `src/organism/cognition/NeuralExperienceBranch.ts`
- state schema: `201`
- NeuralExperienceBranch state: `22`
- application: `35.10.0`
- organism core: `100.1.0-autonomous-continual-p2724`

## Новые механизмы

### 1. Context & boundary inference
Нет oracle task labels. Контексты строятся по vector prototypes и divergence, а смена режима оценивается online.

### 2. Selective replay
Replay больше не является просто накоплением истории: сохраняется маленький prioritized coreset и используется только при достаточной relevance.

### 3. Shallow world-model planning
Используется online action model + uncertainty + information gain. Глубина 1–3 зависит от ресурса.

### 4. Counterfactual action model
Для действий поддерживаются running estimates среднего результата, uncertainty и confidence; они влияют на lookahead.

### 5. Sparse structural plasticity
При regime shift ограниченное число нейронов может быть «разбужено», а очень слабые связи — разреженно очищены.

### 6. Mobile-aware residency
Контроллер ограничивает размер replay, следит за pressure/residency и понижает вычислительный бюджет при resource stress.

## Проверки

- `P2724_AUTONOMOUS_CONTINUAL=PASS` — 188 outcomes, 3 contexts, 17 switches, replay 96/188, replayUsed 372, cfConf 0.4284, trajectoryDiff 45.5276
- `P2724_MOBILE_ENDURANCE=PASS` — 1500 cycles / 750 outcomes, maxHeapGrowth 24.2 MB, endGrowth 37.4 MB, replay 96, restartOk=1
- `P2720_ADAPTIVE_LIFELONG=PASS`
- `P2716_DEEP_INTEGRATION=PASS`
- `P2716_CONTINUAL_BATTERY=PASS`
- `P2716_PROMOTION_GATE=PASS`
- `P2708_DEEP_LEARNING_COUPLING=PASS`
- `P2708_CONTINUAL_FACTORIAL=PASS`
- `P2708_LONG_HORIZON_CLOSURE=PASS`
- `TYPECHECK=PASS`

## Важная оговорка

В одном текущем synthetic matched run P2716 continual battery дал forgetting proxy `0.0589` против контрольного `0.0668`; это ориентировочно на 11.8% меньше proxy, но результат зависит от benchmark и не является доказательством универсального превосходства. Другой старый P2708 factorial benchmark по-прежнему показывает, что forgetting может быть хуже baseline, поэтому дальнейшее улучшение должно идти через абляции и независимые matched batteries.
