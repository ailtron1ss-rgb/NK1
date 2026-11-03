# NK1 — разбор исходных архивов и план селективной интеграции (2026-11-03)

## Итог инвентаризации

Проверены четыре пользовательских контейнера `one.7z`–`four.7z`: 22 вложенных ZIP-артефакта, 21 уникальный проект и один точный дубликат Letta. SHA-256 всех четырёх контейнеров и каждого вложенного ZIP зафиксированы в `contracts/UPSTREAM_SOURCE_ARCHIVE_REVIEW_2026-11-03.json`. Архивы остались пользовательскими исходными вложениями; байты стороннего кода в NK1 этой ревизией не копировались и зависимости не устанавливались.

Наличие SPDX/LICENCE/Licence-файла или лицензии в корне — только источник для предварительной классификации, не юридическое одобрение всего дерева. Необходимо проверять вложенные подкаталоги, модели, optional skills, notices и зависимости перед переносом или распространением.

## Архивы и их назначение

| Источник | Лицензия по архиву | Что стоит изучать для NK1 | Решение |
|---|---|---|---|
| Agent0 | Apache-2.0; вложенные training/verl требуют path-level review | propose → reason → verify → repair; adversarial curriculum/executor | Только принцип для SelfImprovementCandidatePool и независимой оценки |
| AutoGPT | MIT вне `autogpt_platform`; Polyform Shield внутри platform | декомпозиция задач, permission-aware execution | Не копировать platform; classic — только после path/dependency review |
| Microsoft Agent Framework | MIT | typed workflow, durable session/checkpoint, middleware | Сверять интерфейсы с ActionGateway/CognitiveEventFabric |
| AutoGen | CC BY 4.0 в корневом LICENSE | group-chat / multi-agent routing | Код не копировать до полного license review |
| Chroma | Apache-2.0 | vector collection/retrieval | Только read-only benchmark adapter к MemoryFabric |
| DSPy | MIT | program optimization, GEPA, trajectory evaluation | Изолированный evaluator; независимый holdout обязателен |
| FAISS | MIT | ANN index / retrieval latency | Benchmark-only, не менять основной memory owner без измеримого выигрыша |
| Hermes Agent | MIT в корне; optional skills имеют собственные лицензии | memory-provider checkpoints, skill provenance, non-overlap scheduler, context isolation | Переносить отдельные инварианты после проверки конкретного пути |
| Hyperon | MIT | символьный слой MeTTa | Только sandboxed reasoning без action/write authority |
| Langroid | MIT | multi-agent task delegation | Только упрощённые паттерны, без второго orchestrator |
| Letta (2 ZIP) | Apache-2.0 в корневом LICENSE | persistent state / memory blocks | Обе копии побайтно одинаковы; 16 участников ZIP — снимок неполный |
| llama.cpp | MIT в корне; модели и backend-assets отдельно | local quantized inference | Адаптер/бенчмарк только на реальном устройстве |
| Mem0 | Apache-2.0; integrations/skills проверять отдельно | extraction/update/search/forget, temporal metadata | Кандидаты только через канонические MemoryOS2 lifecycle-команды |
| OpenAI Agents SDK | MIT | typed tools, guardrails, handoff, tracing | Адаптировать контракты к ActionGateway, не добавлять второй runtime |
| OpenClaw | MIT в корне; bundled assets проверять по путям | gateway/session recovery, plugin boundaries | Только точечные recovery/security invariants |
| Hexis | MIT | belief provenance/supersession, memory consolidation, heartbeat/energy | Новый снимок сравнить с Hexis от 2026-10-08; не создавать второй MemoryOS |
| PocketFlow | MIT | компактные graph-workflows | Изучать как упрощение существующего CognitiveEventFabric |
| Lumina | Apache-2.0 | temporal decay, replay/dream, staged toolmaker | SHA совпадает с ранее учтённым архивом; не дублировать |
| OWL | корневой LICENSE не найден | multi-agent patterns | Код заблокирован до проверки лицензии |
| Superpowers | MIT | TDD, короткие тестируемые задачи, review discipline | Методология, не runtime-код |
| Will | Apache-2.0 + NOTICE | deterministic clock, self-model update, episodic consolidation, allostasis, reafference | SHA полностью совпадает с уже учтённым архивом Will |

Полные hashes, размеры, количество членов ZIP, родительские контейнеры, license caveats и точечные NK1-владельцы записаны в JSON-манифесте.

## Сверка с тем, что уже есть в NK1

Это не чистый проект без интеграций. На `workpass70-source` уже присутствуют MemoryOS2/MemoryFabric, multi-timescale/world models, intrinsic motivation, offline consolidation, SelfModelV2, ActionGateway, CognitiveEventFabric, causal outcome binding, локальные inference adapters и release license gate. Поэтому источники сравниваются с canonical owners, а не разворачиваются как параллельные реализации.

В существующей `docs/INTEGRATION_MATRIX_WORKPASS43_2026-10-15.md` уже указаны: WILL reafference/action credit; Hexis belief provenance; Mem0 candidates; Chroma/FAISS read-only evaluation; DSPy/Agent0 gated self-improvement; Hyperon sandbox; OpenAI Agents/Agent Framework typed tool contracts; Hermes/OpenClaw recovery. Эта ревизия уточняет идентичность новых архивных байтов и правовые границы:
- WILL ZIP SHA совпадает с уже индексированным source archive от 2026-10-08.
- Lumina ZIP SHA совпадает с уже индексированным source archive.
- Letta ZIP в обоих контейнерах — одна и та же копия SHA `5d28f1…`, всего 16 членов; это не полноценный upstream checkout.
- Hexis ZIP SHA новый относительно ранее развернутого источника; требуется path-by-path diff против старой версии до выбора новых механизмов.
- AutoGPT Platform, AutoGen и OWL не проходят упрощённый допуск на копирование: нужны точные разрешения по пути/дереву.

## План интеграции по проходам

### A. Проверка дельты, а не повторное чтение README
Сравнить новую Hexis-версию с уже архивированным снимком по файлам и тестам; отдельно проверить, какие механизмы Hexis/WILL уже представлены в NK1 и какие тесты/граничные случаи отсутствуют. Для каждого кандидата сформировать source file + license path + NK1 owner + measurable acceptance.

### B. Self-improvement: ограниченный обучающий контур
Использовать Agent0/DSPy как исследовательские паттерны для генерации кандидатов и траекторной критики. Канонический контур: proposal → exact patch receipt → protected-region check → deterministic tests → independent downstream evaluator → immutable holdout → rollback-capable promotion. Генератор не имеет права подтверждать собственную эффективность или менять evaluator/holdout/approval authority.

### C. Память и устойчивость идентичности
Сопоставить Hexis/Mem0/Lumina с текущими MemoryOS2 + MemoryFabric: provenance, supersession/revert, temporal decay, explicit forget, consolidation replay. Принимать только недостающие операции/тесты, не создавать вторую БД, vector store или память.

### D. Агентная инфраструктура и инструменты
Из Hermes/Agent Framework/OpenAI Agents/Will изучать типизированные действия, non-overlap scheduler, context isolation, session recovery, skill provenance и action reafference. Все операции должны оставаться в существующем ActionGateway/Engineering OS и obey fail-closed tool registry. Ни один внешний источник не получает автономный доступ к секретам, evaluator или критическим файлам.

### E. Доказательство выигрыша и выпуск
Каждая интеграция обязана иметь baseline, paired seeds, fixed train/evaluation split, независимый holdout, rollback и измеренный выигрыш. Векторная память: recall/precision, stale/conflicting recall, forget correctness, p50/p95 latency. Автономия: initiated goal rate, usefulness, duplicate actions, budget, user stop/revoke. Релиз — только после path-level license review, clean-room install и проверки точного Release ZIP SHA.

## Запреты и границы

1. Не устанавливать крупную зависимость только потому, что она есть в источнике.
2. Не копировать код из AutoGPT `autogpt_platform`, AutoGen или OWL до явной path-level license review.
3. Не трактовать наличие архитектуры, benchmark, heartbeat или self-writeback как доказательство субъективного сознания.
4. Не присваивать upstream код как NK1; сохранять notice, лицензии, source SHA и список изменённых файлов для любого будущего заимствования.
5. Не считать PR/ветку релизом: изменения считаются опубликованными только после проверки содержимого Release ZIP и его checksum.

## Проверка архива / воспроизводимость

- Четыре outer 7z контейнера идентифицированы по SHA-256.
- Каждый вложенный ZIP распакован как самостоятельный контейнер, проверен на валидную структуру и хеширован.
- Letta duplicate обнаружен по совпадающему SHA-256, а не по имени.
- Количество участников и файловые лицензии — inventory metadata; содержимое внешних архивов не включено в Git commit.

