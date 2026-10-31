
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
# Master Roadmap — Neuro-Kurisu 34.31.0

## Stage 1 — Canonical Consolidation
Unified ownership, persistence, source truth and auditability.

## Stage 1.5 — Portable Subject Boundary
Portable subject package independent of host/embodiment.

## Stage 2 — Real Host / Portable Runtime
Lifecycle-aware native hosts, recovery, permissions, resource constraints.

## Stage 3 — Grounded Reality
Semantic perception, multimodal grounding, causal external interaction.

## Stage 4 — Developmental Person
Longitudinal identity, learning, goals, values, social cognition and development.

## Stage 5 — Living Artificial Person / Consciousness Research
A research-ready integrated artificial-subject architecture. This stage does not automatically imply proof of consciousness.

The current execution order and exit criteria are specified in `docs/NEURO_KURISU_UNIVERSAL_MASTER_PROMPT_v2.0_RU.md`.

**Historical validation marker: BIG PASS 39. Current release is tracked by the source-of-truth marker below.**

## Current source-of-truth marker — 34.31.0

This document remains part of the current documentation layer and has been revalidated for Neuro-Kurisu 34.40.0 (state schema 104). Historical release-specific passages remain historical unless explicitly marked current. The authoritative machine-readable release state is `VERSION.json` + `RELEASE_MANIFEST.json` + `src/organism/system/ReleaseContract.ts`.

> Current release source-of-truth: **34.91.0 · state schema 122 · BIG PASS 117**.

### BIG PASS 60 — Learned World Model
World cognition is now coordinated through `WorldSubsystemRuntime`: grounded context, P27 representation, WorldModel2, residual prediction, integrated action evaluation, passive transition learning and action-conditioned learning share one system boundary.

---

### Current release metadata
- application: 34.43.0
- state schema: 99
- phase: Stage-7/external-observer-fabric
- BIG PASS 63: Causal Accountability + Outcome Cognition Fabric

## BIG PASS 66 — Roadmap update

Stage-7 расширен до `reality-reconciliation/p83-persistent-reality`. Закрыта системная связь между external observation, prediction linkage и persistent reality continuity. Следующая цель — перейти от локальной reconciliation к долгосрочной модели belief/world/self continuity с реальными Android evidence streams.

## BIG PASS 67 — Autobiographical Continuity Fabric (34.40.0)

В текущем релизе добавлен P84 `AutobiographicalContinuityFabric` внутри существующего Self physical owner. P84 не является новым независимым хранилищем памяти: он хранит bounded lineage-моменты, связывающие действие/результат, decision, prediction/observation/evidence IDs, reality hash/revision, цели и метрики continuity. Канонические сырые данные остаются в Self, Memory, World и Evidence owners.

Цепочка теперь замыкается как `Reality → Prediction → Action/Outcome → Observation/Evidence → Autobiographical Moment → Identity/Continuity`. Одинаковая семантическая ситуация не создаёт новый тяжёлый момент на каждом цикле; используется material-change guard. P84 проецируется и восстанавливается через persistence coordinator / migrations и доступен через `autobiographicalContinuitySnapshot/summary/recent`.

Статус BIG PASS 67: интеграционный тест, аудит, restart/persistence и typecheck — PASS. P84 не доказывает субъективное сознание; это инженерный механизм непрерывной автобиографической причинной связности.

## BIG PASS 69 — CAUSAL BEHAVIOR CARRY-OVER

34.40.0 расширяет P84 Autobiographical Continuity Fabric bounded causal carry-over.
Подтверждённые внешней verification/corroboration исходы могут ограниченно влиять на будущий score соответствующего действия. Bias ограничен ±0.06, имеет временное затухание и не обучается на слабых/unknown данных. Новый physical subsystem не добавляется: механизм остаётся внутри Self owner и использует канонические EventLog/Memory/Reality/Outcome источники.

1000-cycle и 500-warm остаются NOT CERTIFIED в данном execution environment при непредсказуемом timeout; 250/500 natural проходят. Это не выдаётся за доказательство стабильности на физическом Android.

## BIG PASS 70 — CONTEXTUAL EXPERIENCE LATTICE

Следующий шаг после identity-level carry-over: ограниченный перенос опыта по контексту, чтобы успешность действия не обобщалась одинаково на все ситуации. P84 сохраняет global action profile и bounded contextual cells. Контекстная bias-функция использует только verified/corroborated outcomes, смешивает локальный и глобальный сигнал, затухает по времени и не меняет исходные Memory/Reality/EventLog данные. Целевой эффект — context-sensitive adaptation без создания нового physical subsystem.

## BIG PASS 70 — CONTEXTUAL EXPERIENCE LATTICE

P84 расширен bounded contextual experience lattice. Опыт по verified/corroborated исходам теперь хранится как global action profile и до 64 контекстных ячеек, сформированных из goal family, uncertainty, novelty, energy, cognitive load и reality confidence. Локальный профиль учитывается сильнее глобального только при достаточной выборке. Это делает перенос опыта контекстным и уменьшает ложное обобщение.


---
АКТУАЛЬНЫЙ RELEASE POINTER: `34.58.0` / state schema `110`. Этот указатель добавлен для синхронизации исторического документа с текущим canonical release.

**Current release:** 34.92.0 (BIG PASS 118)


<!-- Canonical release: 35.6.1 -->


> Release truth marker: 35.6.43 / 79.3.0-actionable-neural-predictive-b2503. This document remains historical/contextual unless its specific section was updated in the release notes.
> Release truth marker: 35.6.54 / 79.7.0-memory-self-consolidation-b2512-b2514. The historical material in this document is retained; this marker identifies the current release context.

**Актуальный кодовый release:** `35.30.0` — R16 multi-system closure: temporal memory, autonomy, continuity and mobile durability (2026-09-25). Source-of-truth следует проверять по исполняемому коду, тестам и manifest этого release.
