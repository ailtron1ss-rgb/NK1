# Нейро Курису — карта очистки архива и глубокий разбор первого исходного проекта WILL

**Дата анализа:** 13 октября 2026 года  
**Каноническая база:** `Neuro_Kurisu_WORKPASS34_2026-10-13.zip`  
**SHA-256:** `028b59733a23661a6a85f4e2aac99fbf71ab05f9a99029b994d2fb7ec3f3ce74`  
**Статус Library:** архив сохранён в `/Нейро Курису/Neuro_Kurisu_WORKPASS34_2026-10-13.zip`.

> Цель документа — не завести ещё один отчётный цикл, а определить безопасный порядок реальной интеграции исходного кода и структурного уменьшения архива. Никакие уникальные исходники, исторические отличия, Legacy UI или Live2D-ресурсы нельзя удалять только потому, что они выглядят старыми или похожими.

## 1. Что было проверено

Архив открыт программно; CRC-проверка ZIP завершилась без ошибки. Инвентаризированы все **12 806 файловых записей**. Для сравнения содержимого использованы SHA-256 по реальным байтам файлов, а не только совпадение имён. Для выбранного проекта WILL дополнительно рассмотрены package metadata, исходные модули, ключевые алгоритмы agency/memory/PMA/replay, адаптеры в runtime Нейро Курису, ссылки из `OrganismCore`, integration tests и provenance.

| Показатель | Результат |
|---|---:|
| Размер WorkPass34 | 230 620 644 байта (≈220 МиБ) |
| Распакованный объём файлов | 387 427 376 байт (≈369,5 МиБ) |
| Файловых записей в ZIP | 12 806 |
| Верхнеуровневый runtime `runtime/neuro-kurisu` | 4 219 файлов; 73,95 МБ до сжатия |
| UI `app` | 279 файлов; 29,17 МБ до сжатия |
| `legacy/` — версии, исходники, снимки | 7 268 файлов; 277,01 МБ до сжатия |
| `research/` | 800 файлов; 3,98 МБ до сжатия |
| `docs/` | 126 файлов; 2,52 МБ до сжатия |
| Вложенных ZIP/TAR.GZ | 13 |

Типы файлов представлены не только документацией: около 4 646 Markdown, 2 551 `.mjs`, 1 956 TypeScript, 1 780 Python, 813 JSON, 371 SQL, 138 TSX, а также модели/Live2D, изображения, PDF, DOCX, shell-скрипты и lockfiles. Значит оптимизация должна обрабатывать и код, и граф ассетов, и вложенные архивы, и build-инфраструктуру.

## 2. Сохранение архива в Library и выполненная безопасная очистка

Текущий WorkPass34 сохранён для повторного использования в любом чате по пути:

`/Нейро Курису/Neuro_Kurisu_WORKPASS34_2026-10-13.zip`

Чтобы высвободить место в Library, сравнили два старых архива по 119 150 018 байт: `Neuro_Kurisu_SUPER_FINAL_2026-10-06.zip` и `Neuro_Kurisu_SUPER_2026-10-05.zip`. Их SHA-256 полностью совпадал (`c20f35b53a1741f55f8f741f65ce0c0090c9e0b88837bb365e307b0b004aa202`). Более поздний `Neuro_Kurisu_SUPER_FINAL_2026-10-06_UPDATED.zip` сохранён: в нём присутствуют все 10 964 файла старого снимка, 10 947 из них побайтно идентичны, 17 отличаются и ещё 141 добавлен. Две дублирующие записи перемещены в корзину Library, а не удалены из текущего проекта. Сохранили единственную обновлённую историческую копию и новый WorkPass34.

Дополнительно подтверждено: отдельный Library-файл `grok-workspace.zip` совпадает по SHA-256 с копией внутри WorkPass34. Его не удаляли: сперва будем завершать source/provenance-карту, чтобы не потерять пользовательский удобный источник.

## 3. Карта компонентов: что и в каком порядке приводить в порядок

| Область/источник | Где находится | Роль и потенциальная ценность | План обращения |
|---|---|---|---|
| **Активный runtime** | `runtime/neuro-kurisu/` | Единственный исполняемый организм: память, действия, обучение, persistence, server/API | Сохранить как canonical source. Новые интеграции направлять сюда; не создавать параллельные владельцы |
| **Основной UI** | `app/` | Продуктовый интерфейс, публичные ресурсы и UI/API-контракты | Сохранить все реально используемые панели и поведенческие элементы; унифицировать источник ассетов после проверки сборки |
| **WILL** | `legacy/input-archives/will-main-2026-10-08/`, `legacy/input-archives/raw-source-archives/will-main.zip`, `runtime/neuro-kurisu/src/organism/integration/will/` | Agency pipeline, efference/reafference, portable mind artifact, replay, SDK/MCP, векторная память | **Первый проект для глубокой интеграции**; сначала соединить механизмы, затем устранить дублирующий развёрнутый слепок с сохранением оригинального ZIP и манифеста |
| **Hexis** | `legacy/input-archives/hexis-main-2026-10-08/` | Адаптивное ревью/аудит, происхождение данных, телеметрия и governance-механизмы | Оставить полезные адаптеры, но сделать MemoryOS2 и канонический event/outcome owner единственной истиной |
| **Lumina** | `legacy/input-archives/lumina-main-2026-10-08.zip`, `legacy/input-archives/raw-source-archives/lumina-main.zip`, интеграционные модули runtime | Browser/tool boundary, ограничения действий, инструментальная среда | Два одинаковых ZIP — SHA-256 совпадает. После проверки ссылок оставить один исходный архив и манифест; кодовые механизмы адаптировать к ActionGateway |
| **Letta** | `legacy/input-archives/letta-main-2026-10-08.zip`, `legacy/input-archives/raw-source-archives/letta-main.zip` | Идеи долгоживущей памяти, агентов и управления контекстом | Архивы по SHA-256 идентичны. Не встраивать рядом полную систему памяти; извлечь конкретные операции и перенести в MemoryOS2/context builder |
| **Conscio** | `legacy/input-archives/external-sources/conscio-4.8.2.tar.gz`, `ConscioAdaptationFabric` в runtime | Research/query pipeline, FTS5, объединение сигналов поиска | Сохранить полезный search fusion и source-lineage, убрать независимое дублирование индекса/истории там, где его может обслужить canonical MemoryOS2 |
| **NOMEGA Pass20** | `research/nomega-pass20/`, `legacy/input-archives/NOMEGA_PASS20_CAPABILITY_FORGE.zip` | Capability forge, перенос навыков, проверка компетенций, safety при transfer | Переносить компилятор навыков/transfer gates в единый skill lifecycle, не заводить второй forge/runtime |
| **NeuroCore V126/V143** | `research/neurocore-v143/`, `legacy/snapshots/neurocore-v126/`, вложенные архивы | Consolidation, causal/world-model и языковые механизмы | Сравнить с активными B/P-модулями по поведению, оставить уникальные полезные алгоритмы; старые деревья не удалять до кодового diff и извлечения уникального |
| **Kurisu v56** | `legacy/kurisu-v56/` | Старый UI, отдельные сервисы и публичные ресурсы | Разделить полезное поведение и старую структуру. Не заменять нынешний UI целым старым приложением |
| **Kurisu v9** | `legacy/kurisu-v9/` | Legacy-UI и оригинальные спрайты | 33 публичных sprite-пути совпадают по SHA с `app/public/sprites`; после проверки ссылок можно хранить один оригинальный пакет + build-time materialization |
| **Снимок runtime 35.30** | `legacy/snapshots/neuro-kurisu-35.30/` | Историческое состояние, полезные регрессии и отличающиеся алгоритмы | Сохранить уникальные версии. Строить blob/delta storage только после manifest-based восстановления |
| **Вложенные runtime 35.30 / 35.40** | `legacy/input-archives/Neuro_Kurisu_35.30...zip`, `...35.40...zip` | Исторические архетипы и промежуточные изменения | Не хранить бесконечно развёрнутые дубликаты целого приложения; сначала сравнить все paths и оформить delta + восстановитель |
| **Grok Workspace** | `legacy/input-archives/grok-workspace.zip` и самостоятельная копия в Library | Источник и сборочные/промежуточные артефакты | Сам архив одинаков; провести отдельную карту: что в нём действительно исходное/уникальное, а что просто зеркалирует текущий runtime |
| **Документы и отчёты** | корневые `WORKPASS*`, `docs/`, интеграционные отчёты | Решения, происхождение, статусы и контекст проекта | Свести к одному каноническому backlog, компактному changelog и provenance manifest; исторические отчёты можно архивировать снаружи основного релизного пакета |
| **Build/runtime-артефакты** | `.map`, старые `dist/`, профили, временные файлы | Иногда нужны для воспроизводимости/отладки, но часто дают большой объём | Проверить import/package path. Удалять build outputs только если source + команды build явно восстанавливают их, а runtime/release не зависит от файлов напрямую |

### Приоритеты

1. **WILL — первый функциональный source-code проект:** именно он пересекается с уже работающими действиями, памятью, outcomes и portable continuity. Глубокая интеграция даст реальное улучшение поведения и одновременно позволит убрать параллельные адаптерные реализации.
2. **Единый asset source:** Live2D и sprites — крупнейший быстрый резерв, но физические копии заменять одним canonical asset directory только вместе со скриптом восстановления в ожидаемые `app/public` и runtime public-пути.
3. **Снимки runtime → manifest/delta:** большой экономический эффект, но только после классификации 199 различающихся путей и 3 файлов, существующих лишь в старом снимке.
4. **Дублирующие source archives и распакованные зеркала:** оставить оригинальный source bundle и per-file hash manifest; распакованное дерево хранить, только если оно нужно разработке/поиску, или воспроизводимо материализовать скриптом.
5. **Документация, версии, build outputs:** оставить одну актуальную точку входа и один список работ; историю не терять, а вынести из основной release-загрузки либо хранить компактно в архиве истории.

## 4. Что показал поиск дубликатов и где можно уменьшить ZIP

SHA-256-аудит нашёл **3 890 групп одинакового содержимого**, в которых участвуют **7 882 пути**. Если каждый одинаковый blob физически хранить в архиве лишь однажды, расчётный резерв составляет около **49 804 462 байт (≈47,5 МиБ сжатого payload)** и около **84,5 МБ сырого содержимого**. Это верхняя оценка на уровне совпадающих байтов, а не разрешение немедленно удалить соответствующие пути: два одинаковых Live2D-файла могут обслуживать два независимых package root, и ссылки должны продолжить работать после распаковки.

Крупные подтверждённые группы:

- `texture_00.png` — четыре одинаковых копии в `app/public/live2d`, `runtime/neuro-kurisu/public/live2d`, снимке 35.30 и Kurisu v56; их сжатый повторный payload занимает примерно 24,3 МБ.
- `texture_00_mobile_2048.png` — три одинаковых копии; примерно 3,19 МБ повторного сжатого payload.
- `Kurisu.moc3` — четыре копии; примерно 1,29 МБ повторного сжатого payload.
- Lumina ZIP — два полностью одинаковых архива по 3 240 773 байта; можно хранить один экземпляр с ссылкой-паспортом на source archive.
- Letta ZIP — две полностью одинаковые копии по 24 683 байта; то же решение.
- Kurisu v9 sprites — 33/33 совпадающих публичных путей с `app/public/sprites` (сравнение по байтам). Сохранить исходный v9 bundle, а дублирующее распакованное дерево можно будет материализовывать сборочным скриптом.
- Вложенный `grok-workspace.zip` совпадает с отдельной Library-копией побайтно. Сам проект внутри WorkPass34 не удаляется.

**Безопасная целевая архитектура ассетов:** один `assets/source-of-truth/` или один оригинальный архив + `assets.manifest.json` (canonical path, SHA-256, media type, consumers, target paths) + детерминированный скрипт `hydrate-assets`. Скрипт восстанавливает ожидаемые `app/public` / runtime `public` пути перед сборкой. До появления этой механики удалять повторяющиеся Live2D/sprite-файлы нельзя.

## 5. Почему снимок 35.30 нельзя просто выкинуть

Сравнение `legacy/snapshots/neuro-kurisu-35.30/` с текущим `runtime/neuro-kurisu/`:

| Категория | Количество |
|---|---:|
| Файлов в старом снимке | 4 022 |
| Файлов в текущем runtime | 4 219 |
| Общие относительные пути | 4 019 |
| Полностью одинаковые файлы | 3 820 |
| Одинаковый путь, разное содержимое | 199 |
| Только в старом снимке | 3 |
| Только в текущем runtime | 200 |

Одинаковые 3 820 файлов занимают суммарно около 17,6 МБ сжатого payload в снимке, который потенциально можно разделять через blob store/delta. Но среди 199 изменённых файлов есть важные ядра (`OrganismCore.ts`, `MemoryOS2.ts`, `MemoryFabric.ts`, `StateMigrations.ts`, server handlers), а также большие reality graph/passport/coverage manifests. Три файла существуют только в снимке (`r7after.cpuprofile`, `NoopOperationalJournal.ts`, `tests/_tmp_handles.mjs`).

**Вывод:** весь snapshot нельзя удалять. Сначала формируем историю: canonical manifest per snapshot → shared blobs keyed by SHA-256 → per-version path/size/mode manifest → `restore-snapshot.mjs` с тестом восстановления байт-в-байт. До появления такого восстановителя текущий ZIP должен сохранять старый снимок целиком либо сохранять все differing/unique files отдельно.

## 6. Первый source project: WILL — что это за код

Оригинальный исходник: [`mindot-ai/will`](https://github.com/mindot-ai/will), пакет `@mindot/will` версии `0.10.0`, лицензия Apache-2.0. Официальный README позиционирует WILL как движок постоянного машинного агента с детерминированным tick, когнитивными факультетами и исполнительным контуром; npm-пакет публикует ту же версию и лицензию. Это внешнее описание проекта, а не доказательство, что каждая заявленная способность работает в целевом окружении.

В архиве находятся оригинальный `legacy/input-archives/raw-source-archives/will-main.zip` и развёрнутое дерево `legacy/input-archives/will-main-2026-10-08/`. Сверка показывает **606 из 606 внутренних файлов совпадают по относительным путям и SHA-256**; manifest `docs/integrations/WILL_SOURCE_PROVENANCE_2026-10-08.json` содержит SHA оригинального вложенного ZIP. Значит эти два представления можно в будущем сократить до оригинального архива + per-file manifest, если устранить потребителей, которым нужна текущая распакованная директория.

### Кодовые подсистемы оригинального WILL

| Подсистема | Файлы | Что ценно для Нейро Курису |
|---|---|---|
| Сборка единого разума | `src/stem/mind.ts`, `src/stem/assembly.audit.ts` | Явная composition root, единый граф владения движками, конфигурация provider roles |
| Agency pipeline | `src/cognition/agency/engines/affordance.synthesizer.ts`, `action.selector.ts`, `deliberation.engine.ts`, `motor.schema.executor.ts`, `reafference.engine.ts` | Разделение «что можно сделать», выбора, выполнения, предсказанного эффекта и обратной связи о реальном результате |
| Планирование и цели | `src/cognition/faculties/goal.manager.ts`, `planning.engine/*` | Приоритеты целей, прогресс, commitment, ревизия/завершение и связь плана с действиями без превращения плана в прямую команду исполнителю |
| Память и векторы | `src/cognition/memory/vector.embedder.ts`, `vector.adapter.ts`, `vector.index.ts`, `vector.content.ts` | Интерфейс embedder, batch indexing, lifecycle индексирования/удаления, детерминированный HNSW, разделение содержимого и индекса |
| Portable Mind Artifact | `src/pma/index.ts`, `src/pma/eval.ts` | Версионируемый portable artifact, миграции/загрузка и fidelity через поведенческие probes, а не только сравнение полей |
| Состояние и replay | `src/core/state.manager.ts`, `snapshot.manager.ts`, `replay.ts`, `event.log.ts`, `inbound.recorder.ts`, `completion.recorder.ts` | Повторяемость событий и входящих стимулов, восстановление, поиск причин расхождений после рестарта |
| LLM dispatch | `src/llm/gate.ts`, `routing.ts`, `summarizer.ts`, `wire.contracts.ts` | LLM как ограничиваемый компонент, routing по ролям и контрактам, а не бесконтрольная зависимость каждого шага |
| Поверхности | `src/surface/sdk/will.ts`, `surface/mcp/server.ts`, `surface/serve/server.ts`, `surface/channels/*`, `surface/cli.ts` | SDK/MCP/HTTP/channels как адаптеры над одним состоянием агента |
| Персистентная личность | `src/pma/*`, `src/cognition/identity.entity.ts`, `social.identity.ts`, `self.model.updater.ts` | Формат переносимости, границы identity и изменение self-model по свидетельствам |

Пакет имеет 199 TS/TSX-файлов в `src` и 256 файлов в `tests`; в `dist` присутствуют собранные JS и source maps. Встроенные optional channels не надо автоматически устанавливать в основной runtime: при интеграции переносим ограниченные контракты, сохраняя выбранные зависимости и их лицензии.

### Что в WILL уже перенесено в Нейро Курису

В `runtime/neuro-kurisu/src/organism/integration/will/` находятся `WillIntegrationBridge.ts`, `WillHnswIndex.ts`, `WillSdkFacade.ts`, `WillMcpJsonRpc.ts`, `WillChannelAdapter.ts`. В `OrganismCore.ts` мост реально вызывается при выборе кандидатов (около строки 6886), фиксации решения (около 6962), записи памяти в индекс (около 7481) и записи outcome (около 7956). Это не просто лежащие в архиве исходники: адаптер подключён к активному runtime, серверу и MCP-подобному endpoint.

Полезные существующие элементы моста:

- ограниченная очередь transport envelopes, acknowledgements, replay/dedupe и backpressure;
- bounded tamper-evident record chain;
- компактный экспорт continuity/PMA с fingerprint;
- entity dossier и conversation aims;
- контекстный budget ledger;
- агентный score adapter;
- SDK/MCP/channel façades.

Их следует **не удалять**, а привязать к canonical owners и избавиться от параллельного состояния.

## 7. Главные проблемы в текущей интеграции WILL

### 7.1. WILL agency применяется после конституционного выбора

В `OrganismCore.ts` сначала вызывается `p69ConstitutionalArbiter.arbitrate(...)` (около 6879), затем `willIntegration.rankCandidates(...)` (около 6886), после чего `selected` выбирается из `p69Decision.chosen` прежде, чем fallback `selectIntent(...)` (около 6903). То есть конституционный выбор уже сделан до изменения WILL score. При наличии `p69Decision.chosen` обновлённый score кандидата обычно не меняет выбранный ID. Это не повод позволять WILL обходить arbiter: правильная интеграция — подать ограниченный WILL bias **до** арбитража как один объяснимый сигнал, а P69 оставить единственным решающим/veto owner.

### 7.2. WILL хранит второй, несемантический векторный индекс

`WillIntegrationBridge.seededVector()` превращает символы/позиции текста в 32-мерный детерминированный hash vector. `indexText()` строит `WillHnswIndex`, хранит `vector.records` (bounded до 512) и обновляет собственные счётчики. Это полезно как deterministic fixture/benchmark, но **не является semantic embedding**. WorkPass34 уже имеет `LocalEmbeddingProvider` и семантический retrieval на canonical MemoryOS2. При этом `willSearchVector()` фактически вызывается серверным vector-search endpoint, а автоматический вызов в основном retrieval path не обнаружен; `indexText()` вызывается при создании памяти. Это создаёт параллельный индекс, не обязательно влияющий на обычное recall.

**Что сделать:** сделать `WillIntegrationBridge` фасадом к canonical retrieval (`MemoryOS2`/`MemoryFabric` + `LocalEmbeddingProvider`), сохранить старый endpoint и legacy-state migration, чтобы вызовы API не сломались. Оставить отдельный deterministic hash-vector только в benchmark/test fixture, ясно назвав его synthetic index и не выдавая за семантику. При забывании/слиянии/редактировании записи канонический индекс должен обновляться ровно одним событием.

### 7.3. Outcome/competence обучаются отдельным счётчиком

`WillIntegrationBridge.observeOutcome()` увеличивает uses/successes по имени action и обновляет `confidence01`. Поле `verified01` влияет на confidence, однако `successes` увеличивается и на непроверенном success. В сигнатуре нет `executionId`/`outcomeReceiptId`, следовательно защита от повторного учёта не выражена самим контрактом. В Нейро Курису уже есть `ActionGateway`, outcome classes, `OutcomeVerificationService`, `CanonicalTemporalCreditAuthority` и механизмы подтверждения/анти-double-credit.

**Что сделать:** WILL должен сообщать observation в единый canonical outcome loop с idempotency key и provenance. Счётчик компетенции повышается только после проверки/атрибуции результата; отказ политики отделяется от провала реального выполнения; duplicate/replay не выдаёт дополнительный credit. `WillCompetenceArtifact` становится projection/read model canonical skill competence, а не второй обучающей истиной.

### 7.4. Дублируются transport/outbox/idempotency контракты

WILL-bridge имеет собственные queue, pending/ack, replay, envelope dedupe и цепочку hash anchors. У основного runtime уже есть ActionGateway, HTTP, outbox/recovery, command receipt IDs и persistence migrations. Две очереди или два журнала могут независимо решить, выполнено ли действие.

**Что сделать:** оставить адаптеры WILL для SDK/MCP/каналов, но направить envelopes и эффекты через один canonical command/outbox. ID/receipt, ACK и replay должны ссылаться на одно execution identity. Record-chain WILL можно оставить как проекцию/аттестацию событий, но не как второй реестр выполнения.

### 7.5. PMA/fidelity — отдельный облегчённый формат

`WillIntegrationBridge.buildCompactPma()` формирует `schemaVersion: 1` и проверяет fingerprint/равенство ряда полей. Оригинальный WILL использует `PMA_SCHEMA_VERSION = 2` и `PMAEvalHarness`, который оценивает реконструкцию по behavioral probes/identity/skills/goal distributions. Нельзя считать lightweight PMA мостa напрямую совместимым с оригинальным форматом WILL только по имени. В runtime есть и другие элементы portable subject fidelity.

**Что сделать:** определить один канонический artifact schema, версионированные импорт/экспорт адаптеры к WILL PMA v2, миграции с сохранением неизвестных полей, проверку fingerprint и поведенческий fidelity harness. Выбрать одного владельца fidelity scoring, остальные проверки превратить в адаптеры/проекции. Не удалять ни один исторический PMA export до успешного обратного импорта.

### 7.6. Dossier, goals и контекстные бюджеты требуют маппинга, а не копирования

WILL имеет dossiers, open conversation aims и `recordContextCut`. В runtime Нейро Курису уже есть `KnownEntityDossier` с явным owner mapping на B288 social predictor / MemoryOS2 и bounded context budget. Перенос ещё одного полного объекта без mapping создаст конфликтующие trust/reputation/goal values.

**Что сделать:** связать WILL fields с canonical entity IDs, goal IDs и context-builder outputs. Разрешить WILL предоставлять signal/adapter, но не independent trust/goals/memory. Сохранять provenance при объединении и не перезаписывать факты смешанными значениями.

### 7.7. Подтверждённая проблема ранжирования — сортировка диагностическая, не окончательная

`rankCandidates()` сортирует локальный массив `rows`, обновляет `lastWinner/lastScores`, но возвращает исходный `candidates`. При этом score/utility мутируются на исходных candidate objects. Это может быть осознанным «bias adapter», но контракт метода выглядит как ranker, а фактически не возвращает отсортированный список. В текущем месте вызова возврат игнорируется. Необходимо выбрать чёткий контракт: `applyBoundedBias(candidates)` возвращает только обновлённые candidate scores или `rankCandidates()` возвращает новый упорядоченный массив — не смешивать две семантики.

## 8. Чего НЕ следует делать с WILL

- Не добавлять весь `@mindot/will` как второй runtime или второй «главный организм».
- Не переносить его 38 факультетов в виде ещё 38 параллельных модулей, если у Нейро Курису уже есть функциональные аналоги.
- Не включать его собственный vector DB рядом с MemoryOS2.
- Не считать названия `self-aware`, `semantic`, `competence` доказательством качества; переносить контракт/алгоритм, а не маркетинговый label.
- Не удалять `legacy/input-archives/will-main-2026-10-08/`, пока исходные ссылки/поиск не переведены на source archive + hash manifest.
- Не удалять LICENSE/NOTICE/авторство. Вложенный WILL — Apache-2.0; при переносе файлов и раздаче производных пакетов нужно сохранять LICENSE и требуемые уведомления.

## 9. План реализации: большие подходы

### WorkPass35 — WILL agency встраивается в единую политику

Переместить применение ограниченного WILL bias до P69 arbitration, но после формирования кандидатов и перед конституционным решением. П69 остаётся верховным veto/decision owner. Разобрать score transform так, чтобы bias был bounded, не накапливался между тиками и не мог протащить запрещённое действие. Сохранить explainability: base score, Will delta, final score, arbiter verdict.

### WorkPass36 — WILL reafference подключается к единому outcome-credit loop

Унифицировать `observeDecision`/`observeOutcome` с `executionId`, `stepId`, `outcomeReceiptId`, `verified`, `policyDecision`, `cause/provenance`. Одна верифицированная телеметрия обновляет canonical temporal credit, затем current skills/competence. Повтор после рестарта не обучает второй раз; policy denial не считается отрицательным опытом исполнения.

### WorkPass37 — один векторный retrieval и один индексный lifecycle

Направить Will search/bench endpoint в canonical `MemoryFabric`/MemoryOS2 и опциональный `LocalEmbeddingProvider`; удалить старый persisted `vector.records` только после миграции и сохранения совместимости сериализованных состояний. `indexText` заменить событием memory-index update/delete. Индекс является производным, восстанавливаемым из canonical memory; поднимать второй HNSW можно только если он даёт отдельную доказанную оптимизацию, не второй набор фактов.

### WorkPass38 — единый PMA и fidelity

Определить canonical PMA schema + versioned WILL import/export. Сохранить старые v1 exports миграторами. Перенести идею behavioral probes из `PMAEvalHarness`, чтобы оценивать не только идентичность JSON полей, но и восстановление goals, выбор действий, привычки и контекстной реакции. Один fidelity owner — другие реализации служат адаптерами.

### WorkPass39 — один event/outbox/replay path

Соединить Will SDK, MCP, channels и replay с canonical action/outbox. Envelope id, command receipt, ACK, external correlation ID и outcome должны ссылаться на одну сущность исполнения. Record-chain оставить bounded audit projection; replay должен использовать те же receipt IDs и canonical state migration.

### WorkPass40 — provenance + безопасный source-code shrink

После миграции runtime consumers создать per-file hash manifest для всех 606 WILL файлов, перенести ссылки в документах с expanded tree на raw source archive/manifest и добавить воспроизводимую команду материализации `extract-source will`. Только затем удалить *внутри основного ZIP* дублирующую распакованную копию `will-main-2026-10-08/`; оригинальный `will-main.zip`, лицензия, источники, tests и provenance остаются. Экономия оценивается по фактическому повторному compressed payload при сборке, а не по числу файлов.

## 10. Следующая очередь оптимизации архива после WILL

1. **Assets:** выделить один canonical source для Live2D и sprites, подготовить manifests и `hydrate-assets`/build hooks. Уменьшать архив только когда чистая сборка приложения и runtime может восстановить все ожидаемые пути; пользовательские Legacy/Live2D сохраняются.
2. **Historical snapshots:** сделать SHA-256 blob store + manifest + restore script. Начать с snapshot 35.30: 3 820 файлов можно ссылочно разделять, но 199 diff-paths, 3 snapshot-only файла и исторические source artifacts сохраняются отдельно.
3. **Source archive mirroring:** искать дубли `raw-source-archives/*.zip` против архивов с датированными именами и extracted tree. Одинаковые Lumina/Letta архивы уже подтверждены по SHA. У каждого сохраняемого проекта — один original archive, hash manifest, license/provenance, материализуемое дерево для разработки при необходимости.
4. **Старые промежуточные runtime ZIP:** сравнить 35.30/35.40 по path+hash, выделить изменённые файлы и reconstruction metadata. Не удалять изменившиеся файлы и не считать отчёты эквивалентными исходникам.
5. **Документация:** оставить краткий root README, один canonical backlog, один source inventory/provenance index и compact changelog. Старые отчёты WorkPass не смешивать с рабочим кодом; хранить историю отдельным архивом/каталогом документации.
6. **Build outputs и кэши:** проверить `dist`, source maps, cpu profiles, lockfiles, временные и сгенерированные отчёты. Удалять только при наличии установленного способа восстановления и при условии, что никакой runtime/build/installer не читает эти пути как вход.
7. **Packaging:** разнести release payload (исполняемый продукт + нужные assets), source provenance bundle и developer/archive bundle. При этом выдавать один полный consolidated master archive по запросу, который можно полностью восстановить из canonical files + manifests.

## 11. Границы безопасности при сокращении архива

Каждый файл перед переносом/исключением получает один из статусов:

- `CANONICAL_RUNTIME` — активный путь выполнения;
- `CANONICAL_UI_ASSET` — реально используемый публичный ресурс;
- `SOURCE_ORIGINAL` — неизменённый исходный архив проекта;
- `HISTORICAL_UNIQUE` — исторический файл, не совпадающий с текущей версией;
- `DUPLICATE_EXACT` — SHA-256 совпадает и назначение второго пути подтверждено;
- `GENERATED_REBUILDABLE` — полностью восстанавливаемый build output/cache;
- `UNKNOWN_KEEP` — назначение не установлено; по умолчанию хранить.

Сокращение делается только после одновременного выполнения трёх условий: (1) сохранён original source или file bytes; (2) все потребители обновлены и есть восстановитель нужного path; (3) архив после сборки проверен на наличие всех required paths и на одинаковые восстановленные байты. Если хотя бы одно условие не выполнено, unique/unknown-файл остаётся.

## 12. Открытые исследовательские источники

- WILL — https://github.com/mindot-ai/will и https://www.npmjs.com/package/@mindot/will (source, package metadata, Apache-2.0, PMA, agency pipeline).
- LangGraph persistence — https://docs.langchain.com/oss/python/langgraph/persistence (пример разделения checkpoint состояния выполнения и durable store; заимствовать принцип, не весь runtime).
- HippoRAG 2 — https://github.com/mo-linyuan/HippoRAG2 (ассоциативное multi-hop извлечение через граф; потенциально полезно позднее для MemoryOS2).
- Graphiti — https://github.com/getzep/graphiti (временной граф и инкрементальные обновления; изучить, прежде чем проектировать единый temporal memory graph).

## Итоговое решение

**Первым работаем с WILL.** В архиве есть полный исходник, тесты и уже встроенный adapter; поэтому это лучший участок, чтобы одновременно улучшить поведение агента и убрать несколько локальных дублей. Первый кодовый проход — не выкидывание файлов, а коррекция active integration: применить WILL agency до P69 arbitrate, объединить outcome credit, затем направить vector search к MemoryOS2/LocalEmbeddingProvider. После этого сохраняем `will-main.zip` как проверенный source original и только тогда сокращаем expanded mirror по manifest. Следующий отдельный крупный проход — canonical asset storage и build-time hydration.


## WorkPass35 correction — active asset paths

During the final packaged-tree check, `runtime/neuro-kurisu/public/sprites/` was found not to exist in the WorkPass34 input archive. The active legacy sprite path is `app/public/sprites/`; the canonical runtime's available public Live2D tree is `runtime/neuro-kurisu/public/live2d/`. WorkPass35 preserved all paths that actually existed in the input and did not synthesize a second runtime sprite directory.


## WorkPass35 implementation follow-up: verified WILL competence

The final implementation pass also closes an exploit-like learning defect: unverified `success` observations no longer increase WILL skill success rate or confidence. `verifiedUses` carries fractional verified evidence separately from raw observation counts; old snapshots without this ledger are restored with zero credited successes and neutral confidence. Tests cover both paths. The remaining high-priority issue is canonical receipt/idempotency across all reward/trust/causal consumers; this is not claimed solved.
