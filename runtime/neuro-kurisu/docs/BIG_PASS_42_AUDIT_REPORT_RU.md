# Neuro-Kurisu 34.11.0 — BIG PASS 42

Дата: 2026-09-05
Фаза: `Stage-2/performance-spine-project-execution`
State schema: **88**

## Цель прохода

Продолжить первый полный аудит без повторного внедрения уже существующих механизмов. Максимально полезный пакет выбран вокруг двух узких мест:

1. стоимость длинного cognitive runtime на среднем телефоне;
2. реальное выполнение автономных проектов, а не только подсчёт их прогресса.

## Реально изменено

### 1. Project Executor 2.0

`AutonomousProjectExecutor` переведён на state version 2.

Добавлены:

- зависимости между шагами проекта;
- минимальное число попыток перед продвижением;
- retry-after tick с экспоненциальным ограничением;
- блокировка шага при незавершённых зависимостях;
- счётчики tool calls/successes/blocked cycles;
- last tool/error provenance;
- отдельный observation контур для результата инструментов.

Это устраняет важный класс ложной автономности: failed tool call больше не выглядит как успешный project progress и не создаёт бесконечный tight-loop.

### 2. Project tool execution стал resource-aware

`OrganismCore.executeProjectTool()` теперь:

- проверяет наличие активного проекта;
- проверяет, что текущий step может быть запущен;
- требует cognitive budget на planning/tool execution;
- блокирует операцию при нехватке бюджета;
- пишет результат инструмента в executor state;
- сохраняет audit/evidence через существующий action gateway.

### 3. Runtime Evidence Bus

Добавлены дешёвые metrics без materialization полного snapshot:

- `total`;
- `buffered`;
- `capacity`;
- `latestTick`;
- `bufferedTickSpan`;
- `externalCount`.

Также устранён лишний `structuredClone()` при возврате только что опубликованного evidence event. Полный snapshot по-прежнему клонируется безопасно при внешнем чтении.

### 4. Cognitive facade

В `CognitiveSubsystemFacade` добавлен сводный `projectBudget()` с:

- toolCalls;
- toolSuccesses;
- toolSuccessRate01;
- blockedCycles.

Это полезнее, чем отдавать потребителю внутренние поля Core.

### 5. Release/source-of-truth

Версия повышена до **34.11.0**, schema до **88**.

Обновлены:

- `ReleaseContract`;
- `VERSION.json`;
- `package.json`;
- `package-lock.json`;
- `RELEASE_MANIFEST.json`;
- current documentation;
- archive manifest.

### 6. Machine-checkable progress

`audit-big-pass-progress.mjs` сделан dynamic относительно текущего `VERSION.json`; теперь проверки не ломаются на следующем release из-за hard-coded версии.

Текущий progress audit: **58/58 = 100%**.

## Что было перепроверено из первого аудита

Первый аудит остаётся governing specification. Из его ключевых направлений:

| Направление | Статус |
|---|---|
| Runtime stabilization | существенно закрыто |
| Evidence Bus | закрыт базовый слой |
| Prediction Ledger | закрыт/расширен |
| Cognitive Budget | закрыт/расширен |
| Model ecology | существенно реализована |
| Autonomous projects | существенно усилены |
| Reality boundary | существенно реализована |
| General learning | частично |
| Causal research | частично |
| Real perception | частично |
| Self-model | существенно, но нужен longitudinal benchmark |
| Identity/autobiography | частично/существенно symbolic layer |
| Shadow Organism | частично независимый |
| Model competition | базовый loop реализован |
| Native Android host | не закрыт |
| Social cognition | частично |
| Development/self-modification | частично |
| Empirical consciousness evaluation | не закрыта |

Строгая weighted реализация первого аудита: **≈77%**. Это не процент сознания.

## Методологическая поправка

Несмотря на сильный code coverage, нельзя считать internal scores доказательством personhood, phenomenal consciousness или human-level intelligence. Для таких утверждений нужен отдельный external/longitudinal evidence layer.

## Проверки

Пройдено:

- `TYPECHECK=PASS`;
- `BIG_PASS_42_PROJECT_EXECUTOR=PASS`;
- `BIG_PASS_42_EVIDENCE_SPINE=PASS`;
- `P64_P65_INTEGRATION=PASS`;
- `P66_P68_INTEGRATION=PASS`;
- `P74_P77_INTEGRATION=PASS`;
- `P80_P82_RUNTIME_E2E=PASS`;
- restart persistence;
- memory dedup;
- identity lock;
- replay;
- API security;
- server security smoke;
- architecture;
- forensics;
- source hygiene;
- source truth;
- release contract.

## Длинный runtime

`operational:250` в доступном verification window не завершён.

`operational:500-warm` также не завершён в доступном verification window.

Это остаётся главным performance debt.

Для 40-cycle spine сохранена корректность:

- tick progression сохраняется;
- adaptive perception cadence работает;
- cold-operation skips сохраняются.

## Что НЕ сделано специально

Не добавлялся новый P-модуль ради роста номера.

Не добавлялся агрессивный cold-gating, потому что прошлый опыт показал риск ухудшения длинного runtime.

Не объявлен long-horizon PASS без фактического completion.

## Следующие большие шаги

### BIG PASS 43 — Performance Spine 3

- allocation budget;
- operational-result compaction;
- event batching;
- snapshot delta reuse;
- 250/500/1000 stable gates.

### BIG PASS 44 — Real External Project Engine

- bounded read/write/search tools;
- task graph;
- failure branches;
- external validation;
- persistent skill acquisition;
- project result → reusable capability.

### BIG PASS 45 — OrganismCore decomposition

- Self;
- World;
- Memory;
- Learning;
- Agency;
- Embodiment;
- Research;
- Governance APIs.

После этого: native Android host, real multimodal perception, social cognition и longitudinal phone runs.
