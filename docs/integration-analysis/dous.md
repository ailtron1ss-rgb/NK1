# DOUS — финальный архитектурно-семантический разбор Нейро Курису и окончательный план интеграции исходников

## Continuation checkpoint — GitHub WorkPass148 (21 октября 2026)

This heading is an implementation checkpoint layered on top of the historical DOUS-1.0 analysis; it does not rewrite the WorkPass42/57 archive baseline.

- **Implemented in the active PR #22 branch:** P23 trusted shadow scheduler in the production runtime; explicit, fail-closed production config; per-run signed observation ingestion; CLI for staging candidates from verified holdout artifacts; distinct Ed25519 promotion-approval authority; API request/apply route; restore-time validation of active candidate, approval and evidence.
- **Central ownership is preserved:** `OrganismCore` remains the orchestration/provenance boundary; `P23LearningEngine` and `VersionedSkillCandidateStore` remain the candidate lifecycle owners; the only promotion path is candidate-store CAS with signed approval. No parallel active-skill store was introduced.
- **Old ActionGateway P0 re-check against the current source:** autonomous resource planning uses `this.executeTool(...)`; composite-skill execution that calls ActionGateway directly explicitly runs `finalizeToolOutcome` for unkeyed, non-replay executions, while keyed execution uses the gateway-owned finalizer; project execution constructs a durable operation/idempotency key and enters receipt reconciliation logic. This is a static source-path review, not runtime proof.
- **Evidence boundary:** successful tests/typecheck and real production learning uplift are not established. Recent Actions jobs finish without a usable step list/logs; treat this as CI infrastructure/pre-step failure, not a test pass or a source-level test failure.
- **Next fixed priority:** (1) obtain exact-head test/typecheck execution on an actionable runner; (2) provision independent verifier/approval keys via managed deployment configuration; (3) add authenticated rollback and run real stage → shadow → approve → activate → restore/rollback; (4) measure task-family holdout, transfer and reset retention before any quality/readiness score changes.

---
 
**Версия документа:** DOUS-1.0  
**Дата:** 15 октября 2026 года  
**Каноническая база:** `Neuro_Kurisu_WORKPASS42_2026-10-14.zip`  
**Канонический runtime:** `runtime/neuro-kurisu`, версия `35.63.0`, schema `225`  
**Статус базы:** `implementation-workpass`; WorkPass42 оценивает взвешенный roadmap в 78%, но прямо не подтверждает release readiness.  
**Предыдущие документы:** `Plants.md`, `syns.md`, `Neuro_Kurisu_Полный_разбор_источников_WorkPass42.md`, архитектурная карта WorkPass42 и архивный журнал `CHANGELOG.md`.  
**Назначение:** один конечный рабочий документ, по которому должны выполняться последующие инженерные проходы. DOUS объединяет и уточняет предыдущие выводы, фиксирует факты из кода и задаёт порядок реальных изменений. Это не отчёт о слиянии: в рамках данного финального анализа исходный проект не переписывался и новый runtime-архив не выпускался.

---

## 0. Финальный вердикт

Нейро Курису уже представляет собой крупную систему с каноническим организмом, единственным владельцем долговременной памяти, отдельным action gateway, проверкой постусловий, реафференцией, причинным журналом, адаптерами WILL/Lumina/Hexis/Letta/Conscio и UI-оболочкой с Live2D/Legacy. Её преимущество — не само количество подсистем, а уже существующие границы владения: **один runtime, один авторитет памяти, один канонический арбитр решений, один шлюз инструментов и исследовательский контур без автоматической записи в организм**.

Но систему пока нельзя честно назвать готовой к релизу или полностью семантически замкнутой. В коде обнаружены конкретные места, где единый стандарт исполнения и наблюдаемости обходится, а также участки, для которых требуется доказательство на реальных повторных действиях, восстановлениях и пользовательских путях. Главное — не дополнять организм новыми параллельными подсистемами, а закрыть границы, которые связывают уже существующие.

### Краткий итог по направлениям

| Направление | Вердикт | Что должно стать следующим изменением |
|---|---|---|
| Канонический runtime/архитектура | Сильная основа | Сохранить владение `OrganismCore`/`OrganismRuntime`, продолжать выделять только реальные границы ответственности |
| Исполнение действий | Хорошая durability-основа для keyed calls; покрытие всех call sites не завершено | Устранить прямые обходы finalizer, классифицировать side effects, стабилизировать receipts и reconciliation |
| Причинный след | Есть два полезных слоя: operational `CognitiveEventFabric` и action-level `OutcomeCognition/CausalAccountability` | Сшить их одним receipt lineage, не создавать третью независимую правду |
| Реафференция/обучение последствиям | Строгий codec и delayed temporal credit уже есть | Докрыть external tool receipts, повторы, unknown/partial outcomes, автономность и рестарт |
| Память | `MemoryOS2` + `MemoryFabric` — правильная каноническая архитектура | Закрепить command idempotency для долгого горизонта; улучшать качество по независимому holdout, не переносить вторую БД |
| WILL/Lumina/Hexis/Mem0 | Много полезного уже адаптировано | Дифференциально находить реальные пробелы и добавлять только недостающие алгоритмы/связи |
| Локальные модели/провайдеры | Есть адаптерные заделы | Проверить реальные model inference, stream/cancel/timeout/health/VRAM, не вендорить llama.cpp |
| UI/Live2D/Legacy | Существуют основные маршруты и fallback | Укрепить `postMessage` source/schema, закрепить локальные зависимости, выполнить настоящий браузерный E2E |
| Архивы/дедупликация | WorkPass42 построен на хешах и восстановлении | Не удалять историю шире без manifest/rollback; сохранить provenance и licensing |
| Release readiness | **Не подтверждена** | Полная сборка app, браузер/Live2D E2E, real provider receipts, holdout, clean-room restore/rollback, лицензии и soak |

**Приоритет №1:** сделать единый проверяемый путь действия `decision → ActionGateway → durable receipt → outcome verification → external observation (если есть) → causal lineage → delayed learning → checkpoint`, чтобы никакой исполняемый путь не обходил общие контракты.

---

## 1. Что именно является главным проектом

Главная база этого аудита — только `Neuro_Kurisu_WORKPASS42_2026-10-14.zip` (runtime `35.63.0`, schema `225`, release root `35.0.0-super-workpass42`). Grok Workspace, старые ветки, архивные NeuroCore/NOMEGA/DeepCode и сторонние исходники остаются материалом происхождения, истории или контролируемого исследования; они не заменяют каноническую Курису.

### 1.1 Владельцы и системные границы

```text
Пользователь / UI
   │
   ▼
app/ (React/Vite, панели, API-клиент, Live2D/Legacy presentation)
   │ HTTP: /api/organism/*
   ▼
runtime/neuro-kurisu/
   ├─ OrganismRuntime / OrganismCore — канонический организм и арбитраж
   ├─ ActionGateway — исполнение инструмента, policy/availability/competence, receipt
   ├─ OutcomeVerificationService — проверка результата/постусловия
   ├─ OutcomeCognitionFabric — action-level outcome и causal accountability
   ├─ CognitiveEventFabric — bounded causal spine обычного operational cycle
   ├─ ExternalObserver / EvidenceTrust / TemporalCredit — внешние свидетельства и delayed learning
   ├─ MemoryFabric → единственный writable authority: MemoryOS2
   └─ provider adapters — LLM, локальный llama.cpp/OpenAI-compatible, sensor/device

research/ → изолированные кандидаты/проверки → только управляемая promotion-процедура
legacy/ + immutable source archives → история и provenance, не активные владельцы состояния
Live2D iframe / Legacy sprite → визуальное представление; не owner эмоций/памяти/решений
```

### 1.2 Главные архитектурные инварианты

1. `runtime/neuro-kurisu` остаётся единственным writable organism runtime.
2. `OrganismCore`/`OrganismRuntime` остаются владельцами решений и состояния; WILL не получает второй арбитр или executor.
3. `ActionGateway` — единственная точка исполнения инструментов и проверки разрешений. Другие модули могут планировать действия, но не должны обходить шлюз или терять его квитанции.
4. `MemoryOS2` — единственная каноническая writable memory; `MemoryFabric` координирует мутации, lifecycle receipts, события и compatibility projections. Другие memory системы могут быть источниками кандидатов/алгоритмов или read-only projections, но не независимыми владельцами памяти.
5. Внешний результат не становится «истиной» только из-за ответа инструмента, текста модели, наличия теста или нескольких зеркал одной страницы. Нужны provenance, independence, verification и подходящий epistemic status.
6. Нельзя выдавать неизвестный/непроверенный исход за нулевую награду или успех; `policy-refused` не означает некомпетентность; unavailable — не failure навыка.
7. Новый механизм должен быть доступен через нужный UI/API путь, если это пользовательская функция; наличие класса/флага без достижимого call path не считается интеграцией.
8. Любое удаление/переименование исторических файлов должно сохранять точное происхождение и проверяемую возможность восстановления.

---

## 2. Как учитывались предыдущие анализы

`Plants.md` задаёт стратегию и долгосрочные инварианты; `syns.md` содержит расширенный построчный индекс, AST-навигацию и выводы по ключевым цепочкам; отчёт WorkPass42 документирует внешние проекты и содержимое архивов. DOUS объединяет эти документы с непосредственной сверкой актуальных файлов в WorkPass42 и уточняет найденные в коде стыки.

### 2.1 Уровни доказательности

- **Наблюдалось в коде:** конкретное поведение видно в просмотренной реализации и можно указать путь/строки.
- **Подтверждено архивной документацией:** факт указан в `CHANGELOG`, архитектурном документе или отчёте соответствующего прохода; это не значит, что проверка повторно запускалась в текущем анализе.
- **Гипотеза/риск для проверки:** есть подозрительный call path/эвристика, но ущерб зависит от конфигурации или вызывающей стороны.
- **Незакрыто поведенчески:** нужны реальные внешние side effects, fault injection, production build, browser test или целевое оборудование.

### 2.2 Ограничения

Был построен автоматический индекс около 22,39 млн строк в 86 532 непустых code-файлах, отдельный AST-проход TypeScript/JavaScript по 59 312 файловым записям и содержательный разбор критических цепочек. Каталог/AST/ключевые слова помогают отобрать и связать код, но не доказывают, что человек вручную понял каждую строку каждого upstream-проекта. И это не заменяет typecheck/build/runtime/E2E.

Внешние архивы содержат около 22 вложенных ZIP-слепков (один проект Letta представлен двумя одинаковыми маленькими копиями). Они анализируются как источники, но приоритеты основаны на реальных механизмах, а не на количестве файлов/звёзд/названиях «cognitive engine».

---

## 3. Самые важные подтверждённые находки в каноническом коде

### DOUS-F01 — ActionGateway уже имеет сильный keyed receipt lifecycle

**Evidence:** `runtime/neuro-kurisu/src/organism/system/ActionGateway.ts`, особенно keyed path и `executeWithLedger`; `OrganismCore.ts` setup около 1226–1238; `FileActionExecutionLedgerArchive.ts`.

Реальная реализация:

- требование стабильного `idempotencyKey` для keyed execution; запрос получает стабильный request hash;
- если нет durable persister — keyed side effect отклоняется до исполнения;
- повтор одного ключа с другим payload становится конфликтом;
- pending receipt сохраняется до начала действия; повтор после рестарта с `pending` блокируется и требует reconciliation;
- `setExecutionFinalizer` запускает проекцию исхода до фиксации completed receipt;
- после ошибки finalizer или неудачной фиксации завершённой квитанции операция остаётся fail-closed/recovery-required;
- архив completed receipts append-only, проверяет SHA-256, fsync-ит строку до освобождения hot capacity, обрезает только torn trailing fragment и падает при повреждённой полной записи;
- горячий ledger не удаляет завершённую квитанцию, пока она не сохранена в архиве.

**Решение:** это сохранять, не заменять другим SDK. Не переписывать заново. Добавить покрытие call-site и adverse-case тесты. Этот механизм — важная основа, но гарантирует защиту только для путей, которые реально используют keyed contract и каноническую финализацию.

### DOUS-F02 — обнаружен прямой автономный вызов, обходящий общий finalizer

**Evidence:** `runtime/neuro-kurisu/src/organism/core/OrganismCore.ts:4340–4346`.

`autoToolPlan` в автономном контуре вызывает `this.cognitiveRuntime.actionGateway.executeTool(...)` напрямую и после него записывает `autonomous-tool-execution` в event log. На этом вызове не передаются idempotency options и не видно вызова `finalizeToolOutcome`; стандартный внешний вызов через `OrganismCore.executeTool` устроен иначе. Это подтверждённый обход общей outcome/causal проекции. Конкретный риск зависит от списка инструментов, который может выбрать `autonomousResourceToolLife`, и должен быть уточнён; нельзя автоматически объявлять, что он уже приводит к разрушительной операции.

**Решение P0:** перенаправить этот путь через общий coordinator/`OrganismCore.executeTool` либо отдельную внутреннюю функцию одного владельца, которая создаёт стабильную идентичность задания, классифицирует side effect, выбирает keyed/idempotent execution там, где действие может повториться, и всегда финализирует receipt. Не допускать, чтобы исправление создало повторный finalizer для keyed path: keyed finalizer должен выполниться ровно один раз внутри `ActionGateway`.

**Приёмка:** автономный tool result, отказ политики, unavailable и execution failure имеют соответствующие записи/trace; повтор задания не исполняет побочный эффект второй раз; receipt и проекции переживают restart; read-only tools не получают искусственную «награду за успех».

### DOUS-F03 — `registerTool` молча перезаписывает ID

**Evidence:** `ActionGateway.ts`, `registerTool`: `this.tools.set(def.id, def)`.

Повторная регистрация того же ID заменяет старую реализацию без явного versioned replacement contract. Возможно, некоторые startup пути намеренно обновляют инструменты, но сама операция не различает ожидаемую замену и конфликт.

**Решение P1:** запрещать дублирующий ID по умолчанию; разрешать замену только через явный метод/version + reason, audit event и подтверждение, что активные compound skills/permission profiles не ссылаются на устаревший контракт. У tool definition должен быть contract fingerprint/version, заметный в Runtime Atlas.

**Приёмка:** две регистрации одного ID случайно вызывают typed conflict; явное обновление оставляет lineage и version; после restart registry fingerprint стабилен.

### DOUS-F04 — есть два связанных, но не идентичных слоя причинности

**Evidence:**
- обычный operational cycle: `OrganismCore.ts` около 7435–7437 (observation/prediction/action), 8093–8097 (outcome/learning/self-update), snapshot около 8120;
- внешние инструменты: `finalizeToolOutcome` около 11054–11075 и `integrateVerifiedToolObservation` около 11078–11102;
- `OutcomeCognitionFabric.ts` строит action-level causal graph и записи verification;
- `CognitiveEventFabric.ts` проверяет точные stage IDs, tick и parent edges для одного обычного цикла.

Это не обязательно ошибка: operational cycle и отдельный action execution могут быть разными временными процессами. Но в просмотренной finalization-цепочке квитанция инструмента явно попадает в `OutcomeCognition/CausalAccountability`, а связь с `CognitiveEventFabric` той же receipt lineage не очевидна. Значит общая причинная автобиография может быть распределена между графами.

**Решение P0/P1:** добавить идемпотентный receipt projection/bridge. Он должен соединить `executionId`/receipt hash, исходный `decisionId` если он есть, action/outcome, external observation ID, verification, delayed learning assignments и checkpoint. Не пытаться засунуть все delayed external actions в тот же однотиковый operational-cycle verifier: для них нужен отдельный проверяемый trace, допускающий межтиковые связи. Не создавать новый третий event bus.

**Приёмка:** по `executionId` можно восстановить одну причинную историю; replays не создают дубли events/learning; задержанные observation ссылаются на исходный decision exact ID; отсутствие decision ID отображается как невозможность причинно атрибутировать, а не угадывается по времени/tool name.

### DOUS-F05 — `CognitiveEventFabric.append` не имеет receipt-level deduplication

**Evidence:** `CognitiveEventFabric.ts`, `append`: ID генерируется с временем/тикером/случайным хвостом, событие просто добавляется в bounded buffer.

Для обычного цикла это удобно и валидно. Но будущий receipt bridge не должен вызывать `append` на каждом replay, иначе создаст несколько уникальных событий для одного реального действия.

**Решение P1:** добавить `appendOnce`/stable causal projection key на уровне моста, привязанный к stable `executionId` + stage/projection version. Сохранять совместимость существующих event IDs, отделить event id от external idempotency/receipt key, ограничить поля payload и не помещать туда секреты/полные ответы инструментов.

### DOUS-F06 — `OutcomeCognition.resolveExternalObservation` допускает fallback по одному tool, когда нет executionId

**Evidence:** `OutcomeCognitionFabric.ts`, `resolveExternalObservation`, поиск записи по `executionId` или fallback по `tool` если идентификатор не предоставлен.

С `executionId` код пытается найти точную квитанцию; без него совпадение только по имени инструмента может быть неоднозначным при параллельных запусках одной и той же tool.

**Решение P1:** для обучения/верификации side effect требовать `executionId` или отдельный устойчивый receipt correlation token. По tool-only fallback разрешать максимум read-only диагностическую подсказку, но не решать outcome или credit assignment. Сценарий должен возвращать `ambiguous-correlation` и требовать reconciliation.

### DOUS-F07 — ReafferenceEvidenceCodec — сильный механизм, его нельзя ослабить

**Evidence:** `ReafferenceEvidenceCodec.ts` и `tests/big-pass-124-reafference-integration.mjs`; исторический WorkPass6 report подтверждает intent и прошедшие на тот момент target regressions.

Текущие правила:

- требуется явно переданный `decisionId`, который остаётся среди pending canonical decisions;
- `actionRef`/`executionId` не подменяет decision ID;
- допускаются только внешние классы источников (`os`, `device`, `user`, `external-api`, `world`) и непустой independence key;
- подтверждение требует verified `match` и confidence не ниже 0.72;
- противоречие допускает отрицательное кредитование только при `disputed`, не менее двух независимых contradiction sources и contradiction score не ниже 0.68;
- неизвестный assessment, слабая уверенность или недостаточная независимость не создают обучающего сигнала;
- assignments возвращаются существующему `CanonicalTemporalCreditAuthority` и `adaptivePolicy`.

**Решение:** не переписывать и не уменьшать пороги «ради автономности». Расширять обработку неблагоприятных сценариев: reused decision IDs, duplicate observations, partial/unknown outcomes, same-source mirrors, user-requested actions, source clock drift, stale pending decisions, restart between action and observation.

### DOUS-F08 — MemoryFabric single-write boundary сильный, но receipt retention ограничен

**Evidence:** `MemoryFabric.ts`, `applyLifecycleCommand` (`commandId`, fingerprint, conflict, replay receipt, snapshot/restore); `MemoryOS2.ts`; WorkPass32/30 в `CHANGELOG.md`.

Плюсы: `MemoryOS2` — единственная каноническая память; `MemoryFabric` — единый mutation boundary для encode/revise/status/context/signals/forget; command ID связывается с fingerprint; повтор того же ID с другим payload вызывает conflict; event log и compatibility projections управляются явно; receipt snapshot переживает restore.

Ограничение: `maxMutationReceipts=512`; старые IDs вытесняются, а `commandId` в команде необязателен. Поэтому receipt guard не является вечным replay-protection для команды, которая может быть повторена после длинного промежутка. Некоторые операции естественно сходятся к noop, но повтор `revise-content` может иметь другую семантику, чем обычное повторное чтение.

**Решение P1:** не менять владельца памяти. Для команд с долговременным внешним retry contract добавить стабильные `commandId` на caller boundary и определить retention/replay horizon. Варианты: persistent compact command archive для операций, которые не должны повторяться бесконечно; idempotent semantic operation; либо typed `reconciliation-required` после выхода из гарантированного окна. Не раздувать receipt-журнал каждой внутренней мутации бесконечно и не подключать второй storage.

### DOUS-F09 — Runtime/API и UI архитектура существует; реальная сборка приложения остаётся blocker

**Evidence:** `docs/ARCHITECTURE.md`, `PROJECT_FILE_MAP_WORKPASS42.md`, `CHANGELOG.md`, `AvatarStage.tsx`, `app/public/live2d/viewer.html`.

UI использует API клиента к каноническому runtime. Live2D находится в iframe и визуализирует state, Legacy sprite является настоящим fallback. Архив WorkPass42 выносит 21 exact duplicate `app/public/live2d` asset в механизм гидратации из `runtime/neuro-kurisu/public/live2d`; viewer/vendor assets остаются app-specific. Реставрация проверяет SHA-256.

Однако текущая архитектура даёт ещё две задачи:
- `AvatarStage.tsx` и iframe проверяют `event.origin`, но в просмотренном коде не проверяют, что `event.source` — именно соответствующий iframe/parent; также сообщения следует валидировать по строгой схеме и допустимым диапазонам;
- viewer использует CDN fallback для Pixi/Cubism runtime. Это ухудшает детерминированность/offline режима и supply-chain модель, если remote loading не ограждён политикой.

**Решение P1/P0:** проверять `ev.source === frame.current?.contentWindow` в родителе и `ev.source === window.parent` в viewer; ограничивать допустимые `type`, expression, motion group/index, поля и payload length. Проверить CSP/allowlist. Закрепить локальные зависимости или сделать remote fallback явным opt-in. Проверить режим, прочитанный из localStorage, перед присваиванием union type.

### DOUS-F10 — source-first cleanup WorkPass42 безопаснее обычного удаления дублей

**Evidence:** `SUPER_VERSION.json`, `docs/PROJECT_FILE_MAP_WORKPASS42.md`, `docs/archive-optimization/README.md`, WorkPass42 entry in `CHANGELOG.md`.

Подтверждено: 21 byte-identical Live2D shadow файлов генерируется из canonical runtime asset path; две ZIP-алиас-копии Lumina/Letta исключены при сохранении canonical raw-source ZIP; 27 duplicate paths Kurisu v9/v56 и 27 report copies представлены restoration path manifest; restoration index — 56 omitted paths; 8,512/8,512 source archive member checks и 10,427/10,427 historical snapshot records сообщаются как прошедшие в WorkPass42. Cleanup hashes, symlinks и different-content overwrite checks fail-closed.

**Решение:** не выполнять новую массовую очистку. Сначала доказывать происхождение/семантику path, затем exact hash, canonical owner, manifest/restore, verify. Не удалять `LICENSE`, `NOTICE`, миграции, `__init__.py`, named test fixtures и version-specific evidence только потому, что байты совпадают.

---

## 4. Главная проблема архитектуры — не отсутствие модулей, а сквозное замыкание

В Курису уже много когнитивных компонентов. Увеличивать их количество до закрытия интеграционных разрывов — низкая отдача. Следующая эволюция должна укрепить связи, ownership и границы, а затем улучшать качество алгоритмов на реальном holdout.

### 4.1 Целевая цепочка внешнего действия

1. **Decision owner:** `OrganismCore` создаёт канонический trace/decision; `decisionId` передаётся вызывающей стороне, если действие связано с решением организма.
2. **Plan/classify:** инициатор указывает тип эффекта: read-only, repeatable/idempotent, externally mutating, irreversible/high-risk. Эта классификация должна принадлежать tool contract/registry, а не свободному тексту модели.
3. **ActionGateway admission:** capability/availability/competence/policy gates, stable input hash, stable idempotency key для retryable side effects, durable pending receipt до старта действия.
4. **Execute:** только зарегистрированный executor; bounded runtime/timeouts/cancellation/permission scope; не допускать самостоятельной регистрации/исполнения созданного кода.
5. **Verify:** `OutcomeVerificationService` отдельно фиксирует basis/confidence/observationId и postconditions. Tool-level «я сам сообщил verified» остаётся только контрактным уровнем, не external truth.
6. **Finalize:** `finalizeToolOutcome` ровно один раз, записывает outcome/causal/external evidence projections и ничего не обучает второй раз при replay.
7. **External observation:** если есть реальное постусловие, `ExternalObserverFabric` сопоставляет его с точной receipt и explicit pending `decisionId`; отсутствие доказательств остаётся unknown.
8. **Causal bridge:** один idempotent receipt projection соединяет `executionId` ↔ `decisionId` ↔ outcome/observation/evidence ↔ delayed credit. Ordinary single-tick operational cycle остаётся отдельным контрактом, не искажается межтиковыми событиями.
9. **Learning:** `CanonicalTemporalCreditAuthority` и `adaptivePolicy` получают только допустимые assignments; политика не обучается на отказе по безопасности, недоступности или неизвестном исходе как будто это нулевая компетенция.
10. **Persistence/restart:** состояние receipt, observations и learning assignments согласованно закрепляется; после падения система либо может безопасно replay recorded result, либо требует явной reconciliation, но не исполняет потенциально уже состоявшееся действие снова.
11. **UI/diagnostics:** Runtime Atlas показывает receipt stage, idempotency state, outcome class, decision link, observation IDs, pending reconciliation и learning eligibility; не выдаёт внутреннюю эвристику за реальный world result.

### 4.2 Строгие значения исходов

| Исход | Что значит | Что нельзя делать |
|---|---|---|
| `unavailable` | Нет prerequisites/среды/инструмента | Не снижать competence и не давать отрицательную награду за умение |
| `competence-insufficient` | Explicit skill/capability check не прошёл | Не смешивать с policy refusal |
| `policy-refused` | Action заблокирован rules/consent/destructive gate | Не исполнять executor; не тренировать как execution failure |
| `execution-failed` | Инструмент начал работу и вернул ошибку/контрактный провал | Отдельно различать частичный side effect и подтверждённое отсутствие эффекта |
| `executed-unverified` | Получен ответ, но постусловие не доказано | Не считать подтверждённым успехом или провалом |
| `executed-verified` | Достаточное проверяемое постусловие подтверждено | Обучение разрешено только с корректной независимостью/автономностью и точной lineage |
| `idempotency-recovery-required` | Эффект мог состояться, но completed receipt/finalization не зафиксирован | Не повторять автоматически; запросить reconciliation |
| `idempotency-conflict` | Тот же ключ с другим request hash | Не выбирать один payload произвольно |

### 4.3 Не превращать реафференцию в «обучение по каждому событию»

Для каждого источника нужно хранить независимость источника и канал, оценку уверенности, timestamp/freshness, ожидаемое и наблюдаемое постусловие, `observationId`, `executionId`, `decisionId`, autonomous/user requested semantics и решение о reconciliation. Повторное чтение одной страницы/зеркала — не независимое свидетельство. Симулятор/shadow run не равен реальному устройству/API. Классификация unknown должна оставаться unknown при тайм-ауте без фактического postcondition.

---

## 5. Что именно интегрировать откуда: все 22 архивные записи

Ни один источник не должен переноситься целиком только потому, что он большой. Таблица — source-to-canonical policy: конкретная польза, владелец в Курису, форма изменения и запреты.

| Источник / архивная запись | Приоритет | Что сохранить/переработать | Куда встраивать | Что запрещено/условие promotion |
|---|---:|---|---|---|
| **WILL (`will-main.zip`)** | **P0/P1** | Reafference, affordance evidence, связи действие→результат, competence/skill learning, ограниченное deliberation | `WillIntegrationBridge`, `WillSdkFacade`, `ActionGateway`, `OrganismCore`, `OrganismRuntime`, `CanonicalTemporalCreditAuthority` | Не добавлять второй organism, selector, executor или memory. Сначала проверить реальное source-to-adapter покрытие |
| **Lumina (`lumina-main.zip`)** | **P1** | Idle consolidation/dreaming, extraction candidates, temporal weighting, staged toolmaker/approval | `MemoryFabric` candidates, canonical scheduler/consolidation, `ActionGateway` registry/approval | Не встраивать второй Palace/SQLite memory. Timezone/watermark must be UTC-aware. Generated tools не исполнять до approval/sandbox |
| **Hexis (`Hexis-main.zip`)** | **P1** | Memory/belief supersession, revision/revert, evidence provenance, capability maturity proofs | MemoryOS2 revision history, `MemoryFabric`, read-only Hexis adaptation/projections, Runtime Atlas | Не заводить второй PostgreSQL/Hexis truth owner. Scorecard без source-linked execution proof — не релизное доказательство |
| **Mem0 (`mem0-main.zip`)** | **P1** | Entity extraction, candidate add/update/conflict/merge, migration semantics | Candidate producer → `MemoryFabric.applyLifecycleCommand` → MemoryOS2 | Не dual-write; не заменять каноническое хранилище. Каждый candidate должен содержать provenance/IDs/conflict reason |
| **Microsoft Agent Framework** | **P1 reference** | Typed events/messages, middleware, handoff/resume, MCP/A2A contracts, tracing | `ActionGateway`, `CognitiveEventFabric`, API/provider/session adapters | Не добавлять второй workflow/agent runtime. Контракт проверять на реальные остановки, cancellation и restart |
| **OpenAI Agents SDK (Python)** | **P1 selective** | Input/output guardrails, tripwire halt contract, tool gating, tracing spans | TypeScript-эквиваленты перед/после ActionGateway и API layer | Не переносить второй Python runtime. Обновлять не по памяти о текущем SDK, а по переданному archive snapshot и лицензии |
| **OpenClaw** | **P1 security-first, selective** | Channel pairing/auth, permission boundary, session resume, browser/device adapters, state lifecycle | server/API, capability policies, session/provider adapters, UI only where a real gap exists | Огромный blast radius; не bulk-import, не второй gateway, browser owner, skill tree или tool executor |
| **Hermes Agent** | **P1 selective** | Long-lived session resume, channel lifecycle, tool approval, gateway recovery patterns | `server.mjs`, session/provider adapters, `ActionGateway`, UI status | Не импортировать всю платформу/CLI. По каждому файлу: gap, license, dependency, tests |
| **llama.cpp** | **P1** | Local GGUF inference interface, streaming/server behavior, health and embedding endpoints | Existing local provider adapter as external process/HTTP service | Не вендорить inference engine в организм и не создавать второй process manager. Нужны target-hardware inference и resource limits |
| **Chroma** | **P1/P2 benchmark** | Vector/hybrid retrieval, metadata filtering, index maintenance and batching | Read-only candidate ranker behind `MemoryFabric` | Нет второй memory owner; внедрять только при независимом holdout uplift и приемлемом RAM/latency |
| **FAISS** | **P2 benchmark** | Fast similarity candidate index, CPU/GPU choices | Optional read-only retrieval adapter/experimental lane | Нет включения по умолчанию без quality/perf measurement; нативные bindings/VRAM complexity оценить |
| **DSPy** | **P2 research** | Offline program/prompt optimization, signatures/modules, reproducible evaluation | Isolated offline lab with versioned candidate configs | Не самоизменять продакционные prompts на неразмеченных online rewards |
| **Agent0** | **P2 research** | Curriculum generation, task/evaluator separation, before/after skill measurement | Research lab and held-out capability experiment | Не переносить тяжёлый RL/training stack в runtime; не включать unverified self-modification |
| **Hyperon / MeTTa** | **P3 research** | Symbolic relations/rules, explicit reasoning traces, explainable rule hypotheses | Sandboxed reasoning adapter that emits typed evidence/justifications | В самом исходнике agent layer описан как preliminary/PoC; не объявлять production-ready reasoning или memory owner |
| **AutoGPT** | **P1/P2 license-gated** | Task planning, event/task logs, workbench contract ideas selectively | Existing project executor and gateway, only with mapped gap | Platform license path-sensitive/PolyForm Shield candidate; mandatory manual license gate before code copy |
| **AutoGen** | **P2 reference** | Event/message orchestration history, handoff semantics | Compare to Microsoft Agent Framework and current project executor | Do not install parallel orchestration layer. Archive references older/maintenance-mode line; no wholesale merge |
| **Langroid** | **P2 selective reference** | Typed messages/tasks, structured tool wiring/delegation | Existing project task contract, adapters if code gap identified | Avoid a Python runtime dependency to reproduce functions Kurisu already has |
| **OWL** | **P2 selective reference** | Specific MCP/search/browser task adapters and collaboration patterns | Existing research/task adapters under canonical action permissions | No entire CAMEL stack unless a distinct measured capability is missing |
| **PocketFlow** | **P2 simplification reference** | Minimal node/transition/retry patterns if they reduce complexity | Existing project-step executor | No second workflow engine by default; copy only with demonstrated reduction in complexity and same permission owner |
| **Superpowers** | **P3 engineering workflow** | Plan/debug/review/skill authoring discipline | DOUS implementation workflow, source contribution checklists | Not a runtime cognitive subsystem and not another user-facing skill system |
| **Letta (`three/letta-main (1).zip`)** | **P3/provenance** | Source/version history only | Source index and provenance | Snapshot has only 16 archive entries and no detected implementation code; do not infer capabilities from tiny zip |
| **Letta (`four/letta-main.zip`)** | **P3/provenance** | Same tiny source snapshot; deduplicate its provenance identity | Same source index as previous Letta, preserving outer-archive provenance | Do not count as independent source or implementation. WorkPass42 canonical raw-source archive has its own source lineage |
| **Other archives under `legacy/input-archives` (NeuroCore/NOMEGA/DeepCode/Conscio)** | **Research/reference** | Unique useful historic algorithms, docs and provenance only after comparison against active code | Read-only research lane; promotion via existing gates | Don't treat them as active canonical basis or bulk overlay. Don't make Grok Workspace the comparison base |

### 5.1 Source files requiring first contextual review

| Source path (inside provided archive) | Why it matters | Decision |
|---|---|---|
| WILL `src/cognition/agency/engines/reafference.engine.ts` | Real action/outcome→learned-skill loop | Differential audit against `ReafferenceEvidenceCodec`/Temporal Credit; port only unmatched guard or signal |
| WILL `src/cognition/agency/engines/deliberation.engine.ts` | Candidate-bounded deliberation and arbiter separation | Preserve canonical `OrganismCore` decision ownership |
| Lumina `core/dreaming.py` | Idle-triggered memory synthesis/watermark | Convert to staged MemoryFabric candidate; fix UTC/timezone and cursor fidelity |
| Lumina `tools/temporal_decay.py` | Exponential recency weighting | Retrieval feature only; no deletion/truth semantics; compare calibrated rank quality |
| Lumina `tools/toolmaker.py` + tests | Staged tool creation/approval pattern | Use staged proposal, explicit human/policy approval, sandbox and least privilege |
| Hexis `services/memory_supersessions.py` | Evidence-linked belief supersession/revert | Map to canonical memory revision history/provenance, not a second DB |
| Hexis `core/capability_maturity.py` | Proof-oriented capability status | Map evidence to observed runtime test/trace, not a score-only badge |
| Mem0 `mem0/memory/main.py`, `memory/storage.py`, entity extraction | Candidate extraction/update/conflicts and migration practices | Extract policies to candidate producer, use MemoryFabric lifecycle commands only |
| OpenAI Agents `src/agents/guardrail.py` | Typed tripwire/fail-closed contract | Adapt guardrail contract to TypeScript ActionGateway policy results |
| `llama.cpp` OpenAI-compatible server | Local process endpoint | Adapter/health/timeout/stream/cancel/model ID, not vendored model engine |
| OpenClaw/Hermes pairing/session/tool approval code | Broad permission and session recovery surface | Focused security review only; map each pattern to current server/registry |

---

## 6. Целевая работа по каждому каноническому модулю

### 6.1 `ActionGateway.ts`

**Оставить:** keyed execution ledger, request hash conflicts, fail-closed pending/complete semantics, independent verification interface, availability/competence/policy distinction, response size bound, archive-before-eviction.

**Изменить:**
- разделить `ToolDefinition` на explicit capability/effect contract: read-only, idempotent mutation, external mutation, irreversible/high-risk;
- reject duplicate tool IDs by default and support audited versioned replacement;
- закрепить для externally mutating operations stable idempotency key, иначе отклонять или направлять в explicit reconciliation workflow;
- гарантировать единый finalization contract для всех callers; один finalizer на execution, без повторного finalizer на replay;
- явно представлять `partial/unknown` результат и потребность в reconciliation, когда timeout случился после возможного remote effect.

**Не делать:** новый tool gateway из OpenClaw/Hermes/SDK; автоматические retries неизвестных side effects; считать `result.verified === true` самостоятельным внешним подтверждением.

### 6.2 `OrganismCore.ts` / `OrganismRuntime.ts`

`OrganismCore.ts` слишком велик и имеет высокую цену изменения: не дробить его массово по названиям функций. Сначала выделить одну реальную границу — например `ToolExecutionCoordinator`/`ActionOutcomeCoordinator` с зависимостями через узкий интерфейс, без передачи всего Core (`this as any`) и без нового источника истины. Сохранить snapshots/migrations, decision IDs, persistence order and behavior.

Приоритетные caller paths для единой политики:

1. автономный `autoToolPlan` — прямой вызов около 4342 без стандартного finalizer, P0;
2. `executeReusableSkill` / steps — около 10821; keyed steps проходят finalizer внутри Gateway, legacy unkeyed explicit finalization около 10843;
3. публичная core wrapper `executeTool` около 11105; keyed path finalizes inside Gateway, unkeyed wrapper finalizes and checkpoints after execution;
4. project tool path около 11426; same rule about keyed versus unkeyed finalizer;
5. другие потенциальные direct call sites — при каждом проходе обновлять manifest и запретить новые bypasses static ownership audit.

Отдельно документировать, какие tool calls read-only и могут безопасно оставаться без keyed ledger, а какие меняют внешний мир и не должны.

### 6.3 `CognitiveEventFabric.ts`, `OutcomeCognitionFabric.ts`, `OutcomeVerificationService.ts`

Не сливать все события в гигантский объект. Сначала определить общий типизированный `ActionOutcomeReceipt`/`ActionTraceProjection` и корреляцию ID. Нужные поля: `executionId`, hashed idempotency key/request hash, tool/capability + tool version, optional exact `decisionId`, autonomous/user-requested, outcomeClass, verification basis/confidence/observation ID, expected/observed postcondition hashes or bounded strings, external source/independence IDs, timestamps, replay/finalization state, event IDs and delayed-learning assignment IDs.

Публичный payload не должен включать secrets, raw tool inputs or unbounded result. Полные данные remain in appropriate store/receipt with redaction/size boundaries; causal projection should store bounded summaries and hashes.

Событие для внешнего action не обязано закрывать normal single-tick operational cycle. Использовать отдельный trace verifier, который валидирует exact cross-tick parents, known event IDs, stage semantics and idempotent projection. Существующий `verifyOperationalCycle` сохранить для normal cycle.

### 6.4 External observers / evidence / temporal credit

- Сохранять точный `decisionId` и `executionId` раздельно.
- Запретить tool-name-only outcome resolution для любого изменения trust/learning.
- Отличать independent source identity от observation ID и URL.
- Не наращивать trust от same publisher mirrors/content hashes.
- Для delayed assignment сохранять подтверждённую source evidence lineage и причину eligibility/withheld.
- Replay must be observationally idempotent: повторение receipt не может удвоить confidence, evidence count, skill observations or adaptive-policy updates.
- Оставить unknown states и reconciliation visible to UI; не «лечить» unknown fabricated `success=0.5`.

### 6.5 `MemoryFabric.ts` + `MemoryOS2.ts`

**Оставить:** единственный writable `MemoryOS2`, `MemoryFabric.applyLifecycleCommand`, mutation fingerprints/conflict check, event projection, memory byte budgeting, residency diagnostics, temporal lookup, retrieval preview and BM25 fallback.

**Укрепить:**
- определить долговременную политику command IDs. Сейчас receipt list ограничена 512 и commandId опционален; это bounded replay guard, а не indefinite deduplication;
- для вызовов от action receipt, memory synthesis, research ingestion, revision/supersession использовать stable idempotency IDs and lineage;
- не делать двойную запись через Mem0/Hexis/Lumina. Их output — candidate/command proposal, final apply — only MemoryFabric;
- добавить `MemoryCandidate` contract: content/source, provenance class, source authority, source identity, independent evidence, observed/freshness times, confidence, epistemic status proposal, reason, conflict set, evaluation/holdout label if experiment;
- temporal decay, embeddings, Chroma/FAISS — ranking features or read-only candidate adapters. Не удалять память только из-за decay и не считать embeddings доказательством истинности;
- promotion Memory 2.0 only after independent labelled temporal holdout shows reproducible lift against true BM25/lexical baseline and safety metrics don't degrade.

**Не делать:** второй memory database, dual-write, unbounded event history, automatic production promotion from synthetic benchmark or self-labelled online outcomes.

### 6.6 WILL bridge / `WillSdkFacade`

Текущая схема правильно treats WILL as canonical adapter rather than second organism. Дальше:
- построить differential feature matrix (source engine → Kurisu adapter → live call path → persisted state → UI surface → test/evidence);
- для каждого WILL faculty дать status `native equivalent`, `adapter partial`, `source not integrated`, `research only`, or `not suitable` with code location;
- фокус на agency/reafference, skill competence evidence, candidate affordance projection and self-reflection loop;
- не переносить duplicated need/emotion/self/goal memories и не отдавать WILL final decision arbitration.

### 6.7 Lumina / Hexis / Mem0 adapters

Адаптеры должны возвращать read-only/candidate outputs, не напрямую мутировать Core или MemoryOS2. Использовать общий error/provenance envelope. Для temporal utilities — одни timestamp conventions (UTC epoch) и explicit invalid timestamp. Для Hexis supersession — `sourceMemoryId`, `revisionGroupId`, `supersedes`, `revertedBy`, `evidenceIds`; всё хранится/проектируется через canonical memory lifecycle. Для Mem0 — proposals, versioned extractor config and conflict explanation. Для Lumina toolmaker — staged files/manifest, static policy, sandbox tests, human/policy approval and explicit promotion transaction.

### 6.8 Provider/runtime/local model

Проверить и интегрировать именно adapter contract:
- provider/model ID + model revision/quantization;
- readiness/health and last successful probe;
- stream chunk shape and stop/abort propagation;
- request and idle timeout, max body/token/context limits;
- retry classifier (safe read vs non-idempotent generation/action), backoff/circuit breaker;
- cancellation reaches subprocess/socket and closes resource handles;
- deterministic offline fallback and observable reason;
- cache key binds provider/model/revision/options; caches bounded and isolated;
- no automatic model download at runtime; weights outside source archive, user-approved setup.

`llama.cpp` remains external local service/process adapter. Target model run and VRAM/latency have not been demonstrated by this report; use chosen device budget and actual model with sustained prompt/output tests before asserting suitable performance.

### 6.9 App / Live2D / Legacy

- Strengthen message trust: iframe-parent `event.origin` plus exact `event.source`; schema/size/range validation; allowlisted expression and motion; do not forward arbitrary message objects to model APIs.
- `live2d_ready/error` must only be accepted from the owned iframe; validate profile/model path before display. Validate localStorage avatar mode against `live2d|legacy` instead of unchecked cast.
- Keep `AvatarStage` state presentation-only; emotion label and speaking state come from canonical runtime snapshot.
- Lock bundled vendor assets / avoid mutable remote fallback unless explicit opt-in; define CSP for script origins and document offline behavior. Model files are runtime canonical assets with hash-verified hydration into app build.
- Keep real legacy sprite deck accessible and testable if model files/CDN unavailable. Do not generate fake portrait as substitute for actual Legacy assets.
- All newly integrated capabilities intended for user operation must have a navigable UI panel/API route (e.g. Runtime Atlas/read-only diagnostics or existing control console), state their true capabilities, and expose disable/error/recovery states.

---

## 7. Другие полезные интеграционные идеи (не только cognition)

| Домен | Что стоит заимствовать | Каноническая точка | Условие реальной пользы |
|---|---|---|---|
| Контроль capabilities | OpenAI Agents tripwire/typed guardrail; OpenClaw/Hermes permission/pairing; Lumina tool approval | ActionGateway registry/policy + server API | Guard blocks executor and leaves typed auditable outcome; no backdoor direct execution |
| Durable sessions | Hermes/OpenClaw resume, bounded session lifecycle | Runtime/server session adapters | User/agent can resume same session after restart without replaying effects or losing conversation lineage |
| Typed handoffs/events | Microsoft Agent Framework/AutoGen/Langroid contracts | Runtime event boundaries and project task API | Message schemas, cancel/resume, ownership and trace IDs are explicit; no parallel workflow owner |
| Memory candidate generation | Mem0 extraction + Lumina consolidation + Hexis supersession | `MemoryFabric` candidate/action policy | Provenance and revision history intact; benchmark over independent corpus; one write owner |
| Retrieval | Chroma/FAISS vector-index ideas, existing embeddings + BM25/hybrid search | MemoryOS2 preview/candidate ranker | On-device memory/latency budget acceptable; recall uplift and epistemic safety are measured |
| Optimization | DSPy/Agent0 curriculum and offline evaluation | Isolated research/optimization lab | Reproducible before-after metric, holdout, fixed seeds, rollback; never auto-promote from unlabeled traffic |
| Symbolic reasoning | Hyperon/MeTTa | Optional research reasoning adapter | Emits typed rules, proof/explanation and uncertainty; cannot bypass action policy or write facts on its own |
| Developer workflow | Superpowers planning/debug/review discipline | This DOUS implementation protocol | Used for focused patches and root-cause debugging, not installed as another runtime skill system |
| Archive engineering | Hash manifests, immutable blobs, path restoration | Existing WorkPass42 manifests | Exact restore + no overwrite on drift; all source licenses preserved |

---

## 8. Финальный implementation roadmap (по зависимостям, не по количеству функций)

Задачи ниже идут в зависимости друг от друга. Следующий проход должен делать кодовые изменения, а не снова составлять общие аудиты. Каждая завершённая стадия должна обновлять changelog, текущий task list, source-to-canonical map and the relevant test/evidence. Не добавлять «пустой тестовый модуль» без исправления поведения.

### DOUS-PASS 0 — Frozen truth and ownership map (короткая подготовка)

1. Зафиксировать SHA-256 базового WorkPass42 и активную версию runtime/schema; не смешивать изменения иной ZIP-версии.
2. Обновить call-site manifest всех вызовов `ActionGateway.executeTool`, всех write methods `MemoryFabric`, всех UI/API routes и `postMessage` consumers.
3. Для каждого tool определить effect class/read-only vs side effect, destructive status, permission owner, verification expectation, retry/idempotency contract.
4. Сверить manifests WorkPass42 before modifications; не трогать historical snapshot files без exact source record.

**Готово, когда:** существует короткий машинно-обновляемый map с каждым активным call site и владельцем, но подготовка не занимает весь проход.

### DOUS-PASS 1 — Единый tool outcome coordinator / устранение bypasses (P0)

1. Направить autonomous resource tool execution через общий финализатор.
2. Закрепить правило keyed path finalizes внутри Gateway, unkeyed safe path finalizes in host coordinator, replay не запускает finalizer снова.
3. Для side-effect tools без устойчивого idempotency key: fail-closed or explicit reconciliation, не молчаливое выполнение.
4. Ввести duplicate tool registration conflict и explicit replace/version protocol.
5. Уточнить partial-timeout semantics: operation potentially happened → unknown/recovery-required until reconciled.
6. Обеспечить стабильный action job key для автономного планировщика, составленный из persisted job/decision identity, а не нового UUID на каждом retry.

**Готово, когда:** все direct Gateway call sites либо явно read-only/safe либо проходят one coordinator; call-site audit показывает ноль неразрешённых bypasses.

### DOUS-PASS 2 — Receipt lineage → causal event bridge (P0)

1. Определить bounded typed receipt projection contract.
2. Связать exact `executionId`, idempotency receipt/request hash, optional `decisionId`, tool version, outcome class, verification/evidence/observation IDs and learning assignments.
3. Добавить idempotent `appendOnce` projection keyed by execution receipt and projection type/version.
4. Не ломать `CognitiveEventFabric.verifyOperationalCycle` same-tick invariant; создать отдельный cross-tick trace verification for external effects.
5. Убрать ambiguous correlation by tool-only fallback из update/training paths.
6. Добавить диагностику orphan receipts, orphan observations, incomplete finalization and pending reconciliation in Runtime Atlas.

**Готово, когда:** любой receipt можно проследить к source decision (если предоставлен) и observation/learning без дубликатов; missing link виден как missing, не угадывается.

### DOUS-PASS 3 — Fault/replay correctness of external actions (P0)

Обязательные сценарии: crash after pending persist but before tool start; crash during side effect; crash after remote success before finalizer; failure during external observation; failure after projection before completed checkpoint; full archive; corrupt newline-terminated record; torn final JSONL line; same key/same payload concurrently; same key/different payload; restart/replay of completed receipt; replay of pending receipt; finalizer throws; provider timeout after possible remote success; cancel on running request; tool definition replaced while session holds old version.

**Готово, когда:** все ambiguous effects block replay until reconcile, completed receipt replay returns same stable outcome and no repeated learning, receipt archive and source state restore consistently. Separate real-provider contract smoke still required beyond mocks.

### DOUS-PASS 4 — Memory lifecycle command durability (P0/P1)

1. Найти retry/restart-able callers that mutate MemoryFabric without `commandId`.
2. Назначать deterministic IDs for research ingestion, memory revisions, external receipt-derived mutations and tool/skill outcome memory updates.
3. Определить replay horizon versus 512-record in-memory/snapshot guard; preserve compact historical deduplication for operations that must not repeat after older receipts leave hot window.
4. Test conflicting ID payload, restore, duplicate command, revision replay, forgetting replay, race of two updates, event projection duplication.
5. Keep canonical `MemoryOS2` sole owner, no dual-write paths.

**Готово, когда:** every retryable mutation has explicit repeat semantics and provenance, and a replay outside the remembered window cannot silently create an incorrect second revision.

### DOUS-PASS 5 — Memory 2.0 uplift through evidence (P1)

1. Fix stable temporal semantics (UTC-aware timestamp handling, invalid-date signal, explicit freshness policy).
2. Choose a real or responsibly labeled dataset representative of the user's use case; pin hashes, deduplicate normalized queries and IDs, detect train/holdout leakage.
3. Compare true baseline BM25/lexical/hybrid against candidate ranking (embeddings, temporal decay, entity relations, Mem0 extraction) on separate holdout.
4. Track recall@k, nDCG/MRR where relevant, contradiction/error retrieval, dormant/unsupported state, future validity, latency, memory/CPU/VRAM and token cost.
5. Preserve existing non-auto-promotion gate. Candidate with no statistically/reproducibly meaningful uplift stays disabled or as opt-in experiment.

**Готово, когда:** independently labeled temporal holdout confirms benefit and no material epistemic/safety regression; synthetic benchmark harness passes alone is insufficient.

### DOUS-PASS 6 — Toolmaker/capability security (P1)

1. Build candidates in staging, never main runtime execution path.
2. Validate manifests/schemas/dependencies, permission scopes, source files and license provenance.
3. Require explicit approval/promotion record and immutable candidate version.
4. Sandbox untrusted/generated code; deny network/file/process access by default; enforce memory/CPU/time/output limits; disposable working directory.
5. Registered tool capability/effect contract, no duplicate tool ID, approval expiration/revocation, audit history.

**Готово, когда:** a generated tool cannot execute before approval; approval does not silently expand permissions; revocation is effective across resumed sessions.

### DOUS-PASS 7 — Provider/local inference reliability (P1)

1. Consolidate health, provider identity, model ID/revision, latency/errors/stream/cancel state in current adapter contracts.
2. Add per-request timeout and overall deadline, response body/token cap, abort propagation and cleanup.
3. Retry only safe requests; no automatic retry of tools/side effects under model/provider timeout.
4. Test model fallback and deterministic unavailable state without silently switching provider/model in a way that changes safety/capability.
5. Run actual local inference on target hardware, measure cold start, context fit, tokens/sec, peak memory and thermal/soak behavior.

**Готово, когда:** target setup reports repeatable real inference plus health and bounded failure behavior, not only mocked API compatibility.

### DOUS-PASS 8 — UI/API/Live2D and Legacy closure (P0 release gate)

1. Validate `postMessage` exact `source`, `origin`, schema, payload length, numeric bounds and expression/motion allowlists.
2. Pin/localize viewer dependencies or gate remote CDN fallback; define CSP and offline behavior.
3. Validate saved avatar mode value and restore fallback correctly.
4. Ensure Runtime Atlas consoles display true backend state/error/provenance, not static labels or guessed capability.
5. Clean install app dependencies from lockfile, full root/app typecheck, production Vite build.
6. Browser E2E from a clean profile: sign-in/auth where applicable; chat; model error and cancellation; runtime snapshot; Live2D ready/error; actual model load; legacy switch; page reload; narrow/mobile layout; console/network failures.
7. Test both generated asset hydration and cleanup, plus Legacy sprite route with remote assets blocked.

**Готово, когда:** real browser execution passes with no required console/network errors and both Live2D and Legacy paths recover correctly under failure/offline conditions.

### DOUS-PASS 9 — Upstream source fidelity and algorithm promotion (P1/P2)

1. WILL: diff engine/faculty against adapters; map each source behavior to active call path/evidence.
2. Lumina: compare dreaming and toolmaker lifecycle; fix timestamp semantics before use.
3. Hexis: link supersession/provenance/maturity to canonical MemoryOS2 and observable tests.
4. Mem0: evaluate extraction/conflict proposals on labeled inputs and canonical lifecycle commands.
5. Agent Framework/OpenAI SDK/OpenClaw/Hermes: narrow security/session/tracing gaps only.
6. Chroma/FAISS/DSPy/Agent0/Hyperon/PocketFlow/Langroid/OWL/AutoGen: keep isolated until measured gap and benefit justify complexity.
7. Keep per-source license, origin hash, adaptation diff and test evidence in manifest.

**Готово, когда:** each promoted feature has source path+revision/license, canonical target, unique owner, measurable benefit, accepted tests, UI path if applicable, rollback plan.

### DOUS-PASS 10 — Archive/provenance/legal gates (P1/P2)

1. Verify existing 56-path restoration manifest, source archive member hashes and historical snapshot before cleanup-related release.
2. Generate/update SBOM from locked dependencies and archive references; include source snapshot/member hashes and declared license evidence.
3. Manually review all nested licenses/NOTICE for copied code; AutoGPT platform path is explicitly license-gated, and native/native-adjacent dependencies require special attention.
4. Do not remove identical file paths representing distinct license, migration, package marker or test role.
5. Restore on copy of archive into clean folder; mutate one hash deliberately in fixture and confirm restore refuses overwrite.

**Готово, когда:** per-file path provenance, license decision, notices, source restore and upgrade/rollback are reproducible.

### DOUS-PASS 11 — Release candidate, recovery and long run (P0)

1. Clean-room install from lockfiles, run build and current focused regression suite from repository root.
2. Backup runtime state, restore to clean environment, run schema migrations forward, rollback from staged upgrade with injected failure and verify data/integrity.
3. Simulate device/provider outages, missing model assets, auth revocation, disk full, corrupted archive, interruption during checkpoint and long-running cancellations.
4. Multi-hour/multi-session soak: event/receipt/archive/memory growth, heap/RSS, file descriptors, latency, CPU/GPU/VRAM/thermal profile; ensure bounded queues and logs.
5. Produce signed release evidence report with verified command outputs, known limitations, supported platform/model matrix, SBOM/license review and explicit release decision.

**Готово, когда:** there are zero unresolved P0 blockers; the release gates have fresh evidence from the release-candidate bytes themselves.

---

## 9. Полный список инженерных действий (рабочий backlog)

Каждый пункт должен иметь owner, path(s), acceptance criteria and evidence link in current todo. «Сделано» означает code change plus demonstrated behavior, не только документ/тест.

### P0 — действие, причинность и релизный пользовательский путь

1. Закрыть `OrganismCore` autonomous `autoToolPlan` direct ActionGateway bypass.
2. Инвентаризировать каждый прямой `ActionGateway.executeTool` call site и classify effects.
3. Ввести общий receipt projection contract/version.
4. Связать receipt с exact decision ID, когда он существует.
5. Сохранить separate external execution trace for cross-tick outcomes.
6. Добавить idempotent causal event projection keyed by receipt ID.
7. Сделать finalization once-only для keyed/unkeyed/replay branches.
8. Явно обрабатывать timeout-after-possible-effect как unknown/recovery-required.
9. Запретить tool-name-only external correlation для credit/trust update.
10. Разделить `policy-refused`, `unavailable`, `competence-insufficient`, `execution-failed`, `executed-unverified`, `executed-verified` на всей трассе.
11. Сделать duplicate tool ID fail-closed и versioned replace explicit.
12. Требовать стабильный idempotency key для retryable external mutations.
13. Добавить concurrent same-key and same-key/different-payload coverage.
14. Добавить crash tests по каждому durability boundary receipt → executor → finalizer → complete receipt.
15. Восстановление pending receipts должно создавать clear reconciliation workflow.
16. Убедиться, что replay не удваивает external observations, trust, skill updates, temporal credit или memory writes.
17. Добавить diagnostics unresolved/ambiguous receipts в Runtime Atlas.
18. Выполнить clean-room runtime persistence and backup/restore trial.
19. Закрыть full app build and interactive browser/Live2D E2E.
20. Проверить реальные provider/device receipts и target inference.

### P1 — системная прочность

21. Добавить stable tool contract fingerprint and explicit capability version.
22. Поля tool effect class сделать typed; default for unknown tools deny live effect.
23. Уточнить authorization across resumed sessions and approval revocation.
24. Удалить или ограничить unsafe tool-name fallback in OutcomeCognition.
25. Audit correlation IDs in ActionGateway, external observer, CEF, MemoryFabric and UI.
26. Проверить race between finalizer/observation and checkpoint.
27. Отдельно зафиксировать finalizer partial completion state; не терять staged changes без маркера.
28. Добавить maximum runtime/output/body/retries by capability, not one global unconstrained policy.
29. Checkpoint error diagnostics distinguish durable not written vs in-memory state changed.
30. Duplicate registry test and active-skill version migration.
31. Memory lifecycle receipt policy for beyond-512 replay horizon.
32. Вынести idempotency command ID creation into callers so IDs survive process restarts.
33. Test `revise-content` replay after receipt eviction and restore.
34. Stable event IDs/unique idempotency projection for research ingestion.
35. Add external evidence source schema normalization + independent source accounting review.
36. Make `decisionId` pending expiry and reconciliation explicit.
37. Add replay-guard for already-consumed observation IDs.
38. Fix/validate timezone-aware timestamps in temporal decay/consolidation candidates.
39. Keep semantic embedding/cache key bound to model revision/config and enforce expiry/limit.
40. Make provider cancellation hit process/socket and clean child resources.
41. Add remote fallback/CSP policy for Live2D viewer dependencies.
42. Enforce exact iframe message sender and strict schema.
43. Validate localStorage avatar mode and model/profile path.
44. Add API response schema and error state linkage tests for Runtime Atlas.
45. Confirm every new public capability has accessible UI entry/permission and truthful unavailable state.
46. Harden generated tool approval/revocation and sandbox.
47. Build readable tool audit trail in UI rather than inaccessible-only JSON status.
48. Make external actions distinguishable from simulated/shadow outcomes in all dashboards.
49. Bound archive growth/compaction without weakening receipt replay guarantees.
50. Ensure concurrent runtime/process ownership lock covers execution archive and state store.
51. Review state schema migration compatibility for action receipts and memory receipts.
52. Verify external inference never updates canonical memory without candidate/promotion semantics.
53. Ensure `MemoryFabric` command/event/projection changes are atomically restorable enough for each lifecycle op.
54. Add compatibility tests for WorkPass42 duplicate path restore and Live2D hydration.
55. Reduce direct `this as any` cross-subsystem coupling only at touched seams; do not mass-refactor Core.

### P2 — measurable capability upgrades

56. Differentially map all 38 claimed WILL faculties to native/adapter/partial/absent states.
57. Add WILL agency evidence/competence provenance where the canonical system truly lacks it.
58. Evaluate Lumina idle consolidation against existing memory scheduler with same examples.
59. Add candidate-based entity extraction via Mem0 with evidence-linked conflicts.
60. Implement Hexis supersession concepts as MemoryOS2 lifecycle revision commands, if existing revision history is insufficient.
61. Use Hexis capability maturity only when proofs point to actual execution traces and release-gate output.
62. Temporal freshness candidate ranker with calibrated UTC timestamps; no direct forgets.
63. Run lexical-vs-hybrid-vs-embedding independent labeled temporal holdout.
64. Run resource/latency benchmark for Chroma adapter without becoming memory owner.
65. Run local FAISS experiment only if similarity workload warrants and device budget fits.
66. Use DSPy only for offline prompt/program candidate diff and reproducible held-out validation.
67. Use Agent0 curriculum generation offline, with immutable evaluation set and promotion review.
68. Symbolic/MeTTa experiments emit evidence-linked explanation and remain gated.
69. Compare Microsoft Agent Framework handoff cancellation/resume against current runtime API.
70. Compare OpenAI Agents tripwire result handling against ActionGateway and close only true gaps.
71. Review OpenClaw pairing/channel permission edge cases.
72. Review Hermes session resume and long-run shutdown/cleanup.
73. Add local llama.cpp health/stream/cancel behavior and model identity.
74. Establish target-device performance profile and resource ceiling.
75. Add a user-readable session recovery path in app.
76. Build `KnownEntityDossier`/identity summary only as read-only projection across existing owners; no new entity truth store.
77. Make memory conflict/quarantine/supersession diagnostics clear in UI.
78. Add a bounded candidate promotion queue with source hash, parent IDs and accept/reject reason.
79. Add error-aware / capability-aware dynamic tool choice without parallel selector.
80. Add capability benchmark suite only where it maps to user-visible feature and has external truth conditions.

### P3 — cleanup, docs and non-blocking ergonomics

81. Trim obsolete reports only after archive manifests and active links are verified.
82. Keep source archive provenance/hashes in generated inventory and SBOM.
83. Normalize current todo/checklist statuses to WorkPass42 as baseline.
84. Reorganize touched Core helper code around stable seams with behavior preserved.
85. Reduce redundant package scripts only when replacement coverage is demonstrably equivalent.
86. Keep old version manifests, migration files and regression fixtures even if byte-equal when their paths are semantic.
87. Improve read-only architecture map/Runtime Atlas source links and owner labels.
88. Improve setup errors when model binaries/provider is unavailable.
89. Document exactly what offline mode requires for UI/runtime/model/Live2D.
90. Ensure source licenses/NOTICE remain next to any redistributed/copy-adapted files.
91. Keep developer-only Superpowers practices in engineering docs, not runtime code.
92. Add a provenance trail to accepted external algorithm adaptation and tests.
93. Ensure recovery workflows write no secrets to audit/diagnostic payloads.
94. Keep reports concise per implementation pass; code changes remain the main work.
95. Recompute any readiness/weighted progress only when workstream evidence changes.
96. Mark historical test PASS separately from fresh current release-candidate PASS.
97. Publish exact limitation list for hardware/provider configurations not tested.
98. Remove stale static UI status only where the backend route and state are already available.
99. Preserve user-facing Legacy path for no-network and Live2D asset failure.
100. Finalize canonical task list and archive manifest alongside each coherent implementation archive.

---

## 10. Release gates that remain open at WorkPass42

WorkPass42 documents strong archive/integrity work and focused regressions. Its own metadata explicitly keeps release gates open. This report did not rerun the complete release suite; statuses below are inherited from the snapshot documents/CHANGELOG and need fresh proof on the final release candidate.

| Gate | Status at WorkPass42 evidence | Why it matters | Required fresh proof |
|---|---|---|---|
| Source archive and historical snapshot integrity | Reported PASS: 8,512/8,512 archive members and 10,427/10,427 snapshot records | Cleanup must be reversible without provenance loss | Re-run from clean extracted WorkPass42 and again after code changes |
| App scripts / release metadata / contract / architecture audits | Reported PASS: 218/218 app scripts, 34/34 metadata, 6/6 contract, architecture 0 missing/cycles/Legacy leakage | Good baseline for source integration | Fresh release candidate rerun after edits |
| Runtime TypeScript typecheck | Focused runtime typecheck is described as passing in relevant pass history | Syntax not enough; ensures current runtime contracts align | Run from final tree, include type diagnostics artifact |
| Full app install and production Vite build | **OPEN**; prior changelog cites missing `vite`/types or blocked dependency install/network | No deployable frontend artifact proof | Clean lockfile install + production build and artifact inspection |
| Browser / Live2D E2E | **OPEN** | UI/API and actual Live2D model may differ from static linkage | Real browser run from clean profile, model load, message security, Legacy fallback |
| Real external provider/device receipts | **OPEN** | Mocked tools do not prove network/process side-effect durability | Contract smoke on supported provider/device, redacted evidence with receipt ID |
| Real target-model inference | **OPEN** | Adapter endpoint is not proof a real model runs within resource budget | Cold/warm inference, stop/cancel, context, latency, memory/VRAM, multiple prompts |
| Independent temporal retrieval holdout | **OPEN**; synthetic retrieval uplift does not demonstrate production benefit | Needed before Memory 2.0 ranking promotion | Pinned labeled corpus; no leakage; matched baseline/candidate metrics + safety metrics |
| Clean-room restore / upgrade / rollback with fault injection | **OPEN** | Restores must survive interruption and preserve receipts/memory IDs | Backup, staged upgrade, injected failure, rollback, restart reconciliation |
| Nested source-license sign-off | **OPEN** | Upstream snapshots have different licenses and dependencies | Manual per-path/file/dependency review + SBOM + notices |
| Long duration / resource soak | **OPEN** | Large event/history architecture can leak memory/handles or grow unboundedly | Multi-hour/multi-session telemetry and enforced limits |
| Unified external tool→cause→learning lineage | **Partially covered; not release-closed** | Current normal CEF and action outcome paths have separate projections and an identified direct-call bypass | Receipt bridge, no-duplicate replay, adverse-case/cross-tick verification |

### Release decision rule

Не повышать release status на основании числа тестов/файлов/процента roadmap. Release candidate is eligible only if **all P0 gates** above have fresh successful evidence on the exact bytes being released; remaining P1 risks documented, security-sensitive upstream licenses signed off, backup/rollback tested and UI path verified. If an environmental blocker prevents a gate, mark it `BLOCKED/UNVERIFIED`, never `PASS`.

---

## 11. Source cleanup, licenses and provenance — окончательная политика

1. Original source archives are immutable references. Store SHA-256, archive member path, source project, original license path, adaptation target and commit/revision metadata when available.
2. A source-derived production change needs a path-level license review and dependency/license review; project-level README text is insufficient for mixed-license repositories.
3. For AutoGPT, preserve the existing explicit platform/PolyForm Shield license gate; do not copy the platform-sensitive tree before review.
4. Keep notices and license files even when identical bytes appear in many folders if each path carries an independent redistribution role.
5. A copied idea reimplemented from behavior and a copied source implementation have different provenance: DOUS implementation matrix must distinguish `idea adapted`, `code copied`, `derived transformation`, and `reference only`.
6. Exact duplicates only: hash must match; omitted path must point to retained canonical file or immutable content-addressed blob; restore must refuse symlink traversal and differing destination content.
7. Keep `legacy/input-archives/`, `legacy/snapshots/`, existing `Source Archive` manifests, 3,873-entry Legacy restoration metadata and WorkPass42's 56-path restoration metadata. Never replace a historical manifest hash with hash of evolved active source.
8. Continue treating tiny Letta snapshots as source/provenance only, not an implementation; two identical entries do not constitute independent confirmation.
9. No mass-cleaning step may be combined with a functional integration without a reversible rollback boundary. Implement code first, then remove only confirmed orphaned redundant paths.

---

## 12. Как измерять завершённость реальной интеграции

Feature is **not integrated** just because files exist, adapter class compiles, a README describes it, or an API route is static-listed. For each feature, track these states:

1. `SOURCE_FOUND` — exact source file(s), revision/hash and license found.
2. `SEMANTICS_REVIEWED` — behavior, preconditions, side effects, failure/retry contract understood and documented.
3. `GAP_CONFIRMED` — current canonical code lacks that behavior or is materially weaker; duplicate existing function rejected as unnecessary.
4. `ADAPTED` — code is translated into canonical contracts and dependency structure; source owner cannot bypass canonical memory/action/decision owners.
5. `WIRED` — callable from active runtime path; caller receives correct errors/outcomes; needed UI/API path exists.
6. `PERSISTED` — necessary state, versions and provenance survive snapshot/restart/migration.
7. `VERIFIED` — focused behavior, failure/replay cases and integrated caller pass with fresh results.
8. `MEASURED` — capability/performance uplift confirmed on representative/holdout workload, or candidate remains disabled.
9. `LICENSED` — source and dependency distribution reviewed and notices preserved.
10. `RELEASED` — feature is included in a clean build and real UI path and appears in release inventory.

For every source adaptation, keep `sourcePath → source hash/revision → original concept → canonical file/function → API/UI surface → test/trace → license/notice → rollback`.

---

## 13. Порядок дальнейшей работы по документам

- **DOUS.md (этот документ):** финальный synthesis, exact high-priority code findings, source-to-canonical policy and implementation order. Use as primary operational work plan.
- **Plants.md:** strategy/invariants, broader domain matrix and 100-item implementation plan; retain as architectural policy.
- **syns.md:** detailed file/line scan methodology, code index/AST references and semantic dossiers; use it to navigate and continue context-specific code review.
- **`Neuro_Kurisu_Полный_разбор_источников_WorkPass42.md`:** original outer archive inventory and per-source report.
- **Current project files:** source truth takes precedence over claims in any report. If active code differs from a report, update the report/task list; never alter code solely to satisfy old docs.

### How each following implementation pass should work

1. Start from current canonical project archive, or explicitly designated newer archive; do not ask again for details already in the manifest.
2. Read the exact relevant DOUS/Plants/syns task(s), then inspect target functions and callers in the active source. Revalidate any line reference before patching because code changes move lines.
3. Implement substantive fixes in a coherent bounded slice. No broad rewrite, no bulk source drop, no decorative module, no test-only pass.
4. Add or update focused behavior/fault tests as support for the code change; include at least one test that fails on the old bug and passes on the new behavior.
5. Run the narrowest meaningful target commands plus typecheck/API-linkage checks where practical. State clearly which checks passed, failed, were blocked or were not run.
6. Update changelog, `Список дел.md`, scorecard and source integration record based on actual implementation—not aspirational progress.
7. Re-run manifests and relevant archive integrity checks after file changes; keep new archive self-consistent.
8. Deliver a new complete project archive at the end of each coherent integration pass, plus a concise mini-report and concrete remaining items.

---

## 14. Final state assessment

### Strong sides

- Main project ownership is explicit and relatively clean despite the project's large historical surface.
- ActionGateway has thoughtful fail-closed logic for keyed side effects and a durable JSONL archive.
- Outcome verification distinguishes tool-contract claims from external postconditions.
- Reafference codec requires exact pending decision ID and sufficiently independent external evidence.
- MemoryFabric and MemoryOS2 provide a single write owner, lifecycle commands, provenance and retrieval preview/benchmark gates.
- WorkPass42's source-first cleanup uses manifests, hashes and restore checks rather than deleting by name.
- There is a meaningful UI/API surface and a true Legacy fallback for Live2D failure.
- Many upstream insights are already adapted; bulk merge would add duplicate owners and complexity instead of capability.

### Weak sides / remaining risks

- There is a direct autonomous action call path bypassing normal finalization.
- Causal evidence is split across normal operational CEF and external action OutcomeCognition graphs; same receipt lineage needs an explicit idempotent bridge.
- Registry overwrite semantics are implicit.
- Memory command idempotency receipts are optional and bounded; replay beyond the retained window needs a defined contract.
- Same-tool fallback correlation can be ambiguous if execution ID is missing.
- Iframe messages lack exact sender validation in the reviewed paths, and external CDN fallback weakens offline/deterministic runtime expectations.
- Project complexity is high; a 1.2 MB `OrganismCore.ts` and broad system inventory raise change blast radius. Refactor only touched boundaries and protect persisted behavior.
- Full React/Vite production build, interactive browser/Live2D E2E, real provider/device receipts, target-model performance, production corpus uplift, clean-room rollback, nested license sign-off and soak remain open.

### Итоговая оценка зрелости

| Axis | Assessment | Notes |
|---|---|---|
| Architecture / owner boundaries | High for an experimental agent organism | Keep singular runtime/memory/action owner |
| Action receipt durability | Medium-high for keyed flows | Close bypasses and all side-effect callers; test real remote outcomes |
| Causal/learning closure | Medium | Strong gating primitives; bridge external receipts and CEF without duplicate credit |
| Memory lifecycle | Medium-high design, uplift unproven | One store and receipts; long replay horizon and independent quality benchmark remain |
| Upstream integration maturity | Selectively high, uneven by project | WILL/Lumina/Hexis/Mem0 worth deep fidelity check; many others reference/research only |
| UI/Live2D release proof | Partial/unverified | Secure messages, exact assets, build and real browser E2E required |
| Provenance/archive integrity | High per WorkPass42 documented manifests | Keep restoration and licensing workflow on every further cleanup |
| Release readiness | **Not yet certified** | P0 release gates are open; 78% is roadmap progress, not readiness |

**Заключение:** следующая работа должна быть инженерной и последовательной. Сначала исправить автономный gateway bypass, затем замкнуть receipt/causal lineage, закрыть replay/restart cases, закрепить memory command replay semantics, после этого улучшать tool safety/providers/UI, и лишь затем переносить новые retrieval/learning algorithms по измеряемой пользе. Нейро Курису не нуждается в ещё одном параллельном «мозге» или третьей памяти. Ей нужна подтверждённая единая система, в которой каждая функция имеет одного владельца, реальный маршрут исполнения, точное происхождение результата, безопасное восстановление и доступный пользовательский путь.

---

## Appendix A. Основные evidence paths

| Path | Что подтверждает |
|---|---|
| `runtime/neuro-kurisu/src/organism/system/ActionGateway.ts` | Tool registry, effect execution, outcomes, keyed ledger, finalizer order |
| `runtime/neuro-kurisu/src/organism/core/OrganismCore.ts:1226–1238` | Durable receipt archive/persister/finalizer setup |
| `runtime/neuro-kurisu/src/organism/core/OrganismCore.ts:4340–4346` | Autonomous-resource-tool direct Gateway call and event logging |
| `runtime/neuro-kurisu/src/organism/core/OrganismCore.ts:7435–7437, 8093–8097` | Ordinary cycle CEF observation/prediction/action/outcome/learning/self-update |
| `runtime/neuro-kurisu/src/organism/core/OrganismCore.ts:11054–11113` | Tool finalization, external observation integration and unkeyed wrapper path |
| `runtime/neuro-kurisu/src/organism/system/ReafferenceEvidenceCodec.ts` | Exact pending decision/source/verification gating for temporal credit |
| `runtime/neuro-kurisu/src/organism/system/OutcomeCognitionFabric.ts` | Outcome record, causal accountability and external resolution correlation |
| `runtime/neuro-kurisu/src/organism/system/CognitiveEventFabric.ts` | Bounded cycle ledger, IDs/parents/same-tick operational verifier |
| `runtime/neuro-kurisu/src/organism/system/OutcomeVerificationService.ts` | Immutable verifier input, basis/id/confidence checks and fail-closed outcomes |
| `runtime/neuro-kurisu/src/organism/persistence/FileActionExecutionLedgerArchive.ts` | Append-only checksummed receipt archive, fsync, torn-tail recovery, conflict detection |
| `runtime/neuro-kurisu/src/organism/memory/MemoryFabric.ts:126–225, 389–402` | Memory lifecycle command receipts, fingerprints, bounded replay guard, snapshot/restore |
| `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts` | Canonical memory model/retrieval/temporal state |
| `app/src/components/AvatarStage.tsx` | Canonical snapshot presentation, iframe state and Legacy fallback |
| `app/public/live2d/viewer.html:32–33, 59–75, 102–110` | Local/CDN script load, iframe posts and message listener |
| `docs/ARCHITECTURE.md` / `docs/PROJECT_FILE_MAP_WORKPASS42.md` | Runtime/app/research/Legacy ownership model |
| `docs/archive-optimization/README.md` | Source-first cleanup and hash-locked restore contract |
| `SUPER_VERSION.json`, `CHANGELOG.md` WorkPass42 | Current runtime/schema metadata and open release blockers |

## Appendix B. Canonical files accompanying this report

- `Plants.md` — strategy and invariants.
- `syns.md` — file/line/AST analysis, semantic catalogs and deeper source notes.
- `Neuro_Kurisu_Полный_разбор_источников_WorkPass42.md` — original broad-source report.
- `Plants_INTEGRATION_MATRIX.csv` — source inventory and broad transfer decisions.
- `Plants_MASTER_FILE_INDEX.csv` — full file origin/index (very large).
- `syns_Audit_Package/SYN_FINDINGS_REGISTER.csv` — existing finding registry.
- `syns_Audit_Package/SYN_UPSTREAM_USEFULNESS_PLAN.csv` — upstream-to-canonical planning matrix.

DOUS is the synthesis and work sequence; the CSV companions generated with this report are the compact operational matrices for implementation passes.
