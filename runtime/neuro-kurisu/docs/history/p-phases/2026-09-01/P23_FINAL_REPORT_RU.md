# P23 Final Report — True Learning & Counterfactual Development

## Статус

P23 реализован в релизе `7.3.0` / core `20.0.0-p23-true-learning-counterfactual-development` / state schema `26`.

Главная цель P23 — закрыть разрыв, который был явно найден при ревизии P21/P22: в системе было много когнитивных эвристик, но мало проверяемого механизма, который показывал бы, что история опыта реально меняет будущую policy.

P23 не заявляет «настоящего сознания» и не называет модельные оценки физическими контрфактическими экспериментами. Он вводит измеримый слой обучения, replay, независимого baseline-поведения, валидации навыков и целостности persisted learning state.

## Что добавлено

### 1. P23LearningEngine

Новый canonical-компонент:

`src/organism/learning/P23LearningEngine.ts`

Он хранит и обрабатывает:

- experiences с `stateBefore` + `stateAfter`;
- replay updates с TD-error и learning rate;
- независимые shadow comparisons;
- policy skills с train/validation split;
- ablation adaptive-policy;
- evidence-debt очередь с информационной ценностью проверки;
- persisted cognitive checksum;
- измеримые learning diagnostics.

### 2. StateAfter стал частью decision trace

`OrganismDecisionTrace.stateAfter` записывается после получения outcome. Это исправляет ключевой недостаток старой replay-схемы: next-state больше не восстанавливается из того же самого `stateBefore`.

### 3. P23 replay действительно меняет policy

В отличие от прежнего replay, где next context фактически совпадал с before context, P23 использует:

`stateBefore → action → outcome → stateAfter`

и выполняет отдельный offline TD-update с меньшим learning rate.

Legacy Longitudinal replay больше не выполняет дополнительный mutation policy в `consolidateLongitudinal()`, поэтому один опыт не обучает policy дважды разными replay-механизмами.

### 4. Independent Shadow Baseline

Shadow теперь является независимым правилом выбора действия, которое не читает AdaptivePolicyEngine.

Он используется как baseline для сравнения:

`actual organism policy vs independent conservative heuristic`

Это baseline для оценки, а не второй «организм» и не доказательство superiority.

### 5. Skill promotion с holdout-validation

P23 не считает навык подтверждённым только по частоте использования.

Промоция требует:

- минимум 8 наблюдений;
- train/validation split;
- достаточной train success;
- достаточной validation success;
- минимальной согласованности train и validation.

Только `promoted` skills получают фактический P23 bias в выборе действий.

### 6. Evidence Debt Market

Нерешённые контексты/action-patterns ранжируются по:

`uncertainty × priority / estimated verification cost`

Высокий приоритет реально немного повышает полезность `verify`, то есть очередь доказательств влияет на поведение, а не существует только в dashboard. Успешная verification-трасса затем снижает соответствующий debt и слабые записи постепенно удаляются.

### 7. Adaptive-policy ablation

P23 добавляет проверку:

`decision with learned adaptive-policy contribution`

против

`decision with adaptive-policy contribution removed`.

Это пока только ablation одного модуля, а не полного lesion-study всех органов организма.

### 8. Cognitive checksum

Persisted learning state теперь имеет SHA-256 checksum, вычисляемый из канонизированного JSON-представления ключевого learning material.

Checksum проверяется при восстановлении и пересоздаётся на commit checkpoint.

Ключевое свойство: сериализация и in-memory представление дают одинаковый digest при нормальном JSON round-trip.

## Дополнительное исправление, найденное при повторной ревизии P22

При проверке предыдущего релиза обнаружено, что серверный `/api/organism/chat` после `runtime.step()` повторно вызывал `generateLanguage()`, хотя runtime уже возвращал готовый language result.

Это означало фактически два обычных LLM-вызова на серверном chat path, несмотря на P22 intention.

P23 это удаляет.

Теперь сервер использует:

`const language = step.language;`

То есть нормальный chat path действительно выполняет один language pass, а второй появляется только при явном `deliberate=true`.

## Новые API поверхности

`GET /api/organism/learning`

Возвращает:

- learning metrics;
- top promoted skills;
- evidence debt queue;
- checksum state.

Кроме того P23 learning diagnostics добавлены в `/api/organism/status` и `/api/metrics`.

## Migration

State schema:

`25 → 26`

Старые persisted states не удаляются. P23 state создаётся через defaults и миграционную нормализацию.

## Проверки P23

Проверены:

- TypeScript typecheck;
- direct P23 learning test;
- P23 migration 25→26;
- P23 integration with persisted FileStateStore;
- checksum round-trip after reload;
- server chat truthfulness contract;
- P22 phone policy regression;
- P22 chat-routing regression;
- legacy deterministic replay regression;
- model-switch continuity regression.

## Что P23 сознательно НЕ утверждает

1. Model-alternative prediction не является физическим контрфактическим экспериментом.
2. Shadow baseline не является вторым полноценным организмом.
3. Adaptive-policy ablation не является ablation всех cognitive modules.
4. Learning diagnostics не являются доказательством general intelligence.
5. Долгий физический прогон на POCO всё ещё требует реального устройства.

## Что теперь можно проверять реально

После P23 можно наблюдать:

- сколько уникального опыта накоплено;
- сколько опыта реально прошло offline replay;
- как часто independent baseline расходится с organism policy;
- какие policy skills проходят holdout validation;
- насколько меняется prediction error во времени;
- какой вклад даёт adaptive policy при ablation;
- целостность persisted learning state после restart.

## Результат

P23 переводит learning subsystem из категории «набор эвристик, который может обучаться» в категорию «есть отдельный persisted механический контур, который может быть измерен, replayed, ablated и проверен после восстановления».

Это не финальная система обучения. Но это существенно более честная база для P24.

## Повторная forensic-проверка после P23

При миграции всех старых migration-tests на schema 26 была найдена и исправлена устаревшая проверка P15, которая всё ещё ожидала schema 25. Дополнительно исправлена одна слишком длинная строка в `StateMigrations.ts`, после чего forensic audit снова проходит без предупреждений.
