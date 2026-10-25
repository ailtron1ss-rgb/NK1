# NK1 — контракты зависимостей и карта связей модулей

**Дата:** 2026-10-24  
**Источник:** branch `architecture/dependency-contracts-2026-10-24`, head `807676edec318f5f63a6ad332b12e64ef5623a29`  
**Целевая ветка:** `workpass331-project-ordering-unified-20261024`  
**Назначение:** уменьшить скрытую связанность между когнитивным runtime, API, интерфейсом, исследовательским мостом, долговременным состоянием и интеграционными инструментами. Это архитектурный контракт для следующих изменений, а не заявление, что все существующие импорты уже соответствуют ему.

## 1. Что подтверждено в текущем дереве

Корневой package.json содержит отдельные команды audit:server-imports, audit:ui-api-linkage, test:integration и audit:quick. Runtime-пакет содержит собственные audit:architecture, audit:contract, audit:integrity, audit:hygiene и типизированные тесты когнитивного цикла. tools/verify-integration.mjs явно проверяет существование runtime server, UI API-клиента, legacy avatar, Live2D-ресурса, research bridge и contracts/integration-manifest.json, затем поднимает runtime и bridge и обращается к их HTTP endpoints.

Это означает, что интеграционные точки уже существуют, но сами по себе проверки наличия файлов и smoke-тесты не доказывают корректность всех направлений импортов, отсутствие циклов или единственность владельца состояния.

## 2. Целевая карта слоёв

```text
app / UI / avatar
      │ typed HTTP contract; DTO only
      ▼
API boundary / server routes
      │ use-case ports
      ▼
cognitive orchestrator (single cycle owner)
      ├──> perception adapters
      ├──> appraisal / drives / goals
      ├──> planning
      ├──> policy + EthicalGate
      ├──> ActionGateway -> tools / actuators
      ├──> memory ports -> memory implementations
      ├──> learning ports -> candidate/evaluation/promotion lifecycle
      └──> reflection / observability
research bridge ──> documented runtime API (never private in-process state)
persistence adapters ──> owned schemas + migration/version boundaries
```

Стрелка означает разрешённое направление зависимости. Это целевая схема; перед массовым переносом нужно сверить реальные пути модулей и закрепить каждый запрет исполняемым аудитом.

## 3. Жёсткие правила зависимостей

1. **Владение когнитивным циклом — одно.** Perceive → Appraise → Plan → Gate → Act → Reflect → Consolidate вызывается одним оркестратором. UI, scheduler, research bridge и отдельные подсистемы не должны обходить его и самостоятельно запускать побочные действия.
2. **Все внешние действия проходят через один шлюз.** Planner формирует намерение; policy/EthicalGate проверяет его; ActionGateway исполняет; receipt/result возвращается обратно в цикл. Нельзя вызывать tool/actuator напрямую из планировщика, памяти, UI или обучающего модуля.
3. **Зависимости направлены к контрактам, а не к реализациям.** Core объявляет узкие интерфейсы/ports; файловая БД, HTTP, модели и внешние библиотеки подключаются адаптерами на внешнем крае. Core не импортирует UI, web-server framework, research bridge или конкретный storage driver.
4. **UI зависит только от публичного API.** Клиент не импортирует серверные модули, внутренние классы памяти, прямые пути к БД или внутренние типы runtime. DTO и ошибки API версионируются и проверяются контрактными тестами.
5. **Research bridge — внешний клиент.** Он обращается к runtime по документированному API и не редактирует состояние организма напрямую. Таймаут, недоступность bridge и повтор запроса не должны блокировать основной когнитивный цикл.
6. **Подсистемы памяти не владеют идентичностью/циклом.** Они предоставляют операции записи, извлечения, консолидации и происхождения фактов. Решение о том, когда вспоминать/записывать, принимает оркестратор через memory ports.
7. **Обучение не меняет активную политику напрямую.** Ошибка/траектория → диагностика → кандидат → изолированная оценка → независимый holdout → gate → явная promotion. Нельзя создавать циклическую зависимость runtime → learner → runtime через импорт внутренних реализаций.
8. **Общее состояние имеет одного владельца.** Для каждой сущности (identity, drives, goals, memory index, action receipts, skill candidates) определить owner, schema/version и единственный путь записи. Остальные модули используют команды/события или read-only проекции.
9. **События не заменяют контракты.** Event payload имеет версию, correlation ID, source, timestamp и idempotency key для повторяемых операций. Ошибки и неизвестные версии должны быть явными, а не молча превращаться в пустое состояние.
10. **Никаких скрытых циклов импортов.** Общие типы переносятся в узкие contract-пакеты, а не в универсальный utils или barrel, который повторно экспортирует реализации.
11. **Не добавлять второй путь для той же операции.** Перед созданием нового gateway, scheduler, memory facade или API-клиента нужно найти действующего владельца и расширить его контракт.
12. **Ошибки деградации локализованы.** Отказ voice/avatar/research/optional model не должен обрушать память, безопасность или основной цикл; отказ policy/action receipt, напротив, должен fail closed для внешнего действия.

## 4. Матрица владения и разрешённых связей

| Узел | Владелец | Разрешено зависеть от | Запрещено |
|---|---|---|---|
| Cognitive orchestrator | Порядок цикла и корреляция шага | ports, policy, DTO | UI, concrete DB, research internals |
| Perception adapters | Нормализация наблюдений | sensor interfaces, schema | Прямое действие, запись identity |
| Drives / goals / appraisal | Оценка состояния и приоритетов | core types, clock, state ports | HTTP/UI, tool execution |
| Planner | Кандидаты планов/намерений | world model, goal snapshot, action descriptions | Прямой вызов tools, обход policy |
| EthicalGate / policy | Разрешение/запрет | policy facts, intent schema | Исполнение действия, скрытая запись в память |
| ActionGateway | Исполнение и receipts | tool adapters, policy decision, idempotency | UI и planner-specific internals |
| Memory subsystem | Хранение/поиск/консолидация | memory contracts, persistence adapter | Управление полным циклом, прямое действие |
| Learning subsystem | Кандидаты и оценка изменений | trajectories, evaluator contracts, holdout | Самостоятельная активация кандидата |
| API/server | Внешняя граница | use cases, DTO, auth | UI implementation imports, прямые обходы gateway |
| App/avatar | Отображение и пользовательский ввод | versioned API DTO | DB/runtime private imports |
| Research bridge | Исследовательские запросы | public runtime API | Импорт private runtime state |
| Observability | Метрики/журналы | redacted events | Авторитетное изменение доменного состояния |

## 5. Обязательные инварианты интеграции

- **Один путь действия:** любой action intent заканчивается разрешением policy и проверяемым receipt; при неопределённом исходе повтор ограничен idempotency.
- **Один владелец состояния:** два модуля не пишут один доменный объект независимо.
- **Без обратных импортов:** UI/API и adapters не становятся зависимостью когнитивного ядра.
- **Контракт прежде реализации:** schema/API/event версии тестируются отдельно от реализации.
- **Неизвестное — не успех:** отсутствующий receipt, пропущенный gate, несовпадающая версия схемы или непроверенный результат не засчитываются как успешная операция.
- **Изоляция необязательных возможностей:** сбой внешнего голоса/аватара/исследовательского сервиса не должен менять решение policy и не должен уничтожать накопленное состояние.
- **Наблюдаемая причинность:** correlation ID связывает вход, appraisal, plan, gate, action receipt, memory write и итоговую оценку без записи секретов.

## 6. Практический план внедрения

### P0 — сначала закрыть обходы
- Составить машинно-читаемый список владельцев и импортных границ для core, memory, motivation, learning, embodiment, self, API, research и persistence.
- Усилить существующие audit:server-imports, audit:ui-api-linkage и runtime audit:architecture: проверять реальные относительные imports, циклы и запрещённые server/client направления, а не только наличие маркеров.
- Проверить, что все tool execution paths сходятся в ActionGateway и что ни один planner/legacy adapter не выполняет действие напрямую.

### P1 — закрепить API и состояние
- Версионировать DTO/event schemas; добавить contract tests для success, timeout, malformed payload, stale version и duplicate request.
- Выделить узкие ports для memory, clock, action execution, learning evaluation и observability.
- Зафиксировать миграции и одного владельца записи для каждого persistable aggregate.

### P2 — уменьшить связанность
- Разрывать циклы через ports/events и переносить только типы в contract-модули.
- Заменять широкие imports точечными интерфейсами; не создавать общий barrel с побочными эффектами.
- Считать долю межслойных imports, циклы, число обходов gateway и контрактные нарушения в CI.

### P3 — проверять поведение, а не только граф
- Интеграционные тесты: отказ memory store, timeout research bridge, повтор action request, отказ policy, устаревший DTO, restart с восстановлением receipts.
- Регрессии: цикл не запускается дважды из UI и scheduler; ошибка avatar не ломает ответ; learner не продвигает кандидата без holdout.
- Не объявлять архитектуру готовой до фактического запуска аудитов на текущем дереве.

## 7. Команды для проверки в рабочем клоне

Из корня проекта:

```bash
npm run audit:server-imports
npm run audit:ui-api-linkage
npm --prefix runtime/neuro-kurisu run audit:architecture
npm --prefix runtime/neuro-kurisu run audit:contract
npm --prefix runtime/neuro-kurisu run audit:integrity
npm run test:integration
```

Примечание к первой команде: `audit:server-imports` теперь обходит транзитивный граф относительных импортов от серверной точки входа, а не только её непосредственные импорты. Скрипт проверяет реальное разрешение локальных рёбер и печатает JSON-отчёт; регрессионный тест подключён к той же команде. Это усиливает проверку полноты графа, но само по себе ещё не доказывает отсутствие всех запрещённых архитектурных направлений. `audit:architecture` дополнительно включает побочные импорты и строковый `require()`, а также умеет разрешать NodeNext-импорты `.js` к исходникам TypeScript. `audit:architecture` теперь использует отдельную тестируемую policy: она блокирует зависимости canonical organism → app/UI, app-server, runtime-server, research и legacy, а также app/src → private runtime source. `tests/architecture-dependency-boundaries.test.mjs` содержит fixture-тесты этих запретов и запускает проверку полного дерева. При успехе аудитор печатает число `dependencyEdges` и `boundaryViolations=0`, чтобы отчёт показывал измеримый размер графа и результат проверки границ.

В этом порте добавлены `dependency-boundary-policy.mjs`, регрессии `architecture-dependency-boundaries.test.mjs` и `server-import-graph-audit.test.mjs`; команды `audit:architecture` и `audit:server-imports` теперь запускают эти проверки. Проверки затрагивают только графы локальных импортов/слоёв и не доказывают отсутствие всех динамических/внешних зависимостей. Exact-head GitHub Actions для целевой ветки ещё должен подтвердить их фактическое прохождение; до этого статус — `IMPLEMENTED / UNVERIFIED`, не `PASS`.

## 8. Definition of Done для области «зависимости и связи»

- [ ] Граф импортов построен по фактическому коду и версионирован как артефакт.
- [ ] Нет циклов между core, memory, learning, API и UI.
- [ ] Нет прямого исполнения tool/actuator в обход ActionGateway и policy gate.
- [ ] UI и research bridge используют только публичные версионированные контракты.
- [ ] Для каждой записи состояния указан единственный владелец.
- [ ] Контрактные тесты покрывают отказ, повтор, stale schema и restart.
- [ ] Все аудиты запущены на одном и том же commit; отчёт хранит SHA и результаты.
- [ ] Любое нарушение блокирует CI с конкретным файлом и ребром графа.

**Статус:** контракт и целевая модель добавлены; фактический граф всех импортов, изменения runtime-кода и результаты исполнения проверок остаются отдельными незавершёнными шагами.
