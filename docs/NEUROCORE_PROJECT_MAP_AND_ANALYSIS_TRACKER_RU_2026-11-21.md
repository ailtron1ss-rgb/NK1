# NeuroCore / NK1 — карта проекта и трекер глубины анализа

> Тип документа: живой инженерный навигатор и реестр покрытия анализа.
> Срез: 2026-11-21.
> Каноническая кодовая база: workpass70-source; последний кодовый checkpoint ef3564c519e9f39f6d6e95834a2fcde202cdc8fa.
> Текущий HEAD ветки документации: 4a46e724686814dc69b00acaeca530399d9b0910 — на 1 commit впереди кодового checkpoint; изменения затрагивают только README.md и docs/plans/2026-11-21-neurocore-prototype-0-1.md.
> main: 06e01cdd0a8e60ed70991f22e842887f544d1ebf (release/metadata lineage; не подменяет runtime source).
> Назначение: карта отражает структуру, зависимости, подтверждённые факты, неизвестные области и очередность проверки. Она не объявляет функции готовыми.

## 1. Как читать прогресс

В документе существуют три независимые шкалы. Их нельзя смешивать.

1. Покрытие анализа — насколько глубоко изучены код, интерфейсы, тесты, CI и реальные ограничения направления.
2. Состояние реализации — существует ли функциональность и связана ли она с остальной системой.
3. Доказанность — прошла ли функция нужные тесты, независимую оценку, целевое устройство и release gate.

### Текущий прогресс анализа

**Оценка покрытия анализа: 39% (ориентир, не измерение готовности продукта).**

Метод: проект разделён на 20 потоков программы завершения; каждому потоку назначена одинаковая доля 5%. Для каждого потока выставлена глубина анализа 0–100% по четырём признакам: прочитана архитектурная документация; определены владельцы и границы; проверены ключевые исходники/контракты; сверены тесты и evidence gaps. Итог — среднее значение по 20 потокам. Это экспертная оценка покрытия текущего аудита, не процент написанного кода и не процент готовности NeuroCore.

| Поток | Глубина анализа | Основание / пробел |
|---|---:|---|
| 00. Truth, inventory, provenance | 75% | README, baseline, release/license и источники истины сверены; полный file/dependency inventory ещё нет |
| 01. Branches, PR, convergence | 65% | 1 072 branch refs просканированы с полной пагинацией; текущий полный PR census и уникальные tips ещё не построены |
| 02. Release ZIP parity | 35% | release metadata и юридический gate изучены; ZIP не материализован, extraction/hash/parity не проверены |
| 03. Toolchain, CI, build | 40% | package scripts и exact-head evidence изучены частично; clean build/test не запускались |
| 04. Cognitive runtime | 50% | Runtime/Core/cycle/event trace исследованы; полный import/call graph и реальный end-to-end не проверены |
| 05. Persistence/recovery | 25% | FileStateStore и отдельные recovery контракты просмотрены; crash matrix, migrations и device restore не пройдены |
| 06. MemoryOS2/retrieval | 75% | MemoryOS2, MemoryFabric, capacity, semantic opt-in, abstention и RU/EN synthetic E2E изучены; независимый holdout отсутствует |
| 07. Retrieval science/evaluation | 55% | benchmark/paired-seed gates изучены; независимые данные, статистика и полный репродукционный протокол не проверены |
| 08. Continual learning/skills | 25% | ReplayBuffer и evidence rules просмотрены; transfer, retention, interference и forgetting не исследованы end-to-end |
| 09. World model/perception | 15% | WorldModel и PlanEngine инвентаризированы; PerceptionRouter, sensor grounding и причинная точность не проверены |
| 10. Self/User/Personality/Affect | 20% | SelfModel и мотивационная связка частично просмотрены; непрерывность идентичности и affect restore требуют отдельного аудита |
| 11. Motivation/autonomy/actions | 60% | ActionGateway, autonomy life controller и governance contracts изучены; 24h telemetry, fault-injection и полезность инициатив не доказаны |
| 12. LLM/model ecology | 25% | Local provider inspected; actual inference, cloud routing, fallback honesty и model-switch continuity не проверены |
| 13. Speech/audio | 20% | Voice/embodiment interfaces частично просмотрены; реальные ASR/TTS/audio lifecycle tests не запускались |
| 14. Embodiment/avatar | 20% | EmbodimentRuntime и aspect owners инвентаризированы; renderer source, visual E2E, lip-sync и device soak не проверены |
| 15. App/UI | 10% | Владельцы app/avatar найдены; screen flows, API wiring, accessibility и browser E2E не изучены |
| 16. External integrations/portability | 35% | HMX export/staging и integration manifest просмотрены; все адаптеры, import/apply и portability не проверены |
| 17. Security/privacy/governance | 45% | API policy, ActionGateway и HMX redaction изучены; threat model, full tool inventory и penetration/fuzz testing отсутствуют |
| 18. Reliability/performance/device | 35% | Метрики и ключевые ограничения определены; 10k/phone/soak/latency benchmarks не запускались |
| 19. Research/legal/release/handoff | 40% | Research intake и license blocker проверены; upstream provenance, human legal decision и release parity открыты |
| **Итого** | **39%** | Средняя глубина по 20 потокам |

Правило пересчёта: менять процент только после записи новых проверенных файлов, интерфейсов, тестов и evidence. Простое чтение ещё одного README не должно резко повышать покрытие. После каждого крупного прохода сохранять дату, baseline и изменения по потокам.

## 2. Source of truth и расхождения документов

| Источник | Назначение | Состояние на этом срезе |
|---|---|---|
| README.md | Live checkpoint и текущие ограничения | Обновлён на HEAD 4a46; указывает кодовый checkpoint ef356 |
| NEUROCORE_START_HERE.md | Handoff | Содержит исторический baseline f1cbaa; не использовать SHA без refresh |
| AGENTS.md | Правила разработки | Содержит baseline 950989; часть инструкций полезна, checkpoint устарел |
| docs/NK1_100_PERCENT_COMPLETION_PROGRAM_RU_2026-11-18.md | Главный исполняемый backlog | 20 потоков / 305 work units; актуализировать live evidence |
| docs/plans/2026-11-21-neurocore-prototype-0-1.md | Узкий план Prototype 0.1 | Пять сквозных задач; использовать как release-oriented subset |
| docs/NEUROCORE_MASTER_STRATEGY_AND_BRAIN_MAP.md | Стратегия и архитектурные границы | Содержательный план; требует синхронизации с последними source changes |
| engineering-os/aspects.v1.json | 75-aspect machine registry | Snapshot от 2026-11-06, observed SHA bcd48b1; не текущий статус |
| engineering-os/manifest.v1.json | Engineering OS planes/policy | Политика сильная; ряд integration entries помечены unverified/disabled |

Иерархия планов без конкурирующих backlog:

- North Star / product invariants — определяют, что строим и чего не заявляем.
- 30 фаз / 300 шагов на main — стратегическая дорожная карта.
- 20 потоков / 305 work units на source — главный рабочий backlog.
- 75 аспектов — машинный реестр владельцев, зависимостей и gates; требует обновления.
- 1 000 work-unit backlog — карта полноты покрытия, не параллельный ежедневный план.
- PR/commit/test receipt — фактическая единица доказанного изменения.
- Release ZIP + manifest + независимый hash + legal approval — конечная единица поставки.

## 3. Карта архитектуры: один организм, шесть взаимосвязанных контуров

    USER / WORLD / SENSORS
             |
    [Perception & Intake]
             |
    [World / Situation]
             |
    [OrganismCore / State]
             |
    [Cognitive Cycle Coordinator]
    PERCEIVE -> APPRAISE -> PLAN -> ACT
          -> REFLECT -> CONSOLIDATE
             |
      +------+-------------------+
      |              |            |
    [Memory &     [Self/Affect/  [World
     Learning]     Drives]       Model]
      |              |            |
      +--------------+------------+
                     |
              [ActionGateway]
                     |
         [Tools / Providers / Environment]
                     |
          [Outcome & Postcondition Proof]
                     |
         [Causal Event / Evidence Ledger]
                     |
          [Persistence / Snapshot / Recovery]
                     |
       +-------------+--------------+
       |             |              |
   [Speech]     [Embodiment]      [App/UI]
       |             |              |
       +-------------+--------------+
                     |
              User-visible organism

Cross-cutting control planes:
- Security, consent, privacy, permissions, governance
- Observability, metrics, diagnostics, resource budgets
- Evaluation, holdouts, regression, fault injection
- Research intake, provenance, licensing, release forge

### Канонические владельцы (рабочая гипотеза, сверять с фактическим call graph)

| Контур | Основной владелец/путь | Что не допускать |
|---|---|---|
| Runtime/state | OrganismCore, OrganismRuntime, FileStateStore | Несколько конкурирующих runtime/state owners |
| Cognitive cycle | CognitiveCycleBoundary, CognitiveKernelCoordinator, UnifiedCognitiveCycle | Счётчик стадии вместо доказанной причинной цепочки |
| Memory | MemoryOS2 (canonical records), MemoryFabric (retrieval lifecycle) | Параллельная canonical memory |
| Learning | ContinualReplayBuffer, learning/evidence owners | Reward от неподтверждённого ACK или self-report |
| Self/identity | P32CausalSelfModel, UserModelEvidenceModel, personality/affect owners | Смешивание user claims, self-model и фактов мира |
| World/planning | WorldModel, PlanEngine, perception owners | План без grounded world state и outcome |
| Action/safety | ActionGateway, ApiSecurityPolicy, outcome verifiers | Прямой обход gateway для side effects |
| Embodiment | EmbodimentRuntime, renderer adapters, voice adapters | Отдельное «эмоциональное состояние» аватара, не связанное с organism state |
| Integrations | Connector/provider adapters + canonical owners | Интеграция сервиса только по наличию manifest entry |
| Evidence/recovery | CognitiveEventFabric, OperationalJournal, FileStateStore | Кольцевой event buffer как единственная история организма |

## 4. Карта 20 потоков и очередность

| ID | Поток | Зависимости | Выходной gate | Приоритет |
|---|---|---|---|---|
| 00 | Truth, inventory, provenance | Все потоки | exact source/release/asset baseline | P0 |
| 01 | Branch/PR convergence | 00 | PR topology, duplicate-tip map, salvage register | P0 |
| 02 | Release ZIP/source parity | 00, 17, 19 | verified archive manifest + hash + parity | P0 |
| 03 | Toolchain, CI, build | 00, 01 | reproducible clean build and test tiers | P0 |
| 04 | Cognitive runtime | 03, 05 | one real full cognitive cycle | P0 |
| 05 | Persistence/recovery | 03, 04 | crash-safe restart and migration | P0 |
| 06 | MemoryOS2 | 05 | 10k-capable canonical memory | P0 |
| 07 | Retrieval evaluation | 06 | independent RU/EN holdout uplift | P0 |
| 08 | Continual learning | 06, 07, 11 | held-out transfer without regressions | P1 |
| 09 | World/perception | 04, 11 | grounded state and prediction calibration | P1 |
| 10 | Self/User/personality/affect | 04, 06, 09 | restart-safe continuity and evidence separation | P1 |
| 11 | Motivation/autonomy/actions | 04, 09, 10, 17 | useful, permissioned, recoverable initiative | P0 |
| 12 | LLM/model ecology | 03, 04, 17 | real provider identity, latency, honest fallback | P0 |
| 13 | Speech/audio | 12, 14, 15 | real ASR/TTS lifecycle and interruption | P1 |
| 14 | Embodiment | 10, 13, 15 | one state-to-motion/viseme pipeline | P1 |
| 15 | App/UI | 04, 12, 13, 14 | clean user journey and observable health | P1 |
| 16 | External integrations/portability | 11, 17 | staged, consented, replay-safe adapters | P1 |
| 17 | Security/privacy/governance | 03, 11, 16 | threat model, permission matrix, privacy tests | P0 |
| 18 | Reliability/performance/device | 04–17 | target-device metrics and soak | P0 |
| 19 | Research/legal/release | 00, 02, 07, 17, 18 | human legal gate + reproducible Release | P0 |

### Рекомендуемые волны реализации

- Wave A — Establish truth: 00 → 01 → 02 → 03. Никаких массовых merges; source/release parity и точная карта веток.
- Wave B — One recoverable brain: 04 → 05. Доказать один цикл через restart, не по отдельным unit tests.
- Wave C — Memory that scales and tells the truth: 06 → 07. Сначала capacity/retrieval contract, затем независимая оценка.
- Wave D — Safe agency: 09 → 10 → 11 → 17. Цель, причина, разрешение, действие, outcome, reflection, rollback.
- Wave E — Real model and embodiment: 12 → 13 → 14 → 15. Реальный provider и целевое устройство, не mock-only.
- Wave F — Product acceptance: 08 → 16 → 18 → 19. Transfer, portability, soak, legal, release.

## 5. Ключевые технические находки, уже включённые в карту

### 5.1 Runtime concentration
runtime/neuro-kurisu/src/organism/core/OrganismRuntime.ts — около 177 995 символов и 56 импортов в ранее полученном содержимом. Это сигнал концентрации orchestration, не доказательство дефекта. Рекомендация: постепенное выделение lifecycle/step/persistence/diagnostics coordinators, без переписывания фасада и без создания параллельных владельцев.

### 5.2 Memory capacity and retrieval
MemoryOS2.ts — около 190 123 символов / 2 344 строки в проверенном содержимом; активный encode path ограничивает resident records значением 1 600. Semantic retrieval в MemoryFabric opt-in через NK_EMBEDDINGS_RUNTIME_ENABLED; при disabled/busy/maintenance применяется lexical fallback. Это требует явного hot/warm/cold design и instrumentation фактического retrieval path. Цель 10k должна означать 10k searchable memories across tiers, а не только размер тестового массива.

### 5.3 Action governance
ActionGateway содержит permission contracts, idempotency, durable execution ledger, reconciliation, undo/compensation и postcondition verification. Следующий gate — fault-injection на crash-before/after-effect, timeout, duplicate key, mismatched payload, provider unknown state и repeated recovery.

### 5.4 Cognitive evidence
UnifiedCognitiveCycle разделяет core cycle и full cycle; CognitiveEventFabric проверяет стадии и причинные связи. Event buffer ограничен, поэтому долговременные receipts и operational journal должны быть независимы от оперативного кольцевого буфера.

### 5.5 HMX / privacy
PR #1083 — Draft, base SHA 4a46e724686814dc69b00acaeca530399d9b0910, head SHA e8343114e3a369d38a487425b5a2fd9613fea257, 6 files. В предыдущем проверенном exact-head срезе было 30/30 workflow success. Это не закрывает API/staging/apply/restart integration и не доказывает универсальную DLP-защиту. Нужны export allowlist, privacy preview, явное подтверждение и проверка, что staging не меняет canonical memory до apply.

### 5.6 Local model and body
Local OpenAI-compatible provider существует и ограничивает endpoint loopback; это не подтверждает реальное локальное inference на целевом устройстве. EmbodimentRuntime координирует body, voice и native events; требуется проверить реальный audio path и UI/renderer связь с тем же organism state.

## 6. Состояние 75-aspect registry — исторический snapshot, не readiness

Проверенный файл: engineering-os/aspects.v1.json, blob SHA 09c1ae368d070d873efe5925d792e42067f1443e. Дата реестра — 2026-11-06, его recorded source SHA — bcd48b1fd408a1539ac537813730669c35cfb3a2, что старше текущего source.

Исторические статусы в snapshot: 61 IMPLEMENTED, 1 CONNECTED, 1 TESTED, 11 PLANNED, 1 BLOCKED. Это не текущая доля готовности.

Наблюдения по качеству реестра:
- CONNECTED aspect reasoning и TESTED aspect reliability не содержат evidence refs, хотя правила самого registry требуют evidence для CONNECTED/TESTED/PROVEN.
- license-review (aspect 72) явно BLOCKED: root NOASSERTION, runtime all-rights-reserved, redistributionApproved=false.
- autonomy-soak, device-e2e, independent-holdout остаются PLANNED в snapshot.
- Некоторые владельцы повторяются между аспектами. Это не всегда ошибка: общий workflow/manifest может обслуживать несколько направлений. Но для runtime owners необходимо различать canonical owner и supporting artifact.
- Aspect status нельзя обновлять по факту наличия файла или PR. Требуется exact evidence receipt.

## 7. Release and legal truth

Последний опубликованный asset, указанный текущим README: Neuro_Kurisu_WORKPASS70_2026-10-19.zip, 135,290,615 bytes; GitHub metadata SHA-256 c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286. Bytes не были независимо скачаны и хешированы; extraction manifest и source/ZIP parity остаются UNVERIFIED. Source changes ноября не считаются RELEASED.

contracts/RELEASE_LICENSE_REVIEW.json остаётся pending. Root license NOASSERTION, runtime private/all-rights-reserved, 477 locked npm components и source archives ожидают human review. Redistribution approval=false. Это блокирующий release gate, не техническая мелочь.

## 8. P0 implementation plan — независимые deliverables

Каждая задача выполняется отдельным aspect branch и Draft PR; сначала тест, затем минимальное изменение, exact-head CI, evidence receipt. Не переписывать большие файлы ради эстетики.

### P0-A. Refresh source truth and analysis registry
Files: update proposed engineering-os/project-analysis.v1.json; update only after review engineering-os/aspects.v1.json; reconcile README.md, NEUROCORE_START_HERE.md, AGENTS.md, daily report.
Consumes: live source SHA, branch census, PR pages, exact-head Actions, release metadata.
Produces: source checkpoint receipt, branch/PR map, aspect evidence ledger.
Tests: JSON schema/duplicate IDs/owner existence/evidence requirement; assert every referenced SHA and branch is still reachable.
Exit: no contradictory current baseline; all statuses have evidence or explicit UNKNOWN/PLANNED/BLOCKED.

### P0-B. Memory scale contract
Files to inspect before editing: MemoryOS2.ts, MemoryFabric.ts, MemorySubstrateCoordinator.ts, persistence interfaces, existing retrieval and restore tests.
Consumes: canonical memory record API and existing persistence.
Produces: documented 10k contract across hot/warm/cold tiers and one retrieval result schema with provenance, path, latency and fallback reason.
Tests: 10k insertion, recall from each tier, temporal correction, forget, restart, dedupe, corruption, p50/p95/p99; verify no hidden loss at 1,600 active entries.
Decision seam: hot/warm/cold thresholds and whether cold tier is file-backed or existing DB; do not add a new database until current store limits are measured.

### P0-C. Cognitive-cycle end-to-end proof
Files: OrganismRuntime.ts, OrganismCore.ts, CognitiveCycleBoundary.ts, UnifiedCognitiveCycle, CognitiveEventFabric, OperationalJournal.
Consumes: one real runtime tick and current state store.
Produces: causally linked receipt from perception through consolidation.
Tests: missing stage, duplicate stage, out-of-order event, failed action, timeout, restart mid-cycle, ring-buffer rollover, restore of durable receipt.
Exit: coreComplete and fullComplete are distinct; no synthetic stage is counted as executed.

### P0-D. ActionGateway fault-injection
Files: ActionGateway, tool registry, execution ledger, postcondition verifier, recovery tests.
Consumes: existing idempotency and permission APIs.
Produces: replay/reconciliation matrix with zero duplicate irreversible side effects.
Tests: crash before effect, after effect/before receipt, provider timeout, unknown result, repeated request, same key/different payload, repeated recovery, compensation failure.

### P0-E. HMX privacy + integration closure
Files: PR #1083 six-file diff plus API/staging/apply tests.
Consumes: export intent, redactor, staging, canonical memory apply.
Produces: allowlisted preview and explicit apply receipt.
Tests: unauthenticated request, forged ID, reject-then-apply, replay, restart, source mutation, nested personal data, secrets in unusual structures, staging non-mutation.
Exit: explicit user approval and verified canonical apply; no privacy guarantee inferred from regex alone.

### P0-F. Release truth and reproducibility
Files: release workflow, manifest, license review, archive parity tooling.
Consumes: exact source commit, latest published ZIP, locked dependencies and provenance.
Produces: independently hashed archive, extraction manifest, parity report, SBOM and human-reviewed license receipt.
Tests: clean extraction/install/smoke; mismatch fails closed; missing legal approval blocks release.
Exit: no release unless source/ZIP exact parity and redistribution approval are verified.

## 9. P1/P2 map

- P1 learning: paired controls, immutable holdout, transfer, retention, catastrophic forgetting, delayed reward, skill promotion/rollback.
- P1 world/perception: sensor provenance, stale observations, uncertainty, causal calibration, world-model persistence.
- P1 identity/affect: user-claim vs verified fact separation, explicit forgetting, affect history aggregation/restore, personality continuity across provider changes.
- P1 local LLM: real model ID, actual inference, token/latency accounting, cancellation, fallback truth, model switch.
- P1 voice/avatar/app: real ASR/TTS, barge-in, viseme drift <=80ms, interrupt <=200ms, renderer parity, Android/Termux device tests.
- P1 integrations: each connector separately marked discovered/configured/connected/runtime-integrated/tested; no manifest-only completion.
- P2 research assimilation: all external sources receive exact hash, license/provenance, capability extraction, comparison against canonical owner, ablation and promotion decision. Research branches stay isolated until evidence passes.

## 10. Definition of Done for every work unit

A work unit is complete only when:
1. exact source base and branch are recorded;
2. canonical owner and changed interfaces are named;
3. focused test fails before the fix where applicable;
4. focused test passes after the fix;
5. affected integration/regression checks pass;
6. exact-head Actions are recorded against the same SHA;
7. security/privacy and persistence side effects are considered;
8. diff is scoped and no unrelated refactor is hidden;
9. status is one of IMPLEMENTED / CONNECTED / TESTED / DEVICE-VERIFIED / INDEPENDENTLY-PROVEN / RELEASED, with evidence;
10. docs and analysis tracker are updated without promoting synthetic evidence.

## 11. Immediate next sequence

1. Finish live PR census (all pages) and map high-overlap files / duplicate tips.
2. Reconcile all current source pointers; keep code checkpoint ef356 distinct from documentation HEAD 4a46.
3. Refresh 75-aspect registry against current source and attach evidence refs.
4. Close MemoryOS2 capacity/retrieval contract before adding new memory architecture.
5. Run targeted runtime/memory/action tests in isolated environment; no claims of pass until outputs are observed.
6. Close #1083 API/staging/privacy gaps without auto-merging.
7. Materialize and independently verify latest Release ZIP; keep license blocker explicit.
8. Only then promote the prototype acceptance matrix.

## 12. Analysis history

| Date | Scope added | New verified facts | Analysis coverage |
|---|---|---|---:|
| 2026-11-21 | Baseline, runtime, memory, actions, cycle, HMX, scripts, aspect registry | 1,072 branch refs; source doc HEAD 4a46 is one commit after code checkpoint ef356; MemoryOS2 active cap 1,600; semantic retrieval opt-in; registry is stale; license blocked | 39% |

Next update format: date; exact baseline; files/PRs/Actions examined; new risks closed/opened; per-stream coverage deltas; revised weighted total; work not performed. Never count the same file or evidence twice.


Project map review PR: https://github.com/ailtron1ss-rgb/NK1/pull/1084 (Draft; not merged). The branch is isolated from the canonical source branch.
