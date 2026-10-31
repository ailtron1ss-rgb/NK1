
Канонический релиз: 35.90.0 · organism core `100.32.0-r26-hierarchical-lowrank-causal` · state schema `225` · WorkPass70/Unified-Embodiment-Intent-Audio-Clock-and-Viseme-Timeline
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
