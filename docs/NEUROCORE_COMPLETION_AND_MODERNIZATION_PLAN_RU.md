# NeuroCore / NK1 — супер-детальный многоэтапный план завершения, модернизации, исправлений и интеграций

**Дата составления:** 2026-11-03
**Репозиторий:** [ailtron1ss-rgb/NK1](https://github.com/ailtron1ss-rgb/NK1)
**Аудируемая ветка на момент плана:** `feature/memory` (shallow clone, HEAD `4f2def8`, комментарий «document live-write byte budget enforcement»)
**Основание:** прочитаны `AGENTS.md`, `NEUROCORE_START_HERE.md`, `NK1_REPOSITORY_README.md`, `docs/STRATEGIC_PROJECT_DEVELOPMENT_AUDIT_2026-10-22.md`, `docs/NEURO_KURISU_FULL_RELEASE_BACKLOG_CANONICAL.md`, `docs/P23_CROSS_SOURCE_INTEGRATION_ROADMAP.md`, `docs/RESEARCH_INTAKE_LEDGER.md`, `docs/NEUROCORE_MASTER_STRATEGY_AND_BRAIN_MAP.md`, `docs/MEMORY_RETRIEVAL_EXPERIMENT_PROTOCOL_2026-10-10.md`, `docs/P23_CONTINUAL_LEARNING_SCORECARD_2026-10-20.md`, а также ключевой код памяти (`MemoryOS2.ts`, `MemoryRetrievalBenchmark.ts`, `MemoryRetrievalExperiment.ts`, `LocalEmbeddingProvider.ts`, `MemorySubsystemRuntime.ts`, `MemoryFabric.ts`, `server.mjs`).

> **Статус документа.** Это план исполнения, а не отчёт о выполнении. Он объединяет уже зафиксированные в репозитории P0/P1-задачи с детальной проработкой **текущего аспекта памяти** и с кандидатами на интеграцию готовых открытых проектов и свежих исследований. Ни один пункт ниже не считается сделанным, пока не приложен артефакт проверки на точном head (лог CI/typecheck/тест, отчёт с hash-ами).

---

## 0. Как пользоваться этим планом

### 0.1 Метки достоверности (из `AGENTS.md`)

`PROVEN` (внешне подтверждено), `IMPLEMENTED` (код существует), `FUNCTIONAL INDICATOR` (прокси), `OBSERVED` (измерено в указанном прогоне), `HYPOTHESIS`, `UNKNOWN`, `UNRESOLVED`, `FAILED`.

**Правило проекта:** присутствие файла = `IMPLEMENTED`, но **не** `PROVEN` и **не** `OBSERVED`. Написанный тест без успешного прогона на точном head не даёт зачёта ни по «верификации», ни по «эффективности».

### 0.2 Правило трёх независимых шкал

Прогресс ведётся по трём **раздельным** процентам, которые нельзя складывать:
1. **Implementation** — код написан.
2. **Integration** — код вызывается в реальном production call-path.
3. **Verified efficacy** — измеренный эффект на независимом holdout с доверительными интервалами.

### 0.3 Текущий честный срез (на момент плана)

| Аспект | Состояние | Доказательство |
|---|---|---|
| Typecheck рантайма | **FAIL** | `node scripts/typecheck-runtime.mjs` → exit 1, 82 × `TS_PARSE_FAIL` (нет `node_modules`, сработал fallback-syntax-check) |
| CI | **UNVERIFIED / сломан** | В аудит-документах: Actions возвращает failed-job без steps/logs; локально узлы не установлены |
| Память (код) | `IMPLEMENTED` | `MemoryOS2.ts` (1506 строк), `MemoryFabric.ts`, `MemorySubsystemRuntime.ts` |
| Память (эффективность) | **не доказана** | Исторически `recallDelta=0`, кандидат не promoted; независимый RU/EN holdout отсутствует |
| Обучение (эффективность) | **не доказана** | Scorecard: symbolic core 61%, evidence-grounded 36%, lifelong roadmap 30%, overall 57/100 |
| UI/voice/Live2D E2E | **не подтверждён** | Требуется реальный браузерный/Android E2E |
| Общая готовность | **46/100**, не release-ready | Master strategy scorecard |

---

## 1. Целевое определение «работоспособности» (Definition of Done)

Продукт считается **работоспособным и релизо-готовым**, когда одновременно выполнены все условия ниже (это и есть набор release-gates):

- **G-A (Сборка/CI).** Чистый checkout → `npm run install:all` → `npm run typecheck` (app+runtime) → production build → targeted tests: **зелёные на точном head** с доступными логами.
- **G-B (Локальная модель).** Реальный локальный LLM-провайдер (`llama.cpp`/Ollama) отвечает через реальный продуктовый путь; зафиксированы модель/SHA/квант/context/GPU-слои, cold/warm latency, поведение при 503/timeout/malformed/cancel/cooldown.
- **G-C (Память).** На замороженном независимо размеченном RU/EN holdout кандидат **достоверно** превосходит baseline (BM25/lexical) с доверительными интервалами и без регрессий по temporal-correctness, stale-fact, latency, памяти. Иначе — не promoted.
- **G-D (Обучение).** Задача, где одна верифицированная попытка улучшает **другую** holdout-задачу; controls (no-learning/shuffled/wrong-feedback), измерены transfer/forgetting/interference.
- **G-E (Действие/верификация).** Матрица spoofed/late/duplicate/contradictory proof + restart recovery; at-most-once или идемпотентная сверка; никакого «silent success».
- **G-F (Личность/непрерывность).** Непрерывность на слепых диалоговых наборах при смене модели/усечении контекста/рестарте; без self-report как доказательства.
- **G-G (Embodiment).** Реальный браузерный E2E (boot/reconnect/reload/offline), Live2D/TTS прерывание, аудио-часы; реальные Android/Termux тесты для заявленных audio-функций.
- **G-H (Производительность/безопасность/soak).** Бюджеты на целевых устройствах (Dell G3 i5/GTX1650; Poco M7 Pro 5G/8GB), threat-model, 24–72 ч soak.
- **G-I (Релиз).** Clean-room build, lockfiles, license/SBOM, миграции, rollback, подписанные артефакты; каждая заявка трассируется к измерению.

> **Жёсткое правило проекта:** «CI зелёный на синтетических фикстурах» необходимо, но **не достаточно**. Сознание/субъективный опыт — `UNKNOWN/UNRESOLVED` без независимых критериев.

---

## 2. Блок P0 — Инфраструктура правды (без него остальное не проверяемо)

> Приоритет: **блокирующий**. Пока это не сделано, любой «зелёный» результат непроверяем.

**P0-1. Починить исполняемость CI.**
- Диагностировать, почему runner завершает job до шагов (`steps: null`, `logs_url: null`). Проверить `permissions`, `concurrency`, path-фильтры, наличие lockfile, `actions/setup-node`, кэш.
- Свести дублирующиеся workflow (20+ файлов в `.github/workflows/`) к **одному** exact-head «воротам» (targeted tests + typecheck runtime + typecheck app + build), остальные оставить как опциональные.
- Добавить в каждый workflow `timeout-minutes` и явные `npm ci` для обоих workspace.
- Выход: **exact-head run со steps и логами**, exit codes видны.

**P0-2. Локальная воспроизводимость.**
- В окружении с доступом к registry выполнить `npm run install:all` (app + runtime), зафиксировать, что lockfiles не переписываются.
- Прогнать `node scripts/typecheck-runtime.mjs` с установленным TypeScript → получить **настоящий** семантический tsc-результат (сейчас fallback: syntax-only, 82 файла не парсятся под strip-types — надо понять, это реальные ошибки или ограничение strip-types).
- Разобрать 82 `TS_PARSE_FAIL`: отделить (а) файлы, реально несовместимые со `--experimental-strip-types` (например, `enum`, `namespace`, параметрические свойства), от (б) настоящих синтаксических ошибок. Для (а) — либо рефактор в strip-совместимый TS, либо исключить из рантайм-загрузки и проверять только tsc.

**P0-3. Топология репозитория.**
- Зафиксировать роль веток: `main` (release/metadata, **нет общего предка** с source-линией), `workpass70-source` (полное дерево), активная source-линия.
- Составить inventory веток: ref/head SHA, merge-base, уникальные коммиты/файлы/тесты, решение keep/cherry-pick/archive. **Не удалять** исторические ветки до diff-review.
- Принять и задокументировать модель публикации (монорепо с общей историей / release-репо с артефактами / отдельная source-ветка).

**P0-4. Sandbox / независимые власти.**
- Развернуть реальный OS/container launcher (границы сети/FS/CPU/mem/time). Host-adapter — это **не** sandbox.
- Отдельно управляемые verifier и safety scanner (разные роли и ключи). Ключи verifier/approver — вне процесса приложения, с планом ротации/отзыва.
- Выход: matched evaluation → signed shadow evidence → approval → activation → restart → rollback на deployment-shaped окружении.

---

## 3. Блок P1 — ПАМЯТЬ (детальный анализ текущего аспекта + план)

Это ключевой раздел запроса. Разберём текущее устройство, проблемы и поэтапный план.

### 3.1 Что уже есть (IMPLEMENTED)

**Владелец памяти:** `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts` — канонический записываемый store. Композиция — `MemorySubsystemRuntime.ts`, фасад записи/обслуживания — `MemoryFabric.ts`.

**Модель записи `MemoryItem2`:** `kind` (sensory/working/episodic/semantic/autobiographical/procedural/social/identity/dream), `content`, `contentHash` (content-addressed identity, адаптировано из Memo), теги/контекст, множественные связи (`semanticLinks`, `temporalLinks`, `causalLinks`, `contradictionLinks`), сигналы (`salience`, `emotionalWeight`, `identityRelevance`, `goalRelevance`, `socialRelevance`, `predictionError`, `temperature01`, `confidence`), эпистемический статус (`fact/belief/hypothesis/unknown/quarantined`), провенанс (`provenanceClass`, `sourceAuthority01`, `independenceKey`, `evidenceFreshnessAt`), темпоральность (`validFromAt`, `validUntilAt`, `observedAt`, `supersedesId`, `supersededById`, `revisionGroupId`, `revisionSequence`), история ревизий и история ревизий уверенности.

**Ретривал (`retrieve()`):**
- кандидаты: IDF-взвешенный токен-индекс + fuzzy (char-trigram Dice) + concept-алиасы (bilingual), bounded top-192;
- ранжирование: **RRF-слияние** сигналов `{bm25:1, coverage:.90, fuzzy:.60, entity:.42, relationship:.32}`;
- lexical = `.24*coverage + .14*exact + .42*normalize(bm25) + .20*fuzzy`;
- временные режимы `current/at/all`, `asOfAt`; intent-fit; goal/identity fit; recency;
- **важно:** хеш-вектор (48-мерная проекция) намеренно **не** используется как канал ранжирования (`semanticVectorUsedForRanking:false`).

**Ревизии/уверенность:** аддитивное обновление уверенности только для новой линии доказательств; дубликаты не двигают уверенность; потолок авторитета источника; история `prior/posterior` с причиной.

**Эмбеддинги:** `LocalEmbeddingProvider.ts` — HTTP-адаптер к Ollama / OpenAI-совместимому локальному endpoint; по умолчанию **loopback-only**, опциональный remote требует явного opt-in + HTTPS; санитизация секретов/PII перед кэшем/отправкой; bounded-кэш; нормализация.

**Эвалюация:** `MemoryRetrievalBenchmark.ts` (paired bootstrap, Recall@k/MRR/precision/coverage, unsupported/false-abstention, temporal/dormant/quarantine safety, fingerprints, promotion **всегда** `allowed:false`) и `MemoryRetrievalExperiment.ts` (multi-seed sensitivity).

### 3.2 Что реально сломано / не доказано

- **M-GAP-1 (критично):** нет независимого размеченного RU/EN корпуса. Broad benchmark даёт `recallDelta=0`, кандидат **не promoted**. Эмбеддинги не участвуют в ранжировании → «semantic recall» фактически не заявлен.
- **M-GAP-2:** хеш-вектор — **не** семантический embedding (зафиксировано в `AGENTS.md`). Смешивать с настоящей семантикой нельзя.
- **M-GAP-3:** materialization векторов отвязана от ранжирования (by design), но тогда неясно, где именно embedding реально повышает качество — нужен контролируемый эксперимент.
- **M-GAP-4:** нет метрики «использование устаревшего/инвалидированного факта» (FAMA-подобной) и тестов supersession/expiry на реальных парах фактов.
- **M-GAP-5:** нет калиброванной абстиненции и оценки на near-duplicate/интерференции (MINTEval-подобной).
- **M-GAP-6:** нет memory→action метрик (помнит ли система настолько, чтобы правильно выбрать tool и параметры).
- **M-GAP-7:** восстановление из snapshot допускало доверие к caller-полям (исправлялось в WorkPass459/273/279); нужна проверка, что все пути restore fail-closed.

### 3.3 План P1 — по шагам

**M1. Заморозить корпуса и провенанс (P0 для памяти).**
1. Собрать/адаптировать **независимо размеченный** RU/EN набор: temporal revision (fact A→fact B), парафразы, контрадикции, дистракторы, multi-hop, privacy-классы.
2. Формат — JSONL по протоколу `MEMORY_RETRIEVAL_EXPERIMENT_PROTOCOL`: `{id, query, relevantIds, split}`; train/holdout без пересечений; provenance-JSON с `datasetId/version/sourceRef/labelingProtocol/licenseId/contentSha256`.
3. Провести leakage-аудит: hash сплитов, проверка, что holdout не использовался при разработке; shuffle/insertion-order контроли.
4. Выход: зафиксированные hash-и корпуса + скрипт запуска + baseline-отчёт.

**M2. Честный baseline и кандидаты (P0).**
1. Зафиксировать baseline: чистый BM25/lexical на **том же** корпусе, без асимметрии усечения.
2. Кандидат-1: текущий гибрид MemoryOS2 (BM25+fuzzy+concept+RRF).
3. Кандидат-2: добавить **настоящие** локальные эмбеддинги как отдельный канал RRF (dense), сохранив lexical. Провайдер — `LocalEmbeddingProvider` (Ollama/llama.cpp), opt-in через env.
4. Отчёт: per-case результаты, Recall@k, MRR, precision, coverage, latency p95, resident memory, bootstrap-CI. Никакого single-seed cherry-pick.
5. Выход: **либо** положительный CI-lower-bound по Recall и MRR non-inferiority, **либо** кандидат остаётся unpromoted (честный отрицательный результат).

**M3. Улучшения ранжирования (P1, только после M2).**
- Тюнинг RRF-весов и lexical-формулы на **train**-сплите (не на holdout).
- Reranker: кросс-энкодер на локальной модели для top-N кандидатов (bounded, opt-in).
- Query rewriting/expansion: bilingual concept-алиасы расширить; контролировать, чтобы не терять precision.
- Graph-diffusion: одношаговый Personalized-PageRank по `semanticLinks`/`causalLinks` (идея HippoRAG 2) вместо 3+ LLM-вызовов — сравнить с текущим `linkSupport`.
- Temporal/contradiction-aware scoring: явный штраф за `validUntilAt<=now`, за конфликтующие `contradictionLinks`.
- Выход: абляция каждого механизма против одинакового baseline/бюджета.

**M4. Корректность ревизий и времени (P0/P1).**
- Ввести метрику **FAMA-подобную**: доля ответов, опирающихся на устаревший/инвалидированный факт.
- Тесты: `as-of` запросы (до/после границы валидности), supersession-цепочки, конфликт источников, `quarantine`, `dormant`.
- Проверить, что все restore-пути применяют потолок авторитета и fail-closed при малформе.

**M5. Политика записи и калибровка (P1).**
- Uncertainty-gated write policy (идея LIRA-класса): записывать/ревизовать/отложить/абстениться по калиброванной уверенности.
- Дедупликация (content-hash identity уже есть), бюджет памяти, eviction/dormancy-политика под нагрузкой.
- Метрики: false-write rate, missed-write rate, калибровка confidence.

**M6. Memory→Action и интерференция (P1).**
- Добавить task-family «memory-to-action»: правильный выбор tool и параметров на основе запомненного (Mem2ActBench-идея).
- Интерференция/порядок: shuffle insertion, distractor/conflict (MINTEval-идея), per-target accuracy + calibration.
- Trajectory-grounded recall (AMA-Bench-идея): состояния/действия/наблюдения/tool-output как часть памяти.

**M7. Интеграция OSS (см. §5) и верификация.**
- Сначала **протоколы**, потом код. Любой перенос — через изолированный адаптер, с сохранением лицензии/атрибуции, и только при измеренном преимуществе.
- Выход: обновление `RESEARCH_INTAKE_LEDGER.md` решением `INTEGRATED/ADAPT/RESEARCH-ONLY/REJECT`.

---

## 4. Блоки P2–P8 — остальные подсистемы (пошагово)

### 4.1 P2 — Обучение и консолидация (G-D)

- **L1.** Определить задачи, где одна верифицированная попытка улучшает **другую** holdout-задачу.
- **L2.** Controls: learning-on / no-learning / shuffled-feedback / wrong-feedback / replay-disabled — на **идентичных** task streams, seeds, версиях manifest.
- **L3.** Метрики: task success, skill quality, trajectory/action efficiency, forgetting, forward/backward transfer, calibration, catastrophic-failure rate, latency, storage.
- **L4.** Ревью: единый replay admission/selection contract; не допускать повторного учёта одного события; novelty/salience ≠ независимое подтверждение успеха.
- **L5.** Продвижение кандидата — только через promotion gate (Ed25519-approval + shadow evidence + bootstrap lower bound). Никакого auto-promote.

### 4.2 P3 — Действие, верификация, безопасность (G-E)

- **A1.** Формализовать состояния: `pending/confirmed/rejected/unknown/stale/conflicted/cancelled/timed_out/reconciled` (не сжимать в boolean).
- **A2.** Инжектить timeout/lost-ACK на **каждом** переходе; независимо читать внешний postcondition; сверять после рестарта.
- **A3.** Матрица тестов: duplicate delivery, spoofed evidence, late evidence, contradictory evidence, частично завершённые многошаговые действия.
- **A4.** At-most-once где возможно; иначе идемпотентная сверка и **явное** ambiguous-состояние.
- **A5.** Threat-model: prompt injection, malicious tools, untrusted memory output, path traversal, secret exposure, dependency compromise, log exfiltration.

### 4.3 P4 — Язык и провайдеры (G-B)

- **LNG1.** Deterministic HTTP-тесты: 503, timeout, malformed, cancellation, cooldown, fallback, recovery.
- **LNG2.** Реальный `llama.cpp`/Ollama на целевом железе: модель/SHA/квант/context/GPU-слои, cold/warm latency, лимиты вывода.
- **LNG3.** Проверить attribution: какой провайдер реально сгенерировал ответ; sanitized-логи; отмена запроса.

### 4.4 P5 — Личность и непрерывность (G-F)

- **I1.** Разделить: identity-факты / временное состояние / role-play / вывод модели. Все пользователь-корректируемые факты — версионированы.
- **I2.** Тесты: смена модели/провайдера, усечение контекста, компакция памяти, export/import, рестарт, конфликтующие правки.
- **I3.** Свежий явный интент пользователя важнее «стабильной» памяти; поддержать selective forgetting и удаление источника.

### 4.5 P6 — UI / voice / Live2D (G-G)

- **U1.** Dependency-complete production build; реальный браузерный E2E: boot/reconnect/reload/permissions/API-errors/offline/accessibility.
- **U2.** Live2D/TTS: прерывание в синтезе/воспроизведении, stale callbacks, монотонность аудио-часов, viseme-boundary.
- **U3.** Реальные Android/Termux тесты аудио; честно помечать Web-Speech-приближения.
- **U4.** Единый версионированный `EmbodimentIntent v1` (речь, аудио-часы, фаза, viseme, выражение, взгляд, priority, cancel-token) — уже заявлен; проверить, что UI не дублирует когнитивную логику.

### 4.6 P7 — Производительность, безопасность, soak (G-H)

- **P1.** Бюджеты на Dell G3 и Poco M7 Pro **раздельно**; никогда не выводить один из другого.
- **P2.** Метрики: cold/warm latency, throughput, peak RAM/VRAM, CPU/GPU, disk growth, cancel-response, thermal throttling, battery drain.
- **P3.** Soak 24–72 ч: рестарты, отказы провайдера, давление на storage, прерванные действия, утечки.

### 4.7 P8 — Упаковка, релиз, эксплуатация (G-I)

- **R1.** Clean-room checkout/build/test; проверка lockfiles, license-инвентаря, hash-ов, generated assets, миграций, rollback.
- **R2.** Версионированный артефакт + changelog + supported-platform matrix + known-limitations + diagnostics-bundle (с редакцией секретов) + backup/export + uninstall.
- **R3.** Тег только на коммит с приложенными доказательствами; каждая заявка трассируется к тесту/измерению.

---

## 5. Интеграция готовых открытых проектов (OSS)

> **Правило проекта:** адаптировать механизм в канонический владелец NK1, **не** вендорить целиком, не создавать второй источник истины. Сначала проверить URL/revision/лицензию/футпринт/приватность, затем — изолированный эксперимент.

| Проект | Лицензия | Механизм | Куда в NK1 | Решение | Шаги адаптации |
|---|---|---|---|---|---|
| [Mem0](https://github.com/mem0ai/mem0) | Apache-2.0 | add/update/delete/retrieve; извлечение и редактирование фактов по scope (user/session/agent); hybrid retrieval (semantic+BM25+entity) | Протоколы extraction/update и hybrid-слияние в `MemoryOS2` | **ADAPT протокол** | (1) изучить формат «fact extraction/update»; (2) сравнить с текущей RRF-формулой; (3) внедрить как ablation, не как второй store; (4) сохранить атрибуцию |
| [Letta / MemGPT](https://github.com/letta-ai/letta) | Apache-2.0 | Tiered self-managed memory (core/archival), self-editing блоки | Политика residency/consolidation (уже есть `MemoryResidencyGovernor`) | **RESEARCH-ONLY** | Сравнить learned/self-managed tiering с детерминированной политикой при равном бюджете; не добавлять второй store |
| [Zep / Graphiti](https://github.com/getzep/graphiti) | Apache-2.0 (Community Edition deprecated) | Bi-temporal knowledge graph: validity-window фактов, supersession, raw episodes | Темпоральная модель `MemoryOS2` (`validFrom/Until`, `supersedes`) | **ADAPT протокол; НЕ вендорить** | (1) перенять семантику «fact invalidated not deleted»; (2) проверить, что текущие as-of запросы её покрывают; (3) Neo4j-нагрузку не тянуть в Node-рантайм |
| [A-MEM](https://github.com/agiresearch/A-mem) | MIT | Zettelkasten-линковка: авто-связи между заметками, эволюция сети | `semanticLinks`/связывание в `MemoryOS2` | **ADAPT идею** | (1) изучить правило авто-линковки; (2) сравнить с текущим `updateLinks` (cosine+entity); (3) внедрить как ablation с метрикой связности |
| [HippoRAG 2](https://arxiv.org/abs/2502.14802) | проверить репозиторий | Dual-node KG + Personalized PageRank + dense-sparse интеграция для ассоциативного recall | Graph-diffusion в ретривале | **ADAPT идею (PPR 1 шаг)** | (1) проверить лицензию/код; (2) реализовать 1-шаг PPR по существующим links; (3) сравнить с `linkSupport` на multi-hop holdout |
| [Cognee](https://github.com/topoteretes/cognee) | Apache-2.0 (проверить) | Extract-Cognify-Load → persistent KG | Пайплайн ингеста знаний | **RESEARCH-ONLY** | Оценить футпринт и лицензию; не тянуть тяжёлые зависимости |
| [retention-bench](https://github.com/symbolfarm/retention-bench) | проверить LICENSE | Hard process reset + survive-directory; различает retained record и integrated capability | Протокол ретенции/transfer | **ADAPT протокол** | Реальный subprocess reset, separate intact/wiped arms, gain-curve vs reset frequency |
| [AgentMemoryBench](https://github.com/solomoon313/AgentMemoryBench) | проверить | offline/online/replay/transfer/repair режимы | Матрица оценки обучения | **ADAPT протокол** | Смэппить outcome-матрицу; holdout изолировать |
| [SkillLearnBench](https://github.com/cxcscmu/SkillLearnBench) | MIT | Три стадии: artifact validity / invocation-trajectory / verified outcome | Диагностика навыков | **ADAPT протокол** | Уже частично адаптировано; не вендорить Docker/API-heavy runner |
| [Hexis](https://github.com/QuixiAI/Hexis) | MIT | Belief revision: поддержка/противоречие/дубликаты; prior/posterior+reason | `MemoryOS2` revision API | **ADAPT механизм** (частично сделано в WorkPass459) | Извлекать по механизму, не импортировать Postgres-схему |

**Общие шаги интеграции (для каждого кандидата):**
1. Зафиксировать URL/revision/commit, лицензию (SPDX), футпринт зависимостей, требования к приватности.
2. Записать в `RESEARCH_INTAKE_LEDGER.md`: механизм, ожидаемая польза, минусы, граница интеграции, тест, ресурсная цена.
3. Изолированный эксперимент на малой репрезентативной выборке против **того же** baseline/корпуса.
4. При выигрыше — адаптировать в канонический владелец через адаптер; сохранить атрибуцию/лицензию.
5. При проигрыше — записать `REJECT` с причиной (чтобы не повторять тупик).

---

## 6. Свежие исследования → эксперименты

Кандидаты из `RESEARCH_INTAKE_LEDGER.md` (статусы — как в реестре, не как интегрированное):

| Источник | Идея | Эксперимент в NK1 |
|---|---|---|
| MemoryAgentBench (arXiv 2507.05257) | retrieval / test-time learning / long-range / conflict+forgetting | Held-out RU/EN suites; same corpus, leakage-проверки, per-case |
| Memora / FAMA (ACL 2026) | штраф за устаревшую/инвалидированную память | Пары fact A→B; запросы до/после границы; false-current / false-historical |
| MINTEval (2026) | multi-target интерференция/агрегация | Shuffle порядка, дистракторы/конфликты, per-target accuracy + calibration |
| AgeMem (ACL 2026) | learned memory management | Сравнить с детерминированной политикой при равном бюджете; safe rollback |
| AMA-Bench (ICML 2026) | long-horizon trajectories (states/actions/observations/tool-output) | Trajectory-grounded recall, не только пассивный QA |
| Mem2ActBench (ACL 2026) | память → выбор tool и параметров | Task-family memory-to-action; успех + ошибки параметров |
| MemoryArena (ICML 2026) | multi-session взаимозависимые задачи | Замкнутый цикл memory→action→verified outcome |
| HippoRAG 2 (ICML 2025) | dense-sparse + PPR | Абляция 1-шаг PPR vs текущий link-support на multi-hop |
| Titans / Mamba / RWKV-7 / FLA | test-time memory, SSM, recurrent LM | Только model/backend tournament при равном бюджете; не второй identity-owner |
| Complementary Learning Systems (McClelland 1995) | fast episodic + slow consolidation | Сравнить fast+slow vs one-rate: transfer/interference/stale-recovery |

**Translation gate (обязательно до кода):** какой конкретный отказ канонического владельца мотивирует идею; что её фальсифицирует; baseline и same-budget кандидат; какой сплит holdout защищён от тюнинга; какие побочные эффекты измерить (latency/RAM/forgetting/privacy); какой результат → rejection/rollback.

---

## 7. Метрики и scorecard (что и как измеряем)

**Память:** Recall@k, MRR, nDCG, precision, coverage; false-current-fact rate, stale-fact use (FAMA), correct-abstention, unsupported-retrieval; latency p95, resident memory; bootstrap-CI (lower bound>0 обязателен для promotion).

**Обучение:** task success, skill quality, trajectory/action efficiency; forward/backward transfer; forgetting (Δ на ранее освоенных); catastrophic-failure rate; калибровка.

**Действие:** at-most-once / duplicate-mutation rate; spoofed/late-proof rejection; restart-reconciliation success; ambiguous-state explicit-rate.

**Ресурсы:** cold/warm latency, throughput, peak RAM/VRAM, CPU/GPU, disk growth, thermal, battery; soak-стабильность.

**Правило score-изменения:** хранить дату, commit, устройство, модель/hash/квант, версию корпуса, скрипт, raw per-case, baseline, абляцию, CI, ревьюера. Оценка **может падать** при обнаружении скрытого отказа.

---

## 8. Дорожная карта (фазы, ориентировочно)

| Фаза | Содержание | Выход (gate) | Ориентир |
|---|---|---|---|
| **A. Ground truth** | P0-1..P0-4: CI, локальная сборка, топология веток, sandbox | Exact-head CI со steps/logs; понятная source-line | 1–2 недели |
| **B. Provider truth** | P4 (LNG1–3), P0-4 sandbox | Реальная модель через реальный путь + deterministic failure | 1–2 недели |
| **C. Memory correctness** | M1–M2 (корпус, baseline, кандидаты) | Positive uplift ИЛИ честный unpromoted | 2–4 недели |
| **D. Memory modernization** | M3–M6 (ранжирование, ревизии, политика, memory→action) | Абляции с измеренным эффектом | 3–6 недель |
| **E. Learning** | P2 (L1–L5) | Measured transfer + bounded forgetting | 3–6 недель |
| **F. Action safety** | P3 (A1–A5) | At-most-once / idempotent reconciliation | 2–4 недели |
| **G. Identity** | P5 (I1–I3) | Blind-continuity без self-report | 2–3 недели |
| **H. Embodiment** | P6 (U1–U4) | Реальный browser + device E2E | 2–4 недели |
| **I. Perf/Security/Soak** | P7 (P1–P3) | Бюджеты + 24–72ч soak | 2–4 недели |
| **J. Release candidate** | P8 (R1–R3) | Clean-room build, rollback, подпись | 2–3 недели |

Фазы A/B — **блокирующие** и параллелятся. C и E — критический путь по доказательности. D/H могут идти параллельно после C/H старта.

---

## 9. Риски (сводно)

| ID | Риск | Митигация |
|---|---|---|
| R-01 | CI не запускает шаги / нет логов | P0-1: один exact-head workflow, диагностика permissions/concurrency |
| R-02 | Host-adapter принимают за sandbox | P0-4: реальный OS/container launcher + независимые роли |
| R-03 | Неполное/непарное evidence | Immutable evaluation envelope; fail-closed при пропусках/дублях |
| R-04 | Ретривал-шум усиливается replay | Verified outcome admission, дедуп, бюджет, равные потоки задач |
| R-05 | Накопление модулей без runtime-вызова | Call-graph владельцев; включать только при конкретном вызове |
| R-06 | Утечка приватных данных в логи/внешние запросы | Threat-model, redaction-тесты, local-first, удаление/экспорт |
| R-07 | Тюнинг под holdout / leakage | Hash-и сплитов, дисциплина доступа, shuffle-контроли |
| R-08 | Устаревшие факты в неверном контексте | As-of запросы, конфликт провенанса, current/historical тесты |
| R-09 | Документация как замена кода | Ярлыки статуса + ссылки на артефакты для каждого gate |
| R-10 | Scope creep по архитектурам | Benchmark-driven tournament + явные REJECT-решения |

---

## 10. Протокол отчётности и rollback

- Каждый проход: воспроизводимый failure-mode → минимальный фикс → регрессия (падает до, проходит после) → узкие тесты + cross-cutting CI → инспекция diff → запись «что запускалось / прошло / не проверено / изменилось ли наблюдаемое поведение» → обновление handover.
- **Не** заявлять recall-uplift, user-level learning, device performance, production-readiness или external grounding на основании одного unit-теста.
- Rollback: каждый кандидат (память/обучение/навык) — с обратимой активацией, версионированием и отзывом approval-ключей.
- Запрет: merge source-стека напрямую в `main` (нет общего предка); авто-продвижение кандидатов; удаление исторических веток без diff-review.

---

## 11. Ближайшие 10 конкретных шагов (можно начинать сразу)

1. Диагностировать и починить exact-head CI (P0-1); получить run со steps/logs.
2. Установить зависимости обоих workspace; получить **настоящий** tsc-результат рантайма (P0-2).
3. Разобрать 82 `TS_PARSE_FAIL`: реальные ошибки vs ограничение strip-types (P0-2).
4. Зафиксировать топологию веток + inventory с решениями keep/cherry-pick/archive (P0-3).
5. Собрать и захешировать независимый RU/EN retrieval-корпус с provenance и leakage-аудитом (M1).
6. Запустить baseline BM25 vs текущий гибрид на одном корпусе; опубликовать per-case отчёт (M2).
7. Добавить настоящий локальный embedding как отдельный RRF-канал; абляция vs baseline (M2/M3).
8. Ввести FAMA-подобную метрику устаревших фактов + as-of/supersession тесты (M4).
9. Проверить все restore-пути памяти на fail-closed и потолок авторитета (M7/P3).
10. Обновить `RESEARCH_INTAKE_LEDGER.md` решениями по OSS-кандидатам §5 (ADAPT/REJECT) с URL/revision/license.

---

**Итог:** продукт имеет мощный, но недоказанный кодовый базис. Критический путь к работоспособности — не добавление модулей, а закрытие разрывов доказательности: **работающий CI**, **честный независимый holdout для памяти**, **измеренный transfer обучения** и **реальная верификация действий**. Интеграции OSS и свежие исследования подключать только через протоколы и абляции против одинакового baseline, фиксируя каждый результат (в т.ч. отрицательный) в реестре.
