# WorkPass534 — разделение полномочий P36: экспериментальные свидетельства и зрелость

**Дата:** 25 октября 2026 г.  
**Ветка:** `feature/learning`  
**PR:** [#79 → integration](https://github.com/ailtron1ss-rgb/NK1/pull/79)  
**Проверка:** исходники и регрессионные сценарии обновлены; точный HEAD не подтверждён запуском CI/typecheck.

## Причина

WorkPass532 добавил адаптер `P36VerifiedOutcomeLedgerEvaluator`, который рассчитывает baseline/treatment только по подписанным authenticated holdout-артефактам. Он принципиально ограничен `delayMs: 0`: подписанная оценка holdout подтверждает качество на заданном наборе задач, но сама по себе не доказывает ретенцию навыка через время или перенос на новые задачи.

До этого прохода единый зарезервированный ID `organism.learning.p36.evaluate-evidence` обслуживал как экспериментальные свидетельства, так и payload с `kind: 'developmental-outcome'`. Нельзя допускать, чтобы точечный holdout-адаптер случайно стал авторитетом зрелости из-за выбора поля запроса.

## Изменения

### Два независимых host-owned слота

- `organism.learning.p36.evaluate-evidence` — `OrganismConfig.p36IndependentEvaluator`. Предназначен для измерения baseline/treatment/holdout.
- `organism.learning.p36.evaluate-maturity` — `OrganismConfig.p36DevelopmentalOutcomeEvaluator`. Предназначен для отдельно измеренного developmental outcome, delayed retention и transfer.

Оба слота регистрируются при создании `OrganismCore`, проходят базовую проверку host-конфигурации и недоступны для перехвата через публичный `registerActionTool`. Generic публичная регистрация любого из этих двух ID отклоняется.
Если настроены оба слота, Core дополнительно требует, чтобы у них различались `sourceId` и `independenceKey`. Совпадение любого из них отклоняет конфигурацию с `p36-evaluator-authorities-must-be-distinct`; это предотвращает случайное повторное использование одного source identity в двух ролях. Это структурная защита от конфигурационной ошибки, но не криптографическое доказательство независимости — доверенный production-хост всё равно отвечает за реальные независимые реализации.

Если настроены оба слота, Core дополнительно требует, чтобы у них различались `sourceId` и `independenceKey`. Перед сравнением идентификаторы нормализуются через NFKC, trim и сведение регистра; это закрывает алиасы, различающиеся пробелами или регистром. Совпадение отклоняет конфигурацию с `p36-evaluator-authorities-must-be-distinct`. Это структурная защита от конфигурационной ошибки, но не криптографическое доказательство независимости — доверенный production-хост всё равно отвечает за реальные независимые реализации.


### Core routing fail-closed

`OrganismCore.finalizeToolOutcome` теперь направляет `kind: 'developmental-outcome'` в `observeDevelopmentalOutcome` только если ID равен `P36_DEVELOPMENTAL_OUTCOME_TOOL_ID`. Обычная запись baseline/treatment допускается только при `P36_EXTERNAL_EVIDENCE_TOOL_ID` и не-maturity payload. Любая комбинация неверного ID и типа свидетельства записывается как отклонение, а не меняет состояние P36.

На уровне самого `P36AutonomousSelfDevelopmentEngine` метод `observeDevelopmentalOutcome` требует и правильный `kind`, и квитанцию с правильным зарезервированным maturity ID, привязанную к полному кортежу входных данных и конкретным execution/decision ID.

### Проверки

- `tests/p36-self-development.mjs`: обе зарезервированные роли выдаются отдельными ActionGateway fixtures; maturity receipts создаются в соответствующем lane.
- `tests/p36-integration.mjs`: Core настраивает оба evaluator-слота, проверяет их наличие, блокирует takeover обоих ID через общий реестр и направляет зрелость только во второй слот.
- Existing signed-ledger evaluator остаётся привязан к experiment slot; он не становится maturity evaluator через payload-поле.
- Обновлены `CHANGELOG.md` и `NEUROCORE_START_HERE.md`.

## Ограничения и статус проверки

**Подтверждено изменением кода:** полномочия разделены на два ID и два construction-time config slots; Core и P36 проверяют соответствующий lane; тестовые сценарии пересозданы под раздельные ID.

**Не подтверждено запуском:** TypeScript typecheck, текущий P36 unit/integration suite и exact-HEAD workflow. Никакое заявление о прохождении тестов в этом отчёте не делается.

**Ещё требуется для полноценной автономной зрелости:** production host должен передать реальный independent maturity evaluator, который наблюдает фактические отложенные исходы. Signed ledger adapter из WorkPass532 доказывает только моментальный holdout. Для зрелости нужны независимо проверяемые delayed-retention/transfer артефакты, повторная аутентификация signed artifacts после рестарта и exact-HEAD CI.

`main` и GitHub Release ZIP не изменялись. Новых runtime-зависимостей не добавлено.
