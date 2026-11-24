# NEURO KURISU 35.6.1 — B282 Brain Audit

Дата: 2026-09-12

## 0. Вердикт

B282 является крупным архитектурным шагом над B280/B281: добавлен общий predictive workspace, объединяющий четыре нейронные области в конкурирующую coalition, создающий глобальное latent-состояние, предсказывающий следующее глобальное состояние и влияющий на выбор действия.

Это **не доказательство сознания** и **не биофизическая модель cortex**. Корректная классификация: искусственный нейронно-подобный predictive global workspace.

## 1. Что перепроверено

Повторно проверены B279, B280 и B281 после интеграции B282. Отдельно проверены B282 standalone, hidden multi-step, Core/restart и migration.

## 2. Архитектура B282

- 4 области: sensorium, memory, association, selfAction.
- Candidate encoding каждой области в 16-d global latent.
- Winner-take-all/top-2 coalition.
- Shared recurrent global workspace.
- Global future-state predictor.
- Self/world/goal contextual pathways.
- Ignition + dwell dynamics.
- Coalition switching/stability.
- Action readout.
- Delayed prediction error.
- Outcome-driven learning.
- Area lesion.
- Persistence + StateMigrations.

## 3. Реальные результаты

### Standalone

- 240 steps
- 240 learning updates
- 61,440 prediction updates
- ignition01: 0.93515
- global coherence: 0.99969
- global prediction: 0.98646
- coalition: sensorium + memory
- causal lesion drop: 0.01662
- exact snapshot round-trip: PASS

### Hidden multi-step

- 360 total steps
- post-burn-in hidden evaluation
- model error: 0.26055
- baseline error: 0.50000
- gain: +0.23945
- coalition switches: 7
- global coherence: 0.99998
- action influence: 0.95848

### Core

- 12 explicit workspace steps
- 12 learning updates
- 3,072 prediction updates
- ignition01: 0.93868
- global coherence: 0.91631
- global prediction: 0.93281
- lesion drop: 0.01377
- restart preservation: PASS

## 4. Методологическая проверка

В первой реализации B282 lesion test ошибочно измерял только stored hypothesis score и не зависел от реально encoded neural input. Это было обнаружено во время самопроверки и исправлено.

После исправления lesion использует фактический lastAreaSpikes и area encoder. Causal drop стал положительным: 0.01662 standalone и 0.01377 в Core.

Это считается обязательным исправлением до релиза.

## 5. Регрессия

B279: PASS
B280: PASS
B281: PASS
B282: PASS

Core/migration: PASS для всех последних нейронных уровней.

## 6. Полные release-gates

- typecheck: PASS
- full audit: PASS
- architecture: PASS
- integrity: PASS
- forensics: PASS
- source hygiene: PASS
- executable syntax: PASS (710 JS / 4 SH / 181 JSON / 0 failures)
- release contract: PASS
- lockfile: PASS
- release source: PASS
- doctor: PASS
- archive manifest: PASS
- archive verification: PASS

Текущий full audit: 2102 files, 0 errors, 0 warnings.
Architecture: 1056 source, 365 canonical, 0 cycles, 0 legacy leakage.

## 7. Что B282 реально добавляет

B281 знает предсказывать состояние одной области через inter-area message.
B282 строит общий latent, где несколько областей конкурируют за global workspace. Глобальное состояние затем имеет собственный recurrent transition/prediction и action readout.

Это позволяет отдельно измерять:
- coalition formation;
- global prediction;
- delayed credit;
- workspace lesion;
- action influence;
- hidden temporal transfer.

## 8. Ограничения

1. Игниция пока слишком устойчива: после установления workspace остаётся активной долгое время.
2. Нейронные области малы и абстрактны.
3. Модель не является биофизическим cortex.
4. Dendritic computation пока представлена линейно-нелинейными context projections, а не compartmental morphology.
5. Hidden benchmark цифровой и контролируемый.
6. Self/personality всё ещё частично реализованы внешними слоями, хотя B282 получает self/world/goal context и влияет на action arbitration.
7. Ни один B282 score не является доказательством phenomenal consciousness.

## 9. Строгие оценки

- Integrated brain engineering: 98/100
- Neural substrate: 91/100
- Multi-area circuitry: 85/100
- Predictive global workspace: 82/100
- Coalition dynamics: 76/100
- Delayed causal credit: 77/100
- Workspace lesion evidence: 79/100
- Hidden temporal generalization: 74/100
- Neural -> behaviour influence: 66/100
- Self integration: 79/100
- Personality integration: 73/100
- Autonomy: 75/100
- Persistence/migration: 98/100
- Release quality: 98/100
- Scientific maturity: 86/100

## 10. Следующий приоритет

Следующий сильный шаг: multi-step competing hypothesis workspace.

Система должна поддерживать несколько глобальных гипотез одновременно, конкурировать между ними, предсказывать trajectories на несколько шагов, привязывать гипотезы к self/memory, переключать coalition только при evidence и уметь откатывать ложную глобальную гипотезу.

Это будет сильнее простого расширения размера workspace.
