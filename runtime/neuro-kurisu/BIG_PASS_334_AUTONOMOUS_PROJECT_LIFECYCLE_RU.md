# BIG PASS 334 — Autonomous Project Lifecycle & Persistence

Дата: 2026-09-14

## Почему B334

Перепроверка B333 показала: организм уже способен порождать внутренние цели, но одной записи `goal created internally` недостаточно. Следующий вопрос — может ли внутренняя цель стать собственной долговременной деятельностью.

B334 НЕ создаёт новую систему целей. Он ставит evidence-gate над уже существующим `SelfDirectedLifeOrchestrator` и его persistent commitments.

## Что измеряется

`genesis -> commitment -> execution -> progress -> interruption -> resume -> revision -> completion/abandonment`

Для каждого project/commitment фиксируются:
- источник и autonomous provenance;
- execution count;
- verified outcomes;
- progress;
- interruption/resume;
- revisions;
- terminal transition;
- persistence.

## Unit gate

PASS:
- 12 autonomous cycles;
- 1 project;
- 12 verified outcomes;
- 1 interruption;
- 1 revision;
- 1 resume;
- persistence после restore.

## Live Core

PASS:
- 16 operational cycles без внешнего текста;
- 16 autonomous cycles;
- 3 internally sourced projects;
- 31 verified outcomes;
- 1 project completed как один edge transition, без повторного counting на следующих циклах;
- projectPersistence01 = 1.0;
- snapshot/restore diagnostics совпали.

## Negative control

PASS:
- 6 cycles с явным внешним запросом;
- externalInputCycles >= 5;
- autonomous projects started = 0;
- lifecycle gate остаётся ineligible.

## Реальный дефект, найденный во время перепроверки

Первая версия observer-а неправильно считала один и тот же `completed` project несколько раз на последующих циклах. Например, мог получаться `projectsCompleted=11` при `projectsStarted=3`.

Это было исправлено: completion/abandonment/interruption теперь считаются как edge transitions, а не как состояние, повторяемое каждый тик.

После исправления live Core дал `projectsStarted=3`, `projectsCompleted=1`.

## Что B334 доказывает

Доказан ограниченный organism-level lifecycle:

`внутренняя цель -> persistent commitment -> repeated execution -> verified progress -> completion/restart persistence`

А также контролируется interruption -> revision -> resume.

## Что B334 НЕ доказывает

Не доказано:
1. многодневное/многосессионное самостоятельное ведение проекта;
2. сложная иерархия self-generated subgoals;
3. перенос autonomous project на unseen environment;
4. независимое external-world consequence ownership;
5. реальная Android embodiment как источник целей;
6. сознание.

## Regression

PASS:
- B326;
- B327;
- B328;
- B329;
- B330;
- B331;
- B332;
- B333;
- B334;
- `npm run typecheck`;
- integrity/syntax/release-contract gates.

## Progress

Консервативная общая оценка остаётся около 73%. Новый gate увеличивает доказательность autonomous-life контура, но не даёт оснований механически добавлять проценты.

## Следующий этап

B335 — autonomous project holdout/transfer: проверить, что внутренняя цель сохраняет собственную стратегию в новом контексте, умеет менять подцели и не получает преимущества от внешнего harness.
