# SYNS — заключительный семантический аудит Нейро Курису и карта интеграции исходников

**Версия документа:** SYNS-1.0 · **Дата:** 15 октября 2026 года  
**Каноническая база:** `Neuro_Kurisu_WORKPASS42_2026-10-14.zip`  
**Источники:** `one.7z`, `two.7z`, `three.7z`, `four.7z`, вложенные архивы главного проекта, документы `Plants.md` и предыдущий отчёт `Neuro_Kurisu_Полный_разбор_источников_WorkPass42.md`.  
**Назначение:** заключительный технический отчёт, реестр полезных механизмов, карта рисков и план завершения интеграции. Этот документ дополняет Plants, а не заменяет его архитектурные инварианты.

---

## 0. Главный вывод в начале

Нейро Курису — не пустой прототип и не просто набор независимых скриптов. В WorkPass42 есть существенная рабочая архитектурная основа: единый runtime и core, шлюз действий с классами исхода, долговечный журнал идемпотентности, отдельный канал проверки результата, внешний наблюдатель, точное сопоставление внешней обратной связи с `decisionId`, отложенное назначение причинного кредита, единый владелец памяти через MemoryOS2/MemoryFabric, когнитивный журнал причинности и UI-оболочка с Legacy/Live2D. Несколько идей WILL, Lumina, Hexis, Mem0 и других источников уже представлены адаптациями или близкими концепциями — их нельзя копировать второй раз без сравнения реальных call path.

**Финальный вердикт:** архитектура перспективна и содержит сильные механизмы, пригодные для дальнейшего развития, но данный аудит **не является подтверждением 100% release readiness**. До такого заключения остаётся доказать сквозное поведение реальных инструментов после ошибок/повторов/рестарта; убедиться, что внешние action receipts единообразно связываются с причинным журналом и обучением; завершить путь единственной записи памяти; подтвердить полный build приложения и реальный браузерный/Live2D E2E на чистой установке; провести восстановление/upgrade/rollback и измерение длительной работы. Человеческое семантическое прочтение десятков миллионов строк всех внешних проектов буквально по одной строке невозможно заявить честно; вместо этого здесь построен многоуровневый построчный статический индекс, отдельный AST-обход ключевых файлов и глубокий содержательный разбор критических путей.

**Важно:** этот отчёт — аудит и план, не слияние исходников. В эту сессию я не переписывал сам проект и не выпускаю новый runtime-архив. Не следует трактовать наличие отчёта/каталога как факт выполнения задач интеграции.

## 1. Основа, целостность и происхождение

| Артефакт | SHA-256 |
|---|---|
| `Neuro_Kurisu_WORKPASS42_2026-10-14.zip` | `f8413ca016c24e050dc1e86ddad95259048df896af76c4cbc963ef1de8a0e33a` |
| `one.7z` | `2aa144432afd7a234b4aa3139cfa6019a97bab453dd235f623ccac2c00b83b41` |
| `two.7z` | `f6bce0f421c727c98c978328efe0dcb2bfa93ef77f8a7fcc1686c24b24958366` |
| `three.7z` | `598c8e11e176994214d2cdfcf9ec0bfe4b65e19e10e54c0190e4f5b859293f97` |
| `four.7z` | `e15b12e9617882026ab8077f7698c6a6c47df5f1e4690607d3dbcac2df4952a0` |
| предыдущий `Plants.md` | `477e9a78ccc92d365a88b72dbff28471d7bbb5cb77ca5217c18e3ab89766c60e` |

Эти хеши закрепляют, к каким конкретно переданным архивам относится отчёт. Если в следующем проходе пользователь даст более новый WorkPass, он считается новой базой только по явному выбору пользователя; нельзя без сравнения накладывать изменения другой архивной версии поверх текущей.

## 2. Что означает «построчный семантический анализ» в этом пакете

В SYNS разделены пять уровней доказательности, поскольку смешение уровней сделало бы отчёт недостоверным.

1. **Каталог уровня файла.** Для пути зафиксированы архив происхождения, размер, хеш, тип/роль, извлечённые объявления и импорты там, где их удалось определить, известные флаги и уровень покрытия.
2. **Линейная классификация строк.** Для каждого обработанного файла кода назначены первичная категория строки и битовая маска дополнительных признаков. Категории покрывают импорт/объявления/типы, control flow, ошибки, async/concurrency, состояние, I/O, память, действия/инструменты, безопасность, события, инференс, UI, telemetry, сериализацию, алгоритмы и тестовые утверждения. Первичная категория — эвристика по лексическим признакам, а не утверждение о полном смысле кода.
3. **Синтаксический AST.** Python-файлы в доступной кодовой области получали `ast.parse`; полный поток TypeScript/JavaScript-парсера обработал 59 312 файловых записей и не зарегистрировал синтаксических diagnostics. По AST собраны импорты, экспорты, декларации, вызовы, `await`, `try/catch/throw` и наборы потенциально чувствительных мест вызова. Отдельный фокус-проход по 13 критическим исходникам Курису дал 13 596 AST-узлов и 0 parse diagnostics. Это не эквивалентно типовой проверке, сборке, пониманию бизнес-смысла каждой функции или runtime-проверке.
4. **Контекстный анализ важных цепочек.** Сопоставлены реальные точки входа и передачи состояния в `OrganismCore`, `OrganismRuntime`, `ActionGateway`, `CognitiveEventFabric`, `ReafferenceEvidenceCodec`, `MemoryFabric`, `MemoryOS2`, `WillIntegrationBridge`, `WillSdkFacade`, `FileActionExecutionLedgerArchive`, `OutcomeCognitionFabric`, `OutcomeVerificationService`, `AvatarStage` и Live2D viewer. Извлечены точные места вызовов и инварианты.
5. **Поведенческая верификация.** В этой сессии чистая сборка, полные тесты, браузерный E2E и испытания на реальных внешних устройствах/провайдерах не запускались. Где нужен запуск, fault injection или production telemetry, результат обозначен как открытый, даже если исходный проект содержит тесты или прошлые документы сообщают PASS.

### 2.1 Масштаб исходных данных и уровни покрытия

По объединённой инвентаризации прежнего и текущего проходов:

- главный `Neuro_Kurisu_WORKPASS42_2026-10-14.zip`: 9 089 записей ZIP; около 267,6 МБ распакованного содержимого;
- главный архив и семь встроенных ZIP: 11 726 записей, 11 440 прочитанных текстовых файлов; около 862 тыс. строк кода;
- внешние архивы: 22 ZIP-записи, включая повторную копию Letta; около 106,7 тыс. записей, не считая каталогов, и около 1,76 ГБ распакованного объёма;
- предыдущий внешний статический скан распознал 96 137 читаемых текстовых файлов, около 24,89 млн текстовых строк, 82 605 кодовых файлов и около 21,52 млн строк кода; он также нашёл документы, тесты и конфигурации;
- расширенный SYNS-индекс объединяет `kind=code` из главного файлового индекса, весь `UPSTREAM_CODE_CATALOG.csv` и main/embedded code из `CODE_SYMBOL_IMPORT_CATALOG.csv`. Он сохраняет дубликаты в разных архивах как отдельные записи происхождения, а не схлопывает их по хешу.

**Точная текущая область SYNS:** 86 858 файловых записей кода из 27 исходных scopes; 86 857 записей получили строковый статус (86 532 непустых файла со строками и 325 нулевых/пустых файлов); один файл кода размером более 4 MiB оставлен в словаре, но пропущен на уровне построчной классификации. Индекс содержит 22 389 562 строки из 86 532 непустых файлов. Нулевые файлы не создают строковых записей; их присутствие видно в словаре. Бинарные/нечитаемые файлы и исходники за пределами кодового фильтра остаются в общем индексе, но не входят в построчный кодовый индекс.

Цифра 86 858 — количество записей файлов, а не обязательно уникальных содержимых: происхождение из различных архивов сохраняется. «Обработано» означает автоматизированное извлечение и анализ по схеме, указанной ниже, а не ручное доказательство смысла каждой строки.

### 2.2 Итог построчного семантического индекса SYNS

Для **22 389 562 непустых строк** создан файл `SYN_LINE_SEMANTIC_INDEX.csv.gz`. Каждая запись содержит `file_id`, номер исходной строки, первичную семантическую роль и маску дополнительных признаков. Первичная роль выбрана детерминированным лексическим классификатором; перекрывающиеся tags позволяют одновременно отметить, например, async, memory, I/O и error handling. Это индекс навигации и отбора для углублённой проверки, а не автоматическое заключение об исправности или дефекте.

Распределение первичных категорий по строкам:

| Категория | Строк |
|---|---:|
| `other_code` | 10 218 193 |
| `control_flow` | 1 602 492 |
| `test_assertion` | 1 560 990 |
| `declaration` | 1 513 092 |
| `blank` | 2 041 675 |
| `comment_doc` | 956 640 |
| `async_concurrency` | 909 340 |
| `module_import_export` | 737 642 |
| `error_handling` | 624 833 |
| `state_mutation` | 329 064 |
| `external_io` | 279 390 |
| `inference_provider` | 272 055 |
| `event_message` | 243 787 |
| `persistence_memory` | 221 091 |
| `action_tool` | 211 114 |
| `type_schema` | 199 854 |
| `security_auth` | 185 164 |
| `serialization` | 128 943 |
| `algorithm_math` | 76 016 |
| `ui_render` | 39 293 |
| `observability` | 38 894 |

Сумма категорий равна 22 389 562 строкам. Порядок/приоритет первичной категории значит, что строка получает одну главную категорию, хотя её маска tags может иметь несколько сигналов. Например, строка импорта получает категорию `module_import_export`, даже если имя импортируемого модуля содержит слово `memory`; комментарий считается `comment_doc`, даже если в нём описан риск. Поэтому эти числа не следует читать как число функций, возможностей, ошибок или уязвимостей.

Частота дополнительных перекрывающихся сигналов (одна строка может иметь несколько): `declaration` 2 346 899; `control_flow` 2 010 657; `test` 1 560 990; `async` 1 327 381; `import` 997 932; `comment` 956 640; `error` 824 125; `state` 533 965; `io` 362 521; `inference` 362 607; `type_schema` 307 168; `memory` 306 199; `event` 294 178; `action` 255 284; `security` 222 949; `algorithm` 188 389; `serialization` 198 432; `ui` 47 176; `observability` 76 526. Эти значения перекрываются и не складываются в размер файла.

### 2.3 AST-проход TypeScript/JavaScript и структура вызовов

Отдельный parser-assisted проход обработал **59 312 файловых записей** с расширениями TypeScript/JavaScript/JSX и получил **0 синтаксических diagnostics**. Сводные результаты AST:

| Структура | Количество |
|---|---:|
| Строки в обработанных файлах по исходной нумерации | 13 998 184 |
| Импорты | 410 952 |
| Экспорты | 9 416 |
| Классы | 4 342 |
| Функции | 178 914 |
| Методы | 43 853 |
| Интерфейсы | 11 056 |
| Type aliases | 48 633 |
| Enum declarations | 120 |
| Call expressions | 5 156 511 |
| `new` expressions | 185 702 |
| `await` expressions | 593 124 |
| `async` functions | 42 435 |
| `try` statements | 59 429 |
| `catch` clauses | 26 627 |
| `throw` statements | 83 420 |
| Candidate hot callsites (по именам/выражениям вызовов) | 474 417 |
| Записи импорта/символов в отдельном symbol index | 725 096 |

Файлы: `SYN_JS_TS_AST_FILE_SUMMARY.csv`, `SYN_JS_TS_SYMBOL_INDEX.csv`, `SYN_JS_TS_CALLSITE_HOTSPOTS.csv` и `SYN_JS_TS_PARSE_DIAGNOSTICS.csv`. Входной набор включает не только живой first-party код, но и некоторые generated/vendor/build artefacts. Поэтому агрегатные количества характеризуют ширину сканирования, но не число продакшен-символов. `hot_calls` — места для адресной проверки по синтаксическому виду вызова; это не установленная уязвимость и не доказательство достижимости из внешнего ввода.

**Распределение AST-покрытия неравномерно.** `source:openclaw-main.zip` даёт 47 287 JS/TS-кандидатов, примерно 11,68 млн исходных строк и 430 536 syntax-level hot-call hints; `source:hermes-agent-main.zip` — 4 828 файлов; `source:AutoGPT-master.zip` — 3 142 файла. `main`-scope главного ZIP содержит 1 482 JS/TS-файла (около 255,7 тыс. строк), но он включает активный runtime вместе с legacy/архивными поверхностями. Среди часто отмечаемых файлов главного архива — активный `runtime/neuro-kurisu/src/organism/core/OrganismCore.ts`, затем исторический snapshot `legacy/snapshots/.../OrganismCore.ts`, а также `app/src/neuro-kurisu/api.ts`, `OrganismRuntime.ts`, `MemoryFabric.ts` и `ActionGateway.ts`. Это помогает направить ручную проверку на реальные активные call paths, не тратить одинаковый объём усилий на архивный код.

Частые имена вызовов также сильно зависят от тестов и фикстур: например, `fs.writeFile`, `vi.restoreAllMocks`, `gateway.waitForRequest`, `spawnSync` и `page.evaluate` широко встречаются в больших upstream-репозиториях. Поэтому hot-call index должен фильтроваться по active path, production/dev/test scope и reachable caller; считать эти вызовы уязвимостями или интеграционными кандидатами без контекста нельзя. Агрегация по каждому scope доступна в `SYN_JS_TS_AST_SCOPE_SUMMARY.csv`.

Нулевой результат parse diagnostics означает только, что parser смог синтаксически построить деревья для включённых JS/TS-кандидатов по своей грамматике. Он не означает, что приложение проходит TypeScript typecheck, сборку, lint, модульное разрешение, запуск, API-контракты или browser E2E. Для важных TypeScript/TSX-файлов канонического пути отдельный фокус-проход дал 13 файлов, 13 596 AST-узлов и 0 синтаксических diagnostics.

### 2.4 Python AST diagnostics и ограничения чтения

Python AST-проход сообщил о пяти исключениях:

1. Agent Framework sample `.../risk-scoring/scripts/risk_score.py` — `invalid non-printable character U+FEFF at 1:1`;
2. Agent Framework sample `.../valuation/scripts/valuation_metrics.py` — аналогичный UTF-8 BOM в начале файла;
3. FAISS demo `demos/index_pq_flat_separate_codes_from_codebook.py` — синтаксическая ошибка около строки 102;
4. Hermes `agent/lsp/client.py` — ошибка парсинга около строки 242, столбец 21;
5. Hermes `gateway/run_turn.py` — ошибка парсинга около строки 3082, столбец 17.

Два BOM-случая необходимо повторно парсить через `utf-8-sig`, прежде чем называть дефектом. Остальные требуют проверки Python-версии/грамматики и того, production это, sample, generated или код под иной парсер. Это кандидаты на ревью, не автоматическое заключение о неисправности Курису. `SYN_PARSE_COVERAGE.csv` хранит диагностические строки.

### 2.5 Как превращать найденные строки в семантическое решение

Для вывода о конкретном модуле нужно проверять цепочку: **точка входа → вызывающая сторона → callee → владельцы состояния → схема данных → успешный путь → timeout/cancel/error → повтор/replay → persistence/restore → UI/наблюдаемость**. Для security review добавить: происхождение входа, доверительную границу, разрешения, escaping/validation, побочные эффекты и журналирование. Для memory review — единственный writer, idempotency, provenance, conflict/supersession, retrieval ranking и eviction. Для agency — observation/decision/execution ID, durable receipt, postcondition verification, CEF lineage, exact reafference assignment, policy refusal versus unknown outcome.

Машинный линейный индекс и AST ускоряют такую работу и указывают, куда смотреть в исходнике, но не подменяют контекстное чтение. Не выполнять автоматический перенос или удаление только по совпадению названия, символа, hash/near-duplicate или одному lexical tag.

## 3. Каноническая архитектура: роли и границы ответственности

### 3.1 Runtime и цикл организма

`runtime/neuro-kurisu` — канонический владелец состояния и исполнения. `OrganismCore` держит долгоживущие подсистемы и персистентное состояние; `OrganismRuntime` координирует цикл; интерфейс `app` обращается к runtime через API, а не создаёт второй самостоятельный организм. `research` предназначен для ограниченной внешней/экспериментальной работы, которая не должна становиться источником истины до проверки и promotion.

Основной цикл, зафиксированный в коде, выглядит так:

`observation → prediction → action/decision → outcome → learning → self-update`

В `OrganismRuntime.ts` на строках 630–645 записывается operational cycle и проверяются наличие этапов, совпадение tick и ребра причинности. В `OrganismCore.ts` на строках 7435–7437 есть привязка `observation → prediction → action`, а на 8093–8097 — `outcome → learning → self-update`, после чего сохраняется снимок CEF. Сервис `CognitiveEventFabric` ограничивает ring buffer, валидирует restore, строит родительские связи и оценивает полноту цикла.

Это сильная основа для объяснимости и обучения на последствиях. Но полноценная архитектурная связь не доказывается самим наличием CEF: нужно проверить, что каждый фактический внешний инструмент, его durable receipt, exact decision id и learning assignment могут быть прослежены одной цепочкой, а не только существовать в параллельных журналах.

### 3.2 Память

`MemoryOS2` — канонический владелец изменяемого содержимого памяти. `MemoryFabric` — координационный façade: lifecycle commands, replay/fingerprint receipts, события памяти, поиск/ранжирование, поддержание hot/warm/cold и совместимые проекции. Не создавать второй writable memory owner под именем Lumina, Mem0, Hexis, Letta, Chroma или FAISS. Их извлекатели/ранжировщики/алгоритмы допустимы только за контрактом, где запись/обновление/forget обязательно проходит через канонический lifecycle.

### 3.3 Исполнение действий

`ActionGateway` — один владелец исполнения зарегистрированных инструментов. Сервис различает недоступность, нехватку компетентности, отказ политики, ошибку исполнения, непроверенный и подтверждённый результат. Для keyed actions сначала сохраняет pending receipt, выполняет действие, запускает finalizer и только затем сохраняет completed receipt. Повтор с тем же ключом возвращает replay; ключ, использованный с другим нормализованным запросом, конфликтует; pending после рестарта блокирует автоматическое повторное внешнее действие до явного reconciliation.

Не всякий вызов может автоматически считаться идемпотентным. Путь `ActionGateway.executeTool` без `idempotencyKey` делегирует напрямую `executeToolDirect`; в каноническом `OrganismCore.executeTool` такой результат финализируется в вызывающем слое и затем фиксируется checkpoint. Значит, для каждого другого direct caller необходимо отдельно доказать безопасное поведение. Внешние side effects должны передавать стабильный логический ключ при retry, а не новый UUID.

### 3.4 Модель, сервер и UI

`llama.cpp` — внешний inference runtime, а не когнитивная архитектура. Подключение следует держать за provider adapter: model identity, timeout, cancellation, stream, health/readiness, контекст и ресурсные лимиты. OpenClaw/Hermes дают референсы для каналов, сессий и авторизации, но копирование их целых платформ резко размоет границы Курису.

`AvatarStage` и `/live2d/viewer.html` — presentation/embodiment слой. UI должен проецировать состояние runtime, но не владеть самостоятельными правилами памяти, агентности или политики. Legacy sprite fallback — полезный путь устойчивости и должен сохраняться.

## 4. Глубокий анализ критических компонентов

### 4.1 `ActionGateway.ts` — durable side-effect boundary

**Что делает.** Регистрирует инструменты, применяет гейты разрешения/доступности/компетентности, вызывает действие и verifier, пишет bounded audit history; для заданного idempotency key обеспечивает устойчивую обработку повтора.

**Подтверждённые сильные стороны.**

- Outcome type не смешивает ошибки окружения и skill competence: `unavailable`, `competence-insufficient`, `gate-check-failed`, `policy-refused`, `execution-failed`, `executed-unverified`, `executed-verified` и отдельные idempotency failure classes.
- Ключ идемпотентности хешируется; запрос получает стабильный хеш по tool id, input, expected output constraints, decision id и autonomous flag.
- Persisted pending receipt записывается до внешнего эффекта. Если архива/персистера нет для keyed path, действие не запускается.
- Same-key in-flight вызовы разделяют promise; разные запросы с тем же ключом получают conflict.
- Ошибка finalizer или запись completed receipt неудачна — outcome становится `idempotency-recovery-required`, pending остаётся блокировкой автоматического повтора.
- Архив сохраняется отдельно, hot ledger ограничен 16–512 записями, и система сначала архивирует старые receipts, прежде чем эвакуировать их из горячего списка.
- Expected output keys проверяются до завершения receipt. Большие replay payload сокращаются без исполнения действия заново.

**Точные кодовые узлы:**

- строки 107–119: интерфейсы durable persister/archive/finalizer и метрики;
- 129–141: валидация и восстановление ledger;
- 149–166: валидация регистрации инструмента и конфликта регистрации;
- 168–190: выбор keyed/unkeyed пути, stable request hash, storage precondition, inflight deduplication;
- 192–263: archive lookup, pending receipt до действия, capacity serialization;
- 265–334 (см. файл-индекс / исходник): финализация, result-shape constraints, completion receipt и recovery state.

**Риски/неопределённость.**

1. `registerTool` использует `Map.set(def.id, def)` и может молча заменить ранее зарегистрированный инструмент с тем же ID. Не следует автоматически объявлять это дефектом: возможен намеренный hot replacement. Нужно потребовать explicit `replace` policy, duplicate guard или документированную atomic replacement semantics, иначе компонент/плагин может незаметно заменить capability.
2. Для unkeyed direct path idempotency guarantees нет на самом gateway. В текущем `OrganismCore.executeTool` есть финализация/checkpoint для такого пути, но необходимо инвентаризировать **все** call sites и все side-effects, включая skill/project wrappers и адаптеры.
3. В журнале есть состояние `pending`, но автоматическое восстановление должно иметь отдельный механизм reconciliation: выяснить, произошло ли внешнее действие; иначе есть только безопасное блокирование, но не завершённый recovery workflow.
4. Нужны реальные fault-injection сценарии для каждого окна: crash до pending persist; после pending persist, до tool call; во время side effect; после effect, до finalizer; после finalizer, до completed receipt; частичная запись/повреждение archive; дублирующие конкурентные вызовы; ledger saturation.
5. Надо документировать, какие входы допустимы для `stableJson`/`sha256Stable`. Не JSON-compatible input отсекается для keyed path, но все API boundary wrappers должны нормализовать формы одинаково.

**Решение:** сохранить ActionGateway как канонический action owner, не заменять его чужим executor. Улучшать reconciliation, duplicate registration policy, видимость статуса и эксплуатационные свойства.

### 4.2 `OrganismCore.ts` — стыковка квитанции, доказательства и реального наблюдения

**Инициализация (1224–1238).** При `FileStateStore` подключает `FileActionExecutionLedgerArchive` к соседнему `action-ledger.jsonl`; устанавливает persister, который требует `ready`, отказывается писать при занятом persistence layer, обновляет состояние и вызывает durable checkpoint; устанавливает finalizer, делегирующий в `finalizeToolOutcome`.

**Restore (1354–1356).** Загружает архив журнала и восстанавливает snapshots ledger до дальнейшей работы организма. Это важный контракт старта: нельзя включать выполнение действия до завершения init/restore.

**Внешнее наблюдение (10930–11053).**

- Регистрирует событие у `ExternalObserverFabric`; при наличии expected postcondition оценивает совпадение и пересогласует claim с источниками.
- Сопоставляет наблюдение с outcome receipt через `actionRef`/`executionId`; exact `decisionId` не выводится из `executionId`.
- `buildReafferenceTemporalSignal` даёт учебный сигнал только для ожидаемого и ещё pending decision, внешнего независимого источника, достаточной верификации match или достаточно сильного, спорного, многократно подтверждённого mismatch.
- Результат идёт в существующий `CanonicalTemporalCreditAuthority`; применяется только delayed assignment с положительным delay, достаточной причинной уверенностью и independent=true. Затем сохраняются canonical temporal credit и `adaptivePolicy`.
- Неизвестный/непроверенный исход не становится автоматически подтверждённой компетентностью.
- Observation обновляет external evidence trust, reality reconciliation и другие projected records; это должно оставаться согласованным по порогам доказательности.

**Finalizer (11054–11113).** `finalizeToolOutcome` проектирует outcome в `OutcomeCognitionFabric`, сохраняет outcome verification/causal accountability, пытается привязать independently verified external postcondition и обновляет tool audit. Если keyed action завершился успешной side effect, finalizer идёт до фиксации completed receipt; failure остаётся recovery-required. Для unkeyed вызова `executeTool` отдельно вызывает finalizer и checkpoint; keyed execution finalizes внутри gateway, а replay не запускает новое обучение/наблюдение.

**Самая важная оставшаяся стыковка:** `CognitiveEventFabric` уже содержит operational cycles и циклы `OrganismCore.feedback`, тогда как финализатор конкретного внешнего tool обновляет `OutcomeCognition`, внешнего наблюдателя и temporal-credit authority. В просмотренном пути не видно прямого append того же конкретного tool receipt в CEF с общими `decisionId/executionId` и `parentIds`. Это **не означает, что причинная информация отсутствует вообще** — она записана в других канонических подсистемах. Но для окончательно единой объяснимой цепочки целесообразно добавить единую проекцию/bridge `ActionReceipt → CEF action/outcome → temporal credit/learning`, не превращая CEF в новый владелец истины и не дублируя обучение.

**Несогласованность порогов, которую надо проверить.** Внешний reafference path требует сильного evidence на своей дороге; параллельно `P84AutobiographicalContinuity.ingest` получает `decisionId: null`, а outcome может быть 0/1/unknown по assessment. Отдельный `learnFromVerifiedOutcome` вызывается по условию verified assessment либо corroborated reconciliation и рассчитывает `success01` по match/mismatch. Это может быть правильным разделением «автобиографический след» и «компетентностное обучение», но пороги должны быть документированы и протестированы на одиночном/повторённом/противоречивом источнике, иначе разные подсистемы могут выучить разные оценки одного результата.

**Решение:** не писать второй реафференсный цикл. Нужна source-of-truth схема outcome и linking contract, единые источниковые ключи, event projections и adverse-case semantics.

### 4.3 `ReafferenceEvidenceCodec.ts` — строгий шлюз учебного сигнала

Модуль отделён от памяти и policy state — это хорошо. Он требует точный pending `decisionId`, не выводит его из action reference; исключает organism/simulator/unknown как независимый внешний источник; для match требует verified и confidence ≥ 0.72; для mismatch требует `disputed`, не менее двух независимых contradiction sources и contradiction01 ≥ 0.68. Для unknown не выдает reward.

Это полезное ядро оставить. Улучшать нужно не переносом чужого engine, а тестированием граничных значений 0.719/0.72, 0.679/0.68, недействительного decision ID, повторного наблюдения, одинакового `independenceKey`, устаревшего evidence, replay и сигналов от неавтономных действий. `autonomous01=0` — корректно не маркировать как autonomous; не следует смешивать этот признак с тем, может ли событие обновлять модель мира.

### 4.4 `CognitiveEventFabric.ts` — ограниченный causal ledger

**Подтверждено:** буфер 128–4096, default 512; typed stage set; strict restore tick/id/stage; parent refs ограничены до 12; operational cycles создают цепочку и проверяют нужные ребра; snapshot считает dangling parent events, lineage integrity, causal density и coverage. В `OrganismRuntime` вызов cycle records находится на 630–645; в core раздельные события находятся на 7435–7437 и 8093–8097.

**Важные границы.** Это ограниченный ring buffer, не event sourcing для всех данных и не полный аудит всех внешних эффектов. После вытеснения старых родителей глобальная snapshot метрика dangling links может ухудшаться естественно. Проверка текущего цикла специально рассчитана на события собственного цикла — это разумно. Генератор IDs использует time/tick + random suffix; для идентичности в пределах одного сохранённого снимка подходит, но deterministic replay не должен зависеть от случайной генерации при повторном построении того же логического действия. Нужно выяснить, является ли ожидаемой стабильная повторяемость event IDs; если да, используйте стабильный logical key для одного события или явно закрепите правило, что replay всегда воспроизводит сохранённый ID, но не генерирует новый.

**Решение:** сохранить CEF как causal projection; договориться о мосте между tool receipt, decision, external observation и learning, ограничить event payload (секреты/PII/large payload), сделать диагностику `parent missing vs intentionally evicted` отличимой.

### 4.5 `MemoryFabric.ts` и `MemoryOS2.ts` — единая память, lifecycle receipts и стоимость

`MemoryFabric` выдаёт `canonicalAuthority: 'memoryOS2'`, делегирует операции через `applyLifecycleCommand`, строит fingerprint для command IDs, при повторе с другим payload/action кидает conflict, сохраняет bounded mutation receipts и проектирует события/совместимое состояние. Семантический retrieval использует bounded pool/cache/timeout, может перейти в fallback при отсутствующем provider, incomplete или неудачном результате; это лучше, чем ломать основной цикл при недоступном embedding service. Владелец изменяемых записей — MemoryOS2.

`MemoryOS2` имеет explicit encode/revise/reviseContent/updateSignals/updateContext/forget, хранит evidence/provenance/semantic-temporal-causal/contradiction links, нормализует restore state, имеет residency plan и `enforceByteBudget`; в бюджетном принтере видны защищаемые identity/autobiographical/quarantined записи и eviction witnesses. Восстановление ограничивает число записей и нормализует индексы/состояние, что помогает ограничить ресурсный риск.

**Что реально полезно перенести из источников.** Из Mem0 — идеи extraction/entities и update conflict policy как candidate producer; из Hexis — supersession/provenance/fidelity и review commands; из Lumina — temporal decay и ночная консолидация в staging; из Chroma/FAISS — только candidate ranker, за общим retrieval interface и после holdout benchmark. Ни один из этих источников не должен напрямую выполнять запись в другую базу или обходить lifecycle receipt.

**Зоны дальнейшего анализа.**

1. Строго инвентаризировать все write methods по всему runtime, API, imported plugins, research bridges и scripts. Любой write должен отображаться на `MemoryFabric` lifecycle command или быть официально объявлен внутренней транзакцией MemoryOS2 с эквивалентной фиксацией.
2. Убедиться, что `commandId` детерминирован для логического события и не вычисляется на каждом retry заново; конфликт fingerprints должен быть диагностируем и не приводить к двум независимым записям.
3. Изучить refresh/embedding index rebuild при restore, изменение embedding provider/model/version и возврат из fallback.
4. Проводить benchmark на фиксированном dataset с раздельными train/holdout: Recall@k, MRR/nDCG, temporal accuracy, conflict handling, stale-memory rate, latency, tokens, memory budget/eviction. Улучшение объявлять только на held-out наборе с фиксированным baseline и несколькими seed.
5. Проверить, что byte-budget eviction учитывает закреплённые пользовательские факты, критические causal links и уникальную редкую информацию; возраст не должен быть единственным прокси ценности.
6. Проверить эпистемический статус external research. Много источников даёт независимость происхождения, не доказательство entailment. Код уже caps confidence и помечает research notes гипотезой, что надо сохранить.

### 4.6 `WillIntegrationBridge.ts` и `WillSdkFacade.ts` — брать механику, не второго WILL

WillIntegrationBridge — адаптер над состоянием Курису, а не новый владелец всего организма. В коде есть компетентностные артефакты, skill success/confidence, выбор доступных affordances и связывание с текущим действием. `ReafferenceEvidenceCodec` связывает строго подтверждённую внешнюю обратную связь с existing temporal credit, а не создаёт вторую систему rewards. `WillSdkFacade` — более тонкий façade для внешних/SDK surfaces.

Условия прочной интеграции:
- WILL candidate/action IDs маппятся на IDs Курису, не используются как отдельная история истинности;
- skill competence изменяется только от допустимого verified outcome;
- policy refusal/unavailable/unknown/unverified не трактуются как провал компетентности;
- повторный receipt не дублирует learning assignment;
- snapshots и восстановление не теряют ID/assignment/source lineage;
- реальные действия не выбираются WILL-модулем параллельно canonical arbiter.

### 4.7 `FileActionExecutionLedgerArchive.ts` и долговечность

Файл архива — separate append/read adapter для исполнения side effects. Это правильное разделение: gateway отвечает за семантику keyed action, адаптер — за долговечное хранение receipt. Критический review — append durability, повреждённая/неполная последняя строка JSONL, частичная запись, повторные ключи/конфликт хешей, размер неограниченного архива, lock/конкурентные процессы и политика компактизации. Нужно проверить, как архив `load()` разрешает дубли и конфликт завершённых/незавершённых записей; любые ambiguous receipts должны блокировать повторное действие и выдавать понятный reconciliation request, а не выбирать произвольную версию.

### 4.8 `OutcomeCognitionFabric.ts` / `OutcomeVerificationService.ts`

Эти сервисы решают разные задачи: verification — соответствует ли результат declared contract/postcondition и на каком основании; OutcomeCognition — проекция исхода в outcome records, причинную ответственность и автобиографическую/объяснительную информацию. Их не следует сливать с `CognitiveEventFabric`, хотя идентификаторы событий/результатов должны быть связаны. Единый `ToolOutcomeReceipt` contract должен хранить `executionId`, `idempotencyKeyHash`, `decisionId?`, tool/capability, outcomeClass, verification basis/confidence, evidence IDs, timestamps, source-independence, autonomous flag, retry/replay state и finalization state.

**Ключевой контракт:** `executed-unverified` — не success; `policy-refused` — не competence failure; `unavailable` — не плохое умение; `unknown` не должен формировать нулевую награду; отсутствие внешнего наблюдения — неопределённость, а не успех/неуспех.

### 4.9 `OrganismRuntime.ts` — автономный цикл и контроль полноты

На строках 610–645 формируется learning gate, outcome evidence, operational CEF cycle и evaluation `unifiedCycle`. Это реальная связь прогноза/исхода и обучающего масштаба. Исход может идти от внешнего источника либо shadow simulator; их нельзя семантически смешивать. Для доказательной оценки внешнего действия важны `source`, `external`, `verified01`, `independent01`, `consequence01`, `predictionError01` и `shadowDivergence01`. В дальнейшем dashboard должен различать реальный результат и shadow rollout.

**Что проверить:** если simulator/shadow выполнил прогноз, не давать этой записи тот же epistemic weight, что реальному устройству/API; в mismatch/unknown/partial timeout правильно удерживать learning gate; убедиться, что цикл не начинает вторую независимую внешнюю side effect; зафиксировать cancellation/time budget и восстановление после provider failure.

### 4.10 `AvatarStage.tsx` + `viewer.html` — UI/Live2D

Текущая схема — same-origin iframe и `postMessage`, с проверкой origin и передачей нормализованных embodiment/expression/lipsync данных. При отказе Live2D предусмотрен Legacy fallback. Это надо сохранять.

**Незакрытые релизные вопросы:** viewer пытается загрузить локальные vendored dependencies, затем fallback на CDN. Это может нарушить offline режим, повторяемость сборки и supply-chain ожидания. Для release нужно pin versions, включить локальные необходимые библиотеки либо сделать remote fallback отдельной явной настройкой; добавить CSP/allowlist и error reporting. При проверке `postMessage` нужен строгий allowlist типов/схем сообщений, нормализация числовых параметров, ограничение размера payload и негативные тесты origin/schema. UI должен получать именно каноническое состояние core, а не самостоятельно выводить эмоцию из произвольного текста.

### 4.11 `package.json`, сборка и документированная проверка

Наличие многочисленных scripts и test files — преимущество проекта, но не доказательство запуска в текущей среде. В `docs/WORKPASS6_AGENCY_REAFFERENCE_2026-10-09.md` прежняя работа документирует положительные результаты runtime typecheck, отдельных regression/integration passes и server smoke, но там же заявлено, что UI dependency-complete build, browser/Live2D E2E и чистая установка остаются открытыми. Это исторический evidence, не результат повторного запуска данного аудита.

Не считать release подтверждённым без: install из lockfile в чистой папке; полного runtime + app typecheck; app production build; API smoke с реальным provider stub/контрактом; браузерного UI E2E, включая Live2D и Legacy fallback; action-ledger fault injection; snapshot/restore/upgrade/rollback; multi-hour soak и ресурсных лимитов.

## 5. Внешние источники: всё ценное, способ интеграции и запреты

### 5.1 WILL — высший приоритет для проверки причинной агентности

**Сильные элементы:** реафференция, affordance synthesis, motor/skill contracts, связи действия и последствий, bounded deliberation, competency artifacts. В `reafference.engine.ts` (538 строк) смысловой фокус — связывать результат реального действия с learning/skill evidence, но его интерфейс и память нельзя переносить целиком. Курису уже имеет codec с exact pending decision ID и thresholds, `CanonicalTemporalCreditAuthority` и адаптированную интеграцию.

**Решение:** сначала differential audit WILL upstream vs `WillIntegrationBridge`, `ReafferenceEvidenceCodec`, `ActionGateway`, `OrganismCore`, `OrganismRuntime`; перенести только реальное отсутствие. Это P0/P1, первый содержательный проход.

### 5.2 Lumina — консолидация, temporal decay, toolmaker

**Dreaming (`core/dreaming.py`).** Идея idle-triggered summarization полезна как memory-staging, но код пишет в собственное `nightstand/Palace` и хранит in-memory watermark. В примечаниях исходник признаёт риск сравнений timestamp без timezone offset, который silently меняет фильтрацию при переходе UTC. Применять идею только через staged candidate в MemoryFabric, использовать timezone-aware watermark, stable cursor/message IDs, deduplication and prompt fidelity evidence. Не копировать другую память Palace.

**Temporal decay (`tools/temporal_decay.py`).** Простая экспоненциальная decay-функция пригодна как один feature в ranking, но не должна быть политикой удаления/истины. Наивный `datetime.fromisoformat(...).timestamp()` с локальным временем и fallback `0.5` на исключение — риск недетерминированности; в Курису нужна timezone normalization, явный invalid-timestamp signal и calibration по задаче.

**Toolmaker (`tools/toolmaker.py`).** Ценность — staging создаваемых инструментов, отдельные pending/approved/rejected списки, review source, audit log, explicit approval before registration. Ограничения: generated Python code всё равно требует sandboxing, dependency/permission allowlist, static review, resource limits и no network/file access unless granted. Не запускать LLM-generated tool в основном процессе до approval и тестового контура.

**Memory tools.** Там есть собственные SQLite/chat stores. Переносить можно UI/workflow ideas, extraction/search policy — записи только в MemoryFabric/MemoryOS2.

### 5.3 Hexis — supersession, temporal belief, provenance, maturity evidence

Сильные идеи: история замены убеждения, событие supersession, возможность reversion, source lineage, capability maturity record с явным proof. Код `services/memory_supersessions.py` содержит модель, validation и API записи/истории/отката supersession; `core/capability_maturity.py` собирает proof-сценарии для recall/boundary/energy/heartbeat/self-initiated. Это полезные **данные о доказательстве**, если каждая запись связывает source event и canonical memory ID. Не переносить отдельный PostgreSQL/Hexis memory authority и не считать scorecard proof реального общего runtime без связанного call path.

### 5.4 Mem0 — извлечение/обновление памяти

Смысловой вклад — entity extraction, candidate memory updates, conflict/merge policies, storage abstraction/migration discipline. Не заменять MemoryOS2 storage. Адаптер Mem0 должен возвращать типизированные candidates с provenance, confidence, evidence IDs, source lineage, conflict explanation и suggested operation, после чего `MemoryFabric` применяет/отклоняет предложение с commandId/fingerprint receipt. Проверить SQLite schema migration/reopen/transaction semantics и отсутствие потерянной строки при повторе.

### 5.5 Microsoft Agent Framework

Использовать как reference для middleware, typed events/messages, tool/workbench contracts, tracing, MCP/A2A/handoffs, resumable workflows. Реальные полезные части — контракты и обработка ошибок/прерываний, не перенос полного multi-agent runtime. Все handoffs должны наследовать canonical action policy и не обходить ActionGateway.

### 5.6 OpenAI Agents SDK

Полезны pre/post guardrails, tripwires, handoff contract, tracing/span correlation и ограничения инструментов. В TypeScript Курису адаптировать эти идеи к существующим `ActionGateway` outcome classes и API security. Guardrail должен выдавать typed terminal refusal/failure and auditable reason; он не должен быть `console.log`-only. Проверка конкретного архивного snapshot нужна перед любым code copy; SDK API меняется, поэтому ориентироваться на предоставленный архив и лицензии его файлов, не на предположения.

### 5.7 OpenClaw

Очень большая система (в инвентаре 28 550 code-kind file records в текущем master catalogue). Потенциально полезны channel routing, pairing/auth, session resumption, browser/device adapters, state lifecycle, tool permissions. Именно из-за размера и богатства поверхности **не переносить весь проект**. Сначала построить точечные trace paths по security/channel/session, сопоставить с Kurisu API, `server.mjs`, ActionGateway и provider/session adapters. Каждый перенос должен иметь один конкретный gap, file/line reference, license approval and test case.

### 5.8 Hermes Agent

Референс сессий, gateway, skill/tool approval, channels и resume. Применять как checklist для long-running agent sessions, cancellation and recovery. Не создавать параллельный gateway или второй tool registry; перенести contract/tests, только если есть пропуск в текущем сервере/runtime.

### 5.9 llama.cpp

Лучший кандидат — provider adapter к локальному GGUF runtime; важны health, model identity, `n_ctx`, GPU offload fallback, streaming/cancel, errors, context overflow, memory usage. Если целевая карта GTX 1650 с 4 GB VRAM, модель и quantization выбирать измерениями на фактическом устройстве, а не по маркетинговому числу параметров. Никакой архитектурный модуль из llama.cpp не подменяет механизм памяти/агентности.

### 5.10 Chroma и FAISS

Использовать только как retrieval prototypes behind shared interface. Сравнивать с текущим MemoryOS2/MemFabric ranker на holdout данных: Recall@k, temporal/contradiction correctness, latency, memory and storage overhead. Не заводить отдельный authoritative vector store без reconciliation/migration and rollback.

### 5.11 DSPy

Офлайн-оптимизация prompt/program signatures, few-shot selection и evaluation. Результат — versioned diff prompt/config, который проходит review и holdout. Запрещено менять live system prompts/weights автоматически по одному успешному эпизоду или оптимизировать на том же наборе, на котором потом отчитываются о выигрыше.

### 5.12 Agent0

Ценный исследовательский паттерн: генерация учебных задач, curriculum, evaluation loop и измеримое сравнение способностей. Дорогостоящие RL/training stack/исполнитель не переносить в production runtime. Изолировать в `research/benchmarks`, публиковать candidate skill only через явную promotion policy и проверенный holdout.

### 5.13 Hyperon / MeTTa

Исследовательский символический reasoning: правила, выразимые knowledge operations, explanations. Пускать через typed evidence adapter: hypothesis, premises, rule ID/version, confidence/calibration, contradictions. Не превращать в неограниченный executor и не заявлять, что символический формализм сам по себе доказывает cognition/consciousness.

### 5.14 AutoGPT

Полезны project orchestration, task history, user visibility, tracing and tool permission patterns. Участки AutoGPT имеют различные лицензии/ограничения (в особенности платформенные части), поэтому licence gate должен быть path-level и version-pinned. Не переносить всё дерево и не брать неизвестные зависимости без проверки SBOM.

### 5.15 AutoGen

Исторический и архитектурный reference для agent message protocols and orchestration. Сравнить с более актуальным Microsoft Agent Framework, не строить вторую систему делегирования поверх неё. Переносить только compact message/tool contracts с доказуемой пользой.

### 5.16 Langroid, OWL, PocketFlow

- **Langroid:** typed task/messages, structured delegation и retrieval/task wiring; reference для недостающего контракта, не второй agent loop.
- **OWL:** task automation/collaboration and adapters. Смотреть конкретные MCP/search/browser интеграции, отдельно проверять side-effects и permissions.
- **PocketFlow:** минимальные graph nodes/transitions/retry patterns. Имеет смысл там, где помогает упростить/заменить код с доказанным уменьшением сложности; не добавлять графовый workflow ради моды.

### 5.17 Letta — две копии

Одна архивная копия помечена как incomplete/docs-focused duplicate, другая также не должна автоматически становиться самостоятельным memory owner. Свести provenance/hash, сохранить одну canonical source reference row и изучить полезные идеи по memory hierarchy/agent state. Не сливать второй полный storage/lifecycle architecture поверх MemoryOS2.

### 5.18 Superpowers

Методология разработчика: маленький coherent pass, план/реализация/проверка, ясные acceptance criteria, code review. Это процессный источник, а не runtime feature. Использовать как дисциплину реализации и избегать бессмысленного размножения skill docs в самом приложении.

### 5.19 Границы, связанные с конкретными внешними файлами, а не только проектами

В адресный просмотр зафиксированы важные реальные исходники: `will-main/src/cognition/agency/engines/reafference.engine.ts` (538 строк); `lumina-main/core/dreaming.py` (89 строк), `tools/temporal_decay.py` (63), `tools/toolmaker.py` (383), `tools/memory.py` (291); `Hexis-main/core/capability_maturity.py` (526) и `services/memory_supersessions.py` (170); `mem0-ts/src/oss/src/storage/SQLiteManager.ts` (177). Наличие этих файлов подтверждено в предоставленных архивных snapshots. Полный размер и версия каждого path берутся из индексных каталогов, а не из текущего состояния upstream сети.

Отдельные семантические замечания:

- `lumina/core/dreaming.py` исправляет старый паттерн, который использовал bespoke `requests.post`, собственный model resolution и fixed 30-second timeout. Текущая функция `run_summarization_call` использует общий `get_llm_backend()` и utility completion. Это хороший урок: новые когнитивные операции должны переиспользовать общий provider abstraction.
- В том же файле watermark хранится in-memory по chat ID, а last timestamp сравнивается как строка без timezone offset. При переходе local→UTC это может фильтровать сообщения неправильно. Значит, при адаптации нужны durable timestamp cursor, timezone-aware UTC, stable IDs and idempotent summary receipt.
- `lumina/tools/temporal_decay.py` использует экспоненциальное ослабление по возрасту. При пустом timestamp возвращает 1.0, при parse exception — 0.5; последнее скрывает invalid input как обычный средний score. При переносе invalid timestamp должен быть отдельным статусом/fallback reason, а decay — только feature retrieval, не самостоятельное право удалять воспоминание.
- `lumina/tools/toolmaker.py` отделяет pending tool, просмотр исходника, approve/reject и custom tool list. Полезна человеческая approval boundary, но генерируемый код нельзя просто зарегистрировать в основном процессе без sandbox/permission/dependency validation.
- `Hexis/services/memory_supersessions.py` реализует record/current/history/revert supersession с валидацией. Курису нужен equivalent lifecycle в MemoryOS2 revision groups, а не второй Hexis DB.
- `Hexis/core/capability_maturity.py` оформляет сценарии доказательства capabilities (включая recall, boundary, energy, heartbeat и self-initiated). Переиспользовать формат evidence/acceptance, но не переносить scorecard как доказательство автономности без связи с реальным runtime artifact.
- WILL `ReafferenceEngine` — полезный upstream для diff review; в Курису уже есть строгий codec, поэтому главный вопрос — пробелы связей/семантики, а не наличие второго engine.

### 5.20 Ключевое правило по каждому upstream

На каждую потенциально переносимую реализацию завести запись: **source archive/hash → exact path + symbol/line range → concrete capability → canonical target → current analogue → delta/gap → adaptation design → dependency/license → behavior acceptance → rollback → status**. Статус только один из: `already-present`, `adapted-and-wired`, `partial`, `research-only`, `rejected`, `unknown`. Нельзя ставить `adapted-and-wired` за копирование файла или теста: нужна подтверждённая цепочка вызова из реального runtime/API/UI.

## 6. Главные конфликты дублирования и что нельзя создавать повторно

| Область | Канонический владелец | Допустимый вклад внешних источников | Недопустимый итог |
|---|---|---|---|
| Исполнение side effect | `ActionGateway` | contracts, tool approval, audit, retries | второй executor/gateway, прямые вызовы инструментов без policy |
| Outcome verification | `OutcomeVerificationService` + `OutcomeCognitionFabric` | независимое evidence strategy | пометка успеха на основании возврата без постусловия |
| Причинный trace | `CognitiveEventFabric` + existing receipt IDs | richer causal labels and projections | второй event source of truth или несвязанные дубли |
| Delayed learning | `CanonicalTemporalCreditAuthority` + `adaptivePolicy` | WILL reafference algorithms | повторное обучение на replay, second reward authority |
| Долговечная память | `MemoryOS2` | Mem0 candidate extraction, Hexis provenance, Lumina consolidation | отдельные writable DB Palace/Mem0/Hexis/Letta/Chroma |
| Retrieval | `MemoryFabric` adapter | Chroma/FAISS candidate ranking | новый store без benchmark/migration/rollback |
| Provider | provider-neutral runtime adapter | llama.cpp engine / supported protocol | provider logic везде дублируется вручную |
| UI/Live2D | app shell + canonical API state | visual/expression/voice adapters | бизнес-логика в iframe или отдельный avatar state owner |
| Research/self-improvement | isolated research + promotion gate | Agent0/DSPy/Hyperon experiments | автоизменения live prompt/model/permissions без gates |
| Source files | provenance catalog / legacy archive | useful assets/docs/code with source hash | destructive dedup based on name, size or similarity |

## 7. Полный перечень типов пользы, которые следует сохранить или проверить

Это общий полезный реестр, по которому проверяется каждый файл/механизм. Он не говорит, что все перечисленные элементы реализованы или должны быть добавлены; «найдено в источниках» означает предмет для comparison, а «полезно Курису» — только после gap review.

### 7.1 Агентность и когнитивный цикл

- observation/prediction/action/outcome/learning/self-update lineage;
- exact logical decision ID and action ID, отдельные от execution ID;
- affordance field и bounded candidate sets;
- outcome verification по tool contract и по independent external postcondition;
- competence separate from availability/policy refusal/execution error;
- delayed temporal credit и предотвращение double learning;
- prediction error, confidence calibration, surprise и causal confidence;
- goal proposal/priority/defer/cancel lifecycle;
- counterfactuals, alternative actions, policy boundaries;
- explicit unknown and withheld evidence states;
- реальный vs simulator/shadow outcome маркирован явно;
- recovery after partial/ambiguous effect;
- user-visible trace for “what was attempted/what happened/why it learned or did not learn”.

### 7.2 Память и knowledge evolution

- candidate extraction/entity normalization;
- merge/deduplicate vs force-distinct decision;
- temporal validity/freshness and timezone normalization;
- provenance/source authority/independence lineage;
- semantic, temporal, causal and contradiction links;
- belief supersession, revise, quarantine, revert;
- user corrections, forget/delete/retention governance;
- lifecycle command IDs and fingerprints;
- replay-safe writes, transaction/append durability;
- semantic retrieval, lexical fallback and provider timeout;
- candidate rank explanation;
- hot/warm/cold residency, byte budget, eviction witness;
- preservation of identity/autobiographical/pinned memories;
- dreaming/summarization into candidate staging, with source IDs/fidelity checks;
- retrieval baseline, holdout benchmark and regression deltas;
- backup/export/import schema migrations, corruption handling and rollback;
- compatibility projections strictly read-only or rebuilt from canonical memory.

### 7.3 Инструменты/безопасность

- capability registry and duplicate-ID policy;
- risk tier matrix (read-only, local write, destructive, process, browser/network, device, self-modification);
- approval gate and scope/identity; typed refusal;
- URL/redirect/DNS/IP private-address checks;
- stable idempotency keys and durable receipt;
- per tool input schema, expected output schema and postcondition;
- cancellation/timeout/deadline and abort propagation;
- retries only for safe operations, bounded backoff and jitter;
- audit provenance without leaking credentials/PII;
- generated tool staged/compiled/tested outside production;
- permission escalation impossible without explicit approval;
- sandbox/resource budgets/process isolation;
- open file/network/device restrictions by default;
- archive corruption and safe recovery;
- actionable UI for pending receipt/reconciliation state.

### 7.4 Models/provider/runtime

- local/cloud provider selection and switching;
- health check and model fingerprint/version;
- context-limit and truncation/compaction;
- streaming semantics, cancellation, retry, timeout;
- per-provider auth/header and safe secret storage;
- inference fallback and degradation metrics;
- CPU/GPU offload on target hardware;
- concurrency limits and back-pressure;
- token/latency/cost/context metrics;
- deterministic settings where reproducibility matters;
- embedding provider/model/version consistency;
- no false semantic guarantee based on similarity score alone.

### 7.5 UI, embodiment and interaction

- every user-facing capability has reachable navigation/control;
- API schema and client type remain synchronized;
- truthful loading/running/cancelled/refused/recovery statuses;
- Live2D visual state mirrors canonical expression/energy/speaking/embodiment state;
- Legacy fallback never disappears when Live2D asset/provider fails;
- same-origin, type/schema validated `postMessage`;
- local assets and offline first behavior;
- error boundary and useful diagnostic reporting;
- keyboard/mobile behavior and layout/long text overflow;
- cancellation/disconnect/resume consistency;
- permission confirmation surfaced before irreversible actions;
- no fake buttons/unused UI-only capabilities;
- no UI code that mutates memory/state outside API ownership.

### 7.6 Engineering/provenance/release

- source-to-canonical path mapping;
- SPDX/license inventory per copied path and dependency;
- SBOM plus dependency lock/provenance;
- no unknown license inherited from bulk copied directories;
- duplicate detection by content hash plus context/dependency review;
- legacy snapshots kept, active entry points distinguished from history;
- baseline archive hash, coherent release numbering and changelog;
- clean install, exact lockfile, build, typecheck;
- runtime + UI/browser E2E;
- fault injection and restore/recovery;
- multi-hour soak with memory/CPU/FD/child process bounds;
- backup/restore, upgrade and rollback drill;
- security tests for SSRF, path traversal, prompt/data injection, secret leaks;
- real provider behavior versus mock and synthetic tests;
- documented residual risks and rollback switches.

## 8. Source-to-canonical integration strategy

### Pass SYN-0 — freeze code truth and active routes

**Code-first action:** фиксировать hash текущего ZIP и установить route map от app API до OrganismCore; для каждого P0 record найти exact call sites. Не добавлять новый subsystem, пока не проверен уже имеющийся analog.

**Deliverable:** source→symbol→canonical owner→call path matrix с status и references.  
**Acceptance:** для каждой high-priority capabilities указан активный caller и owner, а документационный/исторический код помечен.

### Pass SYN-1 — receipt/reafference causal closure (P0)

1. Свести поля ActionGateway/OutcomeCognition/ExternalObserver/CEF в typed receipt projection без вторичной истины.
2. На keyed side effects сохранять pending до effect и completed только после finalizer + checkpoint.
3. Привязать `decisionId` только из host; executionId не использовать как его substitute.
4. При verified external postcondition передавать одну receipt lineage в CEF с явными `action → outcome` parent IDs; ссылаться на существующие outcome/temporal IDs.
5. Сделать строгий event idempotency key для observations and assignments; duplicates remain visible but cannot learn twice.
6. Развести policy refusal, unavailable, competence-insufficient, execution-failed, executed-unverified, executed-verified, pending-recovery и contradicted evidence.
7. Реализовать явный recovery UX/API: pending receipt -> reconciliation state -> no replay until resolved.
8. Проверить несколько source classes, independent keys, same source duplicates, late feedback, replay, wrong decisionId, stale observations, autonomous=false.
9. Объяснимо показывать пользователю, что случилось и какое свидетельство привело/не привело к learning.

**Acceptance:** один реальный tool effect прослеживается через logical decision, durable receipt, actual result, external observation, outcome verification, causal CEF projection, ровно один delayed assignment and restart restore; retry/reconnect не выполняет side effect и learning повторно.

### Pass SYN-2 — MemoryFabric write authority and research candidates (P0/P1)

1. Поискать все writes `encode/revise/reviseContent/updateSignals/updateContext/forgetById` во всех активных runtime paths.
2. Все accepted mutations подчинить MemoryFabric lifecycle command/fingerprint или задокументированной эквивалентной транзакции MemoryOS2.
3. Для research, Mem0, Hexis и Lumina выдавать typed candidate, evidence/provenance, confidence and suggested lifecycle operation.
4. Unknown/conflicted candidate по умолчанию остаётся `unknown`/hypothesis; source diversity не доказательство entailment.
5. Timezone-aware watermark, stable message IDs, dedupe and replay receipts for consolidation/dreaming.
6. Проверить supersession and revert flow, forget/delete and tombstone semantics, revision history and compatibility projections.
7. Синхронизировать embeddings model fingerprint and rebuild index on model/schema drift.
8. Добавить ranking/eviction explanations and metrics, но не второй memory UI/state owner.
9. Benchmark baseline and candidate on held-out temporal/contradiction tests before changing default ranking.

**Acceptance:** один входной факт проходит candidate -> source/independence -> conflict check -> one MemoryFabric write receipt -> restore -> retrieval with provenance and ranking reason; forget/revise survives restart and no orphan store holds authoritative copy.

### Pass SYN-3 — Toolmaker, channel/permission and security (P0/P1)

1. Audited capability registry with duplicate tool-ID guard or explicit versioned replacement.
2. Risk-tier matrix and policy-enforced caller/channel/permission identity.
3. URL/redirect/DNS/IP allowlisting at connect time, block private/reserved addresses unless capability explicitly local-scoped.
4. Offline creation/review/compile/test of candidate tools; explicit out-of-band approval; no LLM self-approval.
5. Generated code executes in bounded process/container with time/memory/network/filesystem restrictions.
6. All destructive tool uses stable idempotency key, explicit confirmation and expected postcondition.
7. Secret redaction in audit/log/diagnostic endpoints; structured reason retained without raw credentials/personal content.
8. Reject/recovery state surfaced to UI/API, not just logs.
9. Include OpenClaw/Hermes/Microsoft Agent Framework/OpenAI SDK references only for an identified missing contract.

**Acceptance:** test proves no unapproved tool executes, no public-facing capability reaches private network through redirects/DNS changes, cancellation/timeouts work, and all outcomes persist and explain correctly.

### Pass SYN-4 — Provider reliability and local model loop (P1)

1. Provider-neutral health/ready/model fingerprint/context window interface.
2. Timeout/cancel/stream/retry contract across local llama.cpp and configured cloud provider.
3. No silent fallback that swaps model semantics without exposing `provider/model/reason` in diagnostics.
4. Bound concurrent inference; account for GPU VRAM, system RAM, context and embedding jobs; degrade safely under load.
5. Normalize error classes and prevent retrying non-idempotent tool side effects as though they were LLM requests.
6. Test on target hardware. Use quality/latency/context-size tradeoff instead of assuming bigger is better.

**Acceptance:** forced provider disconnect / OOM / context overflow / timeout / cancellation recovers without duplicate tool call, lost memory write or silent success.

### Pass SYN-5 — UI/Live2D and Legacy release path (P0)

1. Route every live subsystem and its actionable state through existing API/Runtime Atlas or existing views only if useful.
2. Build clean root/app, fix real dependencies/typing issues instead of adding placeholder typings.
3. Test iframe origin and message type/schema, reject malformed/oversize data; do not accept arbitrary messages.
4. Pin or bundle Pixi/Cubism vendor dependencies for offline deterministic release; remote CDN fallback explicit, recorded and optional.
5. Verify Legacy fallback at missing model, invalid model, network denied, slow init, iframe error, desktop/mobile and page reload.
6. Confirm user-facing status differentiates pending/recovery/refused/unknown/verified results; avoid decorative capabilities.
7. Check all new modules are accessible through UI if intended for user operation.

**Acceptance:** browser E2E clean install: chat/diagnostics/action/memory UI flows work; Live2D and fallback work; no console-critical error; API state is canonical; user action is observable end to end.

### Pass SYN-6 — Retrieval and memory improvements with evidence (P1/P2)

1. Make fixed memory benchmark with labelled positives, temporal changes, contradictions, forget/revised facts, same-source syndicated content and adversarial irrelevant distractors.
2. Establish baseline metrics before adding algorithms.
3. Prototype Mem0 extraction, Lumina candidate consolidation, Hexis supersession, Chroma/FAISS retrieval independently behind adapter.
4. Evaluate per-seed Recall@k, MRR/nDCG, contradiction safety, temporal freshness, latency, memory/CPU and cost; pre-register acceptance minimum.
5. Only promote if holdout improvement is repeatable and does not degrade correctness or memory governance.
6. Keep dream-summary candidate staged pending provenance/fidelity review, never directly writing curated facts from an LLM summarization.

**Acceptance:** candidate outperforms baseline on held-out cases, no regression on forgotten/contradictory facts, full rollback switch retained.

### Pass SYN-7 — Research/self-improvement as isolated candidate lab (P2)

1. Agent0 generates tasks/curricula; run only in bounded research runner with budget/timeout.
2. DSPy optimizes prompts/signatures only on fixed evaluation/training subsets; preserve data split and commit diff.
3. Hyperon/MeTTa returns rule trace/premises/confidence as typed hypothesis; no direct executor authority.
4. New skill/model/prompt gets versioned provenance, diff, eval score, holdout result and explicit promotion. No live auto-mutation after a single positive event.
5. Maintain research/production boundary and rollback to last known version.

**Acceptance:** research cannot modify production memory/runtime/tool permissions without explicit promotion; experiment is reproducible and its effect is measurable.

### Pass SYN-8 — Duplicates, historical versions and licensing (P1/P2)

1. Compare byte-identical candidates first, then semantic duplicate candidates, then imports/asset references.
2. Categorize: current-active duplicate, old snapshot, bundled vendored dependency, test fixture, source archive, unique asset, same name/different implementation.
3. Before deletion, prove no import/config/script/path dynamically references the file; retain rollback archive and manifest.
4. Record origin and license for every adapted third-party path; generate SBOM and verify notices.
5. Letta duplicate consolidated as source reference but keep one canonical provenance record; do not delete original archive.
6. Avoid license-sensitive AutoGPT/OpenClaw transfer without exact path/version/legal review.

**Acceptance:** no missing assets/imports after cleanup, no loss of Live2D/Legacy or source provenance, rollback path reproducible.

### Pass SYN-9 — Release candidate proof (P0)

- Clean install from lockfiles and reproducible package build;
- runtime TypeScript typecheck + application typecheck/build;
- targeted unit/integration plus full relevant suite;
- action-ledger crash/fault injection and replay matrix;
- memory restore/forget/update/revision/upgrade/rollback;
- UI/browser/Live2D/Legacy e2e;
- security tests for SSRF, path traversal, permission bypass, malformed `postMessage`, secret exposure, prompt/data injection;
- multi-hour soak, bounded logs/ledger/archive/cache, no leak/resource growth;
- clean backup/restore and previous release rollback;
- provider smoke and device integration with explicitly recorded real-vs-simulated outcomes;
- residual risk ledger and release sign-off based on evidence, not roadmap percentage.

## 9. Приоритетный список инженерных действий (120 пунктов)

Статусы при запуске SYNS: `OPEN` (пока не доказано закрытие в этой ревизии), кроме задач, явно описанных как существующие механизмы. Это новая адресная очередь, а не утверждение, что каждую функцию нужно добавить с нуля.

### P0 — сквозная корректность, долговечность, UI

1. **SYN-P0-001** Составить call-site list каждого `ActionGateway.executeTool` и подтвердить ключ/обработку результата для каждого внешнего side effect.
2. **SYN-P0-002** Привести action outcome к единой схеме receipt с `executionId`, exact `decisionId?`, tool, class, verification, source, timestamp и finalization status.
3. **SYN-P0-003** Добавить CEF projection для реального external-tool receipt с parent IDs, не дублируя outcome authority.
4. **SYN-P0-004** Проверить, что keyed receipt finalizer завершается до `completed` persistent ledger row.
5. **SYN-P0-005** Испытать crash после pending receipt до side effect — после restore не должно быть повторного неопределённого действия.
6. **SYN-P0-006** Испытать crash после side effect до finalizer — должно оставаться recovery-required с безопасной reconciliation процедурой.
7. **SYN-P0-007** Испытать finalizer failure, completion-persist failure и архивную read/write ошибку.
8. **SYN-P0-008** Проверить same-key same-request concurrency: реально один side effect и один finalizer.
9. **SYN-P0-009** Проверить same-key different-request conflict в разных процессах/после restore, не только внутри одного inflight map.
10. **SYN-P0-010** Проверить completed receipt replay — не создаётся новый outcome/learning event.
11. **SYN-P0-011** Проверить huge response payload/omitted replay payload и документировать, что повтор получает достаточно статуса для понимания исхода.
12. **SYN-P0-012** Добавить explicit recovery protocol для pending receipt, включая external confirmation/unknown/manual resolution.
13. **SYN-P0-013** Определить duplicate `registerTool` policy; отказать неожиданной подмене либо выдавать явный versioned replace event.
14. **SYN-P0-014** Проверить восстановление `action-ledger.jsonl` при частично записанной последней строке.
15. **SYN-P0-015** Проверить ledger/archive compaction, размер, concurrency, duplicate keys and conflicting records.
16. **SYN-P0-016** На тестовых границах подтвердить reafference confidence threshold 0.72 включительно.
17. **SYN-P0-017** На тестовых границах подтвердить mismatch threshold 0.68 и минимум 2 independent contradiction sources.
18. **SYN-P0-018** Проверить exact pending decision ID; неверная/уже resolved ID не должна назначать temporal credit.
19. **SYN-P0-019** Проверить duplicate `independenceKey` и повтор observation; повтор не должен искусственно увеличивать независимость.
20. **SYN-P0-020** Развести отказ policy и недоступность с competence update во всех learning consumers, включая P84/Will bridge.
21. **SYN-P0-021** Сделать единую политику для `verified mismatch` в world/identity/competence: разные consumers могут иметь разные последствия, но thresholds должны быть явными.
22. **SYN-P0-022** Проверить delayed assignments с `delayTicks>0`, causalConfidence ≥ 0.5, independent=true и повторным применением после restore.
23. **SYN-P0-023** Инвентаризировать все MemoryOS2 writes в активных runtime paths, API and research.
24. **SYN-P0-024** Подтвердить, что внешнее исследование/кандидаты пишутся только через lifecycle API/fingerprint receipt.
25. **SYN-P0-025** Проверить повтор одного `commandId`/same payload, replay different payload, fingerprint conflict and restore.
26. **SYN-P0-026** Проверить tombstone/forget, quarantine, revise, supersession and rollback semantics across restart.
27. **SYN-P0-027** Проверить полную root/app TypeScript/Vite production build на clean install.
28. **SYN-P0-028** Реализовать браузерный E2E главного пользовательского потока от UI до canonical runtime state.
29. **SYN-P0-029** E2E Live2D available/unavailable/corrupt/slow/offline plus Legacy fallback.
30. **SYN-P0-030** Подтвердить, что каждый предназначенный пользователю новый capability имеет реальную UI/API точку, а не только код.
31. **SYN-P0-031** Проверить `postMessage` schema/type/origin/size, сообщения из nested/redirected windows и invalid values.
32. **SYN-P0-032** Убрать обязательную зависимость release-time rendering от нефиксированного CDN; remote fallback сделать явным и безопасным.
33. **SYN-P0-033** Пройти clean install → start → chat → action → external confirmation → restart → replay.
34. **SYN-P0-034** Проверить cancel/timeouts на browser, provider and tool side: cancellation не равна success.
35. **SYN-P0-035** Провести backup/restore/upgrade/rollback до release sign-off.

### P1 — надёжность интеграций и память

36. **SYN-P1-036** Сделать source-to-canonical matrix с точной ссылкой на файл/символ, не только названием upstream проекта.
37. **SYN-P1-037** Добавить standard evidence references to action receipts, outcome records and CEF nodes.
38. **SYN-P1-038** Разделить durable truth, diagnostic projection and rolling cache в схемах сериализации.
39. **SYN-P1-039** Проверить CEF restore for duplicate IDs, wrong ticks, missing parents, oversized payloads.
40. **SYN-P1-040** Проверить ring-buffer truncation and distinguish aged-out parent from never-existing parent.
41. **SYN-P1-041** Зафиксировать identity rule for CEF event IDs in replay/rebuild.
42. **SYN-P1-042** Проверить CEF payload for secrets, prompts, PII and large binary values.
43. **SYN-P1-043** Сделать explicit distinction real-world, externally verified, simulator and shadow event classes across UI/learning.
44. **SYN-P1-044** Не давать simulator outcomes равную evidence weight внешнему действию.
45. **SYN-P1-045** Проверить source/freshness/independence normalization in ExternalObserverFabric.
46. **SYN-P1-046** Ensure external observation stale and late-arriving results have explicit state.
47. **SYN-P1-047** Проверить claim reconciliation for mixed supported/refuted evidence and repeated mirrors.
48. **SYN-P1-048** Единый outcome receipt should preserve verifier observation IDs, not just text postconditions.
49. **SYN-P1-049** Добавить explicit capability risk tiers and policy mapping.
50. **SYN-P1-050** Audit tool registry: duplicate IDs, project permissions, destructive flag, schemas and missing verifier.
51. **SYN-P1-051** Проверить caller identity and channel permissions at API boundary.
52. **SYN-P1-052** Проверить redirect-time URL policy + resolved IP (SSRF/local network boundary).
53. **SYN-P1-053** Ограничить browser/process/device tool runtimes by time, output size, memory and child processes.
54. **SYN-P1-054** Guard generated tool source, dependencies, approval and execution registry.
55. **SYN-P1-055** Secret redaction in audit logs, error messages, trace payload and frontend.
56. **SYN-P1-056** Make provider failure class stable: timeout, cancellation, auth, rate limit, context overflow, OOM, protocol error.
57. **SYN-P1-057** Make provider retry policy separate from tool action retry semantics.
58. **SYN-P1-058** Pin local model/server version and record model fingerprint/config in diagnostics.
59. **SYN-P1-059** Benchmark llama.cpp on actual hardware, context size and quantization.
60. **SYN-P1-060** Bound provider concurrency, requests and embedding queue depth.
61. **SYN-P1-061** Ensure adapter failure falls back without losing user turn/action state.
62. **SYN-P1-062** Verify embedding provider/model change triggers index rebuild or explicit version mismatch handling.
63. **SYN-P1-063** Fix timezone-aware timestamp handling in memory/event import and dreaming candidate staging.
64. **SYN-P1-064** Ensure MemoryFabric memory retrieval timeouts/fallbacks appear in diagnostics but are not treated as empty-world facts.
65. **SYN-P1-065** Add why-included/why-excluded explanation for memory ranks.
66. **SYN-P1-066** Add eviction witness for each dropped memory and prove protected IDs work with byte pressure.
67. **SYN-P1-067** Test memory revisions, source lineage and supersession revert.
68. **SYN-P1-068** Test external research duplicate content/independence and syndicated mirror keys.
69. **SYN-P1-069** Keep external research at hypothesis unless real claim entailment evidence exists; diversity alone is not truth.
70. **SYN-P1-070** Add candidate consolidation fidelity check with pointers to original memories.
71. **SYN-P1-071** Ensure dream summaries cannot overwrite curated/factual memory without validation.
72. **SYN-P1-072** Implement offline memory benchmark with holdout, fixed seeds and repeatable baseline.
73. **SYN-P1-073** Inspect adaptive learning/policy outcome IDs for replay idempotency.
74. **SYN-P1-074** Confirm all diagnostics UI actions are bound to API handlers and reflect canonical statuses.
75. **SYN-P1-075** Produce SBOM/provenance and license allow/deny report per source path.

### P2 — measurable capability upgrades

76. **SYN-P2-076** Differential audit `will-main/src/cognition/agency/engines/reafference.engine.ts` vs Kurisu codec/bridge.
77. **SYN-P2-077** Compare WILL affordance synthesis with current candidate/affordance fields; port only missing ranking evidence.
78. **SYN-P2-078** Map WILL skill artifacts to canonical ProceduralSkillLibrary/adaptivePolicy without parallel authority.
79. **SYN-P2-079** Make tool outcome trace include skill/decision version when one was used.
80. **SYN-P2-080** Port Lumina temporal decay as ranking feature behind calibration, not delete policy.
81. **SYN-P2-081** Port Lumina idle dreaming as staged candidate with timezone-safe cursor, source messages, dedupe and cancellation.
82. **SYN-P2-082** Port Lumina toolmaker approval workflow behind existing ActionGateway and sandbox policy.
83. **SYN-P2-083** Adapt Mem0 entity extraction as optional candidate producer with raw source references.
84. **SYN-P2-084** Compare Mem0 update/conflict policy against MemoryOS2 merge/revise behavior using a fixed adversarial dataset.
85. **SYN-P2-085** Map Hexis supersession and revert history to canonical memory revision group IDs.
86. **SYN-P2-086** Port Hexis capability evidence format for feature receipts, not ungrounded capability score.
87. **SYN-P2-087** Compare Microsoft Agent Framework middleware semantics to existing API/action guards.
88. **SYN-P2-088** Adapt OpenAI-style tripwires with typed refusal/failure in ActionGateway.
89. **SYN-P2-089** Compare Hermes session resumption/approval without creating another gateway.
90. **SYN-P2-090** Targeted OpenClaw channel/security deep dive only on mapped gaps.
91. **SYN-P2-091** Compare Chroma hybrid retrieval on held-out dataset behind MemoryFabric.
92. **SYN-P2-092** Compare FAISS CPU/GPU index performance at target scale and memory budget.
93. **SYN-P2-093** Require retrieval winner on held-out correctness and resource cost before enabling.
94. **SYN-P2-094** Introduce DSPy offline prompt optimization only with retained train/holdout separation.
95. **SYN-P2-095** Isolate Agent0 curriculum and self-improvement trials behind bounded research worker.
96. **SYN-P2-096** Let Hyperon/MeTTa produce explainable typed evidence with premises and rule versions.
97. **SYN-P2-097** Compare PocketFlow transitions/retry pattern and simplify existing workflow where measurable.
98. **SYN-P2-098** Reuse Langroid/OWL/Microsoft task contracts only where there is no simpler existing solution.
99. **SYN-P2-099** Compare OpenAutoGPT orchestration UX/trace, after exact license check, to existing project runner.
100. **SYN-P2-100** Convert selected runtime capability passport into observable operational proof, not prose-only claims.

### P3 — cleanup/maintenance only after critical paths

101. **SYN-P3-101** Reclassify every duplicate group: exact copy, same upstream snapshot, historical revision, vendor, asset, or semantic duplicate.
102. **SYN-P3-102** Keep legacy snapshots immutable and record relationship to active sources.
103. **SYN-P3-103** Never delete same basename unless hash/dependency/path references prove it is redundant.
104. **SYN-P3-104** Normalize docs so archived PASS values are marked with their tested scope and date.
105. **SYN-P3-105** Keep tests proportional to feature risk; do not add new testing layers without an actual code change they safeguard.
106. **SYN-P3-106** Trim noisy or unbounded logs/ledgers while retaining recovery evidence.
107. **SYN-P3-107** Generate compact source provenance records to avoid duplicated bulk source trees.
108. **SYN-P3-108** Simplify import/adapter layers after ownership boundaries are stable.
109. **SYN-P3-109** Check dynamic import/config references before eliminating apparently unused modules/assets.
110. **SYN-P3-110** Keep Live2D model assets, Legacy sprite assets and fallback paths during any cleanup.
111. **SYN-P3-111** Pin all runtime and app dependencies and eliminate accidental transitive drift.
112. **SYN-P3-112** Confirm package scripts do not refer to removed paths or stale workspace names.
113. **SYN-P3-113** Add graceful shutdown for provider workers, child processes and background consolidation.
114. **SYN-P3-114** Add resource bound diagnostics for hot memory, embedding queues and action archive.
115. **SYN-P3-115** Keep public/diagnostic API outputs bounded and redact private prompts/keys.
116. **SYN-P3-116** Ensure static heuristic flags have reviewed disposition, not mass auto-fixes.
117. **SYN-P3-117** Remove dead duplicate code only after active import graph confirmation.
118. **SYN-P3-118** Record licence/notice for any derived snippets or vendored assets.
119. **SYN-P3-119** Produce a release-facing residual risks document tied to exact artifact hash.
120. **SYN-P3-120** Freeze a tagged candidate after all P0 items have evidence and roll-back works.

## 10. Как использовать вспомогательные реестры

В состав `syns_Audit_Package` включены/формируются следующие реестры:

- `SYN_FILE_DICTIONARY.csv` — code file ID, scope, archive, path, extension, bytes/hash, role, known symbols/imports/signals, review level and scan status;
- `SYN_FILE_SEMANTIC_DOSSIERS.csv` — primary category counts, tag counts, actual line count, parser status/errors and risk signals per file;
- `SYN_LINE_SEMANTIC_INDEX.csv.gz` — compressed row for each scanned code line: `file_id,line_no,primary_category,tag_mask`; joins to file dictionary; categories/tags defined in `SYN_LINE_SEMANTIC_SUMMARY.json`;
- `SYN_CRITICAL_PATH_AST.csv` — imports, classes, interfaces, types, declarations, methods/properties, calls, constructors and catch blocks for selected high-impact TypeScript modules;
- `SYN_PARSE_COVERAGE.csv` — parse/read exceptions and diagnostics found by the automated pass;
- `SYN_LINE_SEMANTIC_SUMMARY.json` — exact line-index coverage, category totals, scan statuses and limitations;
- `Plants_MASTER_FILE_INDEX.csv` — wider source/archive inventory, including docs/assets/non-code and previous source-level metadata;
- `Plants_INTEGRATION_MATRIX.csv` — top-level disposition, priority, candidate contribution, canonical target, risks and do-not-do rules for all external sources;
- `Plants_CROSS_SCOPE_DUPLICATES.csv` — exact hash overlaps to contextual review; no row authorizes automatic deletion;
- `Plants_ACTIVE_PATH_REVIEW_QUEUE.csv` — active code candidates with static signals to inspect. Flags such as `exec`, `mock`, `TODO`, secrets or dynamic imports are leads, not verdicts.

**How to trace one line:** find `file_id` in `SYN_FILE_DICTIONARY.csv`; resolve `scope/archive/path`; locate exact file and line in source archive or extracted project; inspect surrounding caller/callee and dependency context. The line category is only a navigation hint. **How to mark an issue confirmed:** provide source line + callsite, input conditions, expected invariant, actual behavior/reproducer and the owner module to fix. No regex flag alone is sufficient.

## 11. Особые правила для семантического ревью по каждому файлу

Для каждого файла, который рассматривается на предмет integration/removal, последовательно ответить:

1. Является ли файл активным входом, зависимостью, тестом, примером, документацией, vendor/build product, archive, generated artefact или legacy snapshot?
2. Кто импортирует/запускает файл? Есть ли dynamic import, package script, worker path, config lookup, reflection, manifest, asset reference или runtime filename convention?
3. Что он владеет: state, database, cache, policy, execution, adapter, UI projection, schema, diagnostic, test fixture?
4. Какой его public contract, invariants, state transitions, side effects, error classes, timeout/cancel and retry policy?
5. Какие другие modules assume its schema, identifiers, order, timezone, path or failure semantics?
6. Какой существующий canonical module выполняет ту же функцию? Сравнить поведение и не по названию.
7. Что лучше: retain, adapt, compose, replace, isolate for research, keep historical, remove after proof, or unknown pending runtime trace?
8. Какие license/dependency/security/size/performance/resource implications?
9. Как проверяется real runtime call path, persistent restore and UI observability?
10. Как откатить изменение без потери состояния/Legacy/assets?

Формат фиксации: `FileRef → SymbolRef → CallPath → DataOwner → Behavior → Evidence → Gap → Decision → TargetModule → Dependencies/Licence → Acceptance → Rollback → Status`. Это практический критерий завершения семантического анализа, не мнение по имени файла.

## 12. Основные неизвестности и что нельзя объявлять доказанным

1. Что каждый активный tool caller соблюдает stable idempotency keys; gateway сам по себе не может гарантировать это у caller without key.
2. Что каждое external tool receipt полностью отображается в общей CEF lineage, а не только в OutcomeCognition/ExternalObserver/temporal ledger.
3. Что `action-ledger.jsonl` безопасно переживает все возможные crash/partial write/corruption patterns and multi-process use.
4. Что состояние learning/skill/memory не меняется повторно при replay/duplicate late observations/restore migration.
5. Что вся writable memory mutation в реальном runtime идёт через MemoryFabric, а не случайный direct MemoryOS2 mutator.
6. Что root app/dependency-complete build and browser UI/Live2D E2E currently pass. Prior docs explicitly marked full app/UI evidence as incomplete.
7. Что CDN fallback/Live2D vendor dependencies behave predictably offline and in production security policy.
8. Что все upstream files are licence-compatible and selected features are actually superior in Kurisu context.
9. Что Chroma/FAISS/other retrieval has measured holdout uplift over current backend. No uplift is claimed in SYNS.
10. Что agent autonomy/identity/personality features demonstrate consciousness. These are functional architecture claims, not proof of human-like subjective experience.
11. That all text files line-indexed equals all binary, >4MiB, generated, vendor and resource files fully semantic-read. Files skipped by line scanner stay visible in master inventory but need separate mode/tool.
12. That the external sources have been manually understood line-by-line. Machine categories and AST nodes are not contextual reasoning for every line.

## 13. Финальная оценка

### Сильные стороны

- Основной runtime and memory/action ownership boundaries are explicit rather than purely conceptual.
- ActionGateway includes meaningful durable side-effect safety: pending-before-effect, same-key in-flight coalescing, request hash conflict, finalizer before completed receipt, and fail-closed replay/recovery behavior.
- Reafference requires exact decision IDs and credible external feedback; delayed learning is routed into existing temporal-credit/policy authority.
- MemoryFabric/MemoryOS2 provide one memory owner, command receipts, source lineage, epistemic states, bounded retrieval and resource control.
- CEF gives a typed bounded causal spine, not a free-floating second world model.
- Legacy/Live2D path is recognized as part of product, including fallback behavior.
- The source archives are large but now have source-to-file indexes, duplicate leads, per-source dispositions and a detailed order of work.

### Weak points/risks

- Runtime complexity and number of subsystems create a risk of parallel journals/projections and incomplete cross-linkage.
- Idempotency depends on all real side-effect callers adopting stable keys or correctly owning a reconciled unkeyed path.
- No current-turn independent execution evidence for full root/app/UI build, browser/Live2D path, long-soak or full fault injection.
- Upstream feature richness can cause integration sprawl unless every capability has a gap statement and one canonical owner.
- Static phrase/line classification cannot decide intent, semantic correctness or whether a feature is genuinely wired.
- Licences, resource limits and external model/provider availability remain release variables.

### Итоговая матрица

| Область | Оценка аудита | Вывод |
|---|---|---|
| Архитектурная основа | Strong | Сохранять canonical ownership; не начинать с переписывания всего |
| Action/idempotency design | Promising, needs fault evidence | P0 — трассировка/recovery across all callers |
| Reafference/learning | Selective end-to-end path exists | P0 — connect exact receipts into one causal trace; duplicate/threshold proof |
| Memory architecture | Strong single-owner direction | P0/P1 — inventory writes and prove all source paths use lifecycle |
| Retrieval / memory upgrades | Candidate value, unproven uplift | P1/P2 — benchmark and promote only with holdout win |
| Security/tool permissions | Has gates, scope still to prove end-to-end | P0/P1 — SSRF/permission/sandbox/failure drills |
| UI/Live2D/Legacy | Design and fallback exist | P0 — real browser E2E + offline asset policy |
| Integration from source archives | Many worthwhile candidate mechanisms | selective, source-traced adaptation; no bulk merging |
| Release readiness | Not proven in this audit | Do not sign off until P0 proof completed |
| “Human-level mind/consciousness” | Cannot be concluded from architecture | Describe implemented functions honestly; no unsupported consciousness claim |

**Финальный инженерный вердикт:** не переписывать Курису заново и не сливать все чужие проекты целиком. Сохранить WorkPass42 как baseline, продолжить code-first интеграцию внутри существующих владельцев, начать с action receipt/reafference causal closure and memory lifecycle single-write guarantees, затем tools/security, provider reliability and UI/Live2D. После каждого реального code pass архивировать новый проект и записывать конкретно: какие файлы изменены, какая способность стала работать end-to-end, какой источник полезной идеи адаптирован, какой дубликат ликвидирован/оставлен и какие acceptance cases прошли. Report score/number of scanned lines is not a substitute for that proof.

## 14. Критерий того, что Курису действительно стала единой

Система считается integrated только если одновременно выполняется следующее:

- одна action инициируется canonical runtime, выполняется по одному policy path, имеет stable receipt and explicit postcondition;
- exact external observation связана с тем же decision/execution lineage, имеет provenance/independence and freshness;
- learning updates once and only from eligible outcomes; retry/replay/unknown/refusal semantics stay stable after restart;
- memory writes are applied once to one canonical owner, provenance and supersession survive restoration, retrieval has measured correctness;
- new providers/tools/memory extractors are adapters behind canonical interfaces, not second owners;
- any capability intended for user operation is accessible via existing UI/API; avatar is presentation of real canonical state;
- errors/cancellation/degraded mode are visible and recoverable, not silently interpreted as success;
- sources are traceable and licensed, duplicate cleanup is reversible, original source remains available;
- build, runtime, UI/browser/Live2D, restore and soak evidence is recorded against an exact release artifact hash.

Until all these conditions are evidenced, the right status is **advanced integration baseline / active engineering, not certified release**.
