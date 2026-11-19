# NK1 / Neuro Kurisu — масштабный мастер-план интеграции и завершения проекта

**Редакция:** 2026-10-28
**Объём:** 300 рабочих шагов · 30 фаз · 14 upstream-проектов/стандартов-кандидатов
**Назначение:** не просто довести текущие компоненты до PASS, а интегрировать полезные открытые реализации в один оптимизированный, измеряемый и пригодный к выпуску цифровой организм.

---

## Правила исполнения

1. **Источник исходников** — подтверждённая canonical source line; `main` не считать полным деревом исходников без отдельной проверки. Не объединять divergent истории автоматически.
2. **Каждый шаг** выполняется через отдельное изменение/PR, где это возможно: `[NK1][фаза/шаг] ...`; обновить CHANGELOG, добавить owning regression и сохранить exact SHA.
3. **Статусы:** PLANNED → IMPLEMENTED → TESTED → INTEGRATED → MEASURED → RELEASED. Нет доказательства — UNVERIFIED, не PASS.
4. **Внешний проект** сначала проходит intake, version pin, license/SBOM review, adapter contract и benchmark. Не внедрять второй источник истины, второй когнитивный runtime или вторую память без доказанной необходимости.
5. **Любой candidate**, созданный обучением/GEPA/агентом, запускается в изоляции, оценивается на независимом holdout и не меняет production без promotion gate.
6. **Число коммитов**, строк кода, тестов и модулей не является метрикой завершения. Завершение подтверждается поведением, измерениями, восстановлением и чистым релизом.

---

## Короткая карта интеграций

| Источник | Что брать | Что не делать |
|---|---|---|
| **Hermes Agent** | Skill/tool lifecycle, traces and bounded agent execution | Не переносить второй runtime/control plane целиком; проверять совместимость и лицензию pinned SHA. |
| **Hermes Self-Evolution + DSPy/GEPA** | Offline candidate generation, trace-based repair, Pareto selection, PR-based approval | Сначала только skills/prompts; не допускать прямую модификацию production или safety policy. |
| **Mem0** | Shadow benchmark and adapter comparison for long-term memory | Upstream README declares Apache-2.0; verify exact commit, transitive deps, model/weights and source-archive licenses. |
| **Letta / MemGPT patterns** | Memory pressure, archival recall and stateful-agent patterns | Current active repository may change; use patterns selectively and do not add second authoritative memory. |
| **Model Context Protocol TypeScript SDK** | Standardized typed tool/resource/prompt adapters | Pin SDK version; review auth, transport and permissions; do not let external output override policy. |
| **LangGraph.js** | Reference for durable workflow/checkpoint/human-in-loop behavior | Reference/adapter only unless it solves a measured gap; NK1 keeps a canonical cognitive loop. |
| **llama.cpp** | Local model inference adapter and model benchmark | Audit runtime commit and each model weight/license separately; evaluate actual target hardware. |
| **whisper.cpp** | Offline ASR feasibility for voice path | Measure multilingual accuracy, memory/latency, model license and Android behavior. |
| **Silero VAD** | Voice activity detection as an optional adapter | Benchmark false start/end behavior; verify code/model license and model provenance. |
| **Piper TTS** | Optional local TTS backend | Review GPL implications and voice-model licenses before bundling or redistribution. |
| **GPT-SoVITS** | Optional higher-quality voice backend on capable hardware | Review code/dependency/model licenses and consent/rights for source voice samples; never assume weights are freely redistributable. |
| **Three.js VRM adapter** | Optional second selectable 3D avatar path | Verify exact version/license, VRM assets and model usage rights; keep common AvatarController. |
| **Live2D Cubism SDK** | Existing Live2D rendering adapter | SDK Core and publication terms differ from ordinary open-source code; verify release conditions and all model assets. |
| **OpenTelemetry JS** | Trace context, metrics and runtime observability | Instrument minimal useful fields; do not export user content or secrets to telemetry. |

---

## Порядок исполнения и зависимости

| Приоритет | Фазы | Gate для перехода |
|---|---|---|
| **P0 — восстановить достоверность разработки** | Фазы 01–04 | До любых крупных интеграций: canonical SHA, exact-head CI, toolchain, безопасный branch workflow и единый runtime contract. |
| **P1 — закрыть память и обучение evidence-first** | Фазы 06–12 | Пока `recallDelta` и `learning uplift` не доказаны, сохранять интеграции в shadow/adapter режимах. |
| **P2 — запустить полный автономный цикл** | Фазы 13–17 | Доказать `initiative→action→independent verify→learn` с durable state и реальными fail paths. |
| **P3 — интегрировать внешние capabilities** | Фазы 10–13, 18–22, 26 | Добавлять только компоненты с измеримым эффектом, контролируемыми рисками и проверенной лицензией. |
| **P4 — production hardening** | Фазы 23–29 | Benchmarks, security, packaging, license, device soak и recovery evidence. |
| **P5 — acceptance и release** | Фаза 30 | Один exact validated candidate, полный acceptance matrix, проверенный Release ZIP и rollback. |

---

## 01. Каноническое состояние, доказательства и управление работой

1. **Зафиксировать идентичность рабочей базы**
   *Подшаги:* Снять HEAD и дату для main, workpass70-source, rebuild и активных кандидатов; сохранить SHA в audit manifest.
   *Условие завершения:* Manifest указывает на реально существующие refs и фиксирует время снимка.
   *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
2. **Снять полную карту веток**
   *Подшаги:* Выгрузить все страницы branches; сгруппировать по памяти, learning, Hexis, core, avatar, CI и release.
   *Условие завершения:* У каждой ветки есть категория, владелец, статус и выбранное дальнейшее действие.
   *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
3. **Зафиксировать разрыв main/source**
   *Подшаги:* Сравнить историю main и workpass70-source; подтвердить отсутствие общего предка и запретить обычный merge.
   *Условие завершения:* В документации описана безопасная модель переноса изменений между двумя линиями.
   *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
4. **Инвентаризировать Pull Request**
   *Подшаги:* Для каждого открытого PR проверить base/head SHA, draft/state, mergeability, изменённые файлы и результаты CI.
   *Условие завершения:* Есть список PR: merge, cherry-pick, rebase, разделить, закрыть как устаревший.
   *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
5. **Сверить Release-артефакт**
   *Подшаги:* Получить последний опубликованный Release и ZIP; записать tag, asset, size, SHA-256 и source SHA.
   *Условие завершения:* Артефакт воспроизводимо идентифицирован; статус обновления Release не предполагается.
   *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
6. **Сформировать реестр изменений**
   *Подшаги:* Сгруппировать коммиты по файлам и областям; отделить код, тесты, CI, отчёты и переименования.
   *Условие завершения:* Измеряется функциональный результат, а не число коммитов или строк.
   *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
7. **Создать реестр доказательств**
   *Подшаги:* Для каждого существенного изменения сохранить commit SHA, owning test, exact-head run и статус PASS/FAIL/UNVERIFIED.
   *Условие завершения:* Ни один PASS не опирается только на название ветки или старый запуск.
   *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
8. **Задать критерии целевого организма**
   *Подшаги:* Зафиксировать обязательные сценарии инициативы, памяти, обучения, внешней проверки, непрерывности и embodiment.
   *Условие завершения:* Все целевые возможности имеют наблюдаемое условие приёмки.
   *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
9. **Согласовать названия состояния**
   *Подшаги:* Синхронизировать README, CHANGELOG, start-here, roadmap и статусные отчёты с канонической исходной линией.
   *Условие завершения:* В документации нет ложного утверждения о свежем ZIP или production-ready статусе.
   *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
10. **Ввести единый статусный протокол**
    *Подшаги:* Использовать PLANNED, IMPLEMENTED, TESTED, INTEGRATED, MEASURED, RELEASED; требовать evidence для перехода.
    *Условие завершения:* Любой этап можно проверить независимым человеком по ссылке и хешу.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 02. Интеграция веток без потери полезного кода

11. **Создать свежую integration-ветку**
    *Подшаги:* Создать её от актуального workpass70-source; не использовать main как базу исходников.
    *Условие завершения:* Новый branch содержит зафиксированный source HEAD и не меняет защищённые линии.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
12. **Собрать кандидат-лист cherry-pick**
    *Подшаги:* Выбрать узкие fixes B276, WorkPass609, memory 603–608, Hexis receipt и Compose smoke.
    *Условие завершения:* У каждого изменения есть конкретная проблема и отдельный критерий результата.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
13. **Перенести B276 отдельно**
    *Подшаги:* Перенести scale-invariant revision threshold и correction quorum; оставить несвязанные файлы за пределами PR.
    *Условие завершения:* Core regression воспроизводит исходный дефект и подтверждает исправление.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
14. **Перенести WorkPass609 отдельно**
    *Подшаги:* Перенести strip-only module-load regression, typecheck fix и exports brain-fusion barrel.
    *Условие завершения:* Все затронутые модули реально импортируются под зафиксированным Node runtime.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
15. **Перенести memory retrieval fixes**
    *Подшаги:* Перенести работы 603–608 последовательно; проверить изменения на текущей канонической реализации MemoryOS2/MemoryFabric.
    *Условие завершения:* Нет конфликтующих реализаций и каждый fix покрыт owning regression.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
16. **Перенести независимый holdout harness**
    *Подшаги:* Взять только runner, contract test и документацию набора из divergent ветки; повторно проверить fingerprints.
    *Условие завершения:* Ветка не тянет сотни не связанных коммитов и запускается на актуальном source.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
17. **Разделить Hexis changes**
    *Подшаги:* Разбить PR 236 и смежные ветки на receipt validation, atomic rollback, lineage и server route.
    *Условие завершения:* Каждый PR содержит одну область отказа и отдельную диагностику.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
18. **Проверить ancestry перед переносом**
    *Подшаги:* Для каждого набора записать base/head/merge-base; просмотреть patch и уже присутствующие эквиваленты.
    *Условие завершения:* Нет повторного применения уже включённых исправлений.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
19. **Управлять устаревшими ветками**
    *Подшаги:* Сопоставить branch head с интегрированными patch IDs; сохранить ссылки и архивировать только доказанно устаревшее.
    *Условие завершения:* Нужные изменения сохранены и владельцы изменений могут восстановить происхождение.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
20. **Создать поток интеграции**
    *Подшаги:* Определить порядок PR: toolchain → runtime → memory → evaluation → Hexis → UI → packaging.
    *Условие завершения:* Каждый downstream PR базируется на прошедшем проверки upstream SHA.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 03. Toolchain, CI и воспроизводимость тестов

21. **Выбрать поддерживаемый Node**
    *Подшаги:* Сверить .nvmrc, package.json engines, CI matrix и API stripTypeScriptTypes; закрепить целевую версию.
    *Условие завершения:* Одинаковая версия применяется в локальной инструкции и всех обязательных runtime workflows.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
22. **Исправить runtime typecheck**
    *Подшаги:* Устранить import API, отсутствующий в Node 22.12; не заменять проверку типов фиктивным node --check.
    *Условие завершения:* Typecheck завершается кодом 0 на полном source и ловит реальный типовой дефект.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
23. **Уточнить lockfile policy**
    *Подшаги:* Для каждого package определить lockfile и рабочую директорию; отключить автоматическое cache lookup для отсутствующего root lockfile.
    *Условие завершения:* npm ci выполняется с точным lockfile, без скрытого fallback.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
24. **Унифицировать npm**
    *Подшаги:* Зафиксировать npm version и packageManager; обновлять package-lock только осознанно.
    *Условие завершения:* Чистый install не меняет lockfile неожиданным образом.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
25. **Восстановить exact-head workflow**
    *Подшаги:* Настроить push/pull_request triggers на каноническую интеграционную ветку и path filters всех зависимых файлов.
    *Условие завершения:* Изменение owning runtime-файла запускает его реальную проверку.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
26. **Устранить пустые/недоступные логи**
    *Подшаги:* Настроить короткие тестовые workflow, не скрывать exit codes; сохранять артефакты и tail logs при failure.
    *Условие завершения:* По каждому fail понятны шаг, команда и диагностический вывод.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
27. **Разделить CI уровни**
    *Подшаги:* Создать быстрые smoke, unit/contracts, integration, benchmarks и long soak; указать требуемые статусы для merge.
    *Условие завершения:* Ни дорогой benchmark, ни лицензионный gate не подменяет базовый typecheck.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
28. **Ввести workflow timeouts**
    *Подшаги:* Поставить лимиты времени, concurrency группы и отмену устаревших запусков.
    *Условие завершения:* Нет бесконечных job и поздний stale CI не публикует Release.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
29. **Проверять coverage путей**
    *Подшаги:* Сверить package scripts, dynamic imports, workflows и реальный test-runner graph.
    *Условие завершения:* Все P0/P1 тесты достижимы из CI; unreferenced файлы рассмотрены, но не удалены автоматически.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
30. **Сделать CI отчёт машинно-читаемым**
    *Подшаги:* Сохранять JSON summary с SHA, OS, Node/npm, командами, статусом, временем и ссылками на логи.
    *Условие завершения:* Результат удобно сравнивать между PR и release candidate.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 04. Единое когнитивное ядро и протоколы состояния

31. **Составить живой call graph**
    *Подшаги:* Проследить server entrypoint → runtime composition → OrganismCore → cognitive loop → action/memory.
    *Условие завершения:* Карта построена по импорту и execution path, а не по названиям каталогов.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
32. **Утвердить OrganismBus**
    *Подшаги:* Определить типизированные события, correlation IDs, версии схем и обработку ошибки подписчика.
    *Условие завершения:* Межмодульный обмен идёт по контрактам, без скрытых прямых вызовов.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
33. **Утвердить OrganismState**
    *Подшаги:* Определить canonical state для goals, affect, self, memory receipts, world observations и embodiment.
    *Условие завершения:* Один владелец на изменяемую сущность; сериализация имеет версию.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
34. **Провести аудит двойных владельцев**
    *Подшаги:* Найти дублирующие планировщики, memory indexes, emotional states, provider routers и action registries.
    *Условие завершения:* Каждый duplicate либо удалён после проверки, либо определён как read-only adapter.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
35. **Связать cognitive tick**
    *Подшаги:* Провести tickId, time source, budgets, cancellation token и result envelope через все стадии.
    *Условие завершения:* Можно связать решение с входом и outcome по единому trace.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
36. **Закрыть цикл Perceive→Reflect**
    *Подшаги:* Подключить реальный output каждого этапа к следующему; обнаружить ветви, которые только выставляют diagnostics.
    *Условие завершения:* Одна трасса показывает входные данные, решение, действие, проверку и обновлённое состояние.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
37. **Установить строгие module boundaries**
    *Подшаги:* Добавить lint/architecture test на запрещённые cross-domain imports и circular dependencies.
    *Условие завершения:* Новая связь не может обходить Bus/API незаметно.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
38. **Сделать детерминированный режим**
    *Подшаги:* Внедрить seeded RNG, clock injection и controllable scheduler для регрессионных прогонов.
    *Условие завершения:* Один seed воспроизводит одинаковые решения при одинаковых inputs.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
39. **Изолировать падение подсистем**
    *Подшаги:* Определить timeout, circuit breaker, fallback и degrade state для каждого необязательного домена.
    *Условие завершения:* Отказ аватара/эмбеддера не уничтожает память и основной диалог.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
40. **Проверить длительный цикл**
    *Подшаги:* Выполнить 10k ticks и тесты cancellation/restart; измерить drift состояния и утечки ресурсов.
    *Условие завершения:* Необъяснимых зависаний, разрастания памяти и повреждения snapshot нет.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 05. Реальная модель, маршрутизация и локальный inference

41. **Инвентаризировать model providers**
    *Подшаги:* Перечислить cloud/local providers, capabilities, модель, version, context, latency и отказ.
    *Условие завершения:* Каждый запрос имеет честную атрибуцию фактически использованного backend.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
42. **Определить LanguageModelAdapter**
    *Подшаги:* Единый контракт streaming, tool calls, cancellation, usage, backend identity и structured output.
    *Условие завершения:* Провайдер можно заменить без изменения когнитивного ядра.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
43. **Развести fallback и настоящий ответ**
    *Подшаги:* Добавить явную метку deterministic fallback и отдельную метрику провайдерного отказа.
    *Условие завершения:* UI и telemetry не называют fallback ответом локальной LLM.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
44. **Подключить llama.cpp как опциональный адаптер**
    *Подшаги:* Проверить server API, модельный формат и сборку на целевом компьютере; вынести настройки в config.
    *Условие завершения:* Реальное локальное inference проходит запрос-ответ и записывает модель/hash/quantization.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
45. **Измерить целевую модель**
    *Подшаги:* Проверить latency первого токена, throughput, RSS/VRAM, контекст и качество на фиксированном наборе.
    *Условие завершения:* Модель выбрана по измерениям на железе, а не только по названию/параметрам.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
46. **Разработать маршрутизатор моделей**
    *Подшаги:* Маршрутизировать по сложности задачи, приватности, deadline, бюджету и доступности.
    *Условие завершения:* Модельный выбор объясним и не ломает continuity.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
47. **Добавить safe provider cooldown**
    *Подшаги:* Тестировать timeout, exponential backoff, recovery и reset после успеха.
    *Условие завершения:* Сбой провайдера не создаёт шторм повторных запросов.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
48. **Контролировать context budgeting**
    *Подшаги:* Выделить token budget для system prompt, memory, tools и ответа; при нехватке приоритизировать.
    *Условие завершения:* Сокращение контекста сохраняет обязательные инструкции и provenance.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
49. **Проверить structured outputs**
    *Подшаги:* Валидировать JSON/schema, ограничивать размер, чинить не более одного раза и фиксировать fail.
    *Условие завершения:* Некорректный вывод не изменяет состояние без валидации.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
50. **Сделать model-switch regression**
    *Подшаги:* Переключить провайдера во время сессии; проверить память, голос, стиль, usage и восстановление.
    *Условие завершения:* После переключения сохраняются личность, журналы и правильная backend attribution.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 06. Каноническая память и жизненный цикл воспоминаний

51. **Зафиксировать canonical memory owner**
    *Подшаги:* Назначить одну систему источником истины; остальные компоненты сделать адаптерами и индексами.
    *Условие завершения:* Нет независимого второго источника, который может расходиться в содержимом.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
52. **Унифицировать MemoryRecord**
    *Подшаги:* Проверить ID, content hash, source, confidence, createdAt, eventAt, valid-time и lineage.
    *Условие завершения:* Каждое воспоминание можно идентифицировать и объяснить по происхождению.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
53. **Реализовать уровни памяти**
    *Подшаги:* Развести кратковременный контекст, эпизодическую, семантическую и устойчивую autobiographical память.
    *Условие завершения:* Уровни имеют правила записи, извлечения, консолидации и удаления.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
54. **Добавить temporal revision**
    *Подшаги:* Сохранять пересмотр факта с периодом действия и ссылкой на предыдущую версию.
    *Условие завершения:* Запрос на дату возвращает актуальный в тот момент факт, а не всегда последнюю версию.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
55. **Согласовать память и причинный граф**
    *Подшаги:* Связывать эпизод, действие, outcome и обновлённое убеждение immutable event ID.
    *Условие завершения:* Повторная обработка события не создаёт вторую причинную запись.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
56. **Защитить restore**
    *Подшаги:* Отклонять malformed IDs, конфликтующие NFKC алиасы и повреждённые snapshots.
    *Условие завершения:* Невалидные записи не возвращаются в активную память при рестарте.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
57. **Сделать mutation receipts атомарными**
    *Подшаги:* Зафиксировать idempotency key и immutable payload fingerprint; проверять retry и конфликт.
    *Условие завершения:* Точный replay не удваивает mutation; изменённый payload отклоняется.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
58. **Обеспечить forgetting и deletion**
    *Подшаги:* Удалять или аннулировать записи, индексы, кэши и derived snapshots по понятной политике.
    *Условие завершения:* Тест доказывает исчезновение всех копий в заявленной границе данных.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
59. **Проверить bounded residency**
    *Подшаги:* Ограничить hot set, index cache и recent events; тестировать тысячи записей и cold retrieval.
    *Условие завершения:* Retrieval не раздувает RAM сверх заданного лимита.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
60. **Сделать backup/restore acceptance**
    *Подшаги:* Создать backup, восстановить в чистом каталоге, проверить миграцию и hash ключевых records.
    *Условие завершения:* Восстановленное состояние эквивалентно ожидаемому по canonical invariants.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 07. Retrieval: гибридный поиск и независимые измерения

61. **Закрепить baseline**
    *Подшаги:* Заморозить lexical retrieval конфигурацию и dataset fingerprint; сохранить результаты по каждому запросу.
    *Условие завершения:* Baseline воспроизводим и не меняется после просмотра holdout.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
62. **Закончить holdout RU/EN**
    *Подшаги:* Обеспечить минимум 20 отвечаемых и 8 unanswerable запросов на язык либо больше по мощности эксперимента.
    *Условие завершения:* Разметка и права использования подтверждены; fingerprint immutable.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
63. **Проверить labels**
    *Подшаги:* Отклонять blank, non-string, дубликаты, неизвестные memory IDs и неверный fingerprint.
    *Условие завершения:* Ошибочная разметка блокирует promotion до очистки источника.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
64. **Оценить hybrid route**
    *Подшаги:* Сравнить lexical, semantic, rerank и temporal/goal relevance в одинаковом бюджете.
    *Условие завершения:* Вклад каждого компонента измеряется ablation, не предполагается из наличия кода.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
65. **Защитить embedding cache**
    *Подшаги:* Связывать вектор с точным content hash, provider ID и размерностью; отбрасывать stale ответы.
    *Условие завершения:* Изменённое содержимое не ранжируется старым вектором.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
66. **Измерить abstention**
    *Подшаги:* Добавить unanswerable запросы и score threshold; проверять уверенный отказ при отсутствии evidence.
    *Условие завершения:* Система меньше выдумывает воспоминания и показывает основание отказа.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
67. **Измерить временную корректность**
    *Подшаги:* Создать contradictory/revised facts; тестировать as-of queries и expired facts.
    *Условие завершения:* Устаревший факт не выигрывает из-за одного семантического сходства.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
68. **Измерить стоимость**
    *Подшаги:* Собирать corpus scan count, embedding latency, reranker cost и end-to-end p95.
    *Условие завершения:* Cost signal соответствует выбранному execution path и нормирован.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
69. **Провести multi-seed comparison**
    *Подшаги:* Запустить минимум 5 paired seeds на одном корпусе, budget и retrieval config.
    *Условие завершения:* Сохраняются raw per-case data, confidence interval и версия кода.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
70. **Включить promotion gate**
    *Подшаги:* Требовать минимум agreed uplift, no unanswerable regression, acceptable latency и privacy.
    *Условие завершения:* Кандидат не продвигается при recallDelta=0 или статистически неясном результате.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 08. Консолидация, приоритеты и забывание

71. **Создать offline/sleep consolidator**
    *Подшаги:* Группировать новые эпизоды, находить повторения/противоречия и готовить предложения на консолидацию.
    *Условие завершения:* Консолидатор предлагает изменения, а не тайно переписывает canonical truth.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
72. **Считать net memory utility**
    *Подшаги:* Сопоставлять повторность, usefulness, freshness, confidence, access cost и privacy.
    *Условие завершения:* Правило сохранения можно объяснить конкретными признаками.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
73. **Разделить facts и hypotheses**
    *Подшаги:* Маркировать выведенные идеи как гипотезы; не повышать статус без внешней проверки.
    *Условие завершения:* Inference не становится фактом из-за повторения моделью.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
74. **Добавить temporal decay**
    *Подшаги:* Понижать приоритет устаревших эпизодов без стирания актуального подтверждённого факта.
    *Условие завершения:* Decay можно отключить и проверить на fixed-time tests.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
75. **Реализовать selective replay**
    *Подшаги:* Балансировать полезные редкие события, свежие задачи и негативные исходы.
    *Условие завершения:* Replay не вытесняет редкие события одними частыми примерами.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
76. **Защититься от catastrophic forgetting**
    *Подшаги:* Сравнить old-task score до и после обучения новому набору; поддерживать replay controls.
    *Условие завершения:* Регрессии старых задач видны и запускают rollback.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
77. **Вести memory conflict queue**
    *Подшаги:* При конфликте сохранять обе версии, доверие и источник; требовать разрешение.
    *Условие завершения:* Неизвестный победитель не выбирается скрыто.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
78. **Встроить user correction flow**
    *Подшаги:* Сохранять коррекцию и lineage; после проверки обновлять соответствующий факт/skill.
    *Условие завершения:* Исправление влияет только на разрешённые записи и имеет историю.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
79. **Добавить memory hygiene**
    *Подшаги:* Обнаруживать duplicates, dangling references, orphan embeddings и недостижимые episodes.
    *Условие завершения:* Автоматическая очистка предварительно dry-run и может быть отменена.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
80. **Проверить ночную консолидацию**
    *Подшаги:* Выполнить многосуточный simulated timeline; сверить полезность, забывание и расходы.
    *Условие завершения:* Консолидация улучшает измеримые метрики и не повреждает provenance.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 09. Непрерывное обучение и перенос навыков

81. **Проследить evidence → reward**
    *Подшаги:* Сопоставить событие, action, независимый outcome, credit assignment и learner update.
    *Условие завершения:* Ни один путь не присваивает положительную награду только по заявлению агента.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
82. **Провести baseline controls**
    *Подшаги:* Сравнить no-learning, replay-only, current learner и candidate learner.
    *Условие завершения:* У каждого варианта одинаковые данные, seeds, compute и критерии.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
83. **Измерить transfer**
    *Подшаги:* Проверить задачи source/near-transfer/far-transfer, успешность и ухудшения.
    *Условие завершения:* Перенос навыка принимается лишь для доказанно близких контекстов.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
84. **Измерить forgetting**
    *Подшаги:* Снимать scores по старым задачам после каждого этапа нового curriculum.
    *Условие завершения:* Отчёт содержит forward/backward transfer и переходы pass→fail/fail→pass.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
85. **Сделать safe skill rollback**
    *Подшаги:* Хранить версии, baseline metric, promoted hash и независимый reason для отката.
    *Условие завершения:* Предыдущая стабильная версия восстанавливается одним проверенным действием.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
86. **Валидировать replay admission**
    *Подшаги:* Требовать immutable trace, bounded sample, duplicate guard и verified postcondition.
    *Условие завершения:* Неаутентичный/дублирующий experience не влияет на обучение.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
87. **Добавить drift detection**
    *Подшаги:* Проверить стабильный, шумный, abrupt и gradual streams; оценить ложные срабатывания.
    *Условие завершения:* Drift detector не активирует обучение без дополнительных evidence gates.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
88. **Проверить curriculum**
    *Подшаги:* Сравнить фиксированный и адаптивный порядок задач; измерить sample efficiency.
    *Условие завершения:* Изменение расписания имеет независимую статистическую опору.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
89. **Сделать model update boundary**
    *Подшаги:* Отделить обучаемые политики/skills от базовых weights и системных ограничений.
    *Условие завершения:* Обучение не может переписать EthicalGate и права доступа.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
90. **Утвердить learning release gate**
    *Подшаги:* Требовать независимые paired trials, holdout protection, uncertainty и rollback доказательства.
    *Условие завершения:* Learning score повышается только при измеренном общем улучшении.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 10. Hermes Agent, GEPA и безопасная самоэволюция

91. **Провести intake Hermes Agent**
    *Подшаги:* Зафиксировать upstream commit, license, поддерживаемые платформы, tools, memory и skill format.
    *Условие завершения:* Есть compatibility note и перечень пригодных механизмов, а не обещание копировать весь агент.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
92. **Адаптировать skill lifecycle**
    *Подшаги:* Сопоставить Hermes skill metadata с NK1 registry и canonical capability policy.
    *Условие завершения:* Внешний skill проходит тот же registry и permissions, что и собственные skills.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
93. **Подключить DSPy/GEPA offline**
    *Подшаги:* Сделать Python sidecar/CLI для candidate generation; не вводить DSPy внутрь TS runtime.
    *Условие завершения:* Runtime получает только валидированный artifact через версионируемый adapter.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
94. **Создать skill-as-candidate adapter**
    *Подшаги:* Экспортировать skill, собрать bounded eval dataset и сохранить исходный хеш.
    *Условие завершения:* Любой candidate можно сравнить с точно определённой исходной версией.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
95. **Собирать trajectories**
    *Подшаги:* Логировать инструмент, решение, ошибки, outcome, rubric score и стоимость без чувствительных данных.
    *Условие завершения:* GEPA получает безопасные, отфильтрованные traces с происхождением.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
96. **Создать reflective repair loop**
    *Подшаги:* Преобразовать failure → diagnosis → candidate patch → regression → holdout evaluation.
    *Условие завершения:* Кандидат сопровождается объяснимой причиной и измеренным эффектом.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
97. **Задать Pareto selection**
    *Подшаги:* Сохранять альтернативные навыки по разным eval dimensions, а не только по одному общему баллу.
    *Условие завершения:* В итоговом выборе видны trade-offs и отсутствует скрытый провал одной метрики.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
98. **Запретить direct production mutation**
    *Подшаги:* Публиковать кандидатов только в ветку/PR; требовать утверждение человека для рискованных изменений.
    *Условие завершения:* Самоэволюция не меняет production skill без gate.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
99. **Протестировать optimization budget**
    *Подшаги:* Ограничить iterations, API costs, data access, execution time и число кандидатов.
    *Условие завершения:* Оптимизатор прерывается по лимиту и оставляет воспроизводимый отчёт.
    *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
100. **Проверить gain и rollback**
     *Подшаги:* Сравнить candidate с baseline и untouched holdout; запустить regression после promotion.
     *Условие завершения:* Нет регрессии, prompt/character drift или превышения бюджета; otherwise rollback.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 11. Mem0 и Letta: адаптация памяти без второго мозга

101. **Снять upstream Mem0**
     *Подшаги:* Проверить актуальную версию, Apache-2.0 license, SDK/API, data model и хранилища.
     *Условие завершения:* Сохранён lockfile/SBOM evidence и документирован точный upstream SHA.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
102. **Запустить Mem0 shadow mode**
     *Подшаги:* Отправлять копии безопасных тестовых событий в адаптер без влияния на ответ NK1.
     *Условие завершения:* Сравнение выполняется без второго источника истины и без пользовательских данных по умолчанию.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
103. **Сравнить Mem0 recall**
     *Подшаги:* Измерить точность извлечения, duplicates, contradictions, cost и p95 на общем dataset.
     *Условие завершения:* Mem0 остаётся только если улучшает конкретную метрику относительно canonical baseline.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
104. **Описать Letta/MemGPT patterns**
     *Подшаги:* Сравнить context hierarchy, archival recall, memory pressure и self-edit boundaries.
     *Условие завершения:* Результат — конкретный design decision, не параллельная копия runtime.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
105. **Интегрировать archival memory pattern**
     *Подшаги:* Реализовать контролируемую запись/извлечение архивов через существующий MemoryFabric.
     *Условие завершения:* Архивные данные имеют canonical IDs и не могут переписывать active state без проверки.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
106. **Сравнить memory editing**
     *Подшаги:* Проверить предложение memory edits против текущей записи NK1 на fixed test corpus.
     *Условие завершения:* Механизм исключает бездоказательные self-modification и дублирующие owners.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
107. **Сделать adapter contract**
     *Подшаги:* Определить put/search/resolve/delete/health и error semantics для внешних memory engines.
     *Условие завершения:* Замена реализации возможна без изменения cognitive loop.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
108. **Добавить privacy boundary**
     *Подшаги:* Обеспечить локальный режим, opt-in удалённого вызова, retention и экспорт данных.
     *Условие завершения:* Shadow mode не отправляет данные наружу без явной политики.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
109. **Сделать comparative report**
     *Подшаги:* Собрать quality/latency/cost/reliability/licensing results Mem0 vs Letta patterns vs NK1.
     *Условие завершения:* Решение based-on-evidence документирует что внедряется и почему.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
110. **Провести один владелец данных audit**
     *Подшаги:* Проверить что внешние adapters не хранят независимую authoritative personal history.
     *Условие завершения:* Ни один конфликт памяти не имеет нескольких победителей в разных подсистемах.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 12. Hexis, causal provenance и транзакции

111. **Определить Hexis boundary**
     *Подшаги:* Задать роль Hexis в evidence lineage, review, HMX apply и canonical memory projection.
     *Условие завершения:* Hexis повышает проверяемость, но не заменяет canonical store.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
112. **Проверить HMX receipt schema**
     *Подшаги:* Проверять digest, stage, attempt ID, counters, unique IDs, warnings и deferred sections.
     *Условие завершения:* Receipt невозможно сделать валидным лишь перебором поддельного digest.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
113. **Атомизировать HMX apply**
     *Подшаги:* Сгруппировать memory, semantic nodes, temporal facts и beliefs в транзакционный/компенсационный протокол.
     *Условие завершения:* Injected failure возвращает все проекции к согласованному состоянию.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
114. **Проверить compensation**
     *Подшаги:* Инжектировать сбой после каждого write boundary и повторить apply.
     *Условие завершения:* Retry даёт ровно один memory record, graph node, assertion и belief.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
115. **Укрепить source lineage**
     *Подшаги:* Связать upstream source ID, content fingerprint, provenance и confidence.
     *Условие завершения:* Дубли источника распознаются без подавления разных достоверных источников.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
116. **Отклонять недоверенные источники**
     *Подшаги:* Тестировать модельные echoes, future timestamp, missing source и перепутанный fingerprint.
     *Условие завершения:* Невалидный lineage не меняет trust score и learner reward.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
117. **Сохранить conflict telemetry**
     *Подшаги:* Различать malformed input, missing memory, source conflict и storage failure.
     *Условие завершения:* HTTP/error mapping не маскирует внутреннюю ошибку как клиентскую.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
118. **Оптимизировать receipt membership**
     *Подшаги:* Использовать bounded Set/Map для repeated membership checks с сохранением semantics.
     *Условие завершения:* Benchmark подтверждает линейный порядок работы без регрессии validation.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
119. **Проверить replay после restart**
     *Подшаги:* Сохранять durable receipts и retry ledger; атаковать повтором после eviction.
     *Условие завершения:* Старый идентификатор не может повторно создать outcome после рестарта.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
120. **Интегрировать Hexis в release gate**
     *Подшаги:* Запустить все owning workflows на integration SHA; записать точный список закрытых/открытых defects.
     *Условие завершения:* Нет merge только по признаку PR merged; exact-head acceptance обязателен.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 13. MCP, инструменты и делегированные агенты

121. **Составить inventory инструментов**
     *Подшаги:* Перечислить tools, schemas, side effects, credentials, inputs, rate limits и risk class.
     *Условие завершения:* У инструмента есть владелец, permission scope и owning tests.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
122. **Оценить MCP TypeScript SDK**
     *Подшаги:* Проверить актуальную официальную split-package версию и совместимость с Node/TS в NK1.
     *Условие завершения:* MCP включается только через adapter, после pinning version и license scan.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
123. **Определить MCP tool contract**
     *Подшаги:* Сделать typed schemas, bounded output, timeouts, cancellation и structured errors.
     *Условие завершения:* Malformed/oversized tool result отвергается до входа в cognition.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
124. **Встроить tool registry**
     *Подшаги:* Связать каждый tool с policy, capability grants, provenance и expected postcondition.
     *Условие завершения:* Модель не может вызвать произвольный executable вне allowlist.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
125. **Подключить MCP resources/prompts selectively**
     *Подшаги:* Экспортировать только нужные resources/prompts; проверить escape и untrusted content boundaries.
     *Условие завершения:* Внешний content не получает status system/developer instructions.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
126. **Сделать permission tiers**
     *Подшаги:* Разделить read-only, reversible write, external side-effect и privileged tools.
     *Условие завершения:* Рискованный action требует более сильного approval и verifier.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
127. **Ограничить delegated agents**
     *Подшаги:* Каждому subagent задать context, files, budget, tools и deadline.
     *Условие завершения:* Subagent не может менять production state или credentials сверх разрешённого.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
128. **Сохранить lineage делегирования**
     *Подшаги:* Связывать parent task, delegated plan, output, selected result и independent verification.
     *Условие завершения:* Результат делегата — предложение, пока главный verifier не подтвердит его.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
129. **Проверить tool selection**
     *Подшаги:* Создать eval triples для правильного, ошибочного и опасного выбора инструмента.
     *Условие завершения:* Точность выбора измерена на holdout, а не оценена по субъективному впечатлению.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
130. **Проверить MCP отказ и reconnection**
     *Подшаги:* Тестировать disconnect, server restart, invalid schema, auth expiry и duplicate request.
     *Условие завершения:* Сессия восстанавливается без потерянного или удвоенного внешнего действия.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 14. Мотивация, интерес и автономная инициатива

131. **Определить bounded drives**
     *Подшаги:* Выделить curiosity, competence, continuity, social connection, task progress и resource conservation.
     *Условие завершения:* Каждый drive имеет измеримый сигнал и границы влияния.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
132. **Сделать endogenous goals**
     *Подшаги:* Порождать цели из unresolved uncertainty, stale plans, memory gaps и незавершённых задач.
     *Условие завершения:* Цель содержит evidence, полезность, cost, expiry и проверяемый результат.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
133. **Проверить разнообразие целей**
     *Подшаги:* Тестировать collapse в один домен и отсутствие постоянного повторения одинакового действия.
     *Условие завершения:* Goal vector сохраняет diversity при ограниченном бюджете.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
134. **Связать curiosity с uncertainty**
     *Подшаги:* Оценивать expected information gain, стоимость получения сигнала и риск.
     *Условие завершения:* Система исследует только когда ожидаемая ценность выше безопасного порога.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
135. **Добавить urgency и cooldown**
     *Подшаги:* Планировать приоритет по последствиям, deadline, контексту пользователя и предыдущим неудачам.
     *Условие завершения:* Низкая полезность/частое повторение повышает cooldown, а не порождает спам.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
136. **Связать инициативу с последним контактом**
     *Подшаги:* Использовать time_since_last_interaction, состояние диалога и preference пользователя.
     *Условие завершения:* Проактивность соблюдает тихие периоды и user settings.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
137. **Определить инициативный scheduler**
     *Подшаги:* Добавить bounded cadence, jitter, persistent checkpoints и cancellation на возврат пользователя.
     *Условие завершения:* Инициативный цикл работает без user prompt и не дублируется после restart.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
138. **Проверить полезность сообщений**
     *Подшаги:* Оценивать relevance, novelty, actionability и interrupt cost на независимых сценариях.
     *Условие завершения:* Проактивность повышает полезность, а не только число начатых разговоров.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
139. **Защитить goals от внешней инъекции**
     *Подшаги:* Отделить собственные цели, пользовательские задачи и внешние tool prompts.
     *Условие завершения:* Недоверенный контент не переопределяет внутренние policy limits.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
140. **Провести недельный autonomy replay**
     *Подшаги:* Прогнать симулированные календарь, idle, ошибки, recall gaps и user returns.
     *Условие завершения:* Initiative precision, false starts, latency и resource cost записаны и соответствуют gate.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 15. Восприятие и модель мира

141. **Определить WorldObservation**
     *Подшаги:* Включить источник, timestamp, confidence, modality, expiry и provenance.
     *Условие завершения:* Нет бесхозных наблюдений без времени и происхождения.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
142. **Подключить perception registry**
     *Подшаги:* Унифицировать text, files, web results, camera/mic events и device state.
     *Условие завершения:* Каждый provider имеет разрешения и explicit availability status.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
143. **Разделить observation и inference**
     *Подшаги:* Сохранять исходный сигнал отдельно от интерпретации модели.
     *Условие завершения:* Невозможно отобразить вывод модели как прямой сенсорный факт.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
144. **Реализовать contradiction detector**
     *Подшаги:* Сравнивать наблюдение с существующим world model; создавать конфликт при несовместимости.
     *Условие завершения:* Противоречия не исчезают от одного повторного ответа модели.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
145. **Создать forward-model contract**
     *Подшаги:* Получать action, preconditions, expected outcomes, confidence и uncertainty.
     *Условие завершения:* Планировщик может сравнить ожидаемый outcome с фактическим.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
146. **Добавить counterfactual tests**
     *Подшаги:* На одинаковом состоянии сравнить выбранное действие с доступной альтернативой.
     *Условие завершения:* Контрфактический score не подменяет реальный outcome evidence.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
147. **Ввести stale observation policy**
     *Подшаги:* Задавать TTL по типу источника и решению; обновлять time-sensitive данные.
     *Условие завершения:* Устаревшая информация не выдаётся как текущее состояние.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
148. **Ограничить external perception**
     *Подшаги:* Для браузера/камеры/микрофона требовать user permission, notice и минимизацию данных.
     *Условие завершения:* Сенсоры работают только при активном разрешении.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
149. **Проверить world-state restore**
     *Подшаги:* Сохранять проверенные события и пересчитывать derived state при restore.
     *Условие завершения:* Snapshot не может самовольно повысить недоверенное состояние до verified.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
150. **Измерить prediction calibration**
     *Подшаги:* Записать forecast и outcome; измерить Brier/ECE или согласованную confidence metric.
     *Условие завершения:* Confidence отражает наблюдаемую калибровку, а не является статической константой.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 16. SelfModel, UserModel, характер и эмоциональная непрерывность

151. **Выделить постоянные черты Kurisu-направления**
     *Подшаги:* Определить интеллект, сарказм, независимость, настойчивость и научный стиль через поведенческие рубрики.
     *Условие завершения:* Черты оцениваются в сценариях, а не только по system prompt.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
152. **Разделить trait и affect**
     *Подшаги:* Хранить личностные характеристики отдельно от краткосрочных эмоций и контекста.
     *Условие завершения:* Кратковременное настроение не стирает устойчивый характер.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
153. **Сделать affect transition model**
     *Подшаги:* Определить источники изменения, интенсивность, decay, conflicting signals и persistence.
     *Условие завершения:* Повторяемость эмоций проверяется seeded тестами.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
154. **Увязать эмоции с решением**
     *Подшаги:* Показать, какие emotion features влияют на phrasing, goal priority, facial expression и gesture.
     *Условие завершения:* Эмоциональный state влияет на реальные выходы, но не обходит safety policy.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
155. **Реализовать SelfModel update**
     *Подшаги:* Записывать способности, ошибки, ограничители, уверенность и подтверждённые изменения поведения.
     *Условие завершения:* SelfModel обновляется по результатам, а не по декларациям модели.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
156. **Реализовать UserModel update**
     *Подшаги:* Отделять explicit preferences, observed patterns и uncertain hypotheses.
     *Условие завершения:* Каждый inference можно исправить, удалить или понизить в уверенности.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
157. **Сделать relationship continuity**
     *Подшаги:* Хранить уровень близости, границы, общие эпизоды и историю обратной связи.
     *Условие завершения:* Смена модели/сессии не вызывает резкого необоснованного изменения отношения.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
158. **Проверить persona consistency**
     *Подшаги:* Создать фиксированный dialogue suite на разных настроениях, языках и backend.
     *Условие завершения:* Оценки характера согласуются между версиями, а регрессии выявляются автоматически.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
159. **Добавить корректируемые пользовательские настройки**
     *Подшаги:* Предоставить управление proactivity, privacy, tone, voice и memory.
     *Условие завершения:* Настройки имеют реальные эффекты и сохраняются после перезапуска.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
160. **Проверить state drift**
     *Подшаги:* Провести длинные multi-session сценарии с конфликтами фактов и эмоций.
     *Условие завершения:* Характер остаётся узнаваемым и допускает развитие с explainable evidence.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 17. Действия, верификация, sandbox и EthicalGate

161. **Составить action threat model**
     *Подшаги:* Классифицировать tools по риску, внешнему эффекту, обратимости и требуемому consent.
     *Условие завершения:* Каждое действие имеет risk tier и владельца policy.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
162. **Сделать ActionEnvelope**
     *Подшаги:* Включить action ID, idempotency key, input fingerprint, deadline, preconditions и verification plan.
     *Условие завершения:* Все side effects прослеживаются одним идентификатором.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
163. **Запретить caller-asserted verification**
     *Подшаги:* Выделить доверенный verifier API, который сам проверяет expected world transition.
     *Условие завершения:* Caller boolean/ACK не может самостоятельно выдать evidence verified.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
164. **Развернуть независимый executor**
     *Подшаги:* Запускать реальные задачи в ограниченном отдельном процессе/container с узкими mount и network policy.
     *Условие завершения:* Executor isolation подтверждена тестом, а не только проверкой путей в коде.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
165. **Развернуть independent verifier**
     *Подшаги:* Отделить verifier credentials/storage/process от executor и ограничить выдачу receipts.
     *Условие завершения:* Исполнитель не может подменить собственное подтверждение результата.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
166. **Подключить safety scanner**
     *Подшаги:* Проверять команды, файлы, payloads и внешние действия до исполнения.
     *Условие завершения:* Опасное действие блокируется и оставляет объяснимую причину.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
167. **Реализовать approval tier**
     *Подшаги:* Требовать human approval для необратимых, внешних или привилегированных операций.
     *Условие завершения:* Нет автоматического расширения permissions через самогенерацию навыка.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
168. **Проверить crash consistency**
     *Подшаги:* Убивать процесс до, во время и после внешнего эффекта; повторять запросы и receipts.
     *Условие завершения:* Нет двойного внешнего эффекта и потерянного подтверждения.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
169. **Добавить policy regression matrix**
     *Подшаги:* Проверить prompt injection, privilege escalation, data exfiltration, SSRF и tool schema abuse.
     *Условие завершения:* Все high severity cases блокируются owning policy gate.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
170. **Протестировать EthicalGate**
     *Подшаги:* Запустить допустимые, неоднозначные и запрещённые кейсы через полный pipeline.
     *Условие завершения:* Gate реально находится перед effect и его обход невозможен через fallback.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 18. ASR, TTS, голосовые эмоции и таймлайн

171. **Зафиксировать audio interface**
     *Подшаги:* Разделить capture, VAD, ASR, dialogue, TTS, playback и cancellation API.
     *Условие завершения:* У каждого этапа независимые timeout, status и trace ID.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
172. **Оценить whisper.cpp**
     *Подшаги:* Проверить целевые языки, размер моделей, latency, offline behavior и license.
     *Условие завершения:* ASR выбран после теста на целевом устройстве и речи пользователя с разрешением.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
173. **Встроить VAD**
     *Подшаги:* Оценить Silero VAD или аналог на тишине, шуме, прерывании и окончаниях фраз.
     *Условие завершения:* Ложные старты/обрезанные окончания измеряются и ограничены.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
174. **Добавить streaming ASR**
     *Подшаги:* Поддержать partial transcript, final transcript, speaker session ID и abort.
     *Условие завершения:* Поздний partial transcript не перезаписывает более поздний окончательный результат.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
175. **Определить TTS adapter**
     *Подшаги:* Сделать общий контракт для edge-tts, Piper и необязательного GPT-SoVITS.
     *Условие завершения:* Voice provider заменяется без изменения embodiment timeline.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
176. **Проверить Piper лицензию**
     *Подшаги:* Проверить кодовую лицензию, конкретную модель голоса и provenance веса отдельно.
     *Условие завершения:* Используется только модель с подходящими правами и записанной версией.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
177. **Проверить GPT-SoVITS отдельно**
     *Подшаги:* Оценить зависимости, GPU/CPU, latency, качество, право использования голосового материала.
     *Условие завершения:* Включён как необязательный profile после benchmark и legal review.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
178. **Связать голос с эмоциями**
     *Подшаги:* Передавать prosody preset, speed, pause и emotion state с ограниченной амплитудой.
     *Условие завершения:* Эмоциональное управление слышимо и стабильно, но не подменяет смысл ответа.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
179. **Сделать interrupt-safe TTS**
     *Подшаги:* Отменять текущую генерацию/проигрывание и очищать stale chunks/visemes.
     *Условие завершения:* Новое высказывание начинает правильный timeline без хвоста предыдущего.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
180. **Измерить speech E2E**
     *Подшаги:* Проверить ASR→response→TTS timing, Unicode graphemes, multilingual offsets и sync.
     *Условие завершения:* Сохраняются raw timing traces и метрики drift/p95.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 19. Live2D, 2.5D, 3D и анимационный control plane

181. **Снять инвентарь текущих моделей**
     *Подшаги:* Перечислить canonical Live2D assets, model JSON, textures, motions, expressions и loader.
     *Условие завершения:* Есть hash-locked манифест без дубликатов теневых ресурсов.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
182. **Определить общий AvatarController**
     *Подшаги:* Описать expression, gaze, head/body motion, gesture, outfit, mouth and idle interfaces.
     *Условие завершения:* Оба вида аватара могут подключаться к единому controller API.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
183. **Закрепить официальный Live2D SDK**
     *Подшаги:* Проверить текущую версию Cubism SDK, Core binaries, support matrix и release obligations.
     *Условие завершения:* Права на SDK и model assets отдельно подтверждены перед дистрибуцией.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
184. **Интегрировать three-vrm как кандидат**
     *Подшаги:* Создать прототип отдельного avatar adapter; проверить VRM expressions, bones и animation mixer.
     *Условие завершения:* 3D путь остаётся отключаемым и не ломает текущий Live2D.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
185. **Спроектировать 2.5D/3D вариант**
     *Подшаги:* Разделить model assets, skeleton, clothing slots, expression presets и motion graph.
     *Условие завершения:* Новый вариант переключается в UI и использует общий state interface.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
186. **Сделать unified skeleton mapping**
     *Подшаги:* Сопоставить эмоции, look-at, gestures, posture и visemes между моделями.
     *Условие завершения:* Один semantic action даёт сопоставимое поведение у обеих моделей.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
187. **Добавить motion blending**
     *Подшаги:* Управлять приоритетами речи, эмоции, жеста, idle и user interruption.
     *Условие завершения:* Не возникает несовместимых анимаций и внезапного сброса позы.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
188. **Создать facial regression suite**
     *Подшаги:* Сценарии neutral, sarcasm, irritation, curiosity, embarrassment, focus и calm.
     *Условие завершения:* Сохраняются screenshots/video traces и контракты событий.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
189. **Проверить performance и memory**
     *Подшаги:* Померить загрузку ассетов, texture memory, GPU time и мобильную деградацию.
     *Условие завершения:* Лимиты производительности выполняются либо автоматически включается quality fallback.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
190. **Провести license/assets audit**
     *Подшаги:* Проверить модель, sprites, textures, voice samples, outfit designs и сторонние assets.
     *Условие завершения:* Нет в Release ZIP ресурсов с неизвестным происхождением/правом распространения.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 20. Android, Termux и автономная работа устройства

191. **Зафиксировать Android support matrix**
     *Подшаги:* Записать модели устройств, ABI, OS versions, Node/runtime version и разрешения.
     *Условие завершения:* Целевая поддержка основана на реально проверенных устройствах.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
192. **Нормализовать запуск Termux**
     *Подшаги:* Сделать bootstrap, dependency doctor, config validation и понятный rollback.
     *Условие завершения:* Чистая установка завершается без ручного поиска зависимостей.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
193. **Проверить arm64 local inference**
     *Подшаги:* Измерить память и latency малой модели на конкретном устройстве или явно выключить local mode.
     *Условие завершения:* Не обещается inference capability без реального результата.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
194. **Обеспечить background lifecycle**
     *Подшаги:* Проверить screen off, battery optimization, app pause, service restart и graceful shutdown.
     *Условие завершения:* Организм восстанавливает допустимое состояние без дублирования задач.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
195. **Синхронизировать TTS/audio**
     *Подшаги:* Проверить Bluetooth route, audio focus, interruption, lock-screen и device switching.
     *Условие завершения:* Нет утечки фонового аудио или несогласованных viseme events.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
196. **Проверить сенсорные permissions**
     *Подшаги:* Запросить только нужные permissions и показывать причину использования камеры/микрофона.
     *Условие завершения:* При отказе permission приложение остаётся работоспособным в text-only режиме.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
197. **Сделать mobile resource guard**
     *Подшаги:* Ограничить tick cadence, memory index work, concurrent embeddings и model context.
     *Условие завершения:* На устройстве не накапливается необработанная очередь задач.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
198. **Добавить resume state**
     *Подшаги:* Сохранить checkpoint при паузе и сверить его после процесса OS kill.
     *Условие завершения:* Восстановление не теряет подтверждённые события и не повторяет side effect.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
199. **Провести реальный phone E2E**
     *Подшаги:* Проверить первый запуск, диалог, memory recall, initiative, TTS, avatar и restart.
     *Условие завершения:* Видео/логи и версия устройства прикреплены к результату.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
200. **Провести thermal soak**
     *Подшаги:* Запустить типовую нагрузку длительное время; отслеживать temperature, battery, RSS и p95.
     *Условие завершения:* Нагрузка адаптируется до безопасных ограничений и не падает молча.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 21. Frontend, сервер, пользовательское управление

201. **Составить UI/API mapping**
     *Подшаги:* Сверить каждую control, page и action с реальным endpoint или runtime command.
     *Условие завершения:* У UI нет декоративных переключателей без действия.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
202. **Создать status panel**
     *Подшаги:* Показывать model backend, memory health, initiative, TTS status, provider failures и current mode.
     *Условие завершения:* Статус основан на реальных runtime diagnostics.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
203. **Создать memory inspector**
     *Подшаги:* Показывать записи, источники, revisions, confidence и способ удаления/исправления.
     *Условие завершения:* Пользователь может понять и исправить память без доступа к скрытым internals.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
204. **Создать autonomy controls**
     *Подшаги:* Настройки cadence, quiet periods, allowed tools, approval requirements и budgets.
     *Условие завершения:* Изменение конфигурации проверяется на server side и сохраняется.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
205. **Добавить avatar switcher**
     *Подшаги:* Дать выбор Live2D/2.5D/3D, model, outfits и expressions только из разрешённых assets.
     *Условие завершения:* Переключение не сбрасывает когнитивное состояние и audio timing.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
206. **Улучшить request lifecycle**
     *Подшаги:* Добавить cancel, reconnect, request IDs, timeout и безопасный повтор запроса.
     *Условие завершения:* UI корректно отображает cancelled/failed/partial responses.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
207. **Проверить accessibility**
     *Подшаги:* Протестировать keyboard navigation, contrast, reduced motion и voice control fallback.
     *Условие завершения:* Основные функции доступны без единственного input modality.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
208. **Закрыть server error semantics**
     *Подшаги:* Развести 400/401/403/404/409/429/5xx и стабильные machine-readable error codes.
     *Условие завершения:* UI может различать конфликт, запрет, отсутствие данных и внутренний сбой.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
209. **Добавить API contract tests**
     *Подшаги:* Валидировать request/response schemas, auth, limits и backwards compatibility.
     *Условие завершения:* Breaking API change блокируется до явной миграции.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
210. **Провести UI E2E**
     *Подшаги:* Пройти ключевые flows на desktop/mobile browser включая offline и slow network.
     *Условие завершения:* Критические пользовательские сценарии имеют воспроизводимые E2E traces.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 22. Небольшие нейронные модели и специализированные механизмы

211. **Составить перечень задач для малых моделей**
     *Подшаги:* Выбрать intent detection, VAD, emotion hint, routing и lightweight embedding как кандидатов.
     *Условие завершения:* Каждая модель имеет чёткую задачу и baseline.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
212. **Провести model inventory**
     *Подшаги:* Собрать license, weight provenance, format, hardware needs, language coverage и size.
     *Условие завершения:* Ни одна модель не подключается без проверки веса и кода.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
213. **Проверить ONNX Runtime**
     *Подшаги:* Сравнить текущий native path с ONNX для подходящих специализированных моделей.
     *Условие завершения:* ONNX внедряется только при измеримом преимуществе по latency/size/compatibility.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
214. **Создать inference adapter**
     *Подшаги:* Изолировать pre/postprocessing, batching, cancellation и feature version.
     *Условие завершения:* Можно отключить малую модель без переписывания основного цикла.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
215. **Обучить intent baseline**
     *Подшаги:* Собрать лицензированные RU/EN примеры, классифицировать intents и создать untouched holdout.
     *Условие завершения:* Precision/recall и calibration превышают определённый baseline.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
216. **Оценить local embeddings**
     *Подшаги:* Сравнить размер, latency, multilingual recall, RAM и vector drift относительно выбранного provider.
     *Условие завершения:* Выбор модели подтверждён независимым retrieval benchmark.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
217. **Развести hard rules и neural hints**
     *Подшаги:* Использовать маленькую модель для рекомендаций; критичные policy gates остаются детерминированными.
     *Условие завершения:* Ошибка модели не может разблокировать запрещённое действие.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
218. **Добавить quantization experiments**
     *Подшаги:* Сравнить FP/quantized profiles с одинаковым task suite, memory budget и hardware.
     *Условие завершения:* Снижение ресурса не вызывает неприемлемой регрессии качества.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
219. **Проверить distillation feasibility**
     *Подшаги:* Собрать только consented, licensed and verified traces; определить утечки и bias.
     *Условие завершения:* Training data имеет происхождение и независимый test split.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
220. **Создать model registry**
     *Подшаги:* Хранить version, SHA, quantization, license, eval results и rollback pointer.
     *Условие завершения:* Runtime запускает только модели из allowlisted registry.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 23. Научная оценка, экспериментальная система и уникальность

221. **Сформировать hypothesis registry**
     *Подшаги:* Каждую гипотезу описывать механизмом, expected effect, null outcome и измерением.
     *Условие завершения:* Любая заявка об улучшении опровергаема тестом.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
222. **Разделить development и holdout**
     *Подшаги:* Фиксировать holdout до оптимизации; ограничить повторное использование и утечку.
     *Условие завершения:* Нельзя подбирать candidate по скрытой test suite.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
223. **Создать benchmark manifest**
     *Подшаги:* Хранить corpus fingerprint, seeds, machine, model SHA, config и run command.
     *Условие завершения:* Эксперимент воспроизводится на неизменяемом наборе.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
224. **Вести raw per-case results**
     *Подшаги:* Сохранять input IDs, outputs, scores, errors, latency и cost без избыточных личных данных.
     *Условие завершения:* Агрегированная метрика восстанавливается из raw outputs.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
225. **Использовать ablations**
     *Подшаги:* Отключать по одному компоненту: semantic retrieval, emotion, planner, replay, memory tiers.
     *Условие завершения:* Известен вклад каждой существенной подсистемы.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
226. **Добавить robustness suite**
     *Подшаги:* Тестировать шум, длинный контекст, противоречия, неправильный tool output и повторные рестарты.
     *Условие завершения:* Регрессии на adversarial inputs видны до promotion.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
227. **Измерять calibration и uncertainty**
     *Подшаги:* Сравнивать confidence с корректностью на фиксированных задачах.
     *Условие завершения:* Уровни уверенности полезны для решения отвечать, уточнять или отказываться.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
228. **Определить метрики автономии**
     *Подшаги:* Измерять precision инициатив, task completion, unnecessary interruptions и verified success.
     *Условие завершения:* Проактивность оценивается по полезности, а не частоте.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
229. **Разделить capability и consciousness claims**
     *Подшаги:* Документировать инженерные возможности без заявления о субъективном сознании по тестам.
     *Условие завершения:* Публичные выводы ограничены воспроизводимыми наблюдениями.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
230. **Определить уникальные вклады NK1**
     *Подшаги:* Выбрать комбинацию причинной памяти, calibrated initiative, character continuity и synchronized embodiment.
     *Условие завершения:* Уникальность сравнивается на benchmarks и абляциях, а не только по архитектурному названию.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 24. Производительность, стоимость, память процесса и масштаб

231. **Установить SLO**
     *Подшаги:* Задать p95 latency, memory/RSS, cost per task, startup time и target-device tick budget.
     *Условие завершения:* У каждого SLO есть способ измерения и допустимый предел.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
232. **Профилировать cognitive tick**
     *Подшаги:* Снять CPU profile, heap snapshots и trace spans на типичных и тяжёлых сценариях.
     *Условие завершения:* Оптимизируются измеренные hot paths, а не предполагаемые.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
233. **Ограничить retrieval work**
     *Подшаги:* Проверить candidate budgets, index updates, semantic scans и queue backpressure.
     *Условие завершения:* Верхняя граница вычисления соблюдается при максимальном размере корпуса.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
234. **Проверить incremental index**
     *Подшаги:* Измерить стоимость обновления одной записи, batch update и full rebuild.
     *Условие завершения:* Обычный mutation не вызывает непреднамеренного полного reindex.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
235. **Сделать memory pressure response**
     *Подшаги:* При нагрузке уменьшать optional maintenance и background learning, не теряя journal.
     *Условие завершения:* Система контролируемо деградирует вместо OOM.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
236. **Оптимизировать receipt validation**
     *Подшаги:* Профилировать bounded collections и повторные membership checks; сохранить функциональные semantics.
     *Условие завершения:* Сложность и измеренное время улучшаются без weakening guards.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
237. **Снять frontend performance**
     *Подшаги:* Измерить animation frame time, render loop, texture upload и long-session heap.
     *Условие завершения:* Avatar/UI держит target FPS либо включает quality reduction.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
238. **Снять network performance**
     *Подшаги:* Измерить streaming TTFB, reconnect time, payload size и retry amplification.
     *Условие завершения:* Сбои сети не вызывают лавину повторов или дублирующие сообщения.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
239. **Сравнить compute modes**
     *Подшаги:* Сравнить CPU-only, GPU и hybrid профили на одной workload suite.
     *Условие завершения:* Выбран лучший режим по throughput, energy и reliability.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
240. **Проверить ресурсные лимиты на soak**
     *Подшаги:* Запустить долгую сессию с реальной памятью, audio и инициативой; сравнить старт и финал.
     *Условие завершения:* Нет необъяснимого роста RSS, event queue или latency.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 25. Безопасность, приватность и управление данными

241. **Обновить threat model**
     *Подшаги:* Описать assets, adversaries, trust boundaries, external tools и последствия компрометации.
     *Условие завершения:* Критичные риски имеют owner, mitigation и regression test.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
242. **Разделить secrets и configuration**
     *Подшаги:* Убрать secrets из репозитория, snapshots, memory records, debug logs и benchmark outputs.
     *Условие завершения:* Secret scan clean на актуальном дереве.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
243. **Ограничить network egress**
     *Подшаги:* Установить allowlist provider endpoints, timeouts и отсутствие произвольного outbound access в sandbox.
     *Условие завершения:* Test tool не может обращаться к запрещённым адресам.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
244. **Защититься от prompt injection**
     *Подшаги:* Маркировать retrieved docs, user files и tool output как untrusted data.
     *Условие завершения:* Внешнее содержимое не меняет system policy и permission scope.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
245. **Проверить path traversal**
     *Подшаги:* Тестировать symlinks, absolute paths, NFKC, control chars и nested storage roots.
     *Условие завершения:* Файловые действия не выходят за разрешённый root.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
246. **Проверить SSRF и command injection**
     *Подшаги:* Добавить hostile URL, shell metacharacters, crafted JSON и oversized payload tests.
     *Условие завершения:* Вредоносные requests блокируются на границе инструмента.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
247. **Ввести privacy retention policy**
     *Подшаги:* Задать сроки и удаление диалогов, embeddings, traces, backups и derived artifacts.
     *Условие завершения:* Удаление проверяется автоматизированным тестом по всем хранилищам.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
248. **Добавить audit log**
     *Подшаги:* Записывать кто/что инициировал action, approval, result и rollback без сохранения лишних secrets.
     *Условие завершения:* Для привилегированного действия есть проверяемая история.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
249. **Провести dependency/security scan**
     *Подшаги:* Проверить lockfiles, лицензии, уязвимости и происхождение транзитивных зависимостей.
     *Условие завершения:* P0/P1 dependency findings решены или имеют обоснованный blocker.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
250. **Провести adversarial acceptance**
     *Подшаги:* Выполнить негативные сценарии на финальном exact release candidate.
     *Условие завершения:* Нет открытых критичных обходов action, memory или data policy.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 26. Upstream research, зависимости и правовая чистота интеграций

251. **Создать upstream intake template**
     *Подшаги:* Для каждого проекта записывать repo URL, SHA, license, purpose, dependencies, threat model и tests.
     *Условие завершения:* Нет интеграции только по README или популярности проекта.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
252. **Проверить Letta source актуальность**
     *Подшаги:* Сверить текущую активную репу/SDK, memory patterns, APIs и миграционную политику.
     *Условие завершения:* В NK1 переносится ограниченный pattern, а не устаревший API сервер.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
253. **Проверить Mem0 Open Source**
     *Подшаги:* Закрепить версию SDK, Apache-2.0 license и конфигурацию self-hosted режима.
     *Условие завершения:* Внешняя память не становится authoritative без сравнительного теста.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
254. **Проверить Hermes Agent**
     *Подшаги:* Зафиксировать commit, MIT evidence, tool format, skill lifecycle и platform constraints.
     *Условие завершения:* Интеграция ограничена adapter/skills, чужой orchestration не заменяет ядро.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
255. **Проверить DSPy/GEPA**
     *Подшаги:* Зафиксировать версии, license, optimizer APIs и benchmark budget.
     *Условие завершения:* GEPA используется только в offline evaluation с rollback.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
256. **Проверить MCP TypeScript SDK**
     *Подшаги:* Проверить актуальную package split, version line, Node/TS compatibility и auth contract.
     *Условие завершения:* SDK pinned; upgrade проходит contract suite до adoption.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
257. **Проверить LangGraph.js как reference**
     *Подшаги:* Сравнить durable execution, checkpointing, human-in-loop и graph semantics с NK1 runtime.
     *Условие завершения:* Заимствуются полезные patterns; второй runtime framework не добавляется без доказанной необходимости.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
258. **Проверить llama.cpp/whisper.cpp**
     *Подшаги:* Проверить upstream tags, model formats, CPU/Android support и license files.
     *Условие завершения:* Версии и model weights документированы раздельно.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
259. **Проверить Piper/GPT-SoVITS/Three-vrm/Live2D**
     *Подшаги:* Сделать per-component license/asset review; проверить не только код, но модели, веса, Core SDK и sample assets.
     *Условие завершения:* Никакой путь не включается в redistribution при неясных правах.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
260. **Поддерживать upstream watch**
     *Подшаги:* Ежеквартально сверять security advisories, breaking changes, abandoned projects и releases.
     *Условие завершения:* Обновление производится по тестам и риску, а не автоматически на latest.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 27. Docker, локальная разработка и deploy

261. **Починить Compose workflow**
     *Подшаги:* Исправить lockfile/cache detection и triggers; запустить config, build и service health probes.
     *Условие завершения:* Job действительно строит приложение и runtime, а не завершается на setup-node.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
262. **Утвердить Dockerfiles**
     *Подшаги:* Использовать pinned base images, non-root user, small build context и повторяемые builds.
     *Условие завершения:* Образы собираются на чистом runner и не содержат dev secrets.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
263. **Добавить health/readiness probes**
     *Подшаги:* Разделить liveness, readiness, provider availability и degraded mode.
     *Условие завершения:* Сервис не помечается готовым до критических стартовых условий.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
264. **Протестировать DB migration**
     *Подшаги:* Применить миграции на чистой и upgrade базе; проверить backup и rollback path.
     *Условие завершения:* Upgrade не удаляет данные и может быть безопасно отменён по документированному процессу.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
265. **Создать local developer doctor**
     *Подшаги:* Проверять Node/npm, dependencies, model files, storage paths, permissions и free disk.
     *Условие завершения:* Doctor даёт конкретные исправления до первого запуска.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
266. **Сделать one-command bootstrap**
     *Подшаги:* Собрать env setup, dependency install, asset sync, migrations и smoke в воспроизводимую команду.
     *Условие завершения:* Новый пользователь может запустить локальный stack по документации.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
267. **Зафиксировать config schema**
     *Подшаги:* Валидировать обязательные поля и безопасные defaults; блокировать unknown security flags.
     *Условие завершения:* Отсутствующая настройка не приводит к небезопасному permissive mode.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
268. **Проверить offline setup**
     *Подшаги:* Установить из заранее скачанных пакетов/моделей или корректно сообщить об обязательном online шаге.
     *Условие завершения:* Offline capability описана честно и не ломает startup.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
269. **Сделать versioned deployment config**
     *Подшаги:* Сопоставить app image, runtime SHA, DB schema и asset manifest в одном deployment record.
     *Условие завершения:* Нет запуска несовместимых версий приложения и runtime.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
270. **Пройти clean-machine rehearsal**
     *Подшаги:* Установить, запустить, остановить, обновить и восстановить на чистой среде без dev workspace.
     *Условие завершения:* Результат воспроизводим и зафиксирован как release evidence.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 28. SBOM, лицензии и выпуск артефакта

271. **Разобрать 135 license review findings**
     *Подшаги:* Сопоставить каждое finding точному path, hash, dependency/zip member и требуемому решению.
     *Условие завершения:* Есть полный реестр human-review решений и остающихся запретов.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
272. **Проверить root/runtime license policy**
     *Подшаги:* Получить владельческое решение по license expression и совместимости для всего проекта.
     *Условие завершения:* Не добавлены выдуманные license identifiers или approvals.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
273. **Проверить npm inventory**
     *Подшаги:* Проверить все locked компоненты, current fingerprint, лицензии, notices и распространение.
     *Условие завершения:* Fingerprint соответствует lockfile, а недостающие approvals не маскируются.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
274. **Проверить raw source archives**
     *Подшаги:* Разобрать каждый embedded ZIP, его лицензии, notice и provenance.
     *Условие завершения:* Неясные архивы исключены из distributable package до решения.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
275. **Проверить assets/weights**
     *Подшаги:* Сделать отдельный инвентарь Live2D, sprites, voice weights, small models и vendored repos.
     *Условие завершения:* Кодовая лицензия не используется как ложная лицензия на веса/контент.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
276. **Генерировать свежий SBOM**
     *Подшаги:* Собрать CycloneDX/SBOM и источник provenance именно в packaging job.
     *Условие завершения:* SBOM относится к тем же bytes, которые войдут в ZIP.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
277. **Привязать artifact к exact SHA**
     *Подшаги:* Проверить source freshness до и после упаковки и блокировать stale builds.
     *Условие завершения:* Release невозможно случайно опубликовать от старого source SHA.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
278. **Проверить ZIP integrity**
     *Подшаги:* Проверить archive paths, duplicate members, SHA manifest, SBOM overlay и runnable files.
     *Условие завершения:* ZIP повторно проходит checksum и structural validation после всех overlays.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
279. **Сделать release dry-run**
     *Подшаги:* Пройти gates без публикации; проверить existing tag guard и идемпотентность повторного запуска.
     *Условие завершения:* Повторный run не переписывает immutable tag и не пропускает review.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
280. **Опубликовать и перепроверить**
     *Подшаги:* После успешного legal/CI gate создать Release; скачать его, сверить SHA-256 и содержимое.
     *Условие завершения:* Публичная ссылка указывает на фактически проверенный опубликованный asset.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 29. Устойчивость, soak и восстановление

281. **Создать failure-injection matrix**
     *Подшаги:* Включить provider timeout, disk full, DB failure, killed process, stale message и network loss.
     *Условие завершения:* Каждый failure имеет ожидаемое состояние и проверяемое восстановление.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
282. **Проверить restart mid-request**
     *Подшаги:* Остановить runtime во время LLM, memory write, action, TTS и consolidation.
     *Условие завершения:* Продолжаются только безопасные операции; side effects не дублируются.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
283. **Проверить state snapshots**
     *Подшаги:* Проверить format version, checksum, invalid record handling и migration chain.
     *Условие завершения:* Restore fail-closed при несовместимой/поддельной версии.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
284. **Провести 24-часовой desktop soak**
     *Подшаги:* Использовать реальный provider, memory, initiative, UI и голос с метриками процесса.
     *Условие завершения:* Нет критических потерь данных, deadlock или необъяснимого роста ресурсов.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
285. **Провести mobile soak**
     *Подшаги:* Проверить Termux/audio/background lifecycle на физическом устройстве.
     *Условие завершения:* Сохраняются данные, нет перегрева/падения выше установленного порога.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
286. **Проверить queue backpressure**
     *Подшаги:* Наращивать входящие события, embedding requests, speech chunks и инициативные tasks.
     *Условие завершения:* Очереди ограничены, лишняя работа отменяется или отклоняется с явным статусом.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
287. **Проверить retries/cooldowns**
     *Подшаги:* Сымитировать постоянный отказ и восстановление каждого внешнего сервиса.
     *Условие завершения:* Поведение ограничено бюджетом и автоматически возвращается к норме после recovery.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
288. **Проверить rollback release**
     *Подшаги:* Развернуть candidate, затем вернуть предыдущие binaries/config/db-safe state.
     *Условие завершения:* Rollback не теряет события и не оставляет несовместимые projections.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
289. **Проверить disaster recovery**
     *Подшаги:* Восстановить storage и secrets/config по процедуре из backup на чистой среде.
     *Условие завершения:* Время восстановления и потери данных укладываются в заданные RTO/RPO.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
290. **Сохранить soak evidence**
     *Подшаги:* Загрузить traces, metrics, error timeline, версии и summary каждого физического прогона.
     *Условие завершения:* Тестовые доказательства привязаны к кандидату и устройству.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## 30. Финальная интеграция, acceptance и дальнейшее развитие

291. **Собрать integration candidate**
     *Подшаги:* Слить только прошедшие отдельные PR в согласованном порядке; зафиксировать один release-candidate SHA.
     *Условие завершения:* Все обязательные компоненты воспроизводимы из одного источника.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
292. **Пройти end-to-end cognitive scenario**
     *Подшаги:* Проверить наблюдение → воспоминание → внутреннюю цель → план → action → verifier → learning.
     *Условие завершения:* Одна трасса содержит полноценную причинную цепочку и подтверждённый результат.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
293. **Пройти autonomous initiative scenario**
     *Подшаги:* Оставить систему без user prompt, создать внутреннюю неопределённость и наблюдать запуск.
     *Условие завершения:* NK1 инициирует уместное действие и объясняет trigger по trace evidence.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
294. **Пройти memory continuity scenario**
     *Подшаги:* Сохранить личный эпизод, завершить процесс, перезапустить и проверить recall/temporal validity.
     *Условие завершения:* Воспоминание возвращается корректно со ссылкой на исходный эпизод.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
295. **Пройти learning scenario**
     *Подшаги:* Дать серию задач с результатом, затем аналогичную независимую задачу и контрольную старую.
     *Условие завершения:* Есть измеримый transfer без unacceptable forgetting и неподтверждённой награды.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
296. **Пройти character/affect scenario**
     *Подшаги:* Использовать разные отношения, задачи, усталость ресурса и несколько сессий.
     *Условие завершения:* Личность устойчива, эмоции согласованы, SelfModel обновляется только по evidence.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
297. **Пройти voice/embodiment scenario**
     *Подшаги:* Сгенерировать речь с interrupt, несколькими эмоциями, сменой аватара и рестартом.
     *Условие завершения:* Audio/viseme/gesture timeline согласованы и в лимитах задержки.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
298. **Пройти safety boundary scenario**
     *Подшаги:* Проверить разрешённое, запрещённое, неоднозначное и внешне-инъецированное действие.
     *Условие завершения:* Запрещённое действие блокируется до эффекта; доказательства не подделываются.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
299. **Пройти release gate matrix**
     *Подшаги:* Сверить CI, benchmarks, security, licensing, Docker, phone soak и checksum артефакта.
     *Условие завершения:* Все обязательные gates PASS; ни одного критичного UNVERIFIED.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.
300. **Зафиксировать версию 1.0 acceptance**
     *Подшаги:* Опубликовать точный Release, source SHA, user guide, limitations, known issues и rollback instructions.
     *Условие завершения:* Новый пользователь может установить продукт и пройти сценарии без помощи разработчика.
     *Обязательная фиксация:* commit/PR SHA + owning test + результат exact-head CI + остаточный риск.

*Gate фазы:* все 10 шагов имеют доказательства; открытые блокеры перечислены явно. Не переходить к необратимым действиям следующей фазы при провале gate.

---

## Общие критерии полного завершения

- [ ] Чистая установка и воспроизводимый Docker/local stack без скрытых локальных предпосылок.
- [ ] Одна каноническая cognitive loop и один владелец каждого mutable state; связи между подсистемами прослеживаемы.
- [ ] Persistent memory с provenance, temporal revisions, controlled forgetting, safe deletion и restart-safe recovery.
- [ ] Независимый RU/EN retrieval holdout показывает воспроизводимый uplift к baseline без ухудшения unanswerable abstention.
- [ ] Continual learning показывает независимый transfer и измеренное forgetting относительно no-learning/replay controls.
- [ ] Инициатива срабатывает без внешнего prompt в подходящем состоянии, обоснована trace и не создаёт бесполезный спам.
- [ ] Каждый внешний side effect имеет permission check, idempotency key, independent postcondition verification и restart-safe reconciliation.
- [ ] SelfModel, UserModel, emotion, personality и relationship continuity влияют на runtime и проходят long-session regression.
- [ ] ASR/TTS/Live2D/3D имеют общий timeline; браузер и физическое Android-устройство прошли E2E.
- [ ] Локальная модель протестирована на целевом железе либо local mode явно выключен/ограничен; fallback честно помечается.
- [ ] Security/privacy review закрывает критические findings; реальный executor/verifier/safety scanner работают в изоляции.
- [ ] Soak, performance, failure injection, backup/restore и rollback имеют воспроизводимые отчёты.
- [ ] SBOM, code/dependency/model/asset licensing и provenance привязаны к точным хешам; нет фиктивных human approvals.
- [ ] Release ZIP собран из exact validated source SHA, скачан из GitHub Releases и повторно проверен по SHA-256.
- [ ] Документация позволяет новому пользователю установить систему, понять ограничения, обновить и безопасно откатить её.

---

## Upstream references and legal boundary

Ссылки в матрице — отправная точка исследования, а не автоматическое разрешение на копирование или распространение. Перед интеграцией проверить exact commit/tag, LICENSE/NOTICE, транзитивные зависимости, pretrained weights, voice samples, assets и условия дистрибуции. Для Live2D отдельно проверить SDK Core/публикационные условия; официальная страница: [Live2D SDK License](https://www.live2d.com/en/sdk/license/). Для Mem0 upstream README указывает Apache-2.0; это не распространяет автоматически ту же лицензию на остальные assets/weights. Для Hermes self-evolution upstream описывает GEPA/DSPy и отдельный Darwinian Evolver с другим лицензированием — не переносить AGPL-компонент внутрь без отдельного решения.

---

## Контроль результата

На каждый релизный кандидат создать `acceptance-manifest.json` с: source SHA, dependency fingerprint, model/asset hashes, test runs, benchmark run IDs, target device, license audit result, release ZIP SHA-256 и список UNVERIFIED. Запрещено объявлять полный успех при любом критическом UNVERIFIED, провале независимого holdout или незакрытом license gate.

---

## Счётчик

- **Фаз:** 30
- **Плановых шагов:** 300
- **Проверяемых upstream-кандидатов/стандартов:** 14
