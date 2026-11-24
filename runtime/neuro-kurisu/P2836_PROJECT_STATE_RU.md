# Project State — 35.18.2 / P2836

Дата: 2026-09-20

## Что реально изменилось

П2836 не расширяет проект только количеством подсистем. Основной runtime теперь различает predictive shadow world и external grounded outcome.

### Новый real code

- `src/organism/system/RealityGroundingController.ts`
- `src/organism/system/NeuralCausalTraceLedger.ts`
- `src/organism/core/OrganismRuntime.ts`
- `src/organism/core/OrganismCore.ts`
- `src/organism/cognition/P2820SelfKnowledgeCoresetBridge.ts`
- `src/organism/cognition/NeuralExperienceBranch.ts`

### Новые проверки

- `tests/p2836-reality-first-loop.mjs`
- `tests/p2836-neural-causality-fast.mjs`

## Проверенные результаты

- TypeScript typecheck — PASS.
- P2835 hotpath — PASS, 40 outcomes.
- P2835 persistence — PASS, 48 outcomes + restart.
- P2836 reality-first — PASS.
- P2836 fast neural ablation — PASS, lesion score L1 = 0.042866.
- Server smoke — PASS.
- Organism smoke — PASS.
- Mobile 256 MB smoke — PASS.
- Architecture audit — PASS, cycles=0, legacyLeakage=0.
- Source hygiene — PASS, errors=0, warnings=0.
- Release contract — PASS.
- Integrity — PASS.
- Release source verification — PASS.
- Archive manifest — PASS.

## Объём текущего прохода

Сравнение с исходным P2835 архивом:

- исходных файлов: 3811;
- текущих файлов: 3824;
- добавлено: 13 файлов;
- изменено: 11 файлов;
- удалено: 0;
- добавлено строк: 1091;
- удалено строк: 145;
- всего строковых diff-операций: 1236;
- `src/organism`: 492 added / 105 deleted;
- tests: 68 added;
- release/config: 107 added / 40 deleted;
- research/docs: 424 added.

Кодовые изменения (`src` + tests) составляют 665 из 1236 строковых diff-операций, то есть **~53.8%** всего изменения по строкам. Только основной production-код `src/organism` даёт **~48.3%** всех diff-операций. Это именно проход code-first; research/release разделы сохранены отдельно, чтобы новые решения не терялись, но они не заменяют реализацию.

## Инженерная оценка относительно конечной цели

Это внутренние рабочие оценки, а не научный benchmark.

| Область | Оценка |
|---|---:|
| Canonical runtime/integration | 82/100 |
| Neural substrate | 72/100 |
| Reality grounding / embodiment | 63/100 |
| Continuous life / persistence | 84/100 |
| Memory | 81/100 |
| World model | 68/100 |
| Autonomous agency/goals | 68/100 |
| Identity/personality | 65/100 |
| Lifelong external learning | 40/100 |
| Social organism | 55/100 |
| Mobile/Termux readiness | 65/100 |
| Causal verification | 55/100 |
| Consciousness research readiness | 20/100 |

### Общая готовность к целевой архитектуре

**≈63/100**.

Главный смысл этой оценки: много когнитивных механизмов уже существует, но внешнее grounding, причинная атрибуция, длительное обучение в реальном мире и научная проверка сознания всё ещё не закрыты.

## Почему полный B365 causal test не засчитан

Исторический `test:big-pass-365:core-causality` не завершился даже за 300 секунд. Это не объявляется PASS и не используется как доказательство регрессии P2836: тест многократно создаёт тяжёлые полные `OrganismCore` instances. Для текущего релиза добавлен быстрый independent lesion check (`P2836_NEURAL_ABLATION_FAST=PASS`), а тяжёлый test остаётся operational-debt benchmark.

## Текущий главный bottleneck

После P2836 главным ограничением является уже не отсутствие ещё одного cognition-модуля. Главные следующие границы:

1. настоящий Android-device run с `external` primary outcome;
2. независимая verification эффектов actuator actions;
3. visual semantic grounding от камеры;
4. длинный real-world learning benchmark;
5. causal lesion/intervention matrix;
6. дальнейшее уменьшение монолитности `OrganismCore`.

## Что обязательно не считать доказанным

- P2836 reality-first в Node проходит с simulation fallback, потому что текущая среда не является Android-устройством; это проверка маршрутизации, а не доказательство физического external outcome.
- Быстрый neural ablation подтверждает наблюдаемый сдвиг при lesion, но не заменяет большую причинную матрицу и повторные эксперименты.
- `reward01` внешнего контура — консервативный grounded execution/evidence сигнал, не task-success reward.
- Тяжёлый исторический B365 causal test (`test:big-pass-365:core-causality`) остаётся незавершённым из-за resource/time ceiling и не засчитывается как PASS.
