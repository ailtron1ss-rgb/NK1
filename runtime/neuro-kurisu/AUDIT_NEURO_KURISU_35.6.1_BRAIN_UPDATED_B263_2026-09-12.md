# NEURO KURISU 35.6.1 — ПОЛНЫЙ ПЕРЕПРОВЕРЕННЫЙ АУДИТ B263

Дата: 12 сентября 2026
Предыдущая точка: B262 Multi-Timescale World Dynamics
Текущая точка: B263 Real Action Consequence & Behavioural Causality

## 0. Принцип аудита

Этот документ отделяет три вещи:

1. код существует;
2. код исполняется;
3. механизм действительно показывает нужное поведение на независимом эксперименте.

Зелёный unit test сам по себе не считается доказательством когнитивного свойства.

## 1. Что было перепроверено перед B263

Был повторно просмотрен B262 source path, OrganismCore integration, StateMigrations, B262 tests, package scripts и предыдущий audit B262. После этого B263 добавлялся только как следующий причинный слой.

Ключевая проблема B262, подтверждённая этим аудитом: world model хорошо предсказывает, но planner пока не показывает стабильного поведенческого преимущества. Поэтому B263 не добавляет ещё один planner, а создаёт causal intervention layer.

## 2. Архитектура B263

### 2.1 Observation

Каждый реальный transition фиксируется как:

`before latent + action + after latent + reward + surprise`.

### 2.2 Action-conditioned dynamics

Для каждого action обучается собственная parameterized delta function. Она предсказывает не абстрактный score, а изменение latent state.

### 2.3 Shuffled-action baseline

Для каждого observed transition строится baseline, в котором action заменяется другим action. Это позволяет проверить, действительно ли identity выбранного действия несёт полезную information.

### 2.4 Intervention

`intervene(before, action)` реализует цифровой do-style intervention: действие подставляется в causal model, строится ожидаемое downstream state и reward. Система также оценивает uncertainty.

### 2.5 Holdout

На unseen samples сравнивается conditioned model с shuffled baseline. Это главный анти-overfit gate B263.

### 2.6 Replay

Ранее полученные causal transitions переобучаются отдельным replay проходом.

### 2.7 Ablation

Для действия с достаточным числом наблюдений сравниваются prediction error исходной action-specific модели и альтернативной action-модели. Это не «убийство органа мозга», а behavioural ablation причинного representation.

### 2.8 Persistence

Состояние B263 входит в OrganismCore persisted system state и StateMigrations. Полный round-trip тест прошёл.

## 3. Фактические результаты B263

### Standalone

132 updates.

Conditioned error = 0.001971.

Shuffled baseline = 0.004462.

Таким образом, action-conditioned predictor ошибается примерно в 2.26 раза меньше, чем shuffled-action baseline на этом эксперименте.

Holdout conditioned = 0.002880.

Holdout shuffled = 0.005251.

Отношение ошибки holdout приблизительно 1.82x в пользу conditioned model.

Causal gain online = 0.002237.

Causal gain holdout = 0.001448.

Reproducibility = 0.991584.

Replay gain = 0.006569.

Verify ablation drop = 0.008145.

Restart = PASS.

### Core

Live core updates = 28.

Conditioned error = 0.005516.

Shuffled baseline = 0.007600.

Causal gain = 0.001147.

Intervention endpoint выполняется из реального OrganismCore.

Replay выполняется.

Restart round-trip = PASS.

## 4. Почему эти цифры важны

Есть три уровня evidence:

TRAIN: action identity помогает предсказывать observed latent change.

HOLDOUT: преимущество сохраняется на samples, которые не участвовали в обновлении параметров.

ABLATION: замена action-specific pathway на альтернативный action ухудшает prediction.

Совокупно это существенно сильнее простого внутреннего score.

Но causal gain всё ещё относительно мал. Поэтому правильный вывод — «есть reproducible action-conditioned causal signal», а не «сформирована полноценная причинная модель мира».

## 5. Регрессионный результат

B259 canonical substrate — PASS.

B260 recurrent causal memory — PASS.

B261 unified world model — PASS.

B261 core integration — PASS.

B262 world model — PASS.

B262 core integration — PASS.

Таким образом, B263 не сломал предыдущую causal/world-model цепочку.

## 6. Release verification

Typecheck — PASS.

Architecture — PASS.

Integrity — PASS.

Hygiene — PASS.

Contract — PASS.

Forensics — PASS.

Release source — PASS.

Manifest — PASS.

Archive hashes — PASS.

Полный historical syntax sweep — BLOCKED_BY_ENV из-за execution timeout. Никакого PASS вместо него не заявляется.

## 7. Оценка элементов 1–100

| Элемент | Балл |
|---|---:|
| Canonical neural substrate | 61 |
| Temporal credit | 64 |
| Causal memory | 67 |
| Unified world model | 63 |
| Multi-timescale dynamics | 66 |
| Action-conditioned prediction | 72 |
| Intervention model | 58 |
| Shuffled-action causal baseline | 64 |
| Holdout causal transfer | 57 |
| Replay | 69 |
| Persistence | 96 |
| Restart integrity | 96 |
| Regression safety | 91 |
| Planning | 43 |
| Long-horizon planning | 38 |
| Behavioural causal evidence | 58 |
| External causal evidence | 22 |
| Policy learning from consequences | 39 |
| Environment grounding | 34 |
| Autonomous agency | 31 |
| Self-model causal coupling | 36 |
| Consciousness evidence | 12 |
| Scientific falsifiability | 71 |
| Architecture quality | 88 |
| Code hygiene | 92 |
| Release discipline | 90 |

## 8. Прогресс по целевой brain chain

Target chain:

Observation → latent → recurrent state → prediction → action → consequence → attribution → memory → replay → policy update → holdout → generalization.

B259 закрывает recurrent learnable substrate.

B260 закрывает temporal causal memory/replay.

B261 закрывает unified action-conditioned world model.

B262 закрывает multi-timescale prediction и planning interface.

B263 закрывает первый explicit action-consequence attribution/intervention layer.

Текущая оценка замыкания цепи: ~76%.

Не закрыто окончательно:

- policy must causally exploit model;
- actions must alter a real environment state;
- postconditions must be independently verified;
- learned causal policy must beat non-causal baselines on unseen tasks;
- long-horizon effects must remain attributable after multiple intermediate actions.

## 9. Что было сделано хорошо

Проект уже имеет необычно сильную инженерную сторону: persistence, migration, release manifests, integrity, regression suite и крупная история prior passes позволяют реально наращивать architecture без хаотического развала.

Самое полезное направление последних проходов — переход от независимых cognitive organs к shared learning substrate.

## 10. Что остаётся плохим/опасным

Главная опасность проекта — считать количество модулей эквивалентом когнитивной глубины.

Второй риск — использовать synthetic formulas, которые делают красивые scores, но не создают downstream behavioural benefit.

Третий риск — планирование без demonstrated action advantage.

Четвёртый — считать causal graph или intervention API эквивалентом реальной causal agency.

## 11. Повторяющийся паттерн, на котором мы застревали

`new organ -> score -> snapshot -> test -> release`.

B263 намеренно ломает этот паттерн через:

`real transition -> action-conditioned learning -> shuffled baseline -> holdout -> intervention -> ablation -> replay`.

Следующие passes должны сохранять именно эту дисциплину.

## 12. Новый технический критерий проекта

Новый механизм считается brain-grade только когда одновременно выполнены:

A. он обучается на реальном transition;
B. меняет внутренние параметры;
C. улучшает unseen metric;
D. имеет ablation;
E. имеет persistence;
F. имеет negative control;
G. его downstream action даёт measurable benefit.

B263 сейчас выполняет A–F и только частично G.

## 13. B264

Следующий крупный апдейт должен быть не новым prediction module.

B264 = POLICY-TO-CONSEQUENCE LOOP.

Он должен связать:

`causal intervention model`
→ `conservative policy proposal`
→ `actual action`
→ `external/postcondition evidence`
→ `observed state delta`
→ `causal attribution`
→ `policy update`
→ `replay`
→ `holdout`
→ `behavioural benchmark`.

Главный acceptance criterion B264:

На unseen tasks causal policy должна статистически и воспроизводимо превосходить shuffled-action и non-causal greedy baselines.

До этого результата нельзя заявлять, что у системы сформирована доказанная автономная причинная агентность.

## Итог

B263 — качественный переход от «мы умеем предсказывать последствия» к «мы начали отделять действие как предполагаемую причину от альтернативного действия и проверять это на holdout».

Это не конец. Но это уже значительно более строгий brain mechanism, чем очередной independent score-module.
