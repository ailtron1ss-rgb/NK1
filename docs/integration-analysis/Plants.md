<!-- Current execution baseline: WorkPass48 / runtime 35.69.0 / schema 225 (2026-10-16). User Library contains four original source archives under /Нейро Курису/Исходники; filenames and byte content are preserved. -->
# PLANTS — канонический стратегический документ Нейро Курису

**Версия документа:** Plants 1.2 · **актуальная линия кода:** `Neuro_Kurisu_WORKPASS48_2026-10-16.zip` · **последний runtime:** 35.69.0 / schema 225 · **актуализация:** 16 октября 2026 г.  
**Роль документа:** главный долговременный контекст для следующих инженерных проходов. Это не отдельный проект и не новый runtime, а рабочая конституция интеграции: откуда брать идеи и код, куда их встраивать, чем доказывать реальную пользу, чего не дублировать и как довести проект до релиза.

> **Основная цель:** превратить Нейро Курису в один целостный, эффективный и расширяемый цифровой организм: с рабочей агентностью, каузальным обучением на последствиях, долговременной памятью, само-моделью, управлением действиями, локальным inference, связью с интерфейсом и Live2D. Не имитировать функциональность пустыми модулями, названиями факультетов или документацией. Не заявлять наличие сознания или человеческого уровня понимания без проверяемых оснований.

## 0. Как следует использовать Plants

1. **Главная линия кода** — последняя пользовательски утверждённая/собранная линия WorkPass45 → WorkPass46 → WorkPass47 → WorkPass48; актуальный рабочий результат — `Neuro_Kurisu_WORKPASS48_2026-10-16.zip`. Внешние `.7z` и все содержащиеся в них ZIP — источники для выборочного переноса, сравнения и извлечения полезных алгоритмов; они не являются равноправными «главными» проектами. Четыре оригинальных `.7z` сохранены побайтно в Library: `/Нейро Курису/Исходники/{one,two,three,four}.7z`.
2. **Plants — канонический план интеграции**, а не замена текущим исходникам и не доказательство, что указанные работы уже выполнены. Перед каждым pass нужно обновить соответствие `source → canonical target → API → владелец состояния → UI → evidence` по реальному коду.
3. **Код прежде отчётов.** После первичной карты основная работа — реальные изменения существующего кода, связей, интерфейса и состояния; аналитические проверки должны занимать только объём, необходимый, чтобы не сломать интеграцию и подтвердить результат. Не создавать отдельные проходы, где результатом являются только новые проверки, каталоги и имитационные модули.
4. **Одна функция — один канонический владелец.** Новая интеграция должна подключаться к уже существующему owner через контракт/adapter, а не создавать параллельный runtime, memory store, tool executor или UI source of truth.
5. **Ничего не удалять по одному названию или только потому, что найден одинаковый хеш.** Сохранить Legacy, Live2D, лицензии, provenance, restore manifests и обратимость. Удаление допустимо только после проверки путей использования и доказуемого восстановления.
6. **Указывать покрытие честно.** Статический анализ текста, поиск символов и эвристики не равны полному человеческому пониманию каждой строки. В отчёте разделены: реальные открытые исходники и наблюдаемые детали; автоматически просканированные строки; доступные только метаданные; задачи будущей ручной проверки.

## Актуальное дополнение WorkPass48 (16.10.2026)

- **Повестка самостоятельного разговора:** существующий `AutonomousSocialInitiativeEngine` ранжирует темы из активных целей, подтверждённых learning memories, текущей рефлексии и curiosity по salience/freshness/source; близкие темы подавляются на 14 дней. Когда свежей допустимой темы нет, механизм ждёт.
- **Эмоция → выражение:** существующий appraisal даёт ограниченный confidence-gated `toneHint`; это временная модуляция формулировки, а не новая эмоциональная или личностная подсистема.
- **Социальная честность:** ACK UI означает доставку, но не положительную реакцию. `reciprocity01` не изменяется от одной только доставки; для обновления нужны настоящие данные об отклике.
- **Граница приватности:** один общий topic sanitizer применён перед выбором темы и при сборке recent-memory контекста для автономного языкового prompt; он отбрасывает типовые secrets, контакты и длинные числовые идентификаторы. Это не универсальная DLP-гарантия, поэтому текстовые контексты всё ещё должны оставаться ограниченными и помечаться как untrusted data.
- **Изменение кода/проверки:** runtime typecheck, queue/prompt/trait tests, personhood restore, social consolidation, server import and UI/API linkage audits passed. Schema остаётся 225; production app/browser/device/provider gates остаются открыты.

## Актуальное дополнение WorkPass47 (16.10.2026)

- **Новая сквозная возможность:** выбранная автономная тема теперь проходит через существующий `AutonomousSocialInitiativeEngine` → язык с каноническим профилем → durable ready-message → API → UI-чат со стабильным ID → ACK после сохранения в local chat cache.
- **Канал личности B:** по подходу WILL (MIT, `four.7z`) добавлена graded/evidence-gated проекция текущих trait values B270 в языковые prompts. B270 остаётся единственным owner numeric trait learner/action bias, `KurisuCanonProfile` — owner стабильных черт, новый адаптер лишь проецирует уже имеющиеся данные в текстовый self-observation. Нет второй persona engine и нет новых persistent schema fields.
- **Тело/Live2D:** взгляд и наклон головы получают детерминированные сигналы от активного режима/эмоции; для конкретного сообщения передаётся token запуска motion. Это первый поведенческий мост, а не завершённая модель тела: синхронизация с фонемами/реальной аудиоречью, физическим состоянием и браузерный E2E остаются открытыми.
- **Открытые релизные ворота:** production Vite build, реальный browser/Live2D E2E, long-idle initiative с настоящим language provider, restart/replay в app, real-device receipts, target-host inference, independent memory holdout, rollback и полный ручной license review не заявляются завершёнными.

## 1. Историческая оценка среза WorkPass46 (сведения WorkPass46 не переутверждают готовность WorkPass47)

### Что уже является сильной основой

- Проект имеет выраженное разделение: `runtime/neuro-kurisu` — канонический writable runtime организма; `app` — оболочка интерфейса React/Vite, которая показывает состояние runtime через HTTP API; `research` — изолированные исследовательские кандидаты; `legacy` — история/происхождение; `contracts` — контракты владения и интеграций; `tools` — запуск и инженерные операции.
- В действующем runtime уже есть значимые каркасы и реализации, а не только документация: `OrganismRuntime`, `OrganismCore`, `ActionGateway`, `CognitiveEventFabric`, `MemoryOS2`, `MemoryFabric`, адаптационные слои Hexis/Lumina/WILL и серверный API. Следующая ценность — связать и довести именно их, а не создать ещё один набор похожих подсистем.
- В проект встроены механизмы доказуемого восстановления и происхождения исторических файлов. Предыдущий cleanup описывает 21 Live2D shadow asset как генерируемые из канонического владельца, сохранение архивов, reversible duplicate removal и восстановление по хеш-локам. Это важно продолжать уважать.
- UI содержит реальные поверхность/компоненты: typed API, `AvatarStage`, `RuntimeAtlas`, `ResearchDock`, Legacy sprite fallback и Live2D asset sync. Значит, новые возможности должны добавляться как реальные доступные маршруты/контролы и достоверная телеметрия, а не невидимые классы.
- В WorkPass46 уже описаны release gates, scorecard и интеграционная матрица. Оценки из документов не равны автоматическому подтверждению релиза, но позволяют адресно фокусироваться на известных открытых разрывах.

### Что нельзя путать с готовностью

- Счётчики roadmap/WorkPass, файлы `capability passports`, архитектурный граф и заявленная связность сами по себе не доказывают, что реальный action доходит до внешнего устройства/провайдера, что memory write проходит единственный путь или что кнопка UI выполняет заявленную функцию.
- Исторические отчёты указывают WorkPass42 internal pass score **94/100**, weighted release roadmap **78%** и отсутствие release approval. Это характеристики, записанные в срезе, а не независимо заново выполненная оценка этой сессии.
- В срезе перечислены реальные P0-релизные пробелы: production dependency installation + Vite build + browser/Live2D E2E; реальные receipts провайдера/устройства, reconnect/replay и reconciliation неоднозначных исходов; clean-room rollback с fault injection. Среди P1: целевая производительность llama.cpp на GPU/CPU, независимый размеченный holdout для temporal retrieval, soak и ручной review лицензий.
- Synthetic retrieval lift в текущей записанной оценке равен **0**; это причина не продвигать новый vector backend только на основании названия или теоретической привлекательности.

## 2. Масштаб и качество аудита

### 2.1 Главный архив и вложенные архивы

Главный `Neuro_Kurisu_WORKPASS42_2026-10-14.zip` содержит **9 089 записей ZIP**, около **267.6 MB распакованного содержимого** по центральному каталогу ZIP. По дереву: `runtime/` — 4 218 записей; `legacy/` — 3 369; `research/` — 800; `docs/` — 374; `app/` — 261; `tools/` — 34; `contracts/` — 23 плюс корневые метаданные.

Дополнительно индексированы семь ZIP внутри основного проекта: NOMEGA Pass20, NeuroCore V126, NeuroCore V143, Grok Workspace, Letta snapshot, Lumina source и WILL source. Внешняя копия Letta встречается дважды и не должна считаться двумя разными реализациями.

Для WorkPass42 вместе с его семью вложенными ZIP машинно проиндексировано **11 726 записей**, успешно прочитано **11 440 текстовых файлов**, в основном архиве обработано около **3 583 070 строк текстового содержимого**; ещё **555 241 строка** приходится на встроенные ZIP, всего около **4 138 311 строк**. В главном архиве — **2 971 кодовый файл / 623 149 строк кода**; вместе со встроенными архивами — **4 182 кодовых файла / 862 268 строк кода**. Каталог хранит относительный путь, расширение, размер, CRC32, SHA-256 для прочитанных текстов, найденные определения/импорты, заголовки документов, короткий фрагмент и эвристические сигналы.

### 2.2 Четыре внешних исходных архива

- В исходных `.7z` находятся **22 ZIP-элемента**, включая дублирующий Letta snapshot; файловый индекс описывает **116 725 ZIP entries** и около **1.76 GB** суммарного распакованного объёма по инвентарю.
- Для содержательной автоматической выборки источников обработано около **106 738 недиректорных записей** (директории сохранены в полном метадатном индексе), прочитано порядка **96 137 текстовых файлов**, статически просканировано **82 605 кодовых файлов**, около **21 522 653 строк кода** и около **24 890 475 строк суммарного текстового содержимого**. В кодовый инвентарь включены имена объявлений и импорты, где они разбираются простыми правилами; это не полноценный AST-анализ и не компилятор.
- Весь читаемый first-party текстовый слой, в том числе 1.5+ млн строк AutoGPT, 3.4 млн строк Hermes по коду и 12.6 млн строк OpenClaw по коду, был обработан статически и индексирован по пути. Ограничения по бинарным файлам, vendor/generated paths и большим текстовым объектам явно отражены в аудите.
- **Это не означает, что человек семантически проверил вручную каждую строку всех 22 источников.** Содержимое было автоматически прочитано и статически просканировано; отдельные особенно важные исходники (WILL reafference/learning, Lumina dreaming/toolmaker/decay, Mem0 storage/extraction, Hyperon agent PoC, OpenAI guardrails, ключевые файлы Курису) дополнительно открывались и анализировались напрямую. Окончательное решение о переносе каждого модуля всё ещё требует source-to-canonical trace и контекстного review.

### 2.3 Важные созданные реестры

- `Plants_MASTER_FILE_INDEX.csv` — сводная строка на каждый файл/элемент внешних архивов плюс главный проект и содержимое его встроенных архивов. Это основной навигационный индекс.
- `Plants_INTEGRATION_MATRIX.csv` — решение по каждому из 22 source ZIP: приоритет, объём прочитанного кода, целевой модуль Курису, рекомендуемый режим и запрет на опасное копирование.
- `Plants_Audit_Package/FILE_LEVEL_AUDIT.csv` — file-level scan WorkPass42 и его embedded ZIPs.
- `Plants_Audit_Package/CODE_SYMBOL_IMPORT_CATALOG.csv` — символы/импорты по кодовым файлам главного проекта и вложенных архивов.
- `Plants_Audit_Package/UPSTREAM_SOURCE_FILE_AUDIT.csv` — внешний source file-level audit с `semantic_review_level`.
- `Plants_Audit_Package/UPSTREAM_CODE_CATALOG.csv` — сводный каталог символов/импортов внешнего first-party кода.
- `Plants_Audit_Package/EXACT_TEXT_DUPLICATES.csv`, `UPSTREAM_EXACT_TEXT_DUPLICATES.csv` и source-specific duplicate CSV — кандидаты на сравнение по SHA-256; сами по себе не являются разрешением удалить файлы.
- Предыдущий `Neuro_Kurisu_Полный_разбор_источников_WorkPass42.md` и `Neuro_Kurisu_Source_File_Inventory.csv` включены в полный комплект.

## 3. Каноническая архитектура: кто за что отвечает

### 3.1 Основной цикл

Ожидаемая сквозная схема должна выглядеть так:

`внешнее наблюдение / пользовательский ввод → нормализованное observation → cognition/prediction/appraisal/attention → память и цели → план/выбор candidate affordance → policy/competence/authorization gate → ActionGateway → реальный исполнитель или provider → подтверждённый outcome receipt → CognitiveEventFabric causal edge → learning/reafference → обновление навыка/самомодели/памяти → API projection → UI/Live2D`.

Каждая стрелка — отдельная интеграционная обязанность. Недостаточно, чтобы соседние модули существовали или обменивались похожими JSON: надо проверить correlation IDs, устойчивость к retry, отказам, задержкам, replay и ambiguous outcome. Обучение должно использовать результат реального действия, а не сам факт, что модель предложила его.

### 3.2 Runtime и координация

**`runtime/neuro-kurisu/src/organism/core/OrganismRuntime.ts`** — центральный coordinator/runtime: `init`, `step`, `stepInternal`, `autonomousStep`, `runAutonomousCycles`, `generateCognitiveProposal`, `executeTool`, проектные шаги, diagnostics/snapshots, grounding, voice/sleep/wake, captureCamera и consolidation. Проверить, что новый источник подключается через имеющийся жизненный цикл, а не запускает скрытый второй цикл агента.

**`runtime/neuro-kurisu/src/organism/core/OrganismCore.ts`** — ядро/фасад когнитивных механизмов и диагностики. Прежде чем реализовывать новую «способность», нужно найти её активный entry point/owner в OrganismCore/runtime и доказать, что функция там отсутствует.

**`runtime/neuro-kurisu/src/organism/system/ActionGateway.ts`** (425 строк в проверенной версии) — единственный исполнительный шлюз: регистрация и перечисление инструментов, авторизация, проверка доступности и компетенции, выполнение, idempotency, независимая проверка результата (если у инструмента есть verifier), durable ledger/архив, finalizer до completed receipt и восстановление ledger. Типы результата различают `unavailable`, `competence-insufficient`, `gate-check-failed`, `policy-refused`, `execution-failed`, `executed-unverified`, `executed-verified`, `idempotency-conflict` и ошибки recovery/storage/ledger capacity. Важнейшее правило: retry использует стабильный logical idempotency key, не новый случайный ID.

**`runtime/neuro-kurisu/src/organism/system/CognitiveEventFabric.ts`** (173 строки в проверенной версии) — ограниченный причинно-событийный ledger, который явно не позиционируется как второй владелец памяти/мира/целей. Поддерживает цепочку этапов observation, prediction, appraisal, attention, memory, goal, plan, action, outcome, learning и self-update; имеет bounded capacity, строгий restore и проверку обязательных parent edges операционного цикла. Проверить, что реальные ActionGateway receipts образуют причинную связь с outcome/learning.

### 3.3 Память — строго один владелец

**`runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts`** (более 1 000 строк) — каноническая политика/модель записи памяти: `MemoryResidencyGovernor`, `MemorySignalFusion`, `AdaptiveMemoryPolicy`, локальный embedding provider, epistemic status (`fact`, `belief`, `hypothesis`, `unknown`, `quarantined`), provenance classes (`device`, `external`, `user`, `agent`, `derived`, `simulation`, `unknown`), evidence sources, memory state, temporal query support, eviction witness.

**`runtime/neuro-kurisu/src/organism/memory/MemoryFabric.ts`** — общий facade/lifecycle. Есть команды `encode`, `revise-status`, `revise-content`, `update-signals`, `update-context`, `forget`, conflict/fingerprint handling, idempotent receipts/replay, lifecycle events, compatibility projections, recall/query, consolidation, snapshots/restore и conflict diagnostics. Важная задача — найти и исключить обходные write-paths. Нельзя позволять Mem0, Lumina, Hexis, Letta или старым адаптерам писать второй раз в самостоятельный persistent store.

**Условие для любого memory улучшения:** оно формализуется как candidate extraction/scoring/ranking/retention/summary algorithm, получает provenance/confidence, пишет через существующий lifecycle, сравнивается на одинаковом независимом labeled holdout с базовой системой и проверяется на ухудшение забывания/ложных воспоминаний. Только benchmark lift, latency/footprint и качественные ошибки решают промоушен.

### 3.4 Адаптация полезных идей уже частично реализована

**`runtime/neuro-kurisu/src/organism/integration/hexis/HexisAdaptationFabric.ts`** уже содержит evidence stance supports/contradicts, решения approve/correct/forget, belief revisions с prior/posterior confidence и trust, independent-source indication, temporal assertions/diffs, learning review, fidelity receipt, retention proposal, staged HMX intents, outbox claim/ack/reclaim и connector policy revoke. Не нужно копировать Hexis целиком; нужно проследить, какие команды доходят до MemoryFabric, какие сохраняются в snapshots и какие видны UI.

**`runtime/neuro-kurisu/src/organism/integration/lumina/LuminaAdaptationFabric.ts`** содержит риск-классы capabilities (`read_only`, `write_local`, `execute`, `browser`, `outbound`, `self_modifying`), каналы, confirmation requirement, allowlist, idempotency, target URL validation и IP/local target checks, search и diagnostics. Уточнить DNS rebinding/redirect/private-IP validation по всей сетевой цепочке и сделать результат авторизации наблюдаемым в ActionGateway/UI.

**`runtime/neuro-kurisu/src/organism/integration/will/WillIntegrationBridge.ts`** (порядка 500 строк) содержит vectors/context budgets/transport ACKs, record-chain digest, bounded queue, text indexing/search, deterministic ranking/benchmark, transport replay, PMA validation/import/export, competence artifacts и social entities. **`WillSdkFacade.ts`, `WillChannelAdapter.ts`, `WillMcpJsonRpc.ts`** дают host wrapper, нормализацию каналов и JSON-RPC façade. Наиболее важный разрыв — доказать, что реальные ActionGateway/host outcome receipts доходят до reafference/learning, а компетентность не деградирует из-за ошибочно трактуемых policy refusals.

### 3.5 Сервер, модель и инструменты

**`runtime/neuro-kurisu/src/server/server.mjs`** (~1 900 строк / ~142 KB в проверенной версии) формирует HTTP API, runtime lifecycle, process lock/state persistence, API security/rate limits, local OpenAI-compatible provider adapter и Will SDK/MCP/channel adapters. Настройки включают `KOBOLD_URL`, `LLAMA_CPP_URL`, `LLAMA_CPP_MODEL`, `LLM_TIMEOUT`, `REQUEST_TIMEOUT`, `MAX_BODY_BYTES`, host/port и ключи API. Проверить auth-by-default для опасных маршрутов, loopback/external bind behavior, payload limits, timeout/cancellation/streaming и реальный результат provider/device; не добавлять второй server/gateway из исходника.

Local inference: `llama.cpp` остаётся внешним process/server, а Курису владеет lifecycle, маршрутизацией, timeout, health, cancel, response-size bounds, model identity and fallback. Цель — корректная работа на целевом устройстве, включая GTX 1650 с 4 GB VRAM, а не перенос всей платформы C++ и не обещание невозможной пропускной способности. Измерять VRAM/RAM, latency/token rate, cold start, OOM, long-context, concurrency, cancellation и CPU fallback.

### 3.6 UI и воплощение

**`app/src/neuro-kurisu/api.ts`** — общий typed API client с `no-store` и обработкой HTTP errors. Новые surfaces должны использовать его, не создавать разрозненные прямые fetches со скрытой семантикой ошибок.

**`app/src/components/AvatarStage.tsx`** — проекция эмоций/выражений организма и Live2D readiness/error; cross-window сообщения ограничены собственным origin, при недоступности Live2D сохраняется Legacy sprite fallback. Не вычислять внутри UI когнитивное состояние, которое должен владеть runtime.

**`app/src/components/RuntimeAtlas.tsx`** — основные surfaces диагностики Runtime, Cognition/World, Memory/Learning, Identity/Social/Development. **`app/src/research/ResearchDock.tsx`** — read-only исследовательские bridge calls для NeuroCore V143, NOMEGA Pass20 и DeepCode; оно не должно promote/write в runtime.

Live2D: канонические модели/motions/textures принадлежат `runtime/neuro-kurisu/public/live2d`; `app/public/live2d` содержит app-owned viewer/vendor support и generated shadows. Generated mirrors формируются через `npm run assets:sync` перед Vite и удаляются `npm run assets:clean`. `app/src/legacy/avatar` плюс `app/public/sprites` — живой compatibility surface. Нельзя удалять эти пути, менять origin/postMessage или вводить второй источник эмоций ради уборки файлов.

### 3.7 Research и Legacy

`research/neurocore-v143`, `research/nomega-pass20`, `research/deepcode` — изолированные candidate implementations. `research/research_bridge.py` делает read-only probes через subprocess/Python imports. Проверить жёсткие timeout, минимальный env, запрет записи runtime и безопасные argv/cwd, но не соединять research напрямую с canonical write path.

`legacy/` — не мусорная папка. Это provenance, snapshots, compatibility, source archives, backups и восстановительные артефакты. Каждая чистка должна сначала доказать что live runtime/UI не импортирует файл, сохранена цепочка источника, manifests согласованы, restore гарантирован и path-specific LICENSE/NOTICE остаются.

## 4. Матрица доменов: как именно интегрировать

| Домен | Уже существующая база | Что брать из источников | Нужная реальная связка | Чего не делать |
|---|---|---|---|---|
| Агентность и навыки | `OrganismRuntime`, `OrganismCore`, WILL bridge, action policy | WILL reafference/outcome learning, bounded deliberation; Hermes/OpenClaw approval patterns | ActionGateway receipt → reconcile → outcome event → reafference/skill update → snapshot/restore → diagnostic/UI | Не создавать второй «Will runtime» или отдельный executor |
| Каузальная история | `CognitiveEventFabric`, runtime EventLog | Causal/receipt correlation, replay/parent edges | Stable event IDs, parent IDs, verified outcome stage and failed-action state all persisted | Не объявлять цикл рабочим лишь по синтетической цепочке |
| Память | `MemoryOS2` + `MemoryFabric` | Mem0 entity extraction/update/conflicts, Lumina dreaming/nightstand, Hexis evidence-linked beliefs, Chroma/FAISS ranking | One lifecycle write API, source/confidence/provenance, retention/evidence receipt, held-out ranking | No dual-write stores; no synthetic uplift claims |
| Убеждения/знания | Hexis adaptation + memory epistemic states | contradict/support and temporal revisions, evidence fidelity | Belief review becomes auditable MemoryFabric lifecycle command or read-only projection | No independent Postgres brain without architecture decision |
| Tool/capability security | ActionGateway, server ApiSecurityPolicy, Lumina adaptation | Agent SDK tripwire; Lumina staged toolmaker; OpenClaw/Hermes permissions and pairing | Preflight authorization + user confirmation + execution receipt + independently observed postcondition | No tool calls outside ActionGateway, no unreviewed generated code |
| Model/inference | local provider adapter / server | llama.cpp health/streaming/embeddings; provider failure/retry patterns | Stable model identity, cancellation, timeout, bounded response, health, target hardware fallback | No embedded fork of llama.cpp or provider-specific second router |
| UI / Live2D | React/Vite, RuntimeAtlas, AvatarStage, ResearchDock | UI ideas that surface runtime states and approvals | every new capability has typed API + visible status/error/approval + route to canonical method | no hidden-only capabilities, no dual model/assets owner |
| Multi-agent orchestration | Existing project steps / server | Agent Framework / AutoGen / Langroid / OWL / PocketFlow concepts | Reuse current project-step coordinator; delegate only with explicit typed task/outcome contract | No new generic framework without gap + benchmark |
| Self-improvement | WILL skill loop, research and evaluation infrastructure | Agent0 curriculum, DSPy offline optimization, Superpowers contributor workflow | isolated candidate → fixed data → measurable before/after → review/promotion/rollback | no online self-modifying production code/prompts without gate |
| Archival / provenance | existing restore manifests, source snapshots, contract docs | upstream license and revision provenance, hash-based restore | exact upstream revision, hash, file, license, transformation, target module, rollback record | no bulk copy, no deletion by similar filename/hash alone |

## 5. Постатейные решения по всем исходным проектам

Ниже — конкретное решение по каждому из 22 ZIP. Детали размеров, статически прочитанных файлов и строк продублированы в `Plants_INTEGRATION_MATRIX.csv`. Автоматические сигналы внутри этих исходников — только навигационные подсказки; они не являются подтверждёнными дефектами.

### 5.1 Agent0 — исследовательский контур самоулучшения

**Что изучать:** task/curriculum generation, sandbox boundaries, candidate executor, evaluation metrics and reproducible before/after comparisons. Важнейшее разделение — новый навык может быть предложен и оценён в isolated lab, но в production он не включается, пока не проходит стабильный holdout и promotion gate.

**Куда:** `research/` + существующий learning/skills path; отчёт/артефакты исследований должны иметь dataset revision, model revision, metric definition, baseline и variance.

**Не переносить:** RL/training heavy runtime в основного организма, не запускать незнакомый sandbox executor с доступом к файлам/сети без явного permission boundary.

### 5.2 AutoGPT

**Что изучать:** task orchestration UI, task/status events, logging, controlled trigger boundaries, audit trail. Classic repository line помечена как unsupported; не восстанавливать её как production base.

**Куда:** существующие project-step flow в `OrganismRuntime`, ActionGateway и Runtime Atlas. Встраивать только контракт, которого действительно нет.

**Лицензионная граница:** в `autogpt_platform` нужно отдельно просмотреть PolyForm Shield ограничения. Нельзя переносить её код, считая весь архив MIT.

### 5.3 Microsoft Agent Framework

**Что изучать:** event-driven middleware, workbench/tool contracts, structured handoff, tracing, provider abstraction and MCP/A2A boundaries. Это основной сравнительный источник для новых agent-runtime patterns вместо того, чтобы множить AutoGen-подобные реализации.

**Куда:** ActionGateway contracts, CognitiveEventFabric tracing/correlation, adapter interfaces. Не добавлять пакетный Python runtime в TypeScript-приложение без чёткого межпроцессного контракта и реального преимущества.

### 5.4 AutoGen

**Что изучать:** исторические message/topic/task patterns и error propagation. Использовать как дизайн-справочник, не основной фундамент.

**Почему:** README архива указывает maintenance mode и рекомендует Microsoft Agent Framework для новых разработок. Полный параллельный multi-agent runtime создаст конфликт владельцев orchestration.

### 5.5 Chroma

**Что изучать:** metadata filtering, candidate retrieval, indexing, queue/embedding management, hybrid retrieval. Поиск нужно тестировать не только на recall, но и на precision/temporal validity, token budget, latency, RAM/VRAM.

**Куда:** read-only retrieval adapter или ranker над индексом, жизненный цикл документов при этом остаётся у MemoryFabric. Промоушен только если независимый holdout показывает преимущество без роста ложных воспоминаний и unacceptable resource cost.

### 5.6 DSPy

**Что изучать:** signatures, evaluation-driven optimization, stable modules and reproducible comparison. Оптимизация prompts/programs должна быть офлайн и версиями.

**Куда:** исследовательский offline optimization pipeline, который выдаёт diff/артефакт для review и promotion. Нельзя allow live reward signals автоматически менять production system prompt.

### 5.7 FAISS

**Что изучать:** index structures и similarity search как экспериментальные альтернативы текущему retrieval. Учитывать CPU/target GPU availability, memory footprint, index persistence/versioning, cold-start и consistency.

**Куда:** candidate adapter за common retrieval interface. Не включать native bindings в основную сборку, если измеримый выигрыш не превосходит эксплуатационную сложность.

### 5.8 Hermes Agent

**Что изучать в первую очередь:** session resumption, tool permission models, skill/catalog surfaces, gateway/channel contracts, error handling и separation between configuration and active session state. Очень большой проект требует path-by-path selection.

**Куда:** `server.mjs`, ActionGateway, channel adapter, state persistence and UI status. Если путь не маппится на реальную открытую задачу, оставить как reference.

**Не переносить:** весь harness/CLI/TUI/web UI и второй agent lifecycle.

### 5.9 Hyperon / MeTTa

**Что изучать:** symbolic facts/rules, traceable derived statements and neuro-symbolic inference experiments. Конкретная agent implementation в источнике описывает себя как preliminary / incomplete PoC, поэтому никакое production качество ей не приписывается.

**Куда:** изолированный research adapter, возвращающий типизированные утверждения и происхождение вывода. Любые новые «факты» должны сохранять epistemic state и provenance через каноническую политику памяти.

### 5.10 Langroid

**Что изучать:** message-centric tasks, delegation, structured results and retrieval/tool integration. Переносить небольшие контракты там, где они упрощают текущий project-step coordinator.

**Не переносить:** всю Python task graph runtime и второй набор agent classes ради удобных имён.

### 5.11 и 5.18 Letta (две копии)

Это **маленький docs/metadata snapshot (16 записей с каталогами)**, не полный runtime. Обе внешние копии и copy внутри main project ранее проверены на byte identity: SHA-256 `5d28f152aba633fcc26fe20125fad28f73c6773e6526fc65249656b2d0c61075`. По нему можно фиксировать происхождение и смотреть на общую идею stateful agents, но не доказывать, что реализация memory/agent code из Letta уже импортирована.

**Решение:** одна provenance identity, не три реализации; не выдавать его за полный source review текущего Letta runtime.

### 5.12 llama.cpp

**Что изучать:** OpenAI-compatible server semantics, health, request/response limits, streaming/cancel, model metadata, embeddings endpoints and benchmark scripts. Runtime owns local provider adapter; inference engine runs externally.

**Куда:** local provider path in server/runtime, common Model Ecology abstraction, operational diagnostics in UI. Нужны холодный старт, steady-state token speed, peak VRAM/RAM, concurrency, cancellation, timeout/retry and CPU fallback data on the actual target hardware.

**Не делать:** vendoring huge C/C++ engine or building duplicate process controller inside multiple modules.

### 5.13 Mem0

**Что изучать:** entity extraction with provenance/confidence/position, normalization, update and conflict resolution, SQLite schema migrations/locking and graceful fallback when optional NLP dependency is absent. Это reference for algorithms and lifecycle discipline, not a second store.

**Куда:** MemoryOS2/MemoryFabric write/recall path: extraction candidate → validation/source classification → idempotent lifecycle command → evidence/receipt. Compare on same labeled set.

### 5.14 OpenAI Agents SDK

**Что изучать:** compact input/output guardrails, explicit tripwire outcome, delegation/handoff contracts and tracing correlation. The reviewed `src/agents/guardrail.py` returns types carrying `tripwire_triggered`; that maps to explicit stop behavior rather than a silent log.

**Куда:** authorization and pre/postcondition in ActionGateway; include rejection reason in outcome receipt and UI. Don’t add the full Python SDK execution engine to a TS host.

### 5.15 OpenClaw

**Что изучать:** channel routing, device/browser boundaries, pairing/auth, per-tool permissions, session persistence/resume, secret minimization, skill/package boundaries, input sanitation and exact failure statuses. Это самый большой источник по количеству файлов; копирование всего резко увеличит attack surface and maintenance cost.

**Куда:** current HTTP gateway/server and channel adapters. Keep a trace row for every code candidate and test the adapter against canonical ActionGateway rather than running external tools in a separate path.

**Не делать:** duplicate gateway/session manager/browser owner/skill system or bulk source copy. Security markers identified by static scans must be manually contextualized; names like `token` and `exec` in code/tests/configs can be legitimate.

### 5.16 Hexis

**Что изучать:** evidence-linked belief revision, trust source independence, temporal truth, fidelity receipt for compression/export and stale belief resistance. Its PostgreSQL/ACID memory+identity+goals model conflicts with MemoryOS2 single-writer rule if imported directly.

**Куда:** current `HexisAdaptationFabric`, with all approved changes converted to MemoryFabric lifecycle commands or remaining advisory/read-only. Audit snapshots, replay, claim/ack/reclaim and connector revocation paths.

### 5.17 PocketFlow

**Что изучать:** small graph-node/flow abstractions, retry semantics and dependency-light task structure. It may help simplify current workflow code, not justify a separate generic orchestration framework.

**Куда:** refactor existing project step execution only after actual code comparison shows fewer states/dependencies and clearer cancellation/receipt semantics.

### 5.19 Lumina

**Высокая ценность:** idle-triggered dreaming/consolidation (`core/dreaming.py`), central utility inference backend, isolated nightstand-like staging before curated memory, exponential temporal decay `w(t)=e^(-λt)` in `tools/temporal_decay.py`, and staged approval gate in toolmaker. Tool tests establish a critical invariant: creating a candidate tool must not execute untrusted code, and approval must not be directly callable by the agent.

**Куда:** consolidation policy through MemoryFabric/MemoryOS2 and action approval through ActionGateway, with a UI that shows candidate/approved/rejected states. Temporal decay must compete against utility, provenance, harm, redundancy and load-bearing memories rather than override them.

**Security edge:** review URL validation against private/local addresses, redirects and DNS rebinding all the way at execution time; a prevalidated hostname is not enough if resolved endpoint changes.

### 5.20 OWL

**Что изучать:** task automation, collaboration, search/MCP integration edges; use only adapter/contracts that solve a concrete missing use case. Avoid pulling in the full CAMEL-oriented dependency tree.

### 5.21 Superpowers

**Что использовать:** contributor workflow: plan, debug, review, compose small implementation slices and maintain clear acceptance criteria. Это developer process reference, not a Kurisu cognitive subsystem. Don’t add in-app “faculties” based on dev skills.

### 5.22 WILL

**Самый важный источник для agency/reafference gap:** `src/cognition/agency/engines/reafference.engine.ts` consumes `agency.outcome` and updates `LearnedSkill`, habits and prediction error; it mirrors learning entities for snapshots/restores and can reduce subsequent LLM recruitment when a behavior is predictable. `reconcile.learning.ts` derives outcomes from host acknowledgements and preserves refusal/finality/counterfactual metadata. `deliberation.engine.ts` keeps LLM choice within substrate-provided candidate affordances and has bounded fallback behavior.

**Куда:** existing `WillIntegrationBridge`, `WillSdkFacade`, `OrganismRuntime`, `ActionGateway` and `CognitiveEventFabric`. The highest value isn't to copy another organism engine; it is to prove the causal edge from the actual host action receipt to skill learning and persistence.

**Required semantic distinctions:** policy refusal ≠ low competence; execution failure ≠ user refusal; executed-but-unverified ≠ verified success; counterfactual outcome ≠ real observed result; duplicate ACK must be idempotent; one action receipt must not train twice.

## 6. Встроенные источники в WorkPass42 и что это означает

- `NOMEGA_PASS20_CAPABILITY_FORGE.zip` — 720 content rows in nested audit including manifests/doctor/module registry, ~67k lines; valuable for architecture-health / configuration provenance comparison, but registry JSON is not live runtime proof.
- `NeuroCore_V126_Consolidation_Decontaminated_2026-09-30.zip` — 808 content entries read, ~121.8k text lines; legacy snapshot/research lineage. Compare specific unique mechanisms only; do not re-promote duplicate NeuroCore code into active runtime.
- `NeuroCore_V143_FwPKM_Language_2026-10-01.zip` — 75 entries, ~13k lines; candidate language/semantic/temporal methods. Its research bridge remains read-only until independent results and explicit promotion.
- `grok-workspace.zip` — ~307 records in archive scan, ~67 MB expanded (website/app artwork/assets and generated outputs dominate). Preserve useful UI/user-facing patterns only after comparison with current React shell; don’t treat generated art or design doc as executable capability.
- embedded Letta ZIP — docs-only provenance snapshot, not full runtime.
- embedded Lumina ZIP — 109 file rows in nested scan, 70+ Python files, relevant dreaming/tool/decay reference; identical source also listed externally, so record one origin.
- embedded WILL ZIP — 606 file rows; source snapshot. Compare exact revision to external WILL source and active TS adapter; do not duplicate archive contents into active runtime.

## 7. Duplicates, version history and preservation policy

### 7.1 Known high-level cleanup facts

WorkPass42 documentation says 21 Live2D shadow files in `app/public/live2d` (~16.69 MB original bytes) were compacted into a generate-from-canonical workflow while canonical files remain under runtime public. It records two duplicate ZIP aliases removed while canonical source copies were preserved, 27 byte-identical same-relative-path sources removed with restorable preimages, 27 duplicate historical reports omitted, 68 old root reports moved unchanged into docs/history, and repaired manifest/snapshot references. These are descriptions of the archive’s own prior cleanup; don’t rerun the destructive pass blindly.

### 7.2 Internal exact text duplicate scan

The static audit found **2,359 SHA-256 groups** with repeated text files in WorkPass42 plus nested archives, including many empty `__init__.py` files, generated/snapshot content and asset/config duplication. A separate cross-scope merge of readable hashes across main/embedded/upstream sources found **3,895 groups across more than one archive** (8,903 indexed copies, including empty or tiny files). Exact text identity proves bytes match, not that path roles are interchangeable. Keep source version, path semantics, imports/references, package data, test fixtures and license/notice files in the decision.

### 7.3 Safe de-dup algorithm

1. Compute SHA-256 and content-type equality; CRC32 is only a cheap inventory check.
2. Identify canonical path and source origin/revision; check consumers/imports/config references and build packaging rules.
3. Decide whether the file is a generated shadow, historical source, fixture, license, data asset or active module. Same content can be deliberately duplicated across package roots.
4. Preserve immutable preimage and manifest entry with canonical restoration path.
5. Delete/move only one reversible group at a time; update manifests/contracts; rebuild asset mirrors; restore it in a clean temporary tree.
6. Record result and expected hash in provenance. If uncertainty remains, retain file and mark it for review.

## 8. Static scan signals: how to interpret them

Static scans use keywords/regular expressions for TODO/FIXME, placeholder/mock/synthetic, dynamic execution (`eval`, `exec`, `__import__`), shell process invocation and secret-looking string assignments. They are **navigation signals, not confirmed findings**. They will naturally match tests asserting that code is never executed, mocks in unit tests, legitimate dynamic language runtimes, env var names, documentation examples and fixtures. They require context review by path/line, reachability, untrusted-input provenance and call chain.

Prioritize review only when all of these apply: file is active first-party runtime; signal is on an executable path; attacker/user-controlled data can reach it; privilege/secrets/network/file access are meaningful; no explicit allowlist/sandbox or authorization boundary exists. Avoid bloated automatic check reports with no code change attached.

## 9. Security, reliability and performance priorities

### P0 — release-blocking end-to-end behavior

- Build the actual app after pinned dependencies are installed; test production Vite output and browser path through startup, Runtime API, Live2D load/readiness/fallback and error UI.
- Produce real—not synthetic—host/provider/device outcome receipts. Exercise disconnected provider, late timeout, tool executed but ACK lost, reconnect/replay, duplicate delivery, conflicting final result, cancellation and restore.
- Demonstrate ActionGateway idempotency and ledger persistence across process restart; uncertain external action must reconcile rather than blindly execute a new action with a fresh ID.
- Fault-inject rollback/restore in a clean-room copy with one broken archive blob, bad manifest hash and missing asset; ensure fail-closed and no destructive partial restore.

### P1 — capability/reliability quality

- Target hardware performance matrix for local inference: cold and steady state, concurrency, memory/VRAM, context length, cancellation, provider health/fallback.
- Independent labeled holdout for temporal/semantic retrieval. Include temporal facts, contradiction, source provenance, stale facts, ambiguous entities and deliberate unknowns. Report precision/recall/temporal correctness and false memory rate, not just aggregate lift.
- Real reconnect/replay soak for channel adapters; bounded queue behavior; idempotency and memory lifecycle conflict behavior.
- DNS/IP/redirect validation for Lumina/outbound capabilities; approval UX for execute/browser/outbound/self-modifying tools.
- Review nested licenses/notices and pin source revisions before code lands.

### P2 — useful but not launch blocker

- Offline agent skill curriculum and DSPy prompt optimization as isolated, reproducible research workflow.
- Candidate Chroma/FAISS retrieval only when benchmark demonstrates a real win within target memory/performance.
- Symbolic/MeTTa reasoning isolated behind an evidence contract; no autonomy claims.
- Developer workflow reuse from Superpowers; documentation only where needed to preserve durable knowledge.

## 10. План реализации: passes с кодом, зависимостями и критериями

Each pass below is a coherent engineering slice. A pass is successful when functionality has changed in the canonical source and can be exercised through a real runtime or user surface—not simply because a report or test file was added. Basic regression evidence is attached to each implementation but is not the bulk of the pass.

### Pass 0 — Establish the current code truth (small, one-time)

**Implementation focus:** pin baseline archive hash, verify current active routes/imports and which adapter files actually wire each existing capability; turn `Plants_INTEGRATION_MATRIX.csv` into a source-to-canonical queue. Avoid adding more architecture docs unless a discrepancy needs durable record.

**Deliverables:** active path map for ActionGateway receipt → CognitiveEventFabric → WILL reafference; MemoryFabric sole write paths; Hexis/Lumina decisions into canonical memory/action; UI API endpoints that render those diagnostics; model provider lifecycle. Record `ported/adapted/rejected/missing/unknown` for every high-priority source module.

**Done when:** every P0 feature has a source file owner, a live call path and a way to observe success/failure; any documentation claiming a capability without a live call path is marked honestly.

### Pass 1 — Finish causal outcome/agency loop (highest value)

**Canonical code:** `ActionGateway.ts`, `CognitiveEventFabric.ts`, `WillIntegrationBridge.ts`, `WillSdkFacade.ts`, `OrganismRuntime.ts`, relevant durable ledger and diagnostics.

Tasks:
1. Normalize action receipts into one typed outcome contract with stable `actionId` / idempotency key, decision ID, host receipt, execution state, verification evidence, timestamps, source, and refusal/failure classification.
2. Wire finalizer so receipt persistence completes before the event is exposed as final; make errors visible and recoverable.
3. Emit exactly one causal `action → outcome` edge; link `outcome → learning`; preserve parent/event IDs on snapshots/replay.
4. Deliver actual outcomes to WILL reafference after host ACK/verification, never merely on proposal, tool start, timeout or unverified completion.
5. Ensure repeated ACK/replay does not train twice; duplicate/late/conflicting ACKs resolve deterministically.
6. Preserve refusal/finality/counterfactual in reconcile logic; policy refusal is not evidence of poor skill; unavailable capability is not failed competence.
7. If result is `executed-unverified`, store the uncertainty and trigger reconciliation/observation rather than report success.
8. Persist and restore learned skill/habit/prediction-error data; verify reafference does not train against malformed or synthetic outcomes by default.
9. Surface causal events, final status and learning consequences in RuntimeAtlas or an existing diagnostic panel.

**Done when:** one real external action can be followed from decision ID through ActionGateway, durable ledger, verified/uncertain outcome, causal chain, one learning update and restore; retry/reconnect cannot execute/train twice.

### Pass 2 — Memory single-write consolidation (high value)

**Canonical code:** MemoryOS2.ts, MemoryFabric.ts, memory adapters and diagnostics.

Tasks:
1. Find every memory write path/import across runtime/adapters/research; funnel accepted writes through MemoryFabric lifecycle API.
2. Add/normalize provenance and epistemic state when external extractor proposes a memory; missing confidence/source becomes unknown, not silently fact.
3. Adapt selected Mem0 entity extraction and conflict signals behind a provider-neutral interface; handle missing NLP libraries without crashing main loop.
4. Adapt Lumina idle-dream summary only as a staging candidate; require provenance references and fidelity receipt; never directly overwrite curated memory with generated dream output.
5. Map Hexis approve/correct/forget learning review into MemoryFabric commands; advisory projections remain read-only until command receipts persist.
6. Track lifecycle receipt fingerprint conflict/replay and bounded journal behavior through snapshot/restore; no path bypassing idempotency.
7. Benchmark recall against existing baseline before turning on Chroma/FAISS candidate ranker; hold out temporal/contradictory examples.
8. Improve query explanation: returned memory IDs, provenance, temporal relevance/conflict and reason for ranking/omission; let UI show this without exposing hidden internals unnecessarily.
9. Fix memory budget policy against eviction of rare high-value, user-pinned or causal source data; temporal decay cannot be sole deletion criterion.

**Done when:** an observed or user-provided event can generate a typed candidate, pass conflict/provenance policy, persist once through MemoryFabric, restore with same identity, be recalled with justified ordering and be surfaced in UI; no second store is a source of truth.

### Pass 3 — Safe capabilities and toolmaker (P0/P1)

**Canonical code:** ActionGateway, LuminaAdaptationFabric, server ApiSecurityPolicy/PhoneRuntimePolicy and UI confirmations.

Tasks:
1. Create explicit risk tiers mapping to mandatory gates: read-only, local write, execute, browser, outbound, self-modifying.
2. Validate capability enablement/channel allowlist, caller identity, permission scope, confirmation and stable idempotency before execution.
3. Port Lumina staged candidate toolmaker behavior: create/inspect/test offline; explicit approval not callable by the agent; execution enabled only after approval and policy checks.
4. Port compact tripwire behavior: `blocked` is a terminal typed outcome, not log-only; distinguish pre-action refusal from post-action failure.
5. Enforce URL destination checks at connect/redirect time; validate DNS-resolved IP after each redirect and refuse local/private/reserved ranges unless a narrowly scoped local capability explicitly allows it.
6. Ensure no shell/dynamic execution can be reached from a user-generated tool without a sandbox, resource limits, denied network/filesystem by default and output cap.
7. Avoid secret values in traces: log credential class/identifier, not raw token; inspect `secret_literals_candidate` matches in runtime first.
8. Surface approval request/reason, risk tier, scope, status and failure to existing UI. No false green indicator until independent postcondition is true.

**Done when:** a malicious or unapproved tool candidate can be created and inspected but cannot execute; a user-approved narrowly scoped tool executes via ActionGateway, leaves a durable receipt and cannot bypass idempotency/policy on retry.

### Pass 4 — Provider reliability and local inference

**Canonical code:** server.mjs, Model Ecology/local provider adapter, diagnostics/API.

Tasks:
1. Normalize provider contract: `providerId`, `modelId`, context limit, capabilities, request deadline, stream support, health state, cancellation and last error class.
2. Implement strict request size/timeout limits, bounded streamed/complete response, abort propagation, cancellation cleanup, and provider failure classification.
3. Keep llama-server external; add health/model identity check and startup/connection diagnostics, never assume process availability from config presence.
4. Exercise CPU fallback and actual target GPU profile; record VRAM peak, load/unload behavior, first-token and tokens/sec at context sizes representative of the project.
5. Prevent retry amplification: one retry policy, backoff/jitter if necessary, bounded attempts, shared request correlation; no duplicated retry loop per adapter.
6. Test ambiguous timeouts when a remote provider may have processed a request; classify idempotent inference vs non-idempotent tool execution distinctly.
7. Add UI status for local model disconnected/loading/ready/degraded and actionable failure, preserving runtime operation in reduced mode.

**Done when:** server reports the correct model/provider, returns a bounded response or honest error, cancellation stops work, outage does not freeze autonomous loop, and measured footprint fits target hardware.

### Pass 5 — UI/Live2D end-to-end integration (P0)

**Canonical code:** `app/src/neuro-kurisu/api.ts`, RuntimeAtlas, AvatarStage, ResearchDock, asset sync scripts, canonical Live2D runtime public dir.

Tasks:
1. Build all new user-visible capability panels around typed `neuroApi` routes and existing route grouping.
2. Show real state (`ready`, `degraded`, `blocked`, `pending approval`, `unverified`, `error`) rather than hard-coded capability counts or optimistic UI.
3. Keep Live2D and Legacy sprite fallback; test canonical asset path, generated shadow sync, viewer startup, CORS/origin and postMessage boundary, motion/expression selection and error recovery.
4. Ensure emotion from runtime is a visual projection, not state authority; missing face/motion assets do not crash the runtime or hide a failed inference.
5. Give each new capability a UI route/control or a documented reason it's intentionally backend-only; user asked specifically that useful functionality be accessible through interface.
6. Label research bridge as read-only and show unavailable/timeouts without auto-promoting data.

**Done when:** clean installation builds, browser launches, runtime responds, Live2D loads (or safe fallback displays), one representative capability works from UI to runtime and back, all errors are visible.

### Pass 6 — Retrieval/learning evidence and candidate ranking

**Canonical code:** memory retrieval interfaces, benchmark scripts in research, diagnostics.

Tasks:
1. Freeze dataset/version labels (temporal fact, contradiction, provenance, ambiguity, unknown, irrelevant/no-answer); define leakage-safe holdout.
2. Run baseline with exact model/prompt/embedding/index versions; record latency, token usage, RAM/VRAM and output grading rubric.
3. Compare existing retrieval vs one candidate at a time (Mem0 logic, Chroma, FAISS, alternate decay); do not blend changes before attributing lift.
4. Use human-reviewed gold labels or carefully adjudicated datasets; synthetic-only wins do not count as release lift.
5. Measure precision, recall, contradiction handling, temporal correctness, unsupported-memory rate and missing-answer calibration; include regression slices by language/long-term age.
6. Promote only if meaningful lift exceeds noise and cost, and rollback when recall or false-memory rates regress.

**Done when:** reproducible, independent holdout evidence supports the selected strategy; if no improvement, keep simpler canonical implementation and close the candidate without stigma.

### Pass 7 — Research/self-improvement safely integrated

**Canonical code:** `research/`, agent skill/learning APIs, promotion metadata.

Tasks:
1. Let Agent0/DSPy generate proposed skill/prompt alternatives in isolated lab, with fixed dataset and seeds/config.
2. Keep Hyperon symbolic deductions separate from facts and beliefs; outputs carry rules/source/confidence/limitations.
3. Give every candidate a version, dataset/model identity, delta report, failure examples, licensing metadata and promotion/rollback decision.
4. On promotion, update the one existing runtime skill/prompt source; do not generate code in live runtime or create parallel cognitive faculties.
5. Use Superpowers principles only to structure developer passes, not as a runtime module.

**Done when:** an experiment can be reproduced, rejected, promoted and rolled back without an autonomous candidate writing directly into the active runtime.

### Pass 8 — Provenance, duplicate cleanup and legacy normalization

**Canonical code:** contracts/manifests, history directories, assets:sync/clean, snapshot restore tools.

Tasks:
1. Record upstream archive revision/hash and file path for each accepted algorithm/code chunk; keep license/NOTICE and dependency impacts.
2. Review all nested licenses (especially AutoGPT subtrees and native inference subcomponents) before transferring any code.
3. Add cross-reference for duplicate versions of WILL/Lumina/NeuroCore/Grok workspace files and state which copy is reference-only, active adapter or canonical asset.
4. Remove repeated bulky assets/reports only after referential/path role review and restore rehearsal; never clean source archives so deeply that research provenance disappears.
5. Keep README/current status/backlog/Plants aligned, but do not let reporting work dominate engineering changes.

**Done when:** each accepted external implementation can be traced, licensed, restored and removed without broken imports/assets/history.

### Pass 9 — Release candidate closeout

This is not a stand-alone test-building sprint. The work is to finish the real unresolved behavior and gather compact acceptance evidence for the candidate.

1. Install exact locked dependencies and produce production build artifact.
2. Clean-room install/startup; exercise core runtime, API, UI and Live2D/Legacy fallback.
3. Real provider/device/action path with outage, cancel, reconnect, duplicate ACK, ambiguous completion, replay and restore.
4. Clean-room fault-injected archive/ledger rollback and provenance checks.
5. Review license/NOTICE/SBOM and secrets; triage only meaningful active-path static scan signals.
6. Ensure the latest operational TODO and canonical backlog reflect real changed code, not test totals alone.

**Done when:** release gates are individually backed by actual artifacts/evidence, no P0 is merely described as done, and a rollbackable release package exists.

## 11. Конкретная очередь работ (100 пунктов)

Статусы ниже — начальные для следующего инженерного прохода, исходя из текущего анализа. Они не означают, что соответствующие исходники отсутствуют; `TRACE` означает проверить реальную связь/полноту, а не создать модуль заново.

### P0 — сначала

- [ ] P0-01: проследить путь `ActionGateway.executeTool` → durable ledger/finalizer → receipt consumer.
- [ ] P0-02: закрепить contract receipt: action/decision ID, idempotency key, host ack, verification, classification, timestamps, provenance.
- [ ] P0-03: проследить `CognitiveEventFabric` parent edges для реального действия, исхода и learning.
- [ ] P0-04: подключить verified host outcome receipt к `WillSdkFacade`/reafference без дублирующего вызова.
- [ ] P0-05: разделить policy refusal, unavailable, skill insufficiency, execution failure, unverified, verified result.
- [ ] P0-06: проверить replay ACK и late/conflicting ACK на exactly-once learning effect.
- [ ] P0-07: сохранить/восстановить learned skills/habits/prediction errors вместе с runtime snapshot.
- [ ] P0-08: пройти все persistent memory write imports и устранить обходы MemoryFabric.
- [ ] P0-09: выстроить UI диагностику причин действия и outcome; показать непроверенный исход честно.
- [ ] P0-10: установить production app dependencies из lockfile и получить реальный `vite build`.
- [ ] P0-11: clean-room UI startup, live Runtime API, Live2D ready/fallback и видимые ошибки.
- [ ] P0-12: проверить generated asset synchronization и path ownership без потери canonical Live2D.
- [ ] P0-13: fault-injection для durable action ledger, restore archive, manifests and asset rollback.
- [ ] P0-14: реальный provider/device outage → reconnect → replay → reconcile сценарий.
- [ ] P0-15: закрыть минимум один реальный сквозной сценарий интерфейс→runtime→действие→outcome→learning→UI.

### P1 — системная прочность

- [ ] P1-01: провести end-to-end трассировку всех high-priority WILL faculties до active host call path.
- [ ] P1-02: сравнить WILL candidate affordance constraint с существующей decision policy.
- [ ] P1-03: проверить компетентность/уверенность и защиту от обучения на отказах политики.
- [ ] P1-04: определить ledger retention/capacity and archive recovery policy.
- [ ] P1-05: проверка receipt/outbox claim/ack/reclaim/revoke в Hexis adaptation.
- [ ] P1-06: превратить Hexis approve/correct/forget в явные канонические lifecycle commands или оставить read-only.
- [ ] P1-07: классифицировать каждую интеграцию Hexis как active, projection, candidate или dead path.
- [ ] P1-08: проверить Lumina confirmationRequired для execute/browser/outbound/self-modifying tool types.
- [ ] P1-09: проверить URL target validation после DNS lookup и после redirects.
- [ ] P1-10: проверить запрет local/private/metadata address access для outbound capability.
- [ ] P1-11: провести toolmaker candidate creation без выполнения; негативный сценарий без approval.
- [ ] P1-12: унифицировать `blocked`/tripwire result в ActionGateway и видимом UI.
- [ ] P1-13: проверить sanitization/secret redaction в active runtime traces.
- [ ] P1-14: сделать retry/backoff единым, bounded и cancellation-aware в provider adapters.
- [ ] P1-15: нормализовать provider/model identity и health diagnostics.
- [ ] P1-16: проверить cancellation propagated to network request/local inference worker.
- [ ] P1-17: измерить llama.cpp latency/VRAM/RAM for target model sizes and context lengths.
- [ ] P1-18: проверить CPU fallback и восстановление после OOM/model disconnect.
- [ ] P1-19: проверить streaming response bounds and handling malformed partial frames.
- [ ] P1-20: собрать независимый temporal retrieval gold set.
- [ ] P1-21: описать benchmark baseline exactly: model/embedding/prompt/data/config.
- [ ] P1-22: сравнить candidate rankers one at a time; ничего не promote если lift = 0 / within noise.
- [ ] P1-23: memory contradiction and temporal validity errors visible in inspect API.
- [ ] P1-24: protect pinned/rare/high causal value memories from simplistic temporal decay.
- [ ] P1-25: проверить query/encode/revise/forget receipts on duplicate replay.
- [ ] P1-26: test clean restore of MemoryFabric/MemoryOS2 snapshots across schema versions.
- [ ] P1-27: проверить route authorization/rate limits/body caps on all active server endpoints.
- [ ] P1-28: ensure research subprocess receives minimal env, cwd and explicit timeout.
- [ ] P1-29: make browser UI show backend unavailable/degraded instead of optimistic state.
- [ ] P1-30: ensure every accepted new capability has a typed API and discoverable UI surface.
- [ ] P1-31: use the existing avatar state to reflect emotion only as projection, never as source of truth.
- [ ] P1-32: test Live2D readiness/error/cross-origin/postMessage paths without breaking sprites.
- [ ] P1-33: clean-room `assets:sync` and `assets:clean` idempotency.
- [ ] P1-34: review nested licenses for all files planned for transfer.
- [ ] P1-35: pin source repo commit/revision for WILL/Lumina/Mem0/Hexis candidates.

### P2 — measurable capability improvements

- [ ] P2-01: adapt Mem0 entity extraction contract only behind MemoryFabric.
- [ ] P2-02: compare entity normalizer against existing extraction on multilingual examples.
- [ ] P2-03: adapt Lumina nightstand/dreaming as isolated candidate queue.
- [ ] P2-04: attach source-memory IDs and evidence fidelity to every generated summary.
- [ ] P2-05: introduce utility vs recency tradeoff benchmark for temporal decay.
- [ ] P2-06: verify memory compaction preserves key entities, source, chronology and contradictions.
- [ ] P2-07: use Chroma only as optional read-only ranker behind an existing interface.
- [ ] P2-08: test FAISS CPU/GPU candidate only with measured gains and footprint.
- [ ] P2-09: compare hybrid metadata + vector retrieval against current baseline.
- [ ] P2-10: expose recall provenance and rank explanation in existing memory UI.
- [ ] P2-11: use Agent Framework handoff/trace concepts to simplify existing call contracts if needed.
- [ ] P2-12: evaluate PocketFlow patterns for reducing current workflow complexity, not adding another engine.
- [ ] P2-13: compare Hermes/OpenClaw channel session recovery to actual Kurisu route needs.
- [ ] P2-14: port compact OpenAI Agents tripwire semantics only if current policy outcome lacks them.
- [ ] P2-15: isolate DSPy offline optimization with held-out benchmark and rollback.
- [ ] P2-16: isolate Agent0 skill curriculum and reproducible before/after evaluation.
- [ ] P2-17: model symbolic reasoning as typed evidence-bearing candidates, not facts.
- [ ] P2-18: add provenance version/transform metadata for adopted source algorithms.
- [ ] P2-19: remove duplicative adapter code after migration only if all callers use canonical contract.
- [ ] P2-20: keep operational README/current status aligned after real code changes.

### P3 — cleanup and polish after critical wiring

- [ ] P3-01: merge source maps into one trace matrix with `ported/adapted/rejected/missing/unknown` status.
- [ ] P3-02: review source-level `TODO/mock/exec` flags only on active first-party runtime paths.
- [ ] P3-03: identify repeated adapters that only transform identical event shapes and collapse them safely.
- [ ] P3-04: trim duplicate reports/assets only with reference check and restore path.
- [ ] P3-05: retain every license/notice/provenance record with copied material.
- [ ] P3-06: keep Legacy UI/sprites behavior as supported fallback rather than historical-only.
- [ ] P3-07: label research features with explicit maturity and resource expectations.
- [ ] P3-08: remove capability claims whose code path is unreachable or only represented in docs.
- [ ] P3-09: optimize expensive queries/embeddings based on telemetry, not guessed bottlenecks.
- [ ] P3-10: publish concise release evidence summary once P0/P1 paths actually close.

### Принцип закрытия пунктов

Пункт считается выполненным только при изменении канонического кода или при доказуемом решении, что перенос не нужен, потому что эквивалентная реализация реально связана и доступна. Для code patch записываются affected files, why this design, outcome, migration/restore plan, evidence and UI impact. Новый тест допустим как минимальный способ удержать регрессию, но сам по себе не заменяет исправление.

## 12. Source-to-canonical tracking record

Для каждой кандидатной функции вести строку со следующими полями (можно реализовать в `Plants_INTEGRATION_MATRIX.csv`/будущем backlog, не обязательно плодить ещё отдельный документ):

1. source archive, source revision/commit, source path and SHA-256;
2. upstream behavior summary plus exact public interfaces and state ownership;
3. current Kurisu equivalent path and line/function range;
4. route/caller from `OrganismRuntime`/server/UI, including whether caller is reachable in production;
5. canonical persistent owner and lifecycle/idempotency semantics;
6. UI entry point and truthful outcome/error presentation;
7. license/NOTICE and dependency/transitive dependency impact;
8. performance footprint on target CPU/GPU and operational burden;
9. decision: `ported`, `adapted`, `already-equivalent`, `research-only`, `rejected`, `missing`, `unknown`;
10. minimal evidence for that decision and rollback/restore instruction.

`already-equivalent` requires a real active call path, not the fact that a file has the same name. `ported` means adapted code is part of canonical runtime, not copied under `legacy/`. `research-only` means it cannot write to live memory/goals or autonomously execute actions. `rejected` must have a reason so the same candidate is not rediscovered in every pass.

## 13. Правила будущих implementation passes

- Каждый pass начинается с главного архива WorkPass42 или более нового canonical archive, а не с Grok Workspace/старого NeuroCore и не с внешнего репозитория.
- Сначала читать Plants + актуальный backlog + актуальные code files; не спрашивать заново данные, уже описанные в этих источниках.
- Перед изменением найти current owner/call graph and existing same-purpose implementations. Если функция уже есть, улучшать связи/гарантии, а не дублировать модуль.
- Большая часть прохода — implementation: исправление логики, durable state, wiring, UI, dependency boundaries, performance. Исследования/тесты — необходимая поддержка, не самостоятельный основной результат.
- При переносе сохранять upstream source path/hash/license, описывать трансформацию и адаптировать типы/async/error contracts к TS runtime, вместо механического Python→TS копирования.
- Не создавать заглушки или pretend status. Если интеграция частична, показывать partial/degraded/not connected и оставлять незавершённый пункт открытым.
- Беречь текущий Legacy/Live2D, generated asset workflow, single memory owner, process lock/restore and existing canonical routes.
- После заметного pass выдать обновлённый архив, не только текстовый отчёт; включить Plants и backlog/status update, но не наращивать документы без изменения кода.
- Всегда указывать: что реального кода изменилось; какие capabilities стали доступнее/надежнее; что соединено end-to-end; какая часть остаётся открытой; какой обновлённый archive создан.

## 14. Неподлежащие нарушению инварианты

1. One organism runtime; one canonical action executor; one memory write authority.
2. No training on proposals as outcomes; no skill updates from unverified outcomes without explicit uncertainty.
3. Refusal/unavailability is not automatically incompetence or a negative reward.
4. Never retry non-idempotent external execution with a new identity simply because an ACK was lost.
5. Every persistent memory has epistemic status/provenance or an explicit unknown value.
6. Research outputs stay isolated and cannot auto-promote into live runtime.
7. No generated tool execution before independent authorization/approval and sandbox constraints.
8. UI does not claim success ahead of real runtime/provider/host receipts.
9. Live2D canonical assets and Legacy sprite fallback remain functional.
10. All copied upstream code has known source revision/license/attribution and a removal/rollback path.
11. Hash duplicates trigger investigation, not automatic deletion.
12. Release readiness depends on real capabilities and evidence, not scorecards alone.

## 15. Сводная оценка источников по ожидаемой отдаче

- **P0: WILL agency/reafference** — максимальная близость к цели автономной деятельности и обучения последствиям. Реальная работа — закрыть путь receipt→outcome→learning and replay safety.
- **P1: Lumina dreaming/toolmaker** — даёт практичные lifecycle patterns for consolidation and approval, если адаптировать к single memory store and ActionGateway.
- **P1: Mem0 extraction/update** — потенциал в качестве извлечения/конфликтов и миграции, не storage architecture.
- **P1: Hexis belief/provenance/temporal** — часть уже существует в адаптере; основной приоритет — соединение и persistence receipts.
- **P1: OpenAI Agents guardrails, OpenClaw/Hermes capability controls, Agent Framework contracts** — безопасность и надёжность инструментов, но только на каноническом executor.
- **P1: llama.cpp** — реальный локальный runtime, но нужен performance/reliability adapter, не vendor fork.
- **P2: Chroma/FAISS** — полезны только после labeled holdout. До фактического uplift текущий implementation остается приоритетом.
- **P2: Agent0/DSPy/Hyperon** — research value; не повышать их до production owner до измерений.
- **P2/P3: PocketFlow/Langroid/OWL/AutoGen/Superpowers** — architectural/developer reference; не создавать второй orchestration layer.
- **License gate: AutoGPT platform** — не копировать без точного разрешения и понимания path-specific license.
- **No code merge from tiny Letta snapshot** — только provenance/research; архив не является полной кодовой базой.

## 16. Как понять, что проект стал «единым»

Единство проекта — это не наличие всех имён upstream внутри дерева. Оно достигается, когда:

- существует один runtime orchestration path с явным lifecycle;
- каждый persistent data domain имеет одного владельца и формальный lifecycle;
- actions проходят один permission/idempotency/receipt path;
- outcome facts причинно связаны с learning/skill updates and persistent state;
- adapters могут быть replaced independently without copy-pasted core ownership;
- UI is usable entrypoint to capabilities, status, approvals and recovery;
- research can generate candidates but not rewrite production state before promotion;
- local inference behaves within actual hardware/network constraints;
- source provenance/licensing/rollback exists for every adopted upstream slice;
- there are no parallel modules that advertise the same capability but disagree about current state;
- release evidence proves actual behavior through faults and clean-room use.

## 17. Открытые риски и что ещё не следует считать закрытым

- Semantic, non-regression source-by-source review of each selected external module still needs to be tied to actual call graph and target code before copying. Static scans of ~21.5M external code lines do not mean human code review or execution.
- Production package installation/build/browser E2E cannot be inferred from a ZIP listing. WorkPass42 docs mark these open; they remain open until a real environment produces evidence.
- Real external provider/device actions and outcomes have to be observed; synthetic stubs/mocks are not a substitute for reconnect/replay evidence.
- GPU performance must be measured on the intended hardware/driver/model; general llama.cpp source scan does not prove compatibility or performance.
- Exact source revision and license headers for copied files need manual verification, particularly monorepos with subdirectory licenses and third-party code.
- Heuristic flags for `placeholder`, `exec`, `secret`, TODO etc. are broad; do not report them as vulnerabilities until active reachability and context are confirmed.
- The current report and catalog are analysis deliverables, not source edits to WorkPass42. No actual code merge was performed as part of creating Plants.

## 18. Deliverables in this package

- `Plants.md` — this canonical long-term architecture/integration strategy.
- `Plants_INTEGRATION_MATRIX.csv` — 22-source prioritized matrix.
- `Plants_MASTER_FILE_INDEX.csv` — combined file/path/line/hash/symbol catalog for main, embedded and external sources.
- `Plants_Audit_Package/FILE_LEVEL_AUDIT.csv` — main and embedded source static scan.
- `Plants_Audit_Package/CODE_SYMBOL_IMPORT_CATALOG.csv` — code definitions/imports in main and embedded sources.
- `Plants_Audit_Package/EXACT_TEXT_DUPLICATES.csv` — duplicate candidates within main/embedded archive scopes.
- `Plants_Audit_Package/UPSTREAM_SOURCE_FILE_AUDIT.csv` — upstream file audit with precise `metadata-only` / `content-line-scan` / `static-line-scan` level.
- `Plants_Audit_Package/UPSTREAM_CODE_CATALOG.csv` — source code symbol/import catalog.
- `Plants_Audit_Package/UPSTREAM_EXACT_TEXT_DUPLICATES.csv` and source-specific duplicate lists — candidates, not deletion commands.
- Prior report `Neuro_Kurisu_Полный_разбор_источников_WorkPass42.md`, initial full member inventory `Neuro_Kurisu_Source_File_Inventory.csv`, summary JSON and all source-specific chunk catalogues are included in the ZIP package.

---

**Каноническое правило для будущих сессий:** сначала WorkPass42 (или новее) как единственный главный проект, затем этот Plants-документ, затем актуальный release backlog. Продолжать с P0/P1 implementation, сначала сквозная каузальная связка agency/outcome/reafference и память single-write, затем action/provider/UI reliability. Не заменять разработку новой документацией, не делать shallow copy, не удалять Legacy/Live2D и не утверждать больше, чем показано фактическим кодом и наблюдаемыми результатами.
