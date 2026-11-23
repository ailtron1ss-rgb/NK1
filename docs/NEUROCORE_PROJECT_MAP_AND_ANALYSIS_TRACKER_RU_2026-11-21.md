# LIVE INTEGRATION ADDENDUM — 2026-11-23

> This addendum supersedes only the live checkpoint and repository-census pointers below. The dated analysis body is retained as a historical snapshot from 2026-11-22; old SHA values and counts inside that body describe the earlier checkpoint, not the current source.

## Canonical source now

- Repository: `ailtron1ss-rgb/NK1`
- Canonical runtime source: `workpass70-source` at `4972c2d5228141ef9673be94fca243614d28d9d6`.
- `main` and published Release ZIP were not modified by the integration passes recorded here.
- Source integration is not equivalent to publishing a new Release ZIP or approving product readiness.

## Verified integration deltas

- **PR #1103** — merged at `272b1dc8431121efc3d948e194b99b29afd2a275`; exact-head Actions **27/27 SUCCESS**. Combined ActionGateway audit-preview credential redaction, bounded/cancellable autonomous cycle batches and safety-escalated cognitive wake/interrupt routing. Original donor PRs #1093/#1094/#1096 were closed as superseded; their source branches were retained.
- **PR #1104** — merged at `4972c2d5228141ef9673be94fca243614d28d9d6`; exact-head Actions **14/14 SUCCESS**. Combined P34 evidence lifecycle/restore reconciliation, Active Information Gain exact outcome attribution with a calibrated exploration evidence threshold (independent risk/resource ceilings retained), and HMX explicit-apply idempotency across server restart. The HMX restart replay verified `inserted=0`, `replayed=1`. Original donor PRs #1097/#1098/#1085 were closed as superseded; their source branches were retained.

## Fresh repository census — 2026-11-23

- Branch refs: **1,097**; unique HEAD SHAs: **1,078**.
- Exact duplicate-tip groups: **4**; excess alias refs: **19**. None of the duplicate branch names is the head of an open PR.
- Open PRs: **275**; unique PR head SHAs: **275**; Draft: **210**; Ready: **65**.
- Prefix counts: 274 `aspect/*`, 268 root-name refs, 180 `fix/*`, 159 `work/*`, 63 `consolidation/*`, 44 `feature/*`, 31 `docs/*`, 27 `integrate/*`, 14 `feat/*`; remaining prefixes total 37.
- Duplicate-tip groups eligible for a later, explicitly reviewed alias cleanup:
  - `f9621bf3e4411ce17bc809922a5f90126001f4fd`: `aspect/consequence-ecology-20261117`, `integrate/consequence-calibration-lineage-followup-20261120`.
  - `68a03799ca0c9f18e4c6e19399ed8018e0215e60`: `aspect/world-forge-integrated-20261117`, `integrate/worldforge-to-sharedfuture-after-calibration-20261120`.
  - `4972c2d5228141ef9673be94fca243614d28d9d6`: `consolidation/nk1-ledger-refresh-20261123`, `workpass70-source`. This same-tip alias appeared during concurrent work and is not a deletion candidate until the other session is confirmed inactive.
  - `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`: 17 legacy/workpass refs enumerated in the 2026-11-23 integration ledger.
- All 19 excess duplicate-tip branch names were checked against the full 275-open-PR list; none is the head branch of an open PR. The source-tip alias `consolidation/nk1-ledger-refresh-20261123` may be active in a parallel session and is excluded from cleanup pending confirmation. Closing a PR does not delete its source branch.

## Size and repository hygiene

- GitHub repository size snapshot: **149,326 KiB** (about **145.8 MiB**).
- One tracked object exceeded 10 MiB in the recursive source tree: `legacy/input-archives/grok-workspace.zip` at **51.78 MiB**. It is above GitHub's 50 MiB warning threshold but below the 100 MiB ordinary Git-file hard limit. No other tracked file in the inspected tree was at least 10 MiB.
- This archive is legacy input evidence; it was not copied into new branches or rewritten. Branch refs share Git objects, so the archive is not stored as a separate full copy per branch.
- No file-size-related merge blocker was observed in #1103 or #1104.

## Next convergence priorities

- Complete the docs salvage from PR #1084 without importing stale README/AGENTS/Start-Here checkpoint blocks.
- Replace the superseded #1102 ledger with this current ledger and close that duplicate integration PR after preserving useful evidence.
- Treat #1095, #1101 and #1099 as high-collision candidates: they share `OrganismRuntime.ts`, `UnifiedCognitiveCycle.ts`, package/workflow or server integration surfaces. Do not combine them blindly; map runtime ownership and lifecycle ordering first.
- Reduce branch refs only after duplicate-tip and merged-ancestor candidates have been checked against open PRs and retained references. The current GitHub connector can inspect/create/update refs but cannot delete them; branch deletion requires an authenticated GitHub session or an equivalent authorized GitHub operation.

---

# NeuroCore / NK1 — карта проекта и трекер глубины анализа

> Тип документа: живой инженерный навигатор и реестр покрытия анализа.
> Срез: 2026-11-22.
> Каноническая кодовая база: workpass70-source; актуальный кодовый checkpoint после HMX integration — a98dbfe858be2df19fa01a78639a23f962920aa0.
> Документационная ветка docs/neurocore-project-map-analysis-20261121 синхронизирована с source checkpoint a98dbfe858be2df19fa01a78639a23f962920aa0; актуальный HEAD отслеживается в PR #1084.
> main: 06e01cdd0a8e60ed70991f22e842887f544d1ebf (release/metadata lineage; не подменяет runtime source).
> Назначение: карта отражает структуру, зависимости, подтверждённые факты, неизвестные области и очередность проверки. Она не объявляет функции готовыми.

## Live evidence delta — 2026-11-22

- Canonical source: workpass70-source @ a98dbfe858be2df19fa01a78639a23f962920aa0; main @ 06e01cdd0a8e60ed70991f22e842887f544d1ebf. Exact-SHA source Actions: 18/18 completed SUCCESS, all check-runs bound to the same source SHA.
- PR #1083 merged externally and is the current source HEAD: bounded HMX 1.7 export/external-file staging. The canonical HMX bridge exposes stage → decide → explicit apply; acceptance alone does not mutate MemoryOS2, and apply requires separate confirmation. The dedicated workflow includes runtime typecheck, canonical HMX bridge regression and explicit-apply consent regression.
- PR #1059 merged externally: locale-neutral BM25 document tokenization. It removes host-locale variance but does not demonstrate recall uplift (synthetic recallDelta=0).
- Branch census: 1,073 refs / 1,055 unique HEADs / 3 duplicate-tip groups / 18 excess aliases. Open PR census: 270 PRs / 270 unique heads / 205 Draft / 65 Ready. PR #1079 preserved 15 already-integrated histories as ancestry.
- PR #903 is 180 ahead / 994 behind current source; PR #866 is 79 ahead / 1,009 behind. Neither is safe for blind rebase/merge. #866 has an ACP import failure in its old environment; equivalent explicit HMX apply/consent behavior is present in current source, so compare only remaining unique behavior before recommending closure.
- Stable and prerelease ZIP metadata remain October 19. Archive bytes, independent hash, extraction manifest and source parity are not verified. Human license review remains pending; redistributionApproved=false.
- No independent RU/EN holdout, target-device soak, physical audio measurement or release approval was added in this cycle. Analysis coverage is an audit-depth estimate only, not product readiness.

## 1. Как читать прогресс

В документе существуют три независимые шкалы. Их нельзя смешивать.

1. Покрытие анализа — насколько глубоко изучены код, интерфейсы, тесты, CI и реальные ограничения направления.
2. Состояние реализации — существует ли функциональность и связана ли она с остальной системой.
3. Доказанность — прошла ли функция нужные тесты, независимую оценку, целевое устройство и release gate.

### Текущий прогресс анализа

**Оценка покрытия анализа: 40% (ориентир, не измерение готовности продукта).**

Метод: проект разделён на 20 потоков программы завершения; каждому потоку назначена одинаковая доля 5%. Для каждого потока выставлена глубина анализа 0–100% по четырём признакам: прочитана архитектурная документация; определены владельцы и границы; проверены ключевые исходники/контракты; сверены тесты и evidence gaps. Итог — среднее значение по 20 потокам. Это экспертная оценка покрытия текущего аудита, не процент написанного кода и не процент готовности NeuroCore.

| Поток | Глубина анализа | Основание / пробел |
|---|---:|---|
| 00. Truth, inventory, provenance | 75% | README, baseline, release/license и источники истины сверены; полный file/dependency inventory ещё нет |
| 01. Branches, PR, convergence | 75% | Полная пагинация: 1 073 refs / 1 055 unique HEADs / 3 duplicate-tip groups; 270 open PRs / 270 unique heads; stale #903 и #866 измерены, полный file-level salvage ещё не завершён |
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
| 16. External integrations/portability | 55% | HMX 1.7 export/staging, canonical stage/decide/apply, explicit consent, replay-idempotency и workflow/tests просмотрены на live source; остальные адаптеры и полный portable-state E2E не проверены |
| 17. Security/privacy/governance | 45% | API policy, ActionGateway и HMX redaction изучены; threat model, full tool inventory и penetration/fuzz testing отсутствуют |
| 18. Reliability/performance/device | 35% | Метрики и ключевые ограничения определены; 10k/phone/soak/latency benchmarks не запускались |
| 19. Research/legal/release/handoff | 40% | Research intake и license blocker проверены; upstream provenance, human legal decision и release parity открыты |
| **Итого** | **40%** | Средняя глубина по 20 потокам |

Правило пересчёта: менять процент только после записи новых проверенных файлов, интерфейсов, тестов и evidence. Простое чтение ещё одного README не должно резко повышать покрытие. После каждого крупного прохода сохранять дату, baseline и изменения по потокам.

## 2. Source of truth и расхождения документов

| Источник | Назначение | Состояние на этом срезе |
|---|---|---|
| README.md | Live checkpoint и текущие ограничения | Обновлён на live source checkpoint a98dbfe858be2df19fa01a78639a23f962920aa0; exact-SHA Actions 18/18 SUCCESS |
| NEUROCORE_START_HERE.md | Handoff | Обновлён на live source checkpoint a98dbfe858be2df19fa01a78639a23f962920aa0; PR #903/#866 divergence и Release gates зафиксированы |
| AGENTS.md | Правила разработки | Обновлён на live source checkpoint a98dbfe858be2df19fa01a78639a23f962920aa0; branch/PR census и Release/license gates указаны |
| docs/NK1_100_PERCENT_COMPLETION_PROGRAM_RU_2026-11-18.md | Главный исполняемый backlog | 20 потоков / 305 work units; source baseline 2026-11-18 исторический, ежедневные evidence обновляются отдельными checkpoint reports |
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
PR #1083 merged 2026-11-22 into workpass70-source: exact head b99838bf795ad01051847f6c6ab0b2a4e0594613, merge commit a98dbfe858be2df19fa01a78639a23f962920aa0, 8 files (+417/-24). Merge tree 77f6e904b81443f4f0d79dce62773dfeb9c29db9 is byte-for-byte the same Git tree as the reviewed PR head. Exact-head Actions: 34/34 check runs and 30/30 workflow runs succeeded. The change adds intent-aware HMX 1.7 export, bounded accessor-safe nested snapshots with heuristic redaction, external-file staging, separate accept/apply confirmation and a 2 MiB upload cap aligned with the canonical bridge. Redaction is not universal DLP. Remaining work: allowlisted privacy preview, broader adversarial PII/secret cases, explicit auth-boundary tests and independent verification that staging alone cannot mutate canonical memory.

PR #866 remains a separate Draft donor: 21 files, head 928b85b981e887f595d7fb2cb6a1cec5611f7c40, based on old f6f8720b02748ac229635d56e81c115e83c96a62; current-source compare is diverged (79 donor-side commits / 1,008 source-side commits). Two donor files, HexisCanonicalMemoryProjector.ts and HmxExportRedactor.ts, are absent from current source. Preserve the branch and review those unique contributions selectively; do not merge the stale branch tree.

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
Files: merged PR #1083 eight-file diff plus the existing canonical HMX bridge.
Consumes: export intent, bounded snapshot/redactor, external-file staging, explicit accept/apply gates.
Produces: bounded redacted HMX export and a staged external document that must pass the existing canonical apply boundary.
Tests added in #1083: nested redaction contract, accessor/cycle rejection, supported-intent validation, stage/accept/reject route path and a 300 KiB request above the general 256 KiB API limit. Existing canonical-apply/restart/replay coverage remains a separate source gate.
Still required: allowlisted privacy preview, adversarial PII/secret fixtures, auth/forged-ID checks and a direct proof that staging alone never mutates canonical memory. No universal privacy guarantee is inferred from regex alone.

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
6. #1083 is merged; close the remaining HMX privacy and non-mutation gaps, then selectively review the stale #866 donor without merging its branch tree.
7. Materialize and independently verify latest Release ZIP; keep license blocker explicit.
8. Only then promote the prototype acceptance matrix.

## 12. Analysis history

| Date | Scope added | New verified facts | Analysis coverage |
|---|---|---|---:|
| 2026-11-21 | Baseline, runtime, memory, actions, cycle, HMX, scripts, aspect registry | 1,072 branch refs; source doc HEAD 4a46 is one commit after code checkpoint ef356; MemoryOS2 active cap 1,600; semantic retrieval opt-in; registry is stale; license blocked | 39% |

Next update format: date; exact baseline; files/PRs/Actions examined; new risks closed/opened; per-stream coverage deltas; revised weighted total; work not performed. Never count the same file or evidence twice.


Project map review PR: https://github.com/ailtron1ss-rgb/NK1/pull/1084 (Draft; not merged). The branch is isolated from the canonical source branch.


---

## 12. Углублённый проход №2 — 2026-11-21

**Статус прохода:** read-only анализ исходников и PR, обновление только этого навигационного документа. Runtime source, Releases, `main`, существующие feature branches и PR не изменялись. Тесты в этой сессии не запускались.

### 12.1 Новая оценка глубины анализа

**Текущее покрытие анализа: 42%** (предыдущий зафиксированный срез: 39%). Это глубина исследовательского покрытия, а не готовность продукта, объём реализации или процент пройденных тестов.

| Поток | Было | Сейчас | Что добавлено в анализ |
|---|---:|---:|---|
| 00 Truth / provenance | 75 | 75 | Без изменения |
| 01 Branches / PR convergence | 65 | 75 | Проверены 100 открытых PR-результатов, точные SHA и расхождение шести крупных архитектурных PR |
| 02 Release ZIP parity | 35 | 35 | Архив по-прежнему не скачан и не сверён побайтно |
| 03 Toolchain / CI | 40 | 40 | Без новых запусков CI/build |
| 04 Runtime / cycle | 50 | 55 | Дополнительно просмотрен импортный слой OrganismRuntime и связка Core/World/Plan/Embodiment/Evidence |
| 05 Persistence / recovery | 25 | 30 | Дополнительно изучен StateMigrations и память/replay restore contracts; crash matrix не выполнена |
| 06 MemoryOS2 / retrieval | 75 | 82 | Подтверждены фактический предел 1 600 записей, bitemporal path, retrieval limit, residency governor и единая mutation boundary |
| 07 Evaluation science | 55 | 55 | Без нового независимого holdout результата |
| 08 Continual learning | 25 | 30 | Разобраны границы P27/P28/Neural Prosthesis/Neural JIT и research-vs-production gates |
| 09 World / perception | 15 | 25 | Изучена архитектура Observation Intake Gate из PR #821 и Shared Future / World Forge PR #903 |
| 10 Self / identity / affect | 20 | 20 | Новые данные недостаточны для изменения оценки |
| 11 Motivation / autonomy / actions | 60 | 65 | Проверены ActionGateway execution semantics и Shared Future external outcome binding |
| 12 LLM / model ecology | 25 | 30 | Разобраны границы Neural Prosthesis/JIT и offline adapter promotion; реальный target inference не проверен |
| 13 Speech / audio | 20 | 20 | Без изменения |
| 14 Avatar / embodiment | 20 | 20 | Без изменения |
| 15 App / UI | 10 | 10 | Без изменения |
| 16 Integrations / portability | 35 | 45 | Проверены HMX export/staging path, старый accept/apply donor и граница canonical memory |
| 17 Security / privacy / governance | 45 | 50 | Дополнительно проверены accessor-safe memory/export patterns, approval, provenance, fail-closed candidate gates |
| 18 Reliability / performance / device | 35 | 38 | Уточнены bounded-ledger и residency limits; измерения на устройстве не проводились |
| 19 Research / legal / release | 40 | 40 | Без нового legal approval или ZIP parity evidence |
| **Среднее** | **39%** | **42%** | 20 потоков с равным весом 5%; сумма глубин 840 / 20 |

Историческое значение 39% сохраняется как контрольная точка. Нельзя задним числом переписывать прошлый срез.

### 12.2 Обновлённое дерево архитектуры — runtime truth

```text
NeuroCore / NK1
│
├── A. Runtime composition & state
│   ├── OrganismRuntime                 [orchestration / host boundary]
│   │   ├── RuntimeInputPolicy
│   │   ├── WorldContextNormalizer
│   │   ├── FileStateStore
│   │   ├── OperationalJournal
│   │   ├── CognitiveEventFabric
│   │   ├── UnifiedCognitiveCycle
│   │   ├── RuntimeEvidenceBus
│   │   ├── EmbodimentRuntime
│   │   └── OrganismCore                [canonical cognitive state/decisions]
│   │
│   ├── Persistence
│   │   ├── StateMigrations
│   │   ├── FileStateStore
│   │   └── OperationalJournal
│   │
│   └── Rule: one runtime, one canonical OrganismState, one owner per mutable facet
│
├── B. Cognitive loop
│   ├── Perception / Observation admission
│   ├── Appraisal / affect / attention
│   ├── Goal genesis / motivation
│   ├── PlanEngine / WorldModel
│   ├── ActionGateway
│   ├── OutcomeVerificationService
│   ├── CognitiveEventFabric / evidence
│   └── Reflection / consolidation / learning
│
├── C. Memory & learning
│   ├── MemoryOS2                   [canonical memory record owner]
│   ├── MemoryFabric                [single mutation/retrieval lifecycle]
│   ├── MemoryResidencyGovernor     [hot/warm/cold budget policy]
│   ├── EvidenceLineage / bitemporal history
│   ├── ContinualReplayBuffer / P23
│   ├── P27 ephemeral context adaptation
│   ├── P28 plasticity substrate
│   └── P25 / adapter registry     [candidate/host-approved model adapters]
│
├── D. World & agency
│   ├── ObservationIntakeGate (PR #821 donor; verify current integration)
│   ├── GroundedWorldState
│   ├── WorldModel / WorldModel2
│   ├── PlanEngine / FutureSimulator
│   ├── SharedFutureEngine (PR #903 donor)
│   └── ActionGateway → external postcondition → outcome evidence
│
├── E. Model & interaction
│   ├── LanguageOrgan / provider ecology
│   ├── Local OpenAI-compatible provider
│   ├── optional Neural Prosthesis sidecar (PR #925)
│   ├── optional Neural JIT shadow capture (PR #926)
│   ├── ASR / TTS / voice observer
│   ├── EmbodimentRuntime
│   └── Live2D / 2.5D / VRM / app UI
│
└── F. Cross-cutting trust planes
    ├── Consent / permissions / approvals
    ├── Provenance / independent evidence / holdout isolation
    ├── Idempotency / reconciliation / undo
    ├── Observability / budgets / fault recovery
    ├── Dependency and license provenance
    └── Reproducible release / SBOM / ZIP hash
```

Это дерево — карта фактических импортов и контрактов, частично подтверждённая исходниками; это не утверждение, что каждый узел уже подключён к production flow. PR-доноры явно отмечены отдельно.

### 12.3 Важные исходные контракты, подтверждённые чтением кода

**MemoryOS2**
- Реальный путь создания записи добавляет запись в `state.items`, обновляет индексы и при превышении 1 600 элементов удаляет последний элемент из resident-массива.
- Retrieval формирует выборку кандидатов и возвращает не более 32 выбранных записей до последующей фильтрации/материализации.
- В запросе есть temporal mode, valid-time и knowledge-time, защита от устаревших/квартинированных записей, bilingual intent routing и semantic/lexical ranking signals.
- Bitemporal revision сохраняет прежнее состояние и различает время действия факта и время, когда система узнала о нём.
- Это сильная база для temporal memory, но текущий 1 600-record cap — прямой блокер критерия 10k searchable memories в текущем виде.

**MemoryResidencyGovernor**
- Политика делит бюджет на hot/warm/cold, но её `targetItems` ограничен максимумом 1 600.
- Комментарий говорит, что governor не удаляет canonical memory, однако сам MemoryOS2 resident array имеет отдельный hard cap и удаляет запись при encode. Нужно доказать, где физически сохраняется cold tier и как он повторно индексируется/поисково доступен. Пока нельзя трактовать три названия tiers как реализованное долговременное 10k-хранилище.

**MemoryFabric**
- Документирована и реализована единая mutation boundary: MemoryOS2 остаётся единственным writable store.
- Команды encode/link/revise/update/evidence/forget получают fingerprint; повтор с тем же commandId и другим payload отклоняется.
- Горячие receipts ограничены, а retired receipt Bloom tombstones заставляют неоднозначный повтор требовать reconciliation вместо повторного выполнения. Это fail-closed дизайн; нужно измерить false-positive/recovery behavior и проверить crash points.

**ActionGateway**
- Execution context связывает tool с decisionId, idempotency key и автономным контекстом.
- Отличаются no-effect, partial, uncertain и verified outcomes; неопределённый сетевой результат не должен превращаться в ложный failure/no-op.
- Undo plan подготавливается до исполнения; внешнее состояние должно быть reconciled, прежде чем outcome станет обучающим сигналом.
- Следующий обязательный gate — интеграционная fault matrix, а не ещё один изолированный unit test.

**StateMigrations**
- Файл импортирует широкий набор canonical state owners и default-state factories. Это подтверждает, что миграции — центральный узел совместимости, поэтому каждый новый facet/ledger требует allowlist, schema-version, restore test и старый snapshot fixture.
- Масштаб import list — риск сложности и частоты конфликтов, но не самостоятельное доказательство дефекта.

### 12.4 Branch / PR convergence — проверенные решения

| PR | Изменения / ветка | Состояние относительно source checkpoint a98… | Рекомендация |
|---|---|---|---|
| #1084 | Живая карта и машинные реестры, docs-only, 4 файла | Синхронизирован с source @ a98…; Draft; 0 commits behind; после обновления реестров нужен новый exact-head CI | Оставить Draft до проверки актуального snapshot и CI |
| #1083 | HMX export/staging, 8 файлов, +417/-24 | Merged 2026-11-22; head b998…; merge a98…; 34/34 checks | Интегрировано в source; не считать выпущенным в Release ZIP |
| #902 | Developmental Genome, 57 файлов в PR metadata, +11 009/-140 | Draft; mergeable=false; compare 43 ahead / 987 behind | Не сливать целиком; переносить только genome bridge после diff по актуальным owners |
| #903 | Shared Future / World Forge, 29 файлов, +7 391/-13 | Draft; mergeable=false; compare 180 ahead / 993 behind | Сохранить как донор; проверить state migration и core changes отдельно |
| #924 | P27 test-time plasticity, 12 файлов, +997/-35 | Draft; mergeable=false; compare 29 ahead / 993 behind | Наиболее узкий research candidate; сверить exact owner path и preserve session isolation |
| #925 | Neural Prosthesis, 26 файлов, +4 993/-19 | Draft; mergeable=false; compare 75 ahead / 986 behind | Только offline/sidecar research; не подключать к primary inference без model/device evidence |
| #926 | Neural JIT, 13 файлов, +1 966/-4 | Draft; mergeable=false; compare 44 ahead / 993 behind | Оставить shadow-only; primary inference и веса не менять |
| #933 | OmeStro integration kernel, 11 файлов, +2 284/-1 | Draft; mergeable=false; compare 23 ahead / 991 behind | Использовать как карту идей/контрактов; не считать объединённой интеграцией |

**Метод сравнения:** PR refs сопоставлены с контрольным source SHA 4a46…; ahead/behind относится к истории Git и не равно числу уникальных полезных изменений. У PR #902/#903/#924/#925/#926/#933 большая история расхождения; GitHub mergeable=false. Патчи просмотрены выборочно по файлам и ключевым участкам, не каждый изменённый символ.

**Новый риск:** PR #902 содержит не только Developmental Genome, но также изменения workflow, package manifests, P25/Neuro-Plastic и других контуров. Его размер и пересекающиеся owners делают прямое объединение особенно опасным. PR #903 затрагивает OrganismCore, CognitiveRuntimeCluster, StateMigrations, FutureSimulator, WorldForge и shared-future ledgers — это широкое изменение нескольких критических владельцев сразу. Сохранять полезные тесты и отдельные функции, но портировать на свежих aspect branches.

### 12.5 Матрица зависимостей и конфликтных швов

| Шов | Источник истины | Главный риск | Что доказать |
|---|---|---|---|
| Runtime ↔ Core | OrganismRuntime / OrganismCore | Второй lifecycle или двойное обновление состояния | Один полный cycle trace и persisted snapshot |
| Core ↔ Memory | MemoryFabric → MemoryOS2 | Прямые обходные записи, 1 600 cap, потеря cold tier | Все write paths + 10k searchable + restore/forget |
| Core ↔ World | GroundedWorldState / WorldModel | Модельный вывод выдаётся за наблюдение | Provenance admission, conflict preservation, point-in-time restore |
| Planner ↔ Action | ActionGateway | Исполнение без decision/approval/undo | Crash-before/after effect, timeout, replay, compensation |
| Action ↔ Learning | OutcomeVerificationService / evidence ledger | Reward от ACK или self-report | Только exact decision-linked independent postcondition |
| Learning ↔ Model | P23/P25/P27/P28 adapters | Research candidate попадает в live inference | Host attestation, exact model revision, immutable holdout, rollback |
| Core ↔ Embodiment | EmbodimentRuntime / MotorFrame | Avatar показывает эмоцию/действие, не совпадающее с Core | State-to-expression-to-rendered-frame E2E |
| HMX ↔ Memory | Hexis bridge → MemoryFabric | accept/stage вызывает canonical write до explicit apply | Stage non-mutation, explicit consent, idempotent apply, restart |
| Engineering OS ↔ repo | Manifest / evidence ledger | Manifest считает connector подключённым без runtime integration | Contract test + exact-SHA receipt + runtime smoke |
| Source ↔ Release ZIP | release manifest / artifact | ZIP отстаёт от source или содержит непроверенные лицензии | ZIP SHA, extraction, source parity, SBOM, human legal approval |

### 12.6 Новый план следующих проходов

**P0 — Истина и ограничители**
1. Зафиксировать текущий source HEAD и отделить его от docs PR base/head.
2. Достроить PR topology: branch tip SHA, merge base, duplicate tips, overlap по файлам, зависимые stacked PR.
3. Проверить все current open PR страницы; 100 результатов последнего поиска — это лимит возвращённой выборки, не утверждение о полном количестве открытых PR.
4. Проверить актуальность 75-aspect registry и его schema/evidence references.
5. Скачать latest Release ZIP, независимо посчитать SHA-256, извлечь в отдельный read-only каталог, сравнить manifest/critical paths с source. Не публиковать новый ZIP до legal approval.

**P0 — Memory 10k contract**
1. Построить полный data lifecycle: encode → dedupe → index → residency → evict/archive → retrieve → revise → forget → restore.
2. Найти и доказать storage backend cold tier; если его нет — зафиксировать архитектурный gap.
3. Разделить capacity: canonical durable count, resident RAM count, indexed searchable count, vector-materialized count.
4. Зафиксировать retrieval SLO по hot/warm/cold, RU/EN, temporal, identity, causal, contradiction и abstention queries.
5. Добавить 10k/100k load, restart, corruption, migration, deletion/forget, latency/memory budget tests.

**P0 — Один сквозной цикл**
1. Проследить один наблюдаемый факт через Observation Intake → World State → Core appraisal → goal/plan → ActionGateway → external postcondition → reflection → MemoryFabric.
2. Перезапустить процесс на каждом durable boundary и проверить, что система не повторяет side effect и не теряет причинную связь.
3. Снять fault matrix: crash before write, after write/before receipt, timeout, partial provider effect, duplicate idempotency key, changed payload, compensation failure.

**P1 — Safe agency / self / world**
1. Верифицировать initiative scheduler: кто создал цель, почему она допустима, как учитывается cooldown, user consent и suppression.
2. Проверить независимость observation provenance и derived/model output.
3. Проверить identity continuity и forgetting across snapshots, migrations, HMX, exports и user corrections.

**P1 — Model / voice / avatar**
1. Подтвердить реальный локальный inference и точную модель/ревизию, не только loopback endpoint.
2. Развести ASR provider, voice observer, TTS output и consent lifecycle.
3. Пройти browser/Android E2E: Core state → affect → speech prosody → viseme/motion → rendered frame; измерить lip drift и interruption.

**P0 — Release gate**
1. Human license decision и provenance по всем lockfile/source archives.
2. Clean build и tests на exact candidate SHA.
3. SBOM, reproducible archive, SHA-256, clean-room boot, upgrade/rollback.
4. Отдельно подписать IMPLEMENTED / CONNECTED / TESTED / DEVICE-VERIFIED / INDEPENDENTLY-PROVEN / RELEASED.

### 12.7 Источники и ограничения этого прохода

- Основная база — `workpass70-source`; исторический code checkpoint, указанный в живой карте, — `ef3564c519e9f39f6d6e95834a2fcde202cdc8fa`; docs checkpoint — `4a46e724686814dc69b00acaeca530399d9b0910`.
- Проверены исходные фрагменты MemoryOS2, MemoryFabric, MemoryResidencyGovernor, ActionGateway, StateMigrations, OrganismRuntime; большой OrganismCore не удалось получить целиком через file-content response, поэтому Core import graph остаётся неполным.
- Проверены PR metadata и выборочные patches #902, #903, #924, #925, #926, #933, #1083, #1084; PR #821 рассмотрен по описанию/архитектурной схеме.
- 100 PR — только возвращённая поиском выборка. 1 072 branch refs — ранее завершённая полная пагинация branch search; SHA всех 1 072 tips и дубликаты пока не вычислены.
- Никакие тесты, build, device soak, release ZIP extraction/hash или legal review в этом проходе не запускались.
- Следующий процент увеличивать только после фактического изучения новых owner files, branch topology, test receipts и/или release artifact evidence.


### 12.8 CI refresh после обновления карты — 2026-11-21

- PR #1083, exact head `e8343114e3a369d38a487425b5a2fd9613fea257`: GitHub Actions association returned **31 completed / 31 SUCCESS** in the latest check. Это подтверждает CI на данном PR head, но не закрывает явно записанные route-level integration, UI file-selection/staging, exact production build/typecheck и human review gaps.
- PR #1084, exact documentation head `8dd658c0fdf78856c4cd66dedeb09b73b19f7f32`: на момент последнего опроса 3 PR-triggered runs — **2 SUCCESS, 1 IN_PROGRESS** (WorkPass79 cognitive runtime regression). Успешные: UserModel explicit-forget integrity и Aspect 02 original 2D asset contract.
- Нельзя объявлять #1084 CI завершённым, пока WorkPass79 не перешёл в terminal conclusion. Этот workflow относится к тестам, запускаемым GitHub на docs PR, а не к новому runtime code change.
- PR #1084 остаётся Draft, не merged; base `workpass70-source` @ `4a46e724686814dc69b00acaeca530399d9b0910`, 3 commits ahead / 0 behind, 1 docs file (+510 lines). Runtime source не менялся.


---

## 13. Углублённый проход №3 — 2026-11-21

### 13.1 Контрольная оценка анализа

**Покрытие анализа: 44%** (предыдущий срез: 42%; исторически 39%). Это экспертная оценка глубины изучения 20 потоков, не project readiness и не implementation completion.

| Поток | Было | Сейчас | Новая доказательная работа |
|---|---:|---:|---|
| 00 Truth / provenance | 75 | 77 | Live README, merge SHA, exact-head Actions и сверка счётчиков |
| 01 Branches / PR convergence | 75 | 78 | Полная пагинация: 1,073 refs / 12 страниц; PR search непригоден для точного open count |
| 02 Release ZIP parity | 35 | 35 | ZIP не скачан/не хеширован |
| 03 Toolchain / CI | 40 | 43 | Root/runtime package scripts и exact-head CI #1075/#1076/#1078/#1081/#1084 |
| 04 Runtime / cycle | 55 | 58 | MechanismSerendipity через OrganismSystemFabric / EvidenceResearchSubsystemRuntime |
| 05 Persistence / recovery | 30 | 30 | File-backed restart подтверждён в synthetic E2E; crash matrix открыта |
| 06 MemoryOS2 / retrieval | 82 | 86 | RU/EN E2E, hard-cap, maintenance, restore и vector-index limits |
| 07 Evaluation science | 55 | 60 | B261 matched baseline и граница synthetic vs independent evidence |
| 08 Continual learning | 30 | 33 | Verify-only experiment → ScientificMethodEngine contract |
| 09 World / perception | 25 | 30 | Declared-dependency provenance, confidence cap <=0.65 |
| 10 Self / identity / affect | 20 | 20 | Новых owner-level данных недостаточно |
| 11 Motivation / autonomy / actions | 65 | 65 | Новых soak-доказательств нет |
| 12 LLM / model ecology | 30 | 30 | Реальный configured provider/device inference не проверен |
| 13 Speech / audio | 20 | 20 | Без изменения |
| 14 Avatar / embodiment | 20 | 20 | Без изменения |
| 15 App / UI | 10 | 10 | Без изменения |
| 16 Integrations / portability | 45 | 50 | 48 connector entries в manifest unverified/disabled |
| 17 Security / privacy / governance | 50 | 55 | Fail-closed policy, explicit forget, evidence gates |
| 18 Reliability / performance / device | 38 | 38 | Нет новых device/soak measurements |
| 19 Research / legal / release | 40 | 40 | License/ZIP gates без изменений |
| **Среднее** | **42.0%** | **43.9% → 44%** | Сумма глубин 878 / 20 |

### 13.2 Веточная картина

- Повторная полная пагинация search_branches: **1,073 branch refs / 12 pages / no remaining cursor**. В предыдущем snapshot было 1,072. Это число refs, а не уникальных реализаций.
- Branch search API возвращает только имена, не tip SHAs. Уникальные HEADs, duplicate-tip groups и ancestry 1,073 веток в этом проходе не вычислены.
- Последняя PR search выборка вернула 100 элементов, но в неё попали PR, отдельные get_pr_info которых подтверждают merged=true (#1075/#1076/#1078/#1081). Следовательно, search result set нельзя использовать как достоверный open-PR census.
- Исторические 275 open PR нельзя считать текущим числом без корректной полной пагинации.
- Новые полезные доноры: #900 Negative Space Memory, #904 Mechanism Serendipity donor, #920 Hyper-Plastic Network, #927 Substrate Independence, #929 Teacher-Student Distillation, #901 ChronoTruth (merged), #866 HMX canonical apply (Draft), #109 dependency contracts (Draft, но основан на старой nk1-all-branches-merge-2026-10-23, не на canonical source).

### 13.3 75-aspect registry: исправление предыдущей ошибки

Текущий engineering-os/aspects.v1.json: blob SHA 09c1ae368d070d873efe5925d792e42067f1443e, дата 2026-11-06, recorded source SHA bcd48b1fd408a1539ac537813730669c35cfb3a2. Счётчики: 61 IMPLEMENTED, 1 CONNECTED, 1 TESTED, 11 PLANNED, 1 BLOCKED.

**Исправление:** прошлое утверждение, что reasoning и reliability не имеют evidence refs, было ошибочным. Реальное поле JSON называется evidence; у обоих оно заполнено. Reasoning описывает частичное contradiction detection wiring, а не универсальную дедукцию/индукцию/абдукцию. Reliability ссылается на PR #594/#607 exact-head evidence и ограничивает доказательство deterministic process-kill coverage.

Открытые registry gates:
- license-review (72) — BLOCKED, redistributionApproved=false.
- autonomy-soak (65) — PLANNED, owner UNKNOWN.
- device-e2e (66) — PLANNED, owner UNKNOWN.
- independent-holdout (68) — PLANNED, immutable RU/EN holdout, >=5 paired seeds не закрыты, recallDelta=0.
- 2.5D, speech, android имеют статус IMPLEMENTED, но notes указывают на незавершённые production art/IK, voice fallback validation и real-phone soak. IMPLEMENTED означает наличие основы/кода, не device-proven completion.

### 13.4 Engineering OS manifest: catalog ≠ runtime integration

engineering-os/manifest.v1.json blob SHA 79a8962a38a069db3f437922683e625f91c0974f.

Политика manifest: default trust=untrusted; credentials только environment/secret manager; no automatic production writes; no self-approval; immutable holdouts; exact-SHA evidence; branch isolation; promotion requires independent verification.

Все 48 connector entries имеют connectionStatus=unverified, runtimeIntegrated=false, enabled=false. Это fail-closed и должно оставаться честным. Наличие записи GitHub/Replit/Supabase/Firecrawl/Context7/TinyFish/Redis или установленного плагина не доказывает adapter integration в runtime NK1. Для включения нужны contract tests, security review, exact-SHA evidence и promotion.

### 13.5 Memory lifecycle E2E — точная граница

Файл runtime/neuro-kurisu/tests/prototype-0-1-bilingual-memory-e2e.mjs: blob SHA 932a18f3d37a3b6b849ec49f7a3a574701db6ef3.

Проверяет:
1. RU memory → EN query и EN memory → RU query.
2. FileStateStore snapshot, reopen и restore в новый MemoryOS2.
3. Сохранение sessionId, provenanceClass, independenceKey.
4. Bitemporal correction с supersedesId/revisionGroupId.
5. Повторный save/restore после correction и отсутствие superseded revision в current retrieval.
6. Explicit forget, согласованность concept index.
7. Повторный restart после forget и отсутствие resurrection.
8. Grounded abstention на отсутствующем концепте.

Ограничения:
- embeddingProvider=null: тест проверяет lexical/hybrid cross-language path, не semantic embedding provider.
- Synthetic fixture из двух специально подобранных записей.
- Не нагрузочный тест 1,600/10,000/100,000 записей.
- FileStateStore проверяется через временный JSON snapshot и новые instances, не через power-loss/SIGKILL на каждом write boundary, filesystem corruption или Android storage.
- Не доказывает независимый RU/EN retrieval uplift.

Статус: **TESTED — narrow synthetic E2E**, не INDEPENDENTLY-PROVEN.

### 13.6 MemoryOS2: реальный hard-cap lifecycle

Просмотр полного исходника подтвердил:
- Encode добавляет запись в state.items; при length > 1600 удаляет последнюю запись, чистит индексы и dedup projections.
- Restore принимает sourceItems.slice(0,1600); лишнее отражается в truncatedRows.
- Maintenance hard cap ограничен максимумом 1,600; удаление выполняется через forgetById(..., 'capacity') и pressure eviction.
- После maintenance список снова обрезается slice(0,1600).
- Semantic embedding index также ограничен 1,600 и очищается по LRU; это не cold durable store.
- Hybrid retrieval candidateSelectionLimit=192; это лимит candidate pool, отдельный от result top-k.
- MemoryResidencyGovernor назначает hot/warm/cold labels и budget, но targetItems тоже capped at 1,600. Класс описывает residency policy, а не отдельную durable cold database.

**Следствие:** текущий canonical MemoryOS2 не поддерживает 10,000 durable searchable memories. Нужен RFC по cold storage/partitioned index и migration strategy, а не увеличение одной константы. Нужно разделить capacity eviction и explicit forget: maintenance использует forgetById для capacity/pressure, что может уничтожать запись вместо её архивирования. Cold tiers должны сохранять user forget semantics, lineage и audit receipts.

### 13.7 B261 holdout integrity

PR #1075 exact head 8d7ffb3a8ee3ca03259be97e288c50f8c640d1b0: **10/10 completed SUCCESS** associated PR workflows.

Исправлен серьёзный дефект: прежний holdoutBefore01=0.5 мог трактоваться как измеренный baseline и давать неподтверждённый положительный gain в transferGain01.

Новый контракт:
- frozen baseline snapshot до candidate training/adaptation;
- один и тот же holdout сравнивается с baseline и candidate;
- без baseline: baselineAvailable=false, delta01=null;
- максимум 256 samples;
- валидация dimensions, finite values, action, reward range, baseline version;
- holdout evaluation не изменяет prediction counters/model weights;
- invalid baseline отклоняется до candidate mutation.

Это исправляет корректность измерений, но не доказывает uplift. Локальный тест использует 80 synthetic training steps и synthetic holdout; это regression contract, не independent multi-seed evaluation.

### 13.8 Mechanism Serendipity — граница интеграции

PR #1081 exact head aa56e0df9ef67eead23a4134ea0c8703bf29d021: **28/28 SUCCESS**.

Путь:
OrganismSystemFabric.systemGraph()
→ MechanismProblemAdapter
→ MechanismSerendipityEngine
→ IntrinsicExperimentGenerator
→ ScientificMethodEngine
→ persisted research state.

Физический subsystem graph содержит declared dependencies, не observed causal effects. Runtime test проверяет flowEvidenceClass='declared-dependency'; confidence topology-only input capped at 0.65. Discovery read-only; candidates verify-only. Protocol требует 5 paired seeds, baseline, independent holdout, одну variant, rollback и no auto-apply.

Это интегрированный research intake, но не доказанные механизмы и не автоматические улучшения организма.

### 13.9 Exact-head CI refresh

| PR | Exact HEAD | Completed workflows | SUCCESS |
|---|---|---:|---:|
| #1075 | 8d7ffb3a8ee3ca03259be97e288c50f8c640d1b0 | 10 | 10 |
| #1076 | d5832aa145b65be83cda3f481996626b8664715e | 16 | 16 |
| #1078 | 0a26d98783b5e27a80deb62ab071cb0349ba7960 | 4 | 4 |
| #1081 | aa56e0df9ef67eead23a4134ea0c8703bf29d021 | 28 | 28 |
| #1084 | 26557bb4b3b971a13f4aa384bc9df09cf6470e5e | 3 | 3 |

Это PR-head runs, не post-merge SHA validation. README содержит заниженные значения 9/9 для #1075 и 3/3 для #1078; direct exact-head query вернул 10/10 и 4/4. README в этом проходе не менялся.

### 13.10 Дерево архитектуры и доказательств

```text
NeuroCore
├── Runtime truth
│   ├── OrganismRuntime / OrganismCore
│   ├── OrganismSystemFabric
│   ├── CognitiveCycle / CognitiveEventFabric
│   └── PersistenceProjectionCoordinator / StateMigrations
├── Cognition
│   ├── Perception / observation provenance
│   ├── Epistemic graph (partial contradiction reasoning)
│   ├── Appraisal / attention / affect
│   ├── Motivation / goal coupling
│   ├── WorldModel / B261 matched baseline
│   ├── PlanEngine / FutureSimulator
│   └── ActionGateway / outcome verification
├── Memory authority
│   ├── MemoryOS2 (single canonical owner; 1,600 cap)
│   ├── MemoryFabric (mutation commands + replay receipts)
│   ├── Retrieval / lexical-hybrid / optional embeddings
│   ├── Bitemporal revisions / provenance / explicit forget
│   ├── Residency labels (not durable cold storage)
│   └── Missing: scalable archive + 10k index + independent benchmark
├── Learning / science
│   ├── ContinualReplayBuffer
│   ├── IntrinsicExperimentGenerator
│   ├── MechanismSerendipity (read-only declared-dependency discovery)
│   ├── ScientificMethodEngine (paired-holdout protocol)
│   └── Missing: independent effect replication and safe promotion receipts
├── Embodiment / interfaces
│   ├── Local/cloud model providers
│   ├── Voice / ASR / TTS
│   ├── Live2D / depth-rig / VRM
│   └── Missing: target-device audio, visual and latency proof
└── Governance / delivery
    ├── Engineering OS manifest (connectors unverified/disabled)
    ├── Aspect registry (75 aspects; 6 Nov snapshot)
    ├── CI exact-SHA receipts
    ├── License review (BLOCKED)
    └── Release ZIP parity (UNVERIFIED)
```

### 13.11 Обновлённые P0/P1

**P0-A — Memory capacity and semantics**
1. RFC: canonical durable store vs resident cache vs searchable index vs embedding cache.
2. Разделить capacity eviction и explicit forget.
3. Persistent cold tier, compaction, restore ordering, index rebuild, archive integrity.
4. Проверить tombstone/forget propagation через tiers, HMX, snapshots, migrations.
5. Нагрузки 1.6k/10k/100k, lexical/semantic, RU/EN, restart, corruption, forget, bitemporal correction.
6. SLO p50/p95/p99, peak RSS, index memory, disk footprint, maintenance CPU на desktop и Android.

**P0-B — Evidence and evaluation**
1. Immutable independent RU/EN holdout, source-session clustered.
2. Исключить пересечение source sessions между train/dev/holdout.
3. >=5 paired seeds с frozen baseline.
4. Одна variant per experiment; preregister metric/stopping rule.
5. Confidence interval, negative results, ablations, no auto-apply.
6. Exact data/seed/model/runtime version в evidence receipts.

**P0-C — Branch convergence**
1. Получить 1,073 branch tip SHAs через endpoint, который отдаёт SHA.
2. Группировать identical tips, ancestry clusters, merge-base age, stacked PR relations.
3. Сопоставить changed files всех open PR, исключить merged PR.
4. Проверить #109: base — историческая mega-branch, не canonical source.
5. Не удалять ветки до доказательства отсутствия уникальных commits/artifacts.

**P1-A — Runtime connectors**
1. Сохранить manifest fail-closed.
2. Для каждого нужного connector выбрать один owner и adapter.
3. Capability contract, auth boundary, timeout/retry, idempotency, audit/revoke.
4. Enable only after exact-SHA contract/security evidence.

**P1-B — Full cycle and device**
1. Trace observation → world → appraisal → goal → plan → action → external verification → learning.
2. Crash at every durable boundary.
3. Real Android/Termux and desktop/browser E2E.
4. 24-hour autonomy soak.
5. Lip drift <=80 ms, interrupt <=200 ms, phone tick <=50 ms at 10k seeded ticks.

### 13.12 Ограничения прохода

- Runtime code не менялся; ветки не сливались и не удалялись.
- Build/test suite/device soak вручную не запускались; CI факты выше получены из GitHub Actions exact-head runs.
- Release ZIP не скачивался и не проверялся; legal review не выполнялся.
- Unique tip SHA 1,073 веток не получены.
- Полный open PR census не получен: search возвращает 100 элементов и смешивает состояния; его нельзя трактовать как число открытых PR.

Следующий проход: получить все branch tip SHAs через подходящий GitHub refs/branches endpoint, затем оформить RFC 10k memory architecture и сквозной fault trace.


## 13. Branch topology, PR dependency graph and consolidation rules (2026-11-22)

This section supersedes earlier incomplete branch-tip notes in this document. It is a live snapshot, not a claim that branches have been deleted or that all PRs have been integrated.

### 13.1 Exact live census

The GitHub REST branch endpoint was fully paginated on 2026-11-22:

- Pages 1–10: 100 refs each; page 11: 73 refs; page 12: empty.
- **1,073 branch refs**, **1,055 distinct HEAD commits**, **18 excess branch names** beyond one ref per distinct HEAD.
- The full name → exact HEAD SHA → protected flag snapshot is stored in `docs/consolidation/branch-census-2026-11-22-live.jsonl`.
- The open-PR manifest is stored in `docs/consolidation/open-pr-census-2026-11-22.jsonl`.

The 18 excess names form exactly three shared-HEAD groups:

| Shared HEAD | Ref count | Names | Current disposition |
|---|---:|---|---|
| `f9621bf3e4411ce17bc809922a5f90126001f4fd` | 2 | `aspect/consequence-ecology-20261117`; `integrate/consequence-calibration-lineage-followup-20261120` | Same commit; no open PR currently uses either name as head or base. Not yet cleared for deletion because closed-PR, tag, workflow, ruleset, deployment and external-consumer references were not all verified. |
| `68a03799ca0c9f18e4c6e19399ed8018e0215e60` | 2 | `aspect/world-forge-integrated-20261117`; `integrate/worldforge-to-sharedfuture-after-calibration-20261120` | Same commit; no open PR currently uses either name as head or base. Same deletion blockers as above. |
| `82ea7a8b7c9b036e65c8b056acedd1176952dd8f` | 17 | `nk1-all-branches-merge-2026-10-23`; `nk1-integration-workspace-2026-10-22`; `rebuild`; `workpass79-cognitive-rebuild`; `workpass116-seed-clustered-learning-eval`; `workpass117-verified-replay-admission`; `workpass118-multi-source-learning-integration`; `workpass119-skill-retrieval-feedback-curriculum`; `workpass120-verified-skill-revision-gate`; `workpass121-ledger-bound-promotion-proposals`; `workpass122-promotion-gate-coverage-hardening`; `workpass123-authenticated-skill-lifecycle`; `workpass124-learning-evidence-hardening`; `workpass135-durable-shadow-run-registry`; `workpass203-independent-candidate-evaluator`; `workpass206-runtime-evaluator-wiring`; `workpass313-actions-history-audit` | **Blocked from retirement.** Four open PRs still depend on these names as base refs: #109, #124, #91 and #86. |

The equality of a HEAD SHA proves that refs currently point at the same commit; it does not prove that every name is unused or that its historical PR/deployment/workflow role can be removed.

### 13.2 Current open-PR topology

A full three-page enumeration returned **270 open PRs** (100 + 100 + 70). All 270 current PR heads have distinct branch names. The current base distribution is:

| Base branch | Open PRs |
|---|---:|
| `workpass70-source` | 125 |
| `main` | 32 |
| `integration` | 13 |
| `work/nk1-final-release-gate-2026-10-26-r3` | 9 |
| `aspect/neurok-engineering-os-20261103` | 5 |
| `audit/repository-wiring-contracts-2026-10-25` | 5 |
| Other historical/stacked bases | 81 |
| **Total** | **270** |

The four dependencies on the 17-name shared-HEAD group are:

- #109 uses `nk1-all-branches-merge-2026-10-23` as base.
- #124 uses `workpass206-runtime-evaluator-wiring` as base.
- #91 and #86 use `rebuild` as base.

This is an actual dependency graph, not a collection of independent PRs. These historical base refs must remain available until each dependent PR has been migrated, selectively ported, or explicitly closed with its unique work preserved.

### 13.3 Keep the two principal histories separate

Current pointers on this snapshot:

- `main`: `06e01cdd0a8e60ed70991f22e842887f544d1ebf`.
- `workpass70-source`: `a98dbfe858be2df19fa01a78639a23f962920aa0`.

GitHub compare reports **no common ancestor** between these refs. Keep their operational roles separate:

- `workpass70-source` is the canonical runtime/application development line.
- `main` is the release/metadata/documentation lineage and default branch.

Do not force-merge one entire tree into the other, change the default branch, or infer runtime release status from files on `main`. Promote only reviewed, path-scoped changes across this boundary when a concrete delivery requirement exists.

The avatar inspection confirms why this matters: `main` contains an older procedural demo under `app/src/components/avatar/KurisuAnime3DAvatar.ts` and its loader, while `workpass70-source` already has a broader embodiment subsystem: `Avatar3DStage`, `depthRig`, `embodimentSwitch`, `embodimentCoordinator`, `vrmRuntimeAdapter`, motion arbitration and renderer capability contracts. The same Kurisu sprite assets are already present in both lines. Do not import the old demo wholesale as a second rendering authority; only port an isolated capability after comparing it with the current avatar owners and their tests.

### 13.4 Prior convergence already completed

PR #1079, merged on 2026-11-21, joined 15 already-integrated donor HEADs as additional parents of the current source line. Its integration report records 253/253 successful exact-head Actions runs across those donor PRs. The merge was ancestry/provenance reconciliation only: the tree delta was the provenance report, with no runtime files copied, no Release ZIP changed and no branch refs deleted. This demonstrates the right way to preserve provenance; it does not reduce the number of branch names.

PR #999 also selectively ported the useful current-source module dependency contracts from historical PR #109. The old persistence-default refactor and its `StateMigrations.ts` rewrite were deliberately excluded because they require separate ownership and migration review. Therefore #109 is **partially superseded, not fully redundant**; do not close it or discard its branch until those remaining files have a salvage/retirement decision.

### 13.5 Consolidation decisions

| Candidate/family | Decision | Reason |
|---|---|---|
| Two 2-ref shared-HEAD groups above | Retirement candidates only | Exact same HEAD and no live open-PR dependency found, but all historical and operational references are not cleared. |
| 17-ref shared-HEAD group | Preserve | Four live PR base dependencies remain. |
| #109 historical dependency-boundary PR | Selective salvage / rebase review | #999 covers only the current-source dependency-contract subset; historical state-default work remains outside it. |
| Stacked `Shared Future → World Forge → Consequence Ecology` chain (#903/#916/#928 and related refs) | Keep isolated; rebase/port in dependency order | The chain is materially divergent and touches current core, migrations and world-model owners. Old-base CI is not proof of current-source compatibility. |
| HMX canonical-apply/export donors (#866/#995 and newer current-source work) | No wholesale replay | The current source already has the canonical apply boundary and newer HMX export/staging work; any remaining UI/route work must be ported narrowly and tested. |
| Old main-target avatar/plan PRs | Compare against current tree; close only after all unique content is accounted for | Repeated files do not prove semantic equivalence; preserve unique plan text, scripts and asset provenance. |
| Latest Release ZIP | Keep immutable until independently inspected | Metadata SHA is not proof of the actual bytes or source/ZIP parity; legal review remains pending. |

### 13.6 Required lifecycle policy

From this snapshot forward:

1. Every feature branch must declare its exact base SHA, owner/aspect, PR, changed paths, dependency PRs and verification commands.
2. Prefer one aspect branch → one PR → current `workpass70-source`. Use a stacked PR only when the parent change is a real technical prerequisite; keep the stack short and record parent/child IDs.
3. A PR is merge-ready only after reviewing the exact head SHA, file-level overlap with current owners, migration compatibility, clean merge state, required exact-head CI, and any device/independent-evaluation gates relevant to the feature.
4. Use a normal merge when additional parent ancestry is the purpose (as in #1079); use squash only when the feature is intentionally a single logical change and losing donor commit ancestry is acceptable. Never replay a historical branch snapshot over current source merely because GitHub offers a merge button.
5. A branch is eligible for deletion only after its unique content is integrated or explicitly archived, no open or closed PR references require it, no tag/release/workflow/ruleset/deployment/external consumer points to it, a fresh backup/census exists, and the deletion operation is available.
6. Equal HEAD, old date, prefix, closed PR state or a successful earlier workflow is not sufficient deletion evidence.
7. After a confirmed merge, enable automatic branch deletion only when repository policy and dependent-PR handling are understood. The current repository setting reports `delete_branch_on_merge=false`; this session did not change repository settings.
8. Keep `main` and `workpass70-source` separate until a deliberate release/packaging design defines a reviewed promotion path.

### 13.7 Scope and limitations of this pass

- Two machine-readable manifests were added to this existing documentation PR: 1,073 branch refs with exact tip SHAs and 270 open PRs with exact head/base pointers plus current head/base branch-tip pointers.
- No branch ref was deleted, renamed or force-moved.
- At the original 13.7 snapshot, no runtime PR had yet been merged; this historical statement is superseded by 13.9, where PR #1083 was merged after exact-head verification.
- The GitHub connector available to this session exposes branch creation/ref updates but no branch-ref deletion action; the browser profile also has no saved GitHub sign-in. Thus it was possible to create an auditable retirement register but not to execute branch deletions in this session.
- The latest release asset was not downloaded; its SHA remains metadata-only. No current-source change is claimed as RELEASED.


### 13.8 Closed-PR, tag and repository-policy reference audit (2026-11-22)

A full closed-PR REST scan was completed: 801 records across 9 non-empty pages (eight pages of 100 plus one record). It found **45 unique closed PRs** that refer to at least one of the three shared-HEAD groups as either head or base. The machine-readable evidence is in `docs/consolidation/closed-pr-branch-reference-audit-2026-11-22.jsonl` (45 rows).

| Shared-HEAD group | Closed PR references | Merged | Closed unmerged |
|---|---:|---:|---:|
| Consequence Ecology / calibration follow-up pair | 4 | 3 | 1 |
| World Forge / Shared Future follow-up pair | 4 | 4 | 0 |
| 17-name `82ea7a8b...` group | 39 | 37 | 2 |

The first two groups overlap in PRs #928 and #1052; the table therefore has 47 group memberships but **45 distinct PRs** overall (42 merged, 3 closed unmerged). Notable retained history includes #916, #928, #1052 and #1054 in the Shared Future → World Forge → Consequence Ecology chain. The 17-name group also has closed-unmerged historical dependencies #121 and #216, in addition to the four open PRs #109, #124, #91 and #86.

A tag scan returned two tags:

- `refs/tags/Neuro` → `c2e8e4a78431734612f89318e79d3491643f24f3`.
- `refs/tags/workpass70-hotfix1-2026-10-19` → `aa237b8991a666155a4795ce714d0abf8a74b6a4`.

Neither tag directly targets one of the three shared HEAD SHAs. This is only an exact-target comparison; it does not prove that no tag points to an ancestor of a shared HEAD.

The rulesets endpoint returned zero rulesets, and the branch API reports all 1,073 listed refs as not protected. The Actions-workflow and deployment endpoints are not exposed by the connected GitHub fetch integration, so their references could not be verified in this pass.

**Updated deletion decision:** none of the three shared-HEAD groups is approved for deletion. The two 2-name pairs have no current open-PR dependency, but they are part of merged historical PR chains and their closed-PR records must remain traceable. The 17-name group has both open and closed PR dependencies. Workflows/deployments and external consumers are not fully audited. Preserve all refs until those blockers are resolved and a branch-delete operation is available.

This section supersedes any earlier wording in §13.1 or §13.5 that described the two 2-name pairs as possible retirement candidates. They are now classified as **preserve pending complete historical/operational reference audit**, not as deletion candidates.

### 13.9 Post-integration refresh — 2026-11-22

#### Реальная интеграция

- PR #1083 merged в `workpass70-source`: PR head `b99838bf795ad01051847f6c6ab0b2a4e0594613`, результат `a98dbfe858be2df19fa01a78639a23f962920aa0`, tree `77f6e904b81443f4f0d79dce62773dfeb9c29db9`.
- До merge: base `4a46e724686814dc69b00acaeca530399d9b0910`, compare 16 ahead / 0 behind, mergeable=true, 34/34 check runs SUCCESS, 30/30 workflow runs SUCCESS, 0 unresolved review threads.
- Tree SHA PR-head и merge commit совпадает точно; merge commit имеет единственного родителя `4a46e724...`. Вошли 8 файлов: 417 additions / 24 deletions. Это одно новое PR-слияние данного запуска.
- Внешний HMX import ограничен 2 MiB; route получает отдельный лимит 2 MiB + 64 KiB, общий API body limit не увеличен. Тест проверяет 300 KiB request выше общего 256 KiB лимита.
- Ветка PR #1083 остаётся в списке refs; ветки не удалялись. `main` и Release ZIP не изменялись.

#### Live branch / PR census

- Branches: **1,073 refs / 1,055 unique HEADs / 3 exact duplicate groups / 18 excess refs**. Предыдущий snapshot: 1,061 / 1,043 / 3 / 18. Изменение: **+12 refs, 0 удалено, +12 unique HEADs**; две существующие refs продвинулись.
- 12 новых refs относительно предыдущего census: `aspect/b261-matched-holdout-baseline-20261121`, `aspect/hexis-hmx-export-import-contract-20261121`, `aspect/omestro10-mechanism-serendipity-current-20261121`, `aspect/prototype-bilingual-memory-e2e-20261121`, `aspect/prototype-health-readiness-probe-guard-20261121`, `aspect/prototype-launch-health-20261121`, `aspect/startup-probe-pr-path-filter-20261121`, `docs/neurocore-live-checkpoint-current-20261121`, `docs/neurocore-project-map-analysis-20261121`, `docs/neurocore-prototype-live-checkpoint-20261121`, `integrate/branch-ancestry-consolidation-20261121-15`, `prototype/neurocore-0.1-execution-plan-20261121`. Это наблюдаемая динамика между snapshot, не атрибуция всех 12 данному запуску.
- Open PRs: **270** (предыдущий snapshot 271; −1 вследствие merge #1083), все 270 head SHA уникальны; 205 Draft / 65 Ready. Base distribution: `workpass70-source` 125, `main` 32, `integration` 13, release-gate 9, engineering-OS 5, repository-wiring audit 5, прочие stacked/historical bases 81.
- Текущие основные refs: `workpass70-source` @ `a98dbfe858be2df19fa01a78639a23f962920aa0`; `main` @ `06e01cdd0a8e60ed70991f22e842887f544d1ebf`. Разделение source/main сохранено.
- Обновлённые JSONL manifests снимают post-merge snapshot: branch census — 1,073 rows; open-PR census — 270 rows. Добавлены `head_ref_tip_sha` и `base_ref_tip_sha`, чтобы различать SHA, сохранённые в PR metadata, и текущие tip SHA соответствующих branch refs. Для строки текущей docs-ветки и PR #1084 зафиксирован pre-manifest-update head `8d7dddb2a78fb4ed167207631f6013bf668eb091`; сам отчёт продвигается отдельным commit после snapshot.
- PR #1084 синхронизирован с новым source через двухродительский merge commit `8d7dddb2a78fb4ed167207631f6013bf668eb091` (parents: source `a98dbfe...`, прежний docs head `f135891...`). Он остаётся Draft; diff ограничен четырьмя документальными файлами, 0 commits behind до обновления manifests. После обновления manifests требуется новый exact-head CI.

#### Exact duplicate HEAD/tree groups

| Shared commit | Exact tree SHA | Refs | Current-source ancestry / dependencies |
|---|---|---:|---|
| `82ea7a8b7c9b036e65c8b056acedd1176952dd8f` | `4525cefe9efccd05c897846b1c806b783feb3002` | 17 | Source 1,968 ahead / 0 behind; open base dependencies #109, #124, #91, #86; 39 closed-PR references (37 merged, 2 closed-unmerged). |
| `f9621bf3e4411ce17bc809922a5f90126001f4fd` | `7711398fa119a30218f44f2d2049cbe985a1d20b` | 2 | No open head/base dependency; 4 closed-PR references (3 merged, 1 closed-unmerged); source diverged 993 ahead / 154 behind. |
| `68a03799ca0c9f18e4c6e19399ed8018e0215e60` | `513c63b24385ce4dedc793200052e3f29b84bf78` | 2 | No open head/base dependency; 4 closed-PR references (all merged); source diverged 993 ahead / 157 behind. |

- Two 2-ref groups are historical Shared Future / World Forge / Consequence chains; equal commit/tree does not erase PR history. The 17-ref group is already an ancestor of source but remains a base for four open PRs.
- **Safe branch-cleanup candidates: 0.** All three groups remain preserved; closed-PR references exist, four open base dependencies remain in the 17-ref group, and workflow/deployment/external-consumer references are not fully audited. No branch deletion operation was executed.

#### HMX donor disposition

- PR #866 remains Draft and unmerged. It has 21 changed files and is 79 commits ahead / 1,008 behind current source by compare; its full diff is not safe to merge as a unit. `HexisCanonicalMemoryProjector.ts` and `HmxExportRedactor.ts` are absent from current source, while the corresponding current HMX bridge/redactor path is different. Preserve #866 and selectively review unique behavior and blob-level dependencies later.

#### Release boundary

- Latest Release remains tag `Neuro`, published 2026-10-19 14:21:35Z, asset `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, 135,290,615 bytes, GitHub metadata digest `sha256:c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`.
- The ZIP bytes were not materialized in this run; the digest above is GitHub release metadata, not a newly computed local hash. No archive-content parity is claimed. No code change in this run is marked RELEASED.

#### Next controlled work

1. Review #866's two absent HMX donor files and its MemoryOS2 / MemoryFabric differences against current `HexisHmxCanonicalMemoryBridge` and current memory owners; port only unique, dependency-complete changes.
2. Resolve or preserve the four open PRs based on the 17-ref legacy group (#109, #124, #91, #86) before any alias retirement.
3. Keep all three shared-tip groups intact until closed-PR, workflow, deployment, ruleset and external-consumer references are cleared.
4. Finish the remaining HMX privacy-preview, adversarial redaction and staging non-mutation gates before treating the HMX path as fully closed.