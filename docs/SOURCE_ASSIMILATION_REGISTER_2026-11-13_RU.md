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


## 14. Runtime assimilation slice — Hexis action consequence policy (2026-11-13)

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

Первый exact-head Actions run `43389637471` на `d3e29cc0ee2b91262? ` (уточнить SHA в PR) показал SUCCESS: locked dependency installation, Node 24, full runtime typecheck, новый policy regression, BIG_PASS_223 autonomous resource/tool lifecycle + persistence, ActionCostPolicy unification. После добавления соседних ActionGateway idempotency/approval suites новый head `83d712b38c7e90a7292c10dfcc71550556adc2bf` показал 12/13 idempotency subtests PASS и один failure: exact pending decision не получил grounded reafference; approval step не стартовал из-за stop-on-failure. Сейчас выполняется отдельная baseline ветка от чистого `workpass70-source` SHA `1a0315595302f3154df0ae53e5d9188875311467`, чтобы установить, является ли это старой проблемой.

До baseline result feature нельзя считать полностью закрытым, а PR остаётся Draft. Успешный исходный test run не отменяет более позднюю обнаруженную проблему; status не маскируется как PASS.

### Текущие границы и следующий проход

1. Сравнить failing gateway test на baseline и feature head. При baseline PASS — локализовать влияние нового controller selection; при baseline FAIL — завести отдельный baseline defect record, но оставить gateway test в CI как известный blocker до решения.
2. Выполнить ActionGateway approval boundary test независимо и сохранить его результат.
3. Инспектировать фактический runtime tool registry по каждому id/capability. Уточнить, какие локальные операции являются drafts/shadow runs и могут безопасно получить отдельный средний-consequence класс без реальной мутации.
4. Оценить контекстные множители Hexis (first-use uncertainty, high error rate, repeated action, timing) и outcome-backed cost adjustment как следующий отдельный срез; не давать модели изменять hard floors.
5. После regression closure — rebase/compare base, human review и только затем merge; публикация в Release ZIP — отдельная проверка.

## 13. Change log — продолжение (2026-11-13)

- Повторно подтверждено runtime wiring Hexis: system composition, canonical provenance bridge, core ingress checks и dedicated tests.
- Уточнён статус Letta: governance-only reference adapter, не Letta runtime.
- Подтверждены границы Mem0 opt-in/3-result/local-first и системная композиция Lumina/Will.
- Добавлены source assimilation static audit, fixture test, npm scripts и включение в `audit-all`.
- Прямой код из 21 архива в этой подитерации не копировался; новые runtime dependencies не добавлялись.
- Открытый PR #863 остаётся Draft/Ready согласно текущему состоянию GitHub; merge и релиз не выполнялись.
