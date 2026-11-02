# Neuro Kurisu / NK1 — актуальный статус проекта

<sub>Снимок состояния на 2026-11-02. Этот блок — единственный активный статус. Весь прежний текст ниже сохранён как исторический архив и не является текущим release pointer.</sub>

## Канонический источник и опубликованный артефакт

| Поле | Подтверждённое значение |
|---|---|
| Рабочий репозиторий | `ailtron1ss-rgb/NK1` |
| Рабочая ветка | `workpass70-source` |
| Канонический source baseline для текущего инженерного прохода | `608435493b4af3b4a222d385f1b77d978d18583b` |
| Приложение | `35.90.0` |
| Organism Core | `100.32.0-r26-hierarchical-lowrank-causal` |
| State schema | `225` |
| Phase | `WorkPass70/Unified-Embodiment-Intent-Audio-Clock-and-Viseme-Timeline` |
| Canonical root | `src/organism` |
| Legacy isolation | `legacy-original/` |
| Canonical files / source surface | `582 / 1,934` |
| Runtime / build dependencies в manifest | `0 / 0` |

Машинные контракты: `VERSION.json`, `RELEASE_MANIFEST.json`, `ARCHITECTURE_MANIFEST.json` и `src/organism/system/ReleaseContract.ts`. Их значения согласованы на указанном кодовом baseline.

### Последний опубликованный GitHub Release

| Поле | Значение |
|---|---|
| Release tag / name | `Neuro` / `NeuroKurisu0.1` |
| Published | `2026-10-19T14:21:35Z` |
| Primary asset | `Neuro_Kurisu_WORKPASS70_2026-10-19.zip` |
| Asset size | `135,290,615 bytes` |
| GitHub asset digest | `sha256:c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286` |
| Download count at snapshot | `3` |

**Release/source separation:** ZIP остаётся главным опубликованным артефактом. Указанный digest взят из метаданных GitHub Release; в этом проходе ZIP не скачивался и digest независимо не пересчитывался. Содержимое ZIP не сравнивалось с текущей исходной веткой. Поэтому parity / artifact-content verification = **NOT VERIFIED**. Новая публикация не выполнялась.

## Новый инженерный проход — 2026-11-02

**PR #649 — ActionGateway restore snapshot integrity**  
Ветка: `fix/action-gateway-restore-snapshot-integrity-2026-11-02` · базовая ветка: `workpass70-source` · base SHA: `608435493b4af3b4a222d385f1b77d978d18583b`.

- Добавлена bounded JSON-like копия persisted snapshot до доступа к данным: getters/accessors, Proxy, exotic/inherited prototypes, sparse arrays, cycles, non-finite numbers и чрезмерные глубина/размер отклоняются.
- Restore строит новый ledger и permission state до изменения текущего состояния; ошибочный snapshot не должен частично заменить живой state.
- Валидный v1 receipt сохраняет idempotent replay; unsupported version отклоняется.
- Добавлен regression-файл `tests/action-gateway-restore-boundary-workpass647.mjs`; workflow `nk1-action-gateway-governance.yml` запускает его.
- RED evidence: изолированное воспроизведение текущего ingress-кода на Node 22.16 вызвало getter дважды (ожидалось 0), что подтверждает первопричину.
- GREEN evidence: точный PR-head `74be80d4f731a594529bf5a3aecf100e390b852f` прошёл все 12 pull-request workflows. Включая Action Gateway governance #41407817320 (15/15 steps; новый restore-boundary regression), memory integrity #41407817092 (12/12), unified organism runtime #41407817108 (16/16), NeuroCore core regression, planner cadence, Hexis, UserModel, WorkPass79/110 и embodiment contract.
- Статус: **Implemented / exact-head CI 12/12 PASS / review pending / not merged / not released**.

**Параллельные aspect PRs остаются отдельными:** #637 planner cadence, #640 test-registry duplicate guard, #642 P80 self-state, #644 memory lifecycle, #646 locale-neutral ActionGateway classification. Их не объединять в одну ветку и не объявлять merged до отдельной проверки.

## Последний подтверждённый инженерный результат

**PR #622 — Cognitive execution planner restore integrity**  
Merged: `2026-11-01` · merge commit `795bb672fd3af0a5ec85cc7d783d00a9226fe083`.

- Planner restore перешёл с широкого object spread на allowlist own-data чтение.
- Getter-функции не исполняются; наследуемые поля игнорируются.
- Ошибки Proxy reflection и revoked Proxy приводят к безопасному default state.
- Проверяются версия и режим; метрики ограничиваются диапазоном, счётчики валидируются, диагностические строки ограничены.
- Добавлен regression test и подключён к `test:rebuild-recovered) и unified organism runtime workflow.

**CI для точного PR head:** 36/36 workflow runs завершились success. Unified organism runtime также завершился success: runtime typecheck, unified cognitive cycle, автономная cadence, endogenous motivation, world perception, planner restore integrity, continuity integration и organism smoke — PASS. Это подтверждает указанные CI gates, но не заменяет Android soak, независимые holdout-эксперименты или Release ZIP verification.

## Когнитивные и системные области

Статусы ниже разделяют наличие кода, интеграцию, тестирование и выпуск. Проценты общей готовности не публикуются, пока нет единого подтверждённого release/device gate.

| Область | Текущая реализация / доказательство | Что ещё не доказано |
|---|---|---|
| Когнитивный цикл и планирование | Unified cognitive cycle, execution planner; PR #622 merged; unified runtime CI PASS | Долгосрочная поведенческая эффективность и мобильный soak |
| Эмоции и интероцепция | `EmotionAppraisalEngine`: appraisal episodes, action tendencies, feeling-access и homeostatic mismatch; WorkPass172 test source present | Новое причинное улучшение поведения и adversarial restore-boundary coverage |
| Global workspace и метакогниция | Predictive workspace, recurrent workspace, metacognitive substrate; WorkPass187/188 tests present | Независимое подтверждение устойчивого влияния workspace на реальные действия; это функциональная модель, не доказательство феноменального сознания |
| Self-model и личность | SelfModelV2, self/world predictive stack, personality coupling, self-authorship | Стабильность характера на независимых длительных сценариях и adversarial holdouts |
| Воображение и counterfactuals | Sensorimotor imagination, future-self projection, counterfactual planner; WorkPass2518–2520 tests present | Связь внутренних симуляций с подтверждённым улучшением реальных действий и полноценным avatar/render loop |
| Память и обучение | MemoryOS2, episodic/autobiographical/semantic retrieval, lineage и holdout gates; relevant CI workflows PASS | Подтверждённый положительный recall uplift на независимых multi-seed holdouts; CI PASS сам по себе не доказывает uplift |
| Самостоятельность и цели | Intrinsic drives, endogenous goal genesis, autonomous goal lifecycle, agency gates; relevant CI workflows PASS | Физический/мобильный background initiative soak и независимая оценка полезности инициатив |
| Аватар и embodiment | Существующий 2D/Live2D путь и проверяемый v5 fallback; candidate GLB v7 описан в issue #601 | v7 не promoted; браузерный и Android visual E2E, lip-sync drift и long soak не подтверждены |

### Активные блокеры выпуска

1. **License / redistribution — issue #485 OPEN.** Нужны человеческое одобрение корневой и runtime лицензий, review 462 locked npm components, SBOM/provenance и успешный exact-SHA release gate. Автоматически обходить gate нельзя.
2. **3D asset promotion — issue #601 OPEN.** GLB revision 7 — кандидат, не canonical runtime asset. Нужны стабильная загрузка байтов, фактический SHA-256, structural/browser verification и Android E2E; v5 fallback сохраняется.
3. **Android/device qualification — PENDING.** Реальный background/restart/resource/lip-sync soak не заменяется CI.
4. **Release ZIP parity — NOT VERIFIED.** Требуется скачать опубликованный ZIP, независимо проверить digest и сравнить фактическое содержимое с исходным baseline.

## Правило оценки

- **Implemented** — код присутствует.
- **Integrated** — подключён к canonical runtime/state owner.
- **Tested** — соответствующий тест/CI gate прошёл на указанном SHA.
- **Released** — изменение подтверждено внутри опубликованного ZIP.
- **Device-verified** — подтверждено на реальном Android/browser target.

Не переносить статус между колонками автоматически. Не выдавать synthetic tests, внутренние diagnostics или один успешный CI за доказательство сознания, общего интеллекта, автономной полезности или production readiness.

---

## Исторический архив

Все release pointers, проценты готовности и статусы ниже сохранены для аудита истории. Они не являются текущими указателями релиза или текущей оценкой готовности.

Канонический релиз: 35.40.0
> **SOURCE OF TRUTH (VERSION.json):** Neuro-Kurisu **35.90.0** · organism core `100.32.0-r26-hierarchical-lowrank-causal` · state schema `225` · `WorkPass70/Unified-Embodiment-Intent-Audio-Clock-and-Viseme-Timeline`.
> **АКТУАЛЬНЫЙ RELEASE POINTER (P2760):** Neuro-Kurisu **35.15.0** · organism core `100.6.0-continuum-memory-p2760` · state schema `205` · `Stage-97/Continuum-Causal-World/P2760`. Старые release pointers ниже сохранены как исторические записи; машинный source of truth: `VERSION.json` + `RELEASE_MANIFEST.json` + `ARCHITECTURE_MANIFEST.json` + `src/organism/system/ReleaseContract.ts`.

CURRENT RELEASE: 35.6.34 / B620

**Current release pointer: 35.6.34 · state schema 138 · Stage-34 — Meta-Cognitive Evolution / B561–B620.**

> Historical material below is retained; the active implementation source of truth is `VERSION.json` + `ACTIVE_ROADMAP_SCS_DIT_35.6.17_RU.md`.


<!-- Current release: 34.99.0 | schema 122 | BIG PASS 125 -->

**Current release pointer: 34.97.0 · state schema 122 · BIG PASS 123 — Developmental Portfolio / Personal Curriculum / Social-Autobiographical Learning**


> BIG PASS 108: Cognitive Research Battery / preregistration / reproducible longitudinal evidence — schema 117.
**Current release pointer: 34.82.0 · state schema 117 · BIG PASS 108**

**Current release pointer: 34.79.0 · state schema 114 · BIG PASS 105**

## Current release pointer

**Neuro-Kurisu 34.53.0 · state schema 107 · BIG PASS 81**

<!-- Current release: 34.43.0 | schema 104 | BIG PASS 71 -->
# Neuro-Kurisu — Project Progress 34.31.0

## Current release

- application: `34.79.0`
- organism core: `70.0.0-master-prompt-progress-engine`
- state schema: `92`
- phase: `Stage-5/learned-world-model-and-unified-world-fabric`

## Completed in the recent deep passes

- canonical source-of-truth consolidation;
- API security boundary;
- lightweight health/status routes;
- route duplicate audit;
- portable subject identity/fingerprint/tamper checks;
- explicit Subject/Host/Embodiment separation;
- long-horizon functional regression with explicit scaling warning handling.

## Active measurable goals

See `docs/PROGRESS_ENGINE_34.2.0_RU.md` and the full Master Prompt.

### G1 — Canonical Core Decomposition
Reduce architecture bottleneck without duplicate authority.

### G2 — Long-Horizon Scaling
Reduce latency/heap growth; extend 1k/10k-cycle gates.

### G3 — Portable Subject v2
Test model switch, embodiment switch and degraded-host transfer.

### G4 — Native Android Host
Advance lifecycle, reboot, background and resource gates.

### G5 — Semantic Sensorium
Improve grounded multimodal perception with holdout evaluation.

### G6 — Autonomous Research Loop
Automate controlled experiments and evidence accounting.

### G7 — Longitudinal Development
24h/72h/168h/30-day continuity and development campaigns.


## BIG PASS 8 update — 2026-09-04

- Checkpoint hash/stamp hotpath optimized.
- MemoryOS2 retrieval/index/pressure maintenance improved.
- MemorySubstrateCoordinator added as canonical-memory transition layer.
- Statistical long-horizon gate: 3x180, median ratio 3.341x, SCALING=PASS.
- Qwen 55-idea audit and weighted coverage documented in `docs/BIG_PASS_8_CHANGELOG_QWEN_AUDIT_RU.md`.
- Physical Android validation remains incomplete; current Termux preflight verifies host prerequisites but optional Termux:API commands are not installed in this environment.

Current engineering readiness estimate: 83%.

## BIG PASS 9 — Memory / Persistence / Efficiency

В BIG PASS 9 внедрён реальный tiered persistence: `PersistenceProjectionGovernor` выбирает hot/full projection, hot cycles больше не выполняют durable `store.save()`, а full/forced checkpoint закрывает bounded durability window. Добавлены regression tests для tiering и durability-window. Persistent footprint на текущем synthetic workload снижен до ~2.42 MB; event log, P62 и autobiographical compatibility state bounded/compact. Добавлены P49/P51 lookup indices. Historical shard audit теперь подтверждает 152 test files / 163 scripts / 55 phases без orphan/missing mapping. Функциональный long-horizon 220 cycles остаётся PASS; отдельный 3×120 statistical profile даёт WARNING, поэтому statistical PASS в этом проходе не заявляется.

Инженерная оценка после BIG PASS 9: **86% overall readiness**. Следующий приоритет — revision-aware dirty graph, physical memory unification, generic branch budgets, snapshot versioning и реальный Android runtime campaign.

### BIG PASS 10 — Projection maturity / efficiency

- Добавлен `AdvancedProjectionScheduler`: advanced persistence branches обновляются по разной cadence, с ускорением при resource pressure и полной материализацией через `flush()`.
- Scheduler benchmark: **64.6%** reduction потенциальных advanced snapshot operations (204/576 за 96 циклов).
- Добавлен `audit:analysis-alignment`: проверка соответствия предыдущих инженерных выводов фактическим файлам и runtime hooks — **PASS 14/14**.
- Typecheck, persistence tiering, durability window, footprint, memory substrate, hot-path, restart и 220-cycle functional horizon — PASS; long-horizon scaling остаётся WARNING.
- Overall engineering readiness: **88%**; scheduler benchmark 64.6%, final footprint gate 2.483 MB PASS, analysis-alignment 14/14 PASS.


## BIG PASS 12 — Operational Result Plane

Добавлен operational result plane (`observeOperational`) и runtime теперь может избегать глубокого клонирования больших advanced/memory ветвей при обычном daemon-step. 96-cycle operational benchmark: PASS, ratio ~1.36x в контрольном прогоне. P80-P82 runtime e2e в текущем окружении не завершился за 120 s и оставлен как TIMEOUT, не PASS. Analysis alignment: 18/18.

## BIG PASS 14 — revision tokens, adaptive branch budgets, long-horizon efficiency

- Добавлен `RevisionTokenRegistry` с 8 именованными subsystem tokens поверх canonical RevisionGraph.
- `PersistenceBudgetController` теперь управляет compatibility memory, P62, P54 и P57 durable projections и использует ранний pressure/emergency порог.
- Operational path больше не делает три полных `MemoryOS2.snapshot()` только ради lightweight counters; добавлен `statsLight()`.
- В operational mode отключён лишний hot persistence projection sync; full-mode/backward-compatible persistence сохранены.
- 250-cycle warmed operational gate: PASS; 500-cycle warmed gate: TIMEOUT в текущей среде и не считается PASS.
- Analysis alignment: 35/35; historical shard audit: 152 test files / 164 targets / 55 phases / 0 orphan / 0 missing.
- Итоговая инженерная готовность BIG PASS 14: 95% (engineering assessment, not AGI/consciousness measurement).

## BIG PASS 15
- Независимые subsystem revision tokens v2 внедрены и persisted через round-trip.
- MemoryOS2 encode/retrieve и MultiTimescaleMemory retrieve переведены на bounded algorithms/caches.
- 250-cycle warmed horizon: ratio 1.662x, heapGrowth 1.094x; это лучше BIG PASS 14.
- 500-cycle tests остаются TIMEOUT и не считаются PASS.
- Analysis alignment расширен до 42/42.
- Forensics: duplicateContent=0, duplicateNames=0, empty=0.
- Текущая инженерная готовность: ~96%.


BIG PASS 37 current engineering readiness: **65%**. Previous-plan compliance: **94%**. Machine checklist: **30/30 = 100%**.

**Historical validation marker: BIG PASS 39. Current release is tracked by the source-of-truth marker below.**


## Current source-of-truth marker — 34.31.0

This document remains part of the current documentation layer and has been revalidated for Neuro-Kurisu 34.40.0 (state schema 104). Historical release-specific passages remain historical unless explicitly marked current. The authoritative machine-readable release state is `VERSION.json` + `RELEASE_MANIFEST.json` + `src/organism/system/ReleaseContract.ts`.

## BIG PASS 41 current progress marker — 34.10.0

Performance Spine: per-tick model cache, shared forecasts, adaptive perception cadence and duplicate evidence snapshot removal are implemented and regression-tested. Operational-250 benchmark: PASS, warmedMedianRatio=1.694, heapGrowth=0.620. Overall engineering readiness estimate: ~74%. First-audit weighted actionable implementation: ~78%. BIG PASS 41 checklist: 100%.

> Current release source-of-truth: **34.91.0 · state schema 122 · BIG PASS 117**.

## BIG PASS 60 — Learned World Model + Unified World Fabric

Текущий релиз объединяет world perception/grounding/P27/WorldModel2/residual prediction внутри `WorldSubsystemRuntime`. `OrganismCore` делегирует world observation, integrated action evaluation и action-outcome learning системному владельцу. Passive transitions отделены от action-conditioned transitions. State schema сохранена: 92.

Микробенчмарк World Fabric: 1000 наблюдений ≈ 293.63 ms, 1000 integrated predictions ≈ 5.98 ms; 999 passive updates. Это benchmark подсистемы, а не полного организма.


---

### Current release metadata
- application: 34.43.0
- state schema: 99
- phase: Stage-7/external-observer-fabric
- BIG PASS 63: Causal Accountability + Outcome Cognition Fabric


## BIG PASS 65 — Reality Reconciliation
34.36.0: independence-aware external evidence quorum, dynamic freshness, prediction closure, guarded world grounding, reconciliation API, persistence repair. 1000-cycle operational gate: PASS in current environment. Physical Android qualification: pending.

## BIG PASS 66 — Progress

P83 замкнул persistent reality continuity: grounded observation обновляет reality anchor, world predictions получают persistent link, external reconciliation меняет epistemic status, а hot persistence сохраняет контур без ожидания медленной advanced projection.


## BIG PASS 67 — Autobiographical Continuity Fabric (34.40.0)

В текущем релизе добавлен P84 `AutobiographicalContinuityFabric` внутри существующего Self physical owner. P84 не является новым независимым хранилищем памяти: он хранит bounded lineage-моменты, связывающие действие/результат, decision, prediction/observation/evidence IDs, reality hash/revision, цели и метрики continuity. Канонические сырые данные остаются в Self, Memory, World и Evidence owners.

Цепочка теперь замыкается как `Reality → Prediction → Action/Outcome → Observation/Evidence → Autobiographical Moment → Identity/Continuity`. Одинаковая семантическая ситуация не создаёт новый тяжёлый момент на каждом цикле; используется material-change guard. P84 проецируется и восстанавливается через persistence coordinator / migrations и доступен через `autobiographicalContinuitySnapshot/summary/recent`.

Статус BIG PASS 67: интеграционный тест, аудит, restart/persistence и typecheck — PASS. P84 не доказывает субъективное сознание; это инженерный механизм непрерывной автобиографической причинной связности.

## BIG PASS 68 — Identity-Change Lineage

P84 теперь связывает autobiographical moments с canonical EventLog и фиксирует identity/reality/memory/learning deltas. Release 34.40.0, schema 104. Device qualification остаётся внешним gate.

## BIG PASS 69 — CAUSAL BEHAVIOR CARRY-OVER

34.40.0 расширяет P84 Autobiographical Continuity Fabric bounded causal carry-over.
Подтверждённые внешней verification/corroboration исходы могут ограниченно влиять на будущий score соответствующего действия. Bias ограничен ±0.06, имеет временное затухание и не обучается на слабых/unknown данных. Новый physical subsystem не добавляется: механизм остаётся внутри Self owner и использует канонические EventLog/Memory/Reality/Outcome источники.

1000-cycle и 500-warm остаются NOT CERTIFIED в данном execution environment при непредсказуемом timeout; 250/500 natural проходят. Это не выдаётся за доказательство стабильности на физическом Android.


---
АКТУАЛЬНЫЙ RELEASE POINTER: `34.59.0` / state schema `110`. Этот указатель добавлен для синхронизации исторического документа с текущим canonical release.

## Current 34.59.0 capability delta
- BIG PASS 86 closes the downstream `self-change → canonical value profile → P67 goal priority` loop.
- P67 uses bounded value alignment; it does not become a value or identity truth owner.
- Evidence is measured as matched-context priority/urgency/alignment change, not merely file existence.

**Current release:** 34.92.0 (BIG PASS 118)


<!-- Canonical release: 35.6.1 -->


> Release truth marker: 35.6.43 / 79.3.0-actionable-neural-predictive-b2503. This document remains historical/contextual unless its specific section was updated in the release notes.
> Release truth marker: 35.6.54 / 79.7.0-memory-self-consolidation-b2512-b2514. The historical material in this document is retained; this marker identifies the current release context.

**Актуальный кодовый release:** `35.30.0` — R16 multi-system closure: temporal memory, autonomy, continuity and mobile durability (2026-09-25). Source-of-truth следует проверять по исполняемому коду, тестам и manifest этого release.
