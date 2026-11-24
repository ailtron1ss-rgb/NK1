# BIG PASS 261 — Unified World Model 2

Дата: 2026-09-12

## Цель

Собрать единый action-conditioned world-model вокруг уже существующих P27 latent и B259 recurrent state, прекратив дальнейшее дробление world-model логики на независимые score-модули.

## Что изменено

Добавлен `B261UnifiedWorldModel`.

Цепочка:

`P27 fused latent -> B259 shared/recurrent activity -> B261 action-conditioned prediction -> real next latent + reward -> prediction error -> plasticity -> episodic evidence -> replay -> transfer`

### Возможности

- action-conditioned next-latent prediction;
- reward prediction;
- online parameter learning;
- episodic storage;
- replay без создания ложных новых эпизодов;
- holdout evaluation;
- action comparison;
- lesion experiment;
- diagnostics;
- persistence/migration.

## Интеграция

### Observe

При наличии active action B261 делает prediction из нового P27 latent.

### Feedback

При реальном outcome B261 получает:

- предыдущий P27 latent;
- выбранное действие;
- фактический следующий P27 latent;
- фактический reward;
- tick.

После этого обновляются dynamics и reward heads.

### Replay

Каждый 32-й tick или при соответствующем цикле outcome replay используется на сохранённых эпизодах.

Replay обновляет существующие параметры без добавления дубликатов эпизодов.

## Найденный и исправленный дефект

После первого интеграционного прохода restart test показал, что B261 был добавлен в `OrganismCore`, но отсутствовал в реальном migration return-path `StateMigrations`.

Результат до исправления:

`restartPreserved = FAIL`

После добавления migration field:

`restartPreserved = PASS`

Это важная проверка: B261 не считается завершённым только потому, что standalone модуль обучается.

## Проверка

### B259 regression

- learningUpdates: 20
- trainError01: 0.430627
- holdoutError01: 0.343982
- holdoutDelta01: +0.156018
- generalization01: 0.656018
- lesionDrop01: 0.0000203
- restartPreserved: true

### B260 regression

- encodingCount: 18
- outcomeCount: 18
- replayRuns: 1
- replayedEpisodes: 12
- meanAbsTd01: 0.03825
- delayedCredit01: 0.046959
- linkedMemoryCount: 3

### B261 standalone

- 80 online training updates;
- holdout after training: 0.206293;
- replay run: 12 episodes;
- holdout after replay: 0.205757;
- additional replay gain over online-only holdout: +0.000536;
- online transition error: 0.050345;
- online reward error: 0.122914;
- lesion transition drop: 0.005903;
- lesion reward drop: 0.001476;
- restore round-trip: PASS;
- action-conditioned predictions: measurably non-identical across actions.

### B261 Core integration

12 complete observe/feedback cycles on mobile profile.

- trainingUpdates: 12
- transitionSamples: 12
- episodeCount >= 8
- state round-trip: PASS
- action comparison API: PASS

## Global validation

- typecheck: PASS
- architecture: PASS — 949 source files / 344 canonical files / 0 cycles / 0 legacy leakage
- integrity: PASS — 1894 files
- source hygiene: PASS — 1888 files / 0 errors / 0 warnings
- contract: PASS
- forensics: PASS — 1873 active files / 0 empty / 0 duplicate content / 0 duplicate names / 0 stale markers
- release source: PASS
- archive manifest: PASS — 2119 files
- archive verification: PASS — missing 0 / hash mismatches 0 / extra 0

## Строгая оценка B261

| Элемент | Оценка 1–100 |
|---|---:|
| Архитектурная целостность | 97 |
| Persistence | 96 |
| Integration | 90 |
| Action-conditioned dynamics | 63 |
| Reward prediction | 61 |
| Online learning | 68 |
| Replay | 57 |
| Delayed transfer | 46 |
| Holdout evaluation | 74 |
| Lesion evidence | 49 |
| World-model causal relevance | 51 |
| Memory/world coupling | 78 |
| Sensorimotor coupling | 53 |
| Agency coupling | 70 |
| Shared neural substrate coupling | 68 |
| Scientific evidence quality | 58 |
| Mobile feasibility | 70 |
| Consciousness evidence | 8 |
| Overall brain engineering readiness | 71 |
| Overall brain scientific maturity | 48 |

## Почему это всё ещё не «готовый мозг»

1. Holdout gain from replay пока мал.
2. Lesion effect измерим, но ещё слаб.
3. Dynamics всё ещё низкоразмерна и сильно упрощена.
4. P27 latent является компактным representation, а не полноценной сенсорной моделью мира.
5. Нет настоящей многомасштабной temporal dynamics.
6. Нет доказанного long-horizon planning через этот world model.
7. Нет физически замкнутого Android sensorimotor benchmark.
8. Не доказано, что B261 причинно необходим для выбора действий в реальном цикле.

## Следующий большой шаг

B262 — Multi-timescale World Dynamics + Causal Action Model.

Приоритет:

`short-term dynamics -> action effect -> delayed consequences -> hierarchical memory -> long-horizon prediction -> planning -> actual action -> observed consequence`

Обязательные эксперименты:

- online-only vs replay;
- one-step vs multi-step prediction;
- intact vs world-model lesion;
- intact vs B259 lesion;
- action swap;
- counterfactual consistency;
- unseen-context transfer;
- delayed reward;
- mobile resource load;
- persistence/restart;
- real Android observation when device gate is available.

## Главный результат

B261 впервые формирует один непрерывный action-conditioned dynamics path поверх shared latent вместо очередной группы независимых world-model scores. Это качественный архитектурный переход, но научная зрелость остаётся существенно ниже инженерной и должна подниматься измеряемыми causal experiments, а не числом модулей.
