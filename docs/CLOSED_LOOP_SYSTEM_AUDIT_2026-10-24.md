# NK1 — аудит замкнутых циклов (2026-10-24)

## Цель

Замкнутый цикл в NeuroCore — это не наличие бесконечного `while`. Это завершённая цепочка:

`наблюдение → прогноз → оценка → внимание/память/цель → план → действие → независимо проверенный результат → обучение → обновление модели себя → фиксация состояния`.

Для каждого начатого цикла система должна сохранять один различимый терминальный результат: `PASS`, `DEGRADED` или `FAIL`. Ошибка, отмена, частичный результат или сбой сохранения не должны превращаться в успех или выдавать обучающий сигнал, которого не подтверждают факты.

## Карта уже существующих контуров

| Контур | Реальная опора в исходниках | Роль |
|---|---|---|
| Когнитивный | `OrganismRuntime.stepInternal`, `CognitiveEventFabric`, `UnifiedCognitiveCycle` | Сквозные этапы с идентификаторами и проверкой причинной целостности |
| Наблюдение / действие / результат | `RuntimeEvidenceBus`, `ExternalPostconditionVerifier`, `RealityGroundingController` | Различение наблюдения, симуляции и внешнего результата |
| Обучение из последствий | `RealityLearningGate`, `OrganismCore.feedback`, `P23LearningEngine` | Ограничение обучающего кредита качеством и происхождением доказательств |
| Обучение навыков | `VerifiedOutcomeLedger`, `VerifiedOutcomePromotionGate`, независимая оценка кандидатов | Парные сравнения, holdout, регрессии и отделение подготовки кандидата от его активации |
| Непрерывность | `ContinuousCognitiveFabric`, `ContinuityLedger`, `RuntimeClosureLedger` | Согласование тиков, памяти, непрерывности, повторного запуска и durable-состояния |
| Причинное замыкание | `CausalDomainClosureLedger` | Фиксация изменений памяти, мира, агентности, обучения и self-update |
| Микроцикл и ресурсы | `OperationalMicroCycleRuntime`, `CognitiveResourceEconomy`, `RuntimePerformanceGovernor` | Недорогие тики, нормализация датчиков, бюджетирование и адаптация частоты |
| Фоновые действия | `RuntimeClockScheduler`, reflection/embodiment/cognitive clocks | Вызов задач по расписанию с журналированием ошибок |

Эти контуры уже существуют. Этот проход не создаёт второй параллельный когнитивный движок — он укрепляет терминальные состояния общего runtime-цикла.

## Реальные изменения WorkPass328

1. `RuntimeClosureLedger.fail()` записывает терминальный `FAIL`, проверку причины и fingerprint сбоя. Нормализатор состояния при restore отклоняет некорректные записи и понижает противоречивые `PASS`, если в их checks есть `ok=false`.
2. `CausalDomainClosureLedger.failPending()` закрывает незавершённый цикл, а `failLatest()` понижает уже закрытый цикл при сбое поздней финализации (`endBatch`, аварийный checkpoint или shutdown). Любой конечный `FAIL` получает причинный score `0`; уже наблюдавшиеся изменения мира/обучения сохраняются, а неподтверждённые durable claims отзываются.
3. Повторный `CausalDomainClosureLedger.begin()` больше не затирает pending-цикл: предыдущая попытка получает `FAIL` с причиной `previous-cycle-unclosed-at-next-begin`, затем начинается новая попытка.
4. Итог `UnifiedCognitiveCycle` соединён с `RuntimeClosureLedger` и `CausalDomainClosureLedger`. Пропущенные/рассинхронизированные обязательные стадии означают `FAIL`; aligned ticks и успешное сохранение сами по себе не могут продвинуть цикл до `PASS`.
5. `OrganismRuntime.stepInternal` проверяет `AbortSignal` на входе, после основных awaited perception/observation/proposal-граней и непосредственно перед `embodiedActions.execute`. Регрессия проверяет раннюю отмену и отмену во время финальной генерации без передачи действия executor-у.
6. `beginBatch()` failure теперь получает terminal-запись runtime и causal ledger, а не только строку ошибки.
7. `stop()` стал single-flight: конкурентные вызовы разделяют один durable shutdown; при сбое final checkpoint фиксируется terminal failure, а continuity journal закрывается в `finally`.
8. Исправлена регистрация P23 фонового repair/revision clock: `p23-compound-repair-revision` теперь разрешён типом/registry `RuntimeClockScheduler`, и opt-in часы запускаются после `init()`. `tests/runtime-clocks.mjs` теперь регрессирует этот контур.
9. В `CognitiveEventFabric` удалена дублирующая реализация `verifyOperationalCycle`; сохранена одна каноническая, расширенная проверка обязательных и переданных optional-этапов/причинных рёбер.
10. Исправлен некорректный character-class в `OutcomeVerificationService` для проверки управляющих символов в correlation IDs. Добавлена защита тестом, что в `CognitiveEventFabric` остаётся один verifier.
11. Добавлены `test:p328:closed-loop-failure-closure` и `audit:p328:closed-loop-failure-closure` (typecheck + регрессия); новый тест и `test:runtime-clocks` подключены к `test:rebuild-recovered`. `CHANGELOG.md` отражает изменения.

## Инварианты, которые теперь проверяются регрессией

- каждый начатый цикл получает терминальную запись, включая отказ `beginBatch()`, исключение, отмену и потерю финализации;
- повторный `begin()` не затрагивает предыдущую pending-запись молча; прежняя попытка закрывается как `FAIL`;
- отсутствие обязательной стадии, неверное causal ребро или tick mismatch не может получить `complete=true`;
- любой terminal `FAIL` имеет causal score `0`; durable / restore не повышает неудачный цикл до `PASS`;
- поздняя ошибка финализации не переписывает уже наблюдавшиеся изменения мира/обучения; она отзывает только неподтверждённые durability claims;
- противоречивые persisted summary, stage checks и causal records нормализуются по более строгому статусу;
- `AbortSignal` останавливает цикл до inference, после основных awaited-granей и перед embodied-action dispatch;
- opt-in P23 repair/revision clock разрешён scheduler-ом и запускается только при включённой конфигурации;
- параллельные вызовы `stop()` используют одну shutdown-процедуру; причина сбоя и fingerprint не стираются служебными durable-записями.

## Осталось закрыть отдельно

- **Точная CI-проверка:** workflow реально запускался на прежнем PR merge SHA `c4c1189e900e7aa70aa7ab1d56487ffa343843a7` (head тогда был `2990f2cf4d8b364dfbbdea9bb1d09f948c51c45d`). App typecheck упал на нетронутом `app/src/legacy/avatar/safeLocalStorage.test.mjs`; Runtime/P26 typecheck сообщил многочисленные ошибки в нетронутых Node shims/типах; WorkPass79 упал на `tests/p23-signed-outcome-artifact.mjs:33` (`duplicate-attempt`, actual `undefined`). Этот run также выявил loop-ошибки в P23 clock kind, дублирующемся verifier и regex, которые затем исправлены. Новый HEAD требует нового запуска; эти старые runs не подтверждают текущий код.
- **Проверка конкурентных границ:** контролируемые инварианты для одновременных `stop()`, `flush()`, `AbortSignal` и входящего autonomous clock требуют отдельного стресс-теста.
- **Проверка полного внешнего цикла:** реальная Android/Termux телеметрия, исполнительное подтверждение, отмена аудио/Live2D и browser E2E остаются незакрытыми release gates.
- **Независимый эффект обучения:** нельзя объявлять контур улучшившимся лишь потому, что он провёл обновление. Требуются paired seeds, неизменяемый holdout, сравнение с baseline и отсутствие семейных регрессий.
- **Отдельное утверждение навыка:** candidate generation, independent evaluation, approval и activation должны оставаться разными этапами; этот проход не активирует навыки автоматически.
- **Релизный артефакт:** исходники изменены на отдельной ветке. Новый ZIP из Releases не собран и не опубликован.

## Проверка состояния после интеграции

Workflow `workpass71-validation.yml` теперь выполняет целевую regression `test:p328:closed-loop-failure-closure` и `test:runtime-clocks` сразу после install, до App typecheck, чтобы ошибки соседнего приложения не скрывали их результаты.

После фактического запуска на одном и том же commit SHA выполнить:
1. `npm run audit:p328:closed-loop-failure-closure` — TypeScript check + новая регрессия;
2. `npm run test:p2685:runtime-closure` — действующий runtime closure/restart тест;
3. `npm run test:rebuild-recovered` — существующий агрегат реконструированных регрессий;
4. проверить отдельные assertions для ранней отмены, отмены до embodied-action, beginBatch failure, сохранения failure state и конкурентного `stop()`;
5. проверить restart/durable поведение и реальные GitHub Actions job steps/logs. Пустой workflow status или запуск без назначенного runner не являются результатом исполнения тестов.

## Критерий закрытия задачи

Цикл считается замкнутым не потому, что код дошёл до конца функции, а если зафиксировано, чем закончилась попытка, результат связан с исходным решением, ошибка не превращается в положительный обучающий сигнал, а продолжение/повторный запуск сохраняет непротиворечивую историю.
