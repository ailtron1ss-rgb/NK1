# Hyperon / MeTTa → NK1: мост экспорта нейросимволических концептов

**Дата:** 2026-11-13  
**Ветка:** `aspect/hyperon-metta-concept-bridge-20261113`  
**База:** `workpass70-source` @ `1a0315595302f3154df0ae53e5d9188875311467`  
**Донор:** Hyperon / MeTTa из пользовательских архивов исходников  
**Статус:** код добавлен; точный CI и ревью ожидаются; не включено в релиз.

## Что адаптировано

В NK1 уже существует `NeuroSymbolicConceptCompiler`: он переводит латентные векторы в прототипы концептов, обновляет центроиды и хранит confidence / success / uses. Но без отдельного межсистемного контракта такие концепты нельзя безопасно передавать в нейросимволический движок.

Добавлен `exportMeTTaFacts()` — ограниченный сериализатор фактов:
- `NK1Concept`: метка, confidence, число применений, success;
- `NK1ConceptEmbedding`: ограниченный вектор центроида;
- стабильная сортировка, нормализация и экранирование меток;
- жёсткий предел 128 концептов и 16 компонент вектора;
- некорректные числовые значения зажимаются в безопасный диапазон.

## Архитектурные границы

- Это протокольный мост, а не встроенный Hyperon runtime.
- Он только сериализует факты: не выполняет MeTTa, не запускает процессы, не меняет память и не принимает внешние правила.
- Каноническим владельцем концептов остаётся NK1 `NeuroSymbolicConceptCompiler`.
- Подключение реального Hyperon worker потребует отдельного sandboxed adapter, timeout, resource budget, provenance и independent-evidence gate.
- Внешние выводы не могут напрямую изменять UserModel, identity, goals или canonical memory.

## Проверка

Workflow `.github/workflows/hyperon-metta-concept-bridge.yml` запускает runtime typecheck и regression:
- escaping / quoted labels;
- bounded output and hard caps;
- deterministic serialization;
- no mutation of canonical state;
- malformed numeric state clamping.

## Польза и следующий этап

Мост создаёт основу для символьных запросов к концептам NK1 и объяснимых структурированных связей между нейронным представлением и символическим слоем. Следующий этап — реальный Hyperon sandbox worker и bidirectional candidate protocol с доказательствами происхождения; это нельзя считать готовым до независимой проверки качества вывода и измерения latency / memory.
