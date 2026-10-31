
Канонический релиз: 35.90.0 · organism core `100.32.0-r26-hierarchical-lowrank-causal` · state schema `225` · WorkPass70/Unified-Embodiment-Intent-Audio-Clock-and-Viseme-Timeline
> **АКТУАЛЬНЫЙ RELEASE POINTER (P2760):** Neuro-Kurisu **35.15.0** · organism core `100.6.0-continuum-memory-p2760` · state schema `205` · `Stage-97/Continuum-Causal-World/P2760`. Старые release pointers ниже сохранены как исторические записи; машинный source of truth: `VERSION.json` + `RELEASE_MANIFEST.json` + `ARCHITECTURE_MANIFEST.json` + `src/organism/system/ReleaseContract.ts`.

CURRENT RELEASE: 35.6.34 / B420

**Current release pointer: 35.6.34 · state schema 138 · Stage-34 — Adaptive Cognitive Research / B401–B420.**

> Historical material below is retained; the active implementation source of truth is `VERSION.json` + `ACTIVE_ROADMAP_SCS_DIT_35.6.17_RU.md`.


<!-- Current release: 34.99.0 | schema 122 | BIG PASS 125 -->

**Current release pointer: 34.97.0 · state schema 122 · BIG PASS 123 — Developmental Portfolio / Personal Curriculum / Social-Autobiographical Learning**

**Current release pointer: 34.82.0 · state schema 117 · BIG PASS 108**

**Current release pointer: 34.79.0 · state schema 114 · BIG PASS 105**

## Current release pointer

**Neuro-Kurisu 34.53.0 · state schema 107 · BIG PASS 81**

<!-- Current release: 34.43.0 | schema 104 | BIG PASS 71 -->
# Architecture — Neuro-Kurisu 34.31.0

Canonical runtime root: `src/organism`.

Current architecture must preserve explicit ownership of identity, experience, memory, world, cognition, agency, development, evidence, embodiment, lifecycle, security, portability, research and evaluation.

The full architectural and operational constraints are defined by `docs/NEURO_KURISU_UNIVERSAL_MASTER_PROMPT_v2.0_RU.md`.

Primary architectural goals: decompose the `OrganismCore.ts` bottleneck, prevent semantic duplication, isolate historical P-phase code, maintain portable-subject boundaries and reduce long-horizon scaling debt.

**Historical validation marker: BIG PASS 39. Current release is tracked by the source-of-truth marker below.**


## Current source-of-truth marker — 34.31.0

This document remains part of the current documentation layer and has been revalidated for Neuro-Kurisu 34.40.0 (state schema 104). Historical release-specific passages remain historical unless explicitly marked current. The authoritative machine-readable release state is `VERSION.json` + `RELEASE_MANIFEST.json` + `src/organism/system/ReleaseContract.ts`.

> Current release source-of-truth: **34.91.0 · state schema 122 · BIG PASS 117**.

## BIG PASS 60 — Physical System Fabric

The canonical runtime now has a composition root for seven physical organism systems. Core is a coordinator; system ownership, lifecycle and restore are isolated behind `OrganismSystemFabric`.

## BIG PASS 60 — Learned World Fabric

`WorldSubsystemRuntime` теперь выступает системным интегратором world cognition: `GroundedWorldState`, P27 latent representation, `WorldModel2`, `LearnedResidualWorldModel`, action-conditioned prediction, passive transition learning и model-agreement. Core не должен вручную склеивать эти модели.

Architecture invariant: perception/context refresh выполняется один раз на observation phase; action candidate evaluation использует единый integrated world prediction; outcome learning вызывается через world subsystem.


---

### Current release metadata
- application: 34.43.0
- state schema: 99
- phase: Stage-7/external-observer-fabric
- BIG PASS 63: Causal Accountability + Outcome Cognition Fabric

## BIG PASS 66 — Persistent Reality Model

`P83PersistentRealityModel` является внутренним координационным слоем World owner, а не восьмым физическим subsystem. Он хранит только компактные производные данные: current reality hash, bounded beliefs, prediction links и continuity events. `WorldModel`, `GroundedWorldState`, `ExternalObserverFabric` и outcome/causal engines остаются первичными алгоритмическими источниками своих доменов.


## BIG PASS 67 — Autobiographical Continuity Fabric (34.40.0)

В текущем релизе добавлен P84 `AutobiographicalContinuityFabric` внутри существующего Self physical owner. P84 не является новым независимым хранилищем памяти: он хранит bounded lineage-моменты, связывающие действие/результат, decision, prediction/observation/evidence IDs, reality hash/revision, цели и метрики continuity. Канонические сырые данные остаются в Self, Memory, World и Evidence owners.

Цепочка теперь замыкается как `Reality → Prediction → Action/Outcome → Observation/Evidence → Autobiographical Moment → Identity/Continuity`. Одинаковая семантическая ситуация не создаёт новый тяжёлый момент на каждом цикле; используется material-change guard. P84 проецируется и восстанавливается через persistence coordinator / migrations и доступен через `autobiographicalContinuitySnapshot/summary/recent`.

Статус BIG PASS 67: интеграционный тест, аудит, restart/persistence и typecheck — PASS. P84 не доказывает субъективное сознание; это инженерный механизм непрерывной автобиографической причинной связности.

## BIG PASS 69 — CAUSAL BEHAVIOR CARRY-OVER

34.40.0 расширяет P84 Autobiographical Continuity Fabric bounded causal carry-over.
Подтверждённые внешней verification/corroboration исходы могут ограниченно влиять на будущий score соответствующего действия. Bias ограничен ±0.06, имеет временное затухание и не обучается на слабых/unknown данных. Новый physical subsystem не добавляется: механизм остаётся внутри Self owner и использует канонические EventLog/Memory/Reality/Outcome источники.

1000-cycle и 500-warm остаются NOT CERTIFIED в данном execution environment при непредсказуемом timeout; 250/500 natural проходят. Это не выдаётся за доказательство стабильности на физическом Android.


---
АКТУАЛЬНЫЙ RELEASE POINTER: `34.59.0` / state schema `110`. Этот указатель добавлен для синхронизации исторического документа с текущим canonical release.

**Current release:** 34.92.0 (BIG PASS 118)


<!-- Canonical release: 35.6.1 -->


> Release truth marker: 35.6.43 / 79.3.0-actionable-neural-predictive-b2503. This document remains historical/contextual unless its specific section was updated in the release notes.
> Release truth marker: 35.6.54 / 79.7.0-memory-self-consolidation-b2512-b2514. The historical material in this document is retained; this marker identifies the current release context.

**Актуальный кодовый release:** `35.30.0` — R16 multi-system closure: temporal memory, autonomy, continuity and mobile durability (2026-09-25). Source-of-truth следует проверять по исполняемому коду, тестам и manifest этого release.
