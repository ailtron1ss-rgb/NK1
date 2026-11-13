# Реестр ассимиляции внешних исходников NK1 — 2026-11-13

> Статус документа: первичная инвентаризация и архитектурная маршрутизация. Это НЕ заявление, что все внешние проекты уже перенесены в NK1. Код из архивов в этой итерации не копировался и зависимости не устанавливались: локально доступен только source-архив NK1 не предоставлен, а сетевой пакетный реестр недоступен. До переноса каждого конкретного механизма нужны проверка точной реализации, совместимости, тесты и лицензионное разрешение.

## 1. Контрольная точка NK1

- Канонический репозиторий: https://github.com/ailtron1ss-rgb/NK1
- Рабочая ветка проекта по закреплённому правилу: `workpass70-source`; `main` — release/metadata.
- Текущая рабочая runtime-архитектура по доступному `runtime/neuro-kurisu/package.json`: TypeScript/Node.js runtime, Node >=22.12, большой набор focused regression tests, cognitive cycle, planner, replay/continual learning, MemoryOS2, causal memory, embodied motor, evidence/provenance, speech.
- Из GitHub обнаружен merge commit `9a789ee1af8fdaa3826dbc734d18e2fc00cde5bf` (2026-11-12), связанный с PR #862; исходный commit `6202661ad1dcfa37d314765b45e6d63852053e2d` описывает UserModelEvidenceModel v2, skeletal kinematics / damped least-squares IK, motor arbitration и расширение UnifiedBrainSystem contract tests. Это наблюдение репозитория, а не подтверждение, что эти изменения уже присутствуют в Release ZIP.
- README в `workpass70-source` содержит старую checkpoint-секцию от 1 ноября; нельзя использовать её как единственный текущий статус. Файл `docs/PROJECT_PROGRESS_TRACKER_2026-11-11_RU.md` по указанному пути на этой ветке не найден. Нужна синхронизация документации с фактической веткой и релизом.
- Runtime package scripts показывают развитую тестовую инфраструктуру, включая `test:rebuild-recovered`, cognitive cycle, planner routing, replay, memory restore/lineage, motor/embodiment. Однако фактический результат запуска CI для merge #862 в доступном запросе не был возвращён (workflow_runs пуст); не обозначать эти тесты как проверенные здесь.

## 2. Инвентаризация предоставленных архивов

Доступны 4 контейнера 7z: `one.7z`, `two.7z`, `three.7z`, `four.7z`. Внутри обнаружены 22 ZIP-вложений, из них 21 уникальный исходный проект (Letta присутствует дважды). По индексам ZIP — около 1.6 GB распакованного содержимого суммарно. SHA-256 контейнеров:

| Архив | SHA-256 |
|---|---|
| one.7z | `2aa144432afd7a234b4aa3139cfa6019a97bab453dd235f623ccac2c00b83b41` |
| two.7z | `f6bce0f421c727c98c978328efe0dcb2bfa93ef77f8a7fcc1686c24b24958366` |
| three.7z | `598c8e11e176994214d2cdfcf9ec0bfe4b65e19e10e54c0190e4f5b859293f97` |
| four.7z | `e15b12e9617882026ab8077f7698c6a6c47df5f1e4690607d3dbcac2df4952a0` |

Указанный пользователем релизный ZIP `Neuro_Kurisu_WORKPASS70_2026-10-19.zip` отсутствовал в доступном каталоге при проверке. Поэтому сравнение «релиз против исходников» пока не завершено.

## 3. Карта источников и решений

Оценки пользы ниже — архитектурные гипотезы для NK1, не результаты сравнительных экспериментов. «Не переносить» означает не импортировать целый framework; допускается точечная адаптация после проверки.

| Источник | Область, которую следует изучить | Потенциальная польза NK1 | Решение / ограничения |
|---|---|---|---|
| Hexis | Postgres-native identity, beliefs, heartbeat, energy budget, audited belief revisions, exportable mind, reviewed learning/forgetting | Усилить долговременную идентичность, provenance beliefs, автономный ритм и объяснимое изменение убеждений | Высший приоритет для сравнительного анализа. Не создавать второй memory owner: адаптировать контракты к MemoryOS2/OrganismState. MIT; проверить все assets/dependencies отдельно |
| Letta | Stateful agent memory, archival/core memory, tool lifecycle | Сопоставить управление рабочей памятью и долгоживущим агентом с текущими слотами/MemoryOS2 | Высокий аналитический приоритет; не переносить параллельное хранилище. Apache-2.0 |
| Mem0 | Memory extraction/update/deletion, scoped memory and retrieval | Сравнить lifecycle памяти, профили/пространства памяти, dedup и write policy | Высокий приоритет для точечных тестовых сравнений; сохранить единого владельца памяти. Apache-2.0 |
| Hermes Agent | Tool/skill lifecycle, persistent sessions, provider adapters, operational loops | Идеи для skill lifecycle, инструментальной устойчивости, восстановления сессий | Высокий приоритет для адаптации отдельных протоколов, не копировать целый агент. MIT, проверять вложенные skill licenses |
| OpenClaw | Gateway/channel architecture, plugin isolation, sessions, mobile/desktop bridges | Усилить единый шлюз каналов/инструментов, наблюдаемость, reconnect и lifecycle клиентов | Высокая архитектурная ценность, но очень большой и неоднородный репозиторий (57k entries); брать узкие контракты. MIT root не покрывает автоматически все вложенные компоненты |
| OpenAI Agents Python | Agent loop, handoffs, guardrails, tracing, sessions, MCP/realtime lifecycle | Сверить handoff, трассировку и tool/session semantics с OrganismBus/ActionGateway | Высокий приоритет для контрактного сопоставления; не вводить второй агентный runtime. MIT |
| Microsoft Agent Framework | Durable agents/workflows, orchestration, typed messages | Сравнить durable execution, workflow resume и typed contracts | Средний/высокий; выбрать отдельные идеи, не внедрять .NET/Python framework в TS runtime без доказанной выгоды. MIT |
| AutoGen | Multi-agent conversation patterns, event-driven runtime | Исследовать распределение задач/агентные роли для параллельных когнитивных процессов | Средний; текущие острова должны координироваться через OrganismBus, не через неконтролируемые чаты. В архиве указан CC BY 4.0 — требуется attribution |
| Langroid | Actor-like multi-agent tasks, tool messages, MCP | Возможные шаблоны типизированных сообщений и акторного взаимодействия | Средний; извлекать идеи/микропаттерны, не Python framework. MIT |
| PocketFlow | Minimal graph/workflow nodes, batch/parallel patterns | Упростить/формализовать отдельные cognitive DAG и bounded fan-out/fan-in | Высокий как источник минимальных orchestration patterns; не заменять существующий cognitive cycle. MIT |
| DSPy | Declarative modules, optimizer/evaluation loops, signatures | Научная оптимизация промптов/маршрутизации на фиксированных eval-наборах | Высокий для офлайн tuning harness; не включать в критический runtime и не давать оптимизатору менять политику без holdout. MIT |
| FAISS | ANN/vector indexing and search | Benchmark alternative для больших derived embedding indexes | Средний/условный: сравнить latency/recall на реальном NK1 corpus; не добавлять нативную зависимость, если текущий индекс достаточен. MIT |
| Chroma | Collection/metadata/vector retrieval | Альтернативный retrieval benchmark и metadata filter semantics | Средний: только как сравнительный backend, не как второй источник истины. Apache-2.0 |
| llama.cpp | Local inference server, quantization, constrained resource execution | Усилить локальный LLM как основной/резервный provider, профили памяти и streaming | Высокий; в NK1 уже есть llama.cpp route, задача — diff и perf/e2e, не повторная интеграция. MIT; модели/веса имеют отдельные лицензии |
| Hyperon / MeTTa | Symbolic atoms, pattern matching, rewrite systems | Экспериментальный слой символьных правил/отношений для explainable reasoning | Исследовательский приоритет, не production dependency до benchmark, sandbox и доказательства преимуществ. MIT |
| Agent0 | Tool-use learning, agent training/evaluation | Идеи для улучшения tool-use через offline trajectories и evaluation | Исследовательский, GPU/data-intensive; не переносить training stack в основной runtime без отдельной цели и лицензий вложенных компонентов. Apache-2.0 root |
| AutoGPT | Agent platform, blocks, workflows, execution | Извлечь идеи блоковой композиции и управления задачами | Ограниченный приоритет: папка `autogpt_platform` заявлена как Polyform Shield, не импортировать её код без отдельной юридической проверки; корневая лицензия неоднородна |
| CAMEL OWL | Multi-agent role/task orchestration, tool ecosystem | Сравнить многоагентные исследовательские сценарии | Исследовательский; корневой LICENSE в архиве не обнаружен — никакого копирования кода до выяснения прав |
| Lumina | Avatar/voice/persona presentation (по структуре архива) | Возможные UX/voice patterns и демонстрационные материалы | Низкий/средний; сначала проверить зависимости, происхождение аудио/изображений и лицензии. Apache-2.0 root не очищает assets |
| Will | Cognitive/agency/attention/awareness design notes (по именам файлов) | Гипотезы о внимании, agency channels, action-conditioned prediction и awareness scoping | Высокий исследовательский интерес, низкая готовность к прямому runtime-переносу; нужна научная проверка каждого механизма. Apache-2.0 root |
| Superpowers | Engineering skills, test-driven development, planning/review workflow | Улучшить процесс разработки NK1, не cognitive runtime | Высокая внутренняя польза; применять как процессные инструкции, не как runtime dependency. MIT |

## 4. Ключевые архитектурные выводы

1. **Не объединять конкурирующие владельцы памяти.** Hexis, Letta, Mem0, Chroma, FAISS — не пять новых баз в NK1. MemoryOS2 остаётся каноническим владельцем памяти; остальные — идеи, адаптеры или изолированные сравнительные стенды.
2. **Сначала контракт, потом импорт.** Любой механизм должен входить через текущие границы: OrganismBus/OrganismState, cognitive cycle, ActionGateway, memory owner, EvidenceFirewall/provenance и существующие capability/embodiment contracts.
3. **Внешний агентный framework не должен становиться вторым мозгом.** OpenClaw, Hermes, AutoGen, Langroid, Agents SDK и Microsoft Agent Framework сравниваются по узким функциям: lifecycle, handoff, durable resume, tool semantics, tracing, cancellation.
4. **Научные/символьные механизмы — экспериментальные.** Hyperon, Agent0 и Will требуют воспроизводимых задач, baseline, ablation и независимого holdout; красивые архитектурные аналогии не являются доказательством когнитивного улучшения.
5. **Модели и веса лицензируются отдельно от кода.** llama.cpp не предоставляет автоматически права на конкретные веса; UI/voice/avatar assets также проверяются отдельно.
6. **Не смешивать проценты реализации и готовности.** Прогресс интеграции источников ниже — это покрытие процесса инвентаризации, не готовность цифровой личности и не доказательство сознания.

## 5. План интеграционных проходов

### Pass A — source-to-capability mapping
Для каждого из 21 уникального источника: pinned revision, exact file paths, license/SPDX and NOTICE, dependencies, platform, runtime language, tests, data/model assets, security surface. Сверить с существующими NK1 modules и отметить duplicate/overlap.

### Pass B — isolated reproductions
Взять по одному механизму из каждой высокоприоритетной области и воспроизвести в отдельном тестовом стенде: belief revision/identity (Hexis), memory lifecycle (Letta/Mem0), skill/tool lifecycle (Hermes/OpenClaw/Agents SDK), workflow scheduling (PocketFlow), offline optimization/eval (DSPy), local inference performance (llama.cpp), vector retrieval (FAISS/Chroma).

### Pass C — adaptation, not wholesale import
Реализовать только механизмы с measurable gain. TypeScript-first adapters; Python/Rust services — только если benchmark показывает необходимость. Любой новый service имеет timeout, bounded queue, cancellation, health/readiness, resource budget, provenance and safe fallback.

### Pass D — integration and ablation
Подключить через существующие владельцы состояния. Сравнить baseline vs candidate на одинаковых immutable fixtures, минимум 5 paired seeds для стохастических экспериментов, RU/EN holdout для памяти. Нельзя promote, если recallDelta <= 0, растёт latency/error rate или ухудшается privacy/safety.

### Pass E — release reconciliation
Только после tests, security/license review, source provenance and exact-SHA CI. Сверить source branch → PR head → merged source → release ZIP. Не объявлять интеграцию выпущенной до проверки фактического Release asset и его SHA-256.

## 6. Приоритеты следующих реальных изменений

- P0: восстановить доступ к текущему полному source/release ZIP и снять live SHA `workpass70-source`; сопоставить его с #862 и опубликованным release.
- P0: собрать актуальную матрицу уже существующих NK1 механизмов против 21 исходника, чтобы не реализовать повторно UserModel/IK/MemoryOS2/llama.cpp/skills.
- P1: сделать воспроизводимый comparative harness для MemoryOS2 vs Mem0/Letta/Chroma/FAISS (одинаковые документы, запросы, RU/EN, source clusters, latency/memory).
- P1: проверить Hexis belief revision/identity/heartbeat и перенести только недостающие контракты, сохраняя единую память NK1.
- P1: сравнить tool/skill/session lifecycle Hermes/OpenClaw/Agents SDK с ActionGateway и runtime recovery.
- P2: исследовать Hyperon/MeTTa как изолированный symbolic-reasoning experiment.
- P2: применить DSPy только к офлайн экспериментам и frozen holdout, без runtime self-modification.
- P2: проверить avatar/voice patterns Lumina и соответствие существующим 2D/3D semantic embodiment channels.

## 7. Честная оценка прогресса этой итерации

| Направление | Прогресс | Что именно подтверждено |
|---|---:|---|
| Обнаружение контейнеров | 100% | 4/4 доступных 7z обнаружены и прочитаны |
| Инвентаризация вложенных ZIP | 100% | 22 ZIP, 21 уникальный проект, Letta duplicate обнаружен |
| Первичный license screen | 80% | Root LICENSE проверен у большинства; OWL root license missing; nested assets/dependencies не очищены |
| Архитектурная маршрутизация | 55% | Сформированы области применения и приоритеты; точные source file-level diff ещё нужны |
| Проверка выбранных NK1 адаптеров | 100% статически для 5 линий | Hexis, Letta governance, Mem0, Lumina и Will сопоставлены с реализацией, composition/persistence и тестовыми контрактами; тесты этой итерации ещё не запускались |
| Прямой перенос upstream-кода в этой итерации | 0% | В текущем проходе добавлен NK1-native аудит интеграций; wholesale-код доноров не копировался |
| Выполнение новых проверок | 0% на момент записи | Проверки и новый audit test зарегистрированы в общем audit; результат CI нужно подтвердить по SHA нового commit |

**Сводный прогресс именно этой итерации: 42%** (инвентаризация и первичная маршрутизация, не интеграционная готовность). Общую готовность NK1 этим числом не заменять.

## 8. Ограничения и запрос недостающего артефакта

В среде были доступны `one.7z`, `two.7z`, `three.7z`, `four.7z`; вложенные ZIP удалось индексировать через libarchive. Путь `/mnt/data/Neuro_Kurisu_WORKPASS70_2026-10-19.zip` не существует в текущей сессии, хотя upload metadata ранее указывала это имя. Для полной интеграции нужен повторно прикреплённый актуальный NK1 source ZIP (лучше текущий release/workpass archive) или доступ к полному source tree. Без него нельзя безопасно редактировать существующие файлы, устанавливать зависимости и запускать полный набор тестов.

## 9. Change log

- 2026-11-13: обнаружены четыре контейнера; проиндексированы 22 ZIP; выявлен дубль Letta; рассчитаны SHA-256 контейнеров; просмотрены README/manifests отдельных источников; выполнен root license screen; проверены NK1 README/package scripts и merge #862; создан отдельный исследовательский branch для дальнейшего source mapping.
- Не сделано: импорт кода, установка runtime dependencies, изменения когнитивного runtime, запуск NK1 test suite, merge или публикация Release ZIP.


## 10. Дополнительная проверка Git-графа (2026-11-13)

Сравнение `workpass70-source` с merge commit `9a789ee1af8fdaa3826dbc734d18e2fc00cde5bf` завершилось GitHub API ответом `No common ancestor`. Следовательно, найденный merge #862 нельзя считать доказанно включённым в каноническую `workpass70-source` ветку; это отдельная линия истории/база. Перед переносом UserModel v2, skeletal kinematics и UnifiedBrainSystem изменений требуется определить корректную родительскую ветку PR #862, проверить полный diff и выполнить трёхстороннее сопоставление с текущим `workpass70-source`. Не cherry-pick вслепую: вероятны пересечения с уже существующими motor/IK/UserModel контрактами.

Также `get_commit_combined_status` для исходного commit `6202661ad1dcfa37d314765b45e6d63852053e2d` вернул пустой список statuses. Это не эквивалентно CI success. Поэтому интеграция #862 остаётся `OBSERVED_ON_OTHER_LINE / NOT_RECONCILED`, а не `VERIFIED_IN_CANONICAL_SOURCE`.


## 11. Дополнительный file-level разбор выбранных исходников

После первичной инвентаризации прочитаны отдельные архитектурные документы из вложенных ZIP:

### Hexis — что действительно стоит сопоставить
- Memory architecture описывает пять слоёв: working, episodic, semantic, procedural, strategic; отношения TEMPORAL_NEXT / CAUSES / CONTRADICTS / SUPPORTS; precomputed associative neighborhoods; lexical fallback; confidence revision с audit trail и защитой от double-counting источников.
- Heartbeat описывает Observe → Orient → Decide → Act → Record → Wait, state-driven cadence, energy budget, receipt-backed outcomes и stateless worker, который восстанавливается после падения.
- Это не повод внедрять Postgres/Apache AGE поверх NK1: наиболее полезны контракты и инварианты. Проверить, что эквиваленты есть в NK1: typed memory-kind projection; causal/temporal edge semantics; belief revision audit; energy/attention budget; receipt-based outcome accounting; crash-safe resume. Если эквивалент уже есть, нужен differential test, а не второй модуль.

### Lumina — полезная инженерная гипотеза
README позиционирует local-first assistant с hardware-bounded inference, backend abstraction, multi-tier memory/dreaming, local TTS/voice, swappable personas и explicit remote access. Для NK1 это полезно как checklist: offline boot, low-VRAM profiles, provider fallback, memory pressure, voice pipeline degradation. Не переносить целиком 13k-line Python application в TypeScript runtime; сначала сравнить с существующим llama.cpp routing, speech stack и mobile budgets.

### OWL / CAMEL — корректная трактовка
README указывает multi-agent task automation и paper arXiv:2505.23885, но отсутствие root LICENSE в архиве означает license clearance pending, несмотря на badge в README. Допустимо изучать опубликованные идеи/бумагу и ссылаться на неё; копирование исходного кода/ресурсов заблокировано до определения применимой лицензии и условий всех вложенных пакетов.

### Что дополнительно извлечь из оставшихся исходников
- Hermes: agent loop, memory-provider plugin, state DB recovery, subagent lifecycle — точные документы уже найдены в архиве, следующий шаг: сопоставить с NK1 ActionGateway, memory owner и recovery receipts.
- OpenClaw: `docs/agent-runtime-architecture.md` и gateway/channel lifecycle — следующий шаг: diff с OrganismBus и существующим transport layer; не импортировать плагины пачкой.
- Will: исходник содержит отдельные концептуальные документы по attention budget, faculty channels, identity guardrails, action-conditioned prediction, agency pipeline и awareness scoping. Это набор исследовательских гипотез; для каждого механизма нужен операциональный тест и falsifiable outcome.
- OpenAI Agents Python: сравнить run-item lifecycle, session ownership, handoffs, tool output schemas и tracing с текущим NK1 cognitive cycle и ActionGateway.

### Вывод после углубления
Наиболее перспективная ассимиляция сейчас — не новая LLM-обвязка и не замена памяти, а усиление **непрерывности личности и проверяемого автономного цикла**: belief/evidence lineage + memory lifecycle + goal/energy cadence + crash recovery + causal outcome receipts. Это должно быть оформлено как единая система поверх уже существующих NK1 владельцев состояния. Прямое внедрение дополнительных баз, агентных framework или параллельных heartbeat loops увеличит фрагментацию и противоречит цели проекта.


## 12. Повторная runtime-сверка и автоматическая карта адаптеров

Проверка дерева `workpass70-source` на SHA `189643ede8f3904dd670f0109a28b7536e894c00` показала, что несколько донорских направлений уже представлены в NK1-native адаптерах. Это **не означает**, что исходные проекты целиком импортированы или что файлы адаптеров являются копией upstream-кода: для доказательства происхождения нужен отдельный file-level diff с точными revision/NOTICE каждого донора.

| Линия | Фактически найдено в NK1 | Связи и владельцы | Польза / статус |
|---|---|---|---|
| Hexis | `HexisAdaptationFabric`, `HexisCanonicalEvidenceBridge` | `OrganismSystemFabric` создаёт адаптер и сохраняет/восстанавливает его; `MemorySubsystemRuntime` создаёт provenance bridge над `MemoryFabric`, `SourceMonitor` и `P65EpistemicLedger`; `OrganismCore.hexisIngestEvidenceLineage` проверяет source, fingerprint и provenance перед вызовом bridge | Фактическая связка belief revision + evidence lineage + temporal/review. MemoryOS2/MemoryFabric остаются единственным каноническим владельцем памяти. Есть два специализированных integration test |
| Letta | `LettaGovernanceAdaptationFabric` | Включён в `OrganismSystemFabric`, snapshot/restore; persisted state типизирован в `OrganismCore` | **Только governance/reference adapter** (source boundary, telemetry, artifact review); сам Letta runtime и его память не импортированы. Это не полная интеграция Letta |
| Mem0 | `Mem0PlatformAdapter` | В `OrganismRuntime`: отдельный флаг `mem0CognitiveRecall === true`, выключено без opt-in, поиск ограничен 3 кандидатами, внешняя ошибка не должна блокировать local-first response | Внешний recall как недоверенный контекст, а не второй memory owner. Есть runtime wiring, Platform и OSS contract tests |
| Lumina | `LuminaAdaptationFabric` | Composition root + snapshot/restore; типизированное persisted state | Capability policy, подтверждение опасного действия, target validation, exact search и idempotency. Наличие адаптера не доказывает перенос avatar/voice assets или всего Lumina UI |
| Will | `WillIntegrationBridge` | Composition root + snapshot/restore; типизированное persisted state | Deterministic candidate ranking, vector retrieval, transport/replay, hash chain и attribution. Тесты отдельно блокируют повышение competence от неподтверждённого успеха |
| Conscio | `ConscioAdaptationFabric` | Есть в текущем NK1 composition root | Не найден среди 21 присланного архива; поэтому учитывать как отдельную существующую линию, а не приписывать одному из этих доноров |

### Добавленный инструмент контроля

В ветку добавлены:
- `runtime/neuro-kurisu/scripts/audit-source-assimilation.mjs` — статически проверяет 5 адаптерных линий, composition root, persistence/restore, provenance/canonical boundary, наличие контрактных тестов и полноту 21-источникового реестра с лицензионными стоп-факторами.
- `runtime/neuro-kurisu/tests/source-assimilation-audit.mjs` — тестирует как успешный fixture, так и искусственный разрыв wiring и отсутствующую запись источника.
- Команды `audit:source-assimilation` и `test:source-assimilation-audit` добавлены в package scripts и включены в `scripts/audit-all.mjs`.

Этот audit — статический контроль связей и наличия тестовых файлов. Он **не запускает** integration tests, не подтверждает upstream provenance, не заменяет license review и не сертифицирует release. Отдельная важная классификация: Letta остаётся governance-reference adapter; Mem0 — opt-in external recall; Hexis provenance bridge — отдельный путь происхождения evidence, а не новый memory store.

### Текущий прогресс (только ветка ассимиляции, не общая готовность NK1)

| Этап | Прогресс | Подтверждение / остаток |
|---|---:|---|
| Контейнеры исходников | 100% | 4/4 архива прочитаны; 22 вложенных ZIP, 21 уникальный источник |
| Реестр и первичный license screen | 80% | 21 источник учтён; остаются nested licenses, model weights, assets и NOTICE для каждого кандидата |
| Статическая карта существующих адаптеров | 100% для 5 линий | Проверены implementation/composition/persistence/test seams; это source inspection, не runtime execution |
| Source-to-source diff и происхождение файлов | 25% | Нужны точные upstream revisions, файл-к-файлу сравнение и attribution |
| Перенос новых upstream-механизмов в runtime в этой итерации | 5% | Один узкий Hexis-derived policy slice реализован NK1-native в отдельном Draft PR #864; точный head получил успешный typecheck и три исходных focused tests, дополнительная gateway regression выявила baseline-кандидат на дефект и проходит сравнительную проверку; merge/release нет |
| Исполнение новых тестов и benchmark | 0% до подтверждения CI | Наличие файлов/команд не считается успехом; нужен результат Actions именно нового head SHA |
| Сверка с Release ZIP и публикация | 0% | Релизный ZIP не смонтирован; release checksum и содержимое не сопоставлены |

Не вычислять из этих строк процент готовности цифровой личности: это отдельная метрика и потребует воспроизводимой функциональной оценки, реальных phone soak и независимых holdout-наборов.

### Следующие проходы

1. Запустить новый static audit, его fixture test и восемь уже существующих focused integration tests; получить результаты Actions на точном SHA и исправить найденные несоответствия.
2. Сделать source-to-source diff Hexis/Mem0/Will/Lumina/Letta: pinned upstream commit, лицензии, NOTICE, отличия контрактов и перечень адаптированных функций. Подтвердить, что существующий код заимствует именно идеи/контракты, а не ошибочно атрибутирован.
3. Следующий runtime-кандидат выбирать по воспроизводимому выигрышу: Hermes/OpenAI Agents для tool/session/trace lifecycle; PocketFlow для bounded DAG; FAISS/Chroma для vector retrieval; DSPy для offline-only optimization с frozen holdout; llama.cpp — для измерения существующего local route. Hyperon и Agent0 оставить экспериментами до sandbox и baseline.
4. Для каждого кандидата выполнить isolated reproduction → 5 paired seeds (для стохастики) → latency/recall/resource comparison → ablation → только потом подключение через OrganismBus/ActionGateway/MemoryOS2.
5. Отдельно reconciliate `workpass70-source`, `main` и Release ZIP: между `workpass70-source` и merge #862 ранее обнаружен `No common ancestor`; не переносить изменения между ними вслепую.


## 12.1 Runtime assimilation slice — Hexis action consequence policy (2026-11-13)

### Донорский механизм и отличие от NK1

Проверены непосредственно распакованные документы Hexis:
- `docs/reference/energy-model.md`
- `docs/concepts/heartbeat-system.md`

В доноре ситуационная цена действия намеренно отделена от compute cost, API pricing и системных ресурсов. Базовые измерения: необратимость, социальная экспозиция, обязательство, требуемое внимание пользователя и влияние на идентичность. Документ также задаёт разные intent classes и более строгие правила для фоновой heartbeat-автономии: read/search дешевле; локальные draft/create допускаются дороже; update — контекстно; private/public send и delete/destroy не разрешаются по умолчанию. Стоимость контролируется системой, а не переписывается моделью.

NK1 уже имеет собственные автономные циклы, homeostasis/interoception, cognitive resource budget и ActionCostPolicy. Поэтому полный Hexis heartbeat или вторую систему памяти не переносили. Добавлен отдельный NK1-native pre-selection policy, не копирующий донорский runtime/SQL:

- `ActionConsequenceCostPolicy.ts` — классификатор read-only / mutation / social / destructive / unknown; пять независимых consequence dimensions и фиксированные профили.
- `AutonomousResourceToolLifeController.plan()` — фильтрует фоновые возможности до явного read-only allowlist. Unknown/mutation/social/destructive fail closed. Это намеренно консервативнее Hexis: локальные draft/write пока не допускаются, пока отдельный ActionGateway approval/idempotency/rollback path не будет проверен.
- consequence cost возвращается отдельно от старого hardware/resource `cost01`; model-supplied cost не принимается.
- `AutonomousResourceToolLifeState` хранит счётчик блокировок, последний класс/цену и receipt-level recomputed assessment; legacy snapshots получают defaults.
- `ActionGateway` остаётся единственным исполнителем, approval authority, idempotency ledger и outcome verifier.

Веса профилей (0.28/0.24/0.18/0.14/0.16) и численные уровни — **наши начальные эвристики**, а не цифры из Hexis и не результат научной калибровки. Они требуют реальных NK1 action logs, независимой оценки рисков и review пользователем.

### Код, тесты и статус

Отдельный Draft PR: [#864 — Hexis-derived action consequence gate](https://github.com/ailtron1ss-rgb/NK1/pull/864). Ветка: `aspect/hexis-consequence-cost-policy-20261113`.

Exact-head GitHub Actions run `43389637471` на `d3e29cc0ee2b912e3dc3ecd2b6f6165d86e70179` завершился SUCCESS: locked dependency installation, Node 24, полный runtime typecheck, policy regression, BIG_PASS_223 autonomy/resource lifecycle + persistence и ActionCostPolicy unification.

При расширении проверки был добавлен ActionGateway idempotency suite. Он показал 12/13 PASS, один известный fail: `the exact pending decision must receive grounded reafference` (тест `action-gateway-idempotency-workpass37.mjs:182`). Это сравнили на чистой базе, а не стали автоматически приписывать новой интеграции:
- feature head `83d712b38c7e90a7292c10dfcc71550556adc2bf`: 12/13, тот же fail;
- чистый baseline `workpass70-source` @ `1a0315595302f3154df0ae53e5d9188875311467`: тот же 12/13 и тот же assert, run `43390523344`.

Вывод: проблема существовала до Hexis policy; она заведена отдельно как [NK1 issue #865](https://github.com/ailtron1ss-rgb/NK1/issues/865). Это не закрывает дефект, но отделяет его от текущего изменения. ActionGateway approval/redaction boundary прошёл на baseline run `43390659519` и feature head run `43390671129`. В feature CI idempotency test изолирован от этого policy workflow, а approval regression остаётся в нём.

После этого workflow обновлён ещё раз; текущий head PR #864 — `72ab4bc76d6fc45fe3888fe74223ecdf127e12a9`, его exact-head Actions run нужно считать финальным для данного среза. PR остаётся Draft, merge/release не делались.

### Текущие границы и следующий проход

1. Отдельно исправить #865: трассировать точный decisionId через `OrganismCore.observe()` → `ActionGateway` → verified postcondition → external observer → temporal credit; сохранить atomic persistence и no-duplicate replay.
2. После прохождения latest exact-head feature CI инспектировать runtime tool registry по каждому id/capability: сверить read-only names, найти реальные draft/shadow операции, которые могут получить отдельный средний consequence tier только при rollback/idempotency guard.
3. Следующим Hexis pass оценить first-use uncertainty, повторные действия, tool reliability и outcome-backed cost adjustment; использовать только receipt/independent evidence и запретить модели менять hard floors.
4. Для каждого следующего донора выполнять isolated reproduction → paired seeds/latency/recall/resource measurements → ablation → adaptation через OrganismBus/ActionGateway/MemoryOS2.
5. Перед merge: latest base compare, review, full relevant regressions; публикация Release ZIP — отдельный процесс.

## 13. Change log — продолжение (2026-11-13)

- Повторно подтверждено runtime wiring Hexis: system composition, canonical provenance bridge, core ingress checks и dedicated tests.
- Уточнён статус Letta: governance-only reference adapter, не Letta runtime.
- Подтверждены границы Mem0 opt-in/3-result/local-first и системная композиция Lumina/Will.
- Добавлены source assimilation static audit, fixture test, npm scripts и включение в `audit-all`.
- Прямой код из 21 архива в этой подитерации не копировался; новые runtime dependencies не добавлялись.
- Открытый PR #863 остаётся Draft/Ready согласно текущему состоянию GitHub; merge и релиз не выполнялись.


## 14. Повторная проверка фактических артефактов и PR (2026-11-13, продолжение)

### Контейнеры и release boundary

Повторный локальный SHA-256 проход четырёх смонтированных пользовательских контейнеров совпал с ранее сохранённым provenance manifest:

| Контейнер | SHA-256 | Проверка |
|---|---|---|
| one.7z | `2aa144432afd7a234b4aa3139cfa6019a97bab453dd235f623ccac2c00b83b41` | MATCH |
| two.7z | `f6bce0f421c727c98c978328efe0dcb2bfa93ef77f8a7fcc1686c24b24958366` | MATCH |
| three.7z | `598c8e11e176994214d2cdfcf9ec0bfe4b65e19e10e54c0190e4f5b859293f97` | MATCH |
| four.7z | `e15b12e9617882026ab8077f7698c6a6c47df5f1e4690607d3dbcac2df4952a0` | MATCH |

22 embedded ZIP artifacts resolve to 21 unique project snapshots; the Letta artifact is an exact duplicate. The four outer archive bytes were rehashed locally. The user-described `Neuro_Kurisu_WORKPASS70_2026-10-19.zip` is still not mounted in this session, so its internal file list, source parity and package contents remain UNKNOWN. Release metadata/checksum is not a substitute for unpacking and inspecting the asset.

### Live source advancement and actual code change

- `workpass70-source` was advanced by merged PR [#838](https://github.com/ailtron1ss-rgb/NK1/pull/838) to `1a0315595302f3154df0ae53e5d9188875311467`.
- The change reduces peak allocations in remote VRM/GLB ingestion by retaining bounded Blob chunks rather than materializing a second full-size byte array. It preserves URL/size/time/abort checks and adds chunk-order, offset-view and SharedArrayBuffer regressions.
- Exact PR-head Actions: 5/5 successful before squash merge. Device RSS and browser/WebGL soak were not measured.
- This is an NK1 implementation improvement, **not a code import from the 21 donor archives**. Donor-source production code copied in this pass: 0. No runtime dependencies were installed.

### HMX: distinguish existing staging from canonical apply

Current source inspection of `HexisAdaptationFabric.ts` confirms `stageHmx()` and `decideHmx(..., 'accept'|'reject')`, with version-prefix/section checks, bounded staged arrays and digest. The live composition does not currently expose a proven canonical HMX 1.7 apply projector into `MemoryFabric/MemoryOS2`. `HexisCanonicalEvidenceBridge` is a separate one-way provenance bridge from `SourceMonitor/P65EpistemicLedger` into an existing canonical memory item; it is not the HMX section importer.

Historical open PRs #221, #232, #233, #235, #239, #247, #248, #284 and #285 contain candidate apply/projector/replay/rollback work, but they have historical base branches and/or multi-commit unrelated changes. Their presence or a connector `mergeable` flag is not proof that they were merged or are safe to merge onto the current HEAD. Do not merge them wholesale. The right next action is a small, current-base design and source-to-current-owner comparison, followed by behavior tests; obtain approval for the architecture before implementing a new HMX behavior.

### Audit-tool evidence semantics

The new `audit-source-assimilation.mjs` in PR #863 is deliberately a **static string/presence audit**. It checks configured text needles in selected files and checks that test files contain configured text. Its self-test generates fixture files from those same needles. Therefore:
- `WIRED_STATICALLY` means only that configured text patterns were found.
- It does not prove TypeScript import reachability, dynamic construction, runtime call flow, test execution, upstream code provenance or measured behavior.
- Synthetic fixture PASS is a test of scanner logic, not validation of the live runtime integration.
- It must never be used as a donor-integration percentage or as evidence that donor code is fully adapted.

Recommended evidence ladder for future reports: `DISCOVERED` → `ADAPTED_IN_CODE` → `CONNECTED_AT_RUNTIME` → `BEHAVIOR_TESTED` → `EXACT_HEAD_CI_VERIFIED` → `RELEASED_AND_PARITY_CHECKED`. Every status must link to its own artifact/test/run and must not be inferred from the previous level.

### PR #863 verification on its exact current head

For the code-bearing PR head inspected before the documentation-only checkpoint commit (`16a6bdb1c8b8b94be7678cdbead3e3afa12cf3dc`), the returned Actions page contained 42 runs: 39 SUCCESS, 1 FAILURE and 2 CANCELLED. The later commit `fb67464cce69c3e84f8290838664037782d7276a` only updates this research register; no new exact-head Actions evidence was returned for that documentation commit. The failed job reached the “Run cognitive evidence Inspect task without external model calls” step; the memory task, route-contract check and runtime typecheck were skipped after failure. The available job summary does not expose the exception text, so no more specific root cause is asserted here. The PR remains Draft; no merge or release is claimed. PR #863 should not be merged as a green integration gate on this evidence.

### Progress recalculation — archive assimilation stream only

| Stage | Progress | Evidence and exact limitation |
|---|---:|---|
| Outer archive provenance | 100% (4/4) | Four locally computed SHA-256 values match the stored manifest |
| Embedded archive inventory | 100% (22/22 artifacts) | 21 unique projects; one exact duplicate |
| Initial source/owner/license triage | 100% (21/21) | Preliminary only; not legal clearance or full per-path SBOM |
| Deep mechanism/code comparison | 29% (6/21) | Detailed pass on Hexis, Will, Mem0, Agent0, DSPy and PocketFlow; all other sources need focused code-level inspection |
| Existing NK1 donor-inspired adapters | 5 major lines statically mapped | Hexis, Letta, Lumina, Will, Mem0; static presence must not be represented as full upstream import |
| New donor production code imported in this pass | 0% | Deliberate: no third-party license/contract-approved code selected for promotion yet |
| NK1 code improvement | 1 merged change | PR #838; exact PR-head checks passed 5/5; target-device performance remains unmeasured |
| HMX v1.7 canonical import | Partial / not release-ready | Current staging and evidence bridge exist; complete canonical import/apply/recovery remains unverified |
| Release ZIP parity | UNKNOWN | ZIP bytes not available in the mounted runtime |

These are separate workstream measures, not a weighted global “digital-person readiness” score. No increase to project consciousness/autonomy or release-readiness percentages is justified by this pass.

### Next execution order

1. Resolve HMX architecture and review the smallest compatible subset of historical projector work; do not introduce a second memory store or automatically overwrite identity/goals/worldview.
2. Extend assimilation audit from static needles to real module import graph/call-edge checks and selected process-level behavior probes; label it as static/dynamic/e2e separately.
3. Complete deep donor reviews for the remaining 15 unique sources, including path-level license, notices, assets, model weights, dependency graph and exact revision.
4. Evaluate DSPy/GEPA and Agent0 only as isolated offline candidate-optimization/evaluation harnesses against frozen task sets and independent holdouts; never allow direct production-policy promotion.
5. Measure Mem0 opt-in request behavior, Will channel effectiveness, Hexis correction/forgetting outcomes, and local llama.cpp inference on target hardware.
6. Acquire the exact Release ZIP bytes, unpack, compare file hashes and generate an exact-source parity report before any release claim.



## 15. Дополнительный source-to-owner проход — оставшиеся механизмы (2026-11-13)

Второй технический проход расширил targeted code review с 6 до **15 из 21** уникального донора. Это число означает чтение выбранных ключевых файлов/контрактов и сопоставление с владельцами NK1; оно **не** означает исчерпывающее построчное ревью каждого проекта, всех зависимостей или разрешение на копирование.

| Донор | Проверенный механизм | Сопоставление с NK1 | Решение |
|---|---|---|---|
| Microsoft Agent Framework | `WorkflowCheckpoint`: graph-signature hash, versioned checkpoint, predecessor lineage, committed state и pending request events; storage protocol отдельно от runtime | `FileStateStore` уже даёт temp-file → fsync → rename, backup recovery; `CognitiveEventFabric` и planner/ActionGateway держат causal events и in-flight receipts. В NK1 можно точечно сравнить совместимость checkpoint с изменившимся cognitive-plan graph | ADAPT/REFERENCE: только проверку checkpoint compatibility, если тест выявит реальный unsafe-resume путь; не переносить MAF workflow runtime |
| OpenAI Agents SDK | `_await_mutation` ждёт завершения async persistence side effect даже при repeated cancellation, затем повторно выбрасывает cancellation; используется в SQLite/conversation mutations | FileStateStore NK1 синхронно сохраняет атомарно, а ActionGateway записывает keyed pending receipt/reconcile для внешних операций. Дополнительная защита нужна только на реальном async mutation boundary, где отмена может оставить неизвестный исход | REFERENCE: не добавлять обобщённый cancellation wrapper без воспроизводимого failure-теста |
| AutoGen | Typed message envelope: message ID, sender, recipient, cancellation token, metadata; single-thread runtime and queue lifecycle | NK1 уже имеет CognitiveEventFabric и ActionGateway с execution IDs, receipts, idempotency и source/evidence chain. AutoGen runtime использует обычную unbounded asyncio queue; это не подходящее основание для нового event bus. Сам AutoGen помечен в собственном README как maintenance mode с рекомендацией MAF для новых проектов | REFERENCE ONLY; не переносить runtime |
| Hermes Agent | Background curator: snapshots до/после, diff/classification, skill merge/prune, backup, write-origin provenance, pinned/read-before-write guards, idle scheduling | NK1 уже содержит `ProceduralSkillLibrary`, `VersionedSkillCandidateStore`, `P23CompoundRepairRevisionCoordinator`, `IndependentSkillCandidateEvaluator` и `HermesVerifiedEvidenceBinding`. Candidate revision связана с dataset/plan/payload fingerprints и независимыми signed run receipts; promotion остаётся отдельным gate | CONCEPTS ALREADY ADAPTED. Сохранять P23 как одного владельца; не добавлять второй curator/skill store |
| OpenClaw | Session store пересматривает exact current owner/row после async operation, не должен воскрешать удалённую session; gateway/plugin/channel ownership и run leases | NK1 ActionGateway имеет durable idempotency ledger/reconciliation, CognitiveEventFabric хранит связанный causal trace, N.E.K.O. gateway разделяет plugin ingress/runtime ownership | REFERENCE: перенести только конкретную race regression при наличии совпадающего NK1 defect |
| Langroid | Typed `ToolMessage`, class-declared handler routing, recipient validation и task/subtask routing; защита от LLM-controlled handler override | NK1 ActionGateway использует declarative tool input contracts, permissions, idempotency и explicit approval; plugin gateway имеет ownership/manifest policy | REFERENCE ONLY; общий tool routing в NK1 уже покрыт действующими владельцами |
| Chroma | Collection API для query/get/upsert/update/delete, metadata filters и collection-level embeddings contract | NK1 MemoryOS2/MemoryFabric, native vector semantic retrieval, HNSW integration и retrieval lineage уже существуют | DO NOT ADD AS SECOND VECTOR STORE; использовать только как внешний benchmark/compatibility reference |
| FAISS | Native C++ index contract: add/add-with-IDs/search/range-search/remove/merge; flat/IVF variants | NK1 использует native TypeScript-side vector/HNSW substrate и integrity tests. FAISS добавит C++ build/ABI/Android packaging и отдельный index owner | RESEARCH/BENCHMARK ONLY; не добавлять C++ dependency без измеренного выигрышного результата |
| Hyperon | MeTTa runner сохраняет parser/runtime state и выполняет expression steps в grounded space; symbolic layer separate from LLM | В NK1 есть cognitive contracts, symbolic/causal evidence и typed planning. MeTTa может дать дополнительную гипотезу для constraints/relations, но требует отдельного runtime и безопасной resource sandbox | RESEARCH ONLY; не подключать к production cycle сейчас |

### Уточнение про self-improvement и агентность

Сопоставление Hermes/Agent0/DSPy с текущим NK1 показывает, что значительная часть идей уже есть в P23:
- версии кандидатов и атомарное изменение активного навыка через expected revision/CAS;
- кандидат отделён от активной версии; есть supersede/rollback;
- independent evaluator исполняет точный fingerprinted payload в изолированном executor;
- validation и holdout имеют раздельные планы/манифесты, отдельные authorities и leakage guards;
- подписанный shadow receipt подтверждает identity/outcome/run binding, но не подменяет независимую оценку качества;
- reflective revision проходит через P23 coordinator и explicit promotion gate.

Это сильнее простого «агент сам переписал себе навык». Узкое место — не отсутствие ещё одного self-improving agent framework, а полное эксплуатационное доказательство изоляции evaluator authority, реального holdout uplift, повторяемости и длительного runtime/device soak. Не повышать readiness только по наличию этих модулей.

### Пересчитанная карта прохождения

| Измерение | Сейчас | Как читать |
|---|---:|---|
| Archive inventory/provenance | 100% (4/4 контейнера, 22/22 ZIP) | Хеши совпали, один дубликат Letta |
| Первичная маршрутизация доноров | 100% (21/21) | Все известны и отнесены к capability/owner; license screen предварительный |
| Targeted source-code review | 71% (15/21) | Выбранные ключевые модули/контракты прочитаны; оставшиеся 6 требуют такого же targeted pass |
| Existing NK1 owner comparison | 100% для рассмотренных 15 | Это сравнение границ/механизмов, не тестовое доказательство |
| Runtime integration tests newly executed in this pass | 0% | GitHub exact-head evidence для PR #863 имеет failure/cancellations; локальный NK1 runtime test suite не запускался |
| New donor runtime code promoted in this pass | 0% | Осознанный выбор: обнаружены повторения существующих владельцев или не закрыты требования лицензии/измерения |
| NK1 code change integrated in this pass | 1 PR | #838 merged; exact PR-head checks 5/5; mobile/WebGL soak pending |
| Release artifact parity | UNKNOWN | ZIP bytes отсутствуют в локальной среде |

Следующие шесть источников для targeted pass: AutoGPT, Letta snapshot, llama.cpp server, Lumina, CAMEL OWL и Superpowers. Для них первыми проверить path-level license/NOTICE, зрелость и конкретные missing seams. Не считать наличие архива доказательством необходимости runtime import.



## 16. Последние шесть доноров: первичный code/license triage (2026-11-13)

| Донор | Факт из извлечённого архива | Решение для NK1 |
|---|---|---|
| AutoGPT | Корневой LICENSE прямо разделяет репозиторий: `autogpt_platform/**` — Polyform Shield 1.0.0, остальная часть — MIT. Поддерево platform нельзя переносить как будто весь репозиторий MIT | Не импортировать Platform. Classic MIT-код всё равно сравнить с NK1 только по конкретной отсутствующей функции; сейчас второй автономный runtime не нужен |
| Letta | Архив содержит Apache-2.0 README/docs snapshot, который указывает, что актуальный harness/runtime находится в отдельном `letta-ai/letta-code`; данный архив не является полным кодовым снимком текущего Agent Runtime | Reference only для memory-block governance/agent state; не делать вывод, что Letta runtime уже импортирован |
| llama.cpp | MIT C/C++ runtime; server описывает JSON-schema-constrained output, grammar, slots, parallel request capacity, continuous batching, KV-slot save/restore и metrics | Высокоприоритетная проверка уже существующего NK1 local route: сначала подтвердить реальный process/endpoint/config на target device, затем сравнить constrained output и slot telemetry. Не встраивать C++ как новую runtime dependency до измерения |
| Lumina | Apache-2.0 local-first Python harness, core modules включают dreaming, skills, idempotency, persistence и backend switching | Сильный conceptual donor, но NK1 уже имеет Lumina adaptation fabric плюс собственные MemoryOS2/skill lifecycle/local-backend policy. Полный Python harness создал бы второй lifecycle и memory owner |
| CAMEL OWL | В архиве найден вложенный `licenses/LICENSE`, но отдельный корневой LICENSE не обнаружен на уровне проекта; пакетный/asset/license scope требует раздельной проверки | Research-only для task decomposition. Никакой code/assets import до path-level license and dependency/NOTICE audit |
| Superpowers | MIT agent-development methodology, composable skills и workflow instructions | Полезен для разработки NK1, но не является runtime когнитивным механизмом. Не копировать весь dev harness в продукт; использовать только совместимые engineering workflow ideas |

### Итоговое покрытие всех доноров

- 21/21: source inventory, owner/capability routing и initial license stop-screen completed.
- 15/21: targeted key-file/code review completed.
- 6/21: preliminary code/README/license triage completed; exhaustive targeted pass remains.
- 0/21: new donor production runtime code promoted in this pass.
- 1 NK1 code change merged: PR #838, independent of the 21 donor imports.

**Следующий лучший технический кандидат:** не добавлять новый framework, а провести runtime proof of the existing `llama.cpp` path (process detection, configured URL, health/slot telemetry, JSON-schema output contract, cancellation/timeout, CPU/RAM/token latency on the intended device). После подтверждения endpoint можно встроить только недостающие server capabilities через существующий provider boundary. Параллельный HMX candidate требует отдельного архитектурного approval и не должен одновременно менять memory ownership.



## 17. Nested license/NOTICE file inventory (2026-11-13)

Повторный проход по извлечённым каталогам считает пути, чьи имена начинаются с `LICENSE`, `LICENCE`, `NOTICE` или `COPYING`. Это **инвентаризация файлов**, а не чтение/разрешение каждого лицензионного текста и не SBOM.

**Результат:** 172 license/notice-пути в 22 распакованных корнях; 21 уникальный источник; два root-каталога относятся к повторному Letta archive.

| Source | Найдено файлов |
|---|---:|
| Agent0 | 4 |
| AutoGPT | 11 |
| Microsoft Agent Framework | 45 |
| AutoGen | 14 |
| Chroma | 3 |
| DSPy | 2 |
| FAISS | 1 |
| Hermes Agent | 23 |
| Hyperon / MeTTa | 1 |
| Langroid | 1 |
| LeTTA | 2 (1 + duplicate snapshot) |
| llama.cpp | 11 |
| Mem0 | 26 |
| OpenAI Agents SDK | 1 |
| OpenClaw | 18 |
| Hexis | 1 |
| PocketFlow | 1 |
| Lumina | 1 |
| CAMEL OWL | 3 |
| Superpowers | 1 |
| Will | 2 |
| **Итого** | **172** |

Высокая плотность nested license files у Microsoft Agent Framework, AutoGen, Hermes, Mem0, OpenClaw, llama.cpp и AutoGPT означает, что нельзя копировать весь репозиторий под одним root license. Следующий legal/code pass должен связывать каждый выбранный файл с его package/subtree license и NOTICE, включая frontend/vendor/skills/assets. Для AutoGPT Platform сохраняется Polyform Shield stop; для OWL root-level license remains unresolved; для AutoGen требуется attribution; для моделей/весов/voice/avatar assets нужны отдельные terms. Пока не выполнен path-level mapping, из этих деревьев переносить исполняемый код нельзя.

Эта инвентаризация не меняет ранжирование кандидатов и не утверждает, что 172 файла прочитаны вручную. Она уточняет объём дальнейшей проверки и снижает риск случайного копирования vendored/skill-кода.
