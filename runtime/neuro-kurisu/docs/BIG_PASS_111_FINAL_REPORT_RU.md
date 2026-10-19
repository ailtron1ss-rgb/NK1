# BIG PASS 111 — Self-Directed Learning / D-VOI

## Цель
Сместить центр проекта с инфраструктуры измерения на реальный автономный цикл выбора обучения, не позволяя системе учиться на собственных synthetic predictions.

## Реально внедрено
- D-VOI: Developmental Value-of-Information — выбор направления развития с учётом дефицита, ожидаемого gain, стоимости, выполнимости и штрафа повторения.
- Persisted learning agenda: выбранная область, hypothesis, score, стоимость, причина и момент решения.
- Area-sensitive evidence requirements: разные developmental области получают разные минимумы контекстов/задержек/holdout.
- Development Campaign Plan: заранее формирует реальные baseline/delay/holdout slots, но не создаёт результаты.
- Core API: `p36LearningAgenda()` и `p36DevelopmentCampaignPlan()`.
- Lifecycle guard: holdout-verified hypothesis не дублируется новой hypothesis до репликации.
- Migration 119→120; P36 state v3.
- Dedicated audit + deterministic regression.

## Самообман исключён на этом уровне
`runSafeExperiment()` остаётся preview-only. Synthetic outcome не может повышать mastery, acceptedChanges или action policy. Promotion идёт только через external evidence gate.

## Научный статус
D-VOI не является доказательством свободной воли или сознания. Он создаёт реальный механизм самостоятельного выбора исследовательского дефицита и запроса опыта. Сам факт обучения подтверждается только внешним, delayed/holdout evidence.

## Результат
`BIG_PASS_111_SELF_DIRECTED_LEARNING=PASS` — выбран `world-model`, D-VOI score `0.748`, campaign `10` slots, lifecycle stage `replicated` на synthetic fixture. Эти значения доказывают работу механизма, не реальное обучение организма.
