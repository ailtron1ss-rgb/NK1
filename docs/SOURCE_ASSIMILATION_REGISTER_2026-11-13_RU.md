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

Доступны 4 контейнера 7z: `one.7z`, `two.7z`, `three.7z`, `four.7z`. Внутри обнаружены 22 ZIP-вложений, из них 21 уникальный исходный проект (Letta присутствует дважды). По индексам ZIP — около 1.8 GB распакованного содержимого суммарно. SHA-256 контейнеров:

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
| Проверка существующих NK1 механизмов | 45% | README/package scripts и merge #862 изучены частично; полное дерево runtime не доступно |
| Реальное внедрение кода | 0% | Код внешних источников не переносился в этой итерации |
| Верификация на полном проекте | 0% | Полный release ZIP/source tree отсутствует в доступном runtime; CI результатов по #862 не получено |

**Сводный прогресс именно этой итерации: 42%** (инвентаризация и первичная маршрутизация, не интеграционная готовность). Общую готовность NK1 этим числом не заменять.

## 8. Ограничения и запрос недостающего артефакта

В среде были доступны `one.7z`, `two.7z`, `three.7z`, `four.7z`; вложенные ZIP удалось индексировать через libarchive. Путь `/mnt/data/Neuro_Kurisu_WORKPASS70_2026-10-19.zip` не существует в текущей сессии, хотя upload metadata ранее указывала это имя. Для полной интеграции нужен повторно прикреплённый актуальный NK1 source ZIP (лучше текущий release/workpass archive) или доступ к полному source tree. Без него нельзя безопасно редактировать существующие файлы, устанавливать зависимости и запускать полный набор тестов.

## 9. Change log

- 2026-11-13: обнаружены четыре контейнера; проиндексированы 22 ZIP; выявлен дубль Letta; рассчитаны SHA-256 контейнеров; просмотрены README/manifests отдельных источников; выполнен root license screen; проверены NK1 README/package scripts и merge #862; создан отдельный исследовательский branch для дальнейшего source mapping.
- Не сделано: импорт кода, установка runtime dependencies, изменения когнитивного runtime, запуск NK1 test suite, merge или публикация Release ZIP.
