# BIG PASS 9 — Memory / Persistence / Efficiency / Regression Audit

Дата: 2026-09-04
База: Neuro-Kurisu Evolution 34.2.0

## 1. Цель прохода

Этот проход продолжает аудит BIG PASS 8 и сознательно не добавляет большое количество новых «когнитивных модулей». Основной критерий прогресса: меньше лишних вычислений и записей, меньше дублирования состояния, более честные persistence semantics, лучшее измерение длительной работы и отсутствие скрытого test/contract drift.

## 2. Что реально внедрено

### 2.1 Tiered persistence вместо псевдо-dirty checkpoint

Добавлен `PersistenceProjectionGovernor`.

Он выбирает между:
- `hot` projection — runtime-проекция без физической durable-записи;
- `full` projection — полное обновление advanced projection и durable save.

Правила ограничены и pressure-aware: обычный режим использует `checkpointMaxDirtyCycles`; при повышенном давлении full checkpoint ускоряется; forced/flush всегда дают full checkpoint.

Ключевое изменение BIG PASS 9: hot checkpoint больше не вызывает `store.save()`. Это превращает предыдущую оптимизацию snapshot-path в реальное сокращение физических writes. Окно возможной потери при внезапном падении ограничено governor и закрывается `flush()`.

Добавлены проверки:
- `tests/persistence-projection-tiering.mjs`;
- `tests/persistence-projection-governor.mjs`;
- `tests/persistence-durability-window.mjs`.

Результат: `PERSISTENCE_PROJECTION_TIERING=PASS saves=3 hot=2 full=3`; durability-window подтвердил `init → hot → hot → full → hot → flush` с сохранением durable tick до full/flush.

### 2.2 Сохранена семантика явных мутирующих API

Публичные операции, которые по смыслу должны быть немедленно durable (`recordCounterfactuals`, `setEmbodiment`, `applyConsolidation`, `executeTool`, `recordLanguageBackend` и аналогичные explicit mutation paths), переводятся на forced checkpoint. Основной `observe()` остаётся coalesced/hot-tiered.

Это уменьшает риск неожиданного delayed persistence для внешних API, одновременно сохраняя экономию на массовом циклическом runtime path.

### 2.3 Persistent footprint

BIG PASS 8 already reduced major branches; BIG PASS 9 закрепил bounded/compact semantics:
- autobiographical compatibility snapshot — compact;
- event log — bounded to 320 in relevant persistence paths;
- P62 history — bounded to 16;
- MultiTimescaleMemory — bounded per-timescale snapshot and compact evidence/source lists.

Текущий `tests/persistence-footprint.mjs`:

`PERSISTENCE_FOOTPRINT=PASS total≈2.42 MB, auto≈119 KB, events≈155 KB, p62≈55 KB`.

В предыдущем измерении того же класса workload общий persistent snapshot был около 2.713 MB; текущий показатель около 2.420 MB, то есть приблизительно на 10.8% меньше в данном synthetic workload. Это локальный engineering benchmark, а не универсальный прогноз для всех host profiles.

### 2.4 Memory substrate

`MemorySubstrateCoordinator` остаётся в силе: MemoryOS2 трактуется как canonical epistemic store, MultiTimescaleMemory — compatibility/read continuum.

Дополнительно оптимизированы индексы:
- P49 `seenEventIds` теперь имеет bounded Set index вместо повторяющихся линейных `includes()`;
- P51 concepts/hypotheses получили bounded lookup Maps вместо повторных линейных `find()`.

Это направлено именно на growing-state cost, не меняя внешнюю модель данных.

### 2.5 Historical test coverage

Добавлен/актуализирован `scripts/audit-historical-shards.mjs`.

Текущий audit:
- 152 test files;
- 163 package test scripts;
- 55 phases;
- 0 orphan test files;
- 0 missing script targets.

Также фактически перепроверены исторические integration/migration shards, включая P29, P46, P47, P48, P49, P52, P56–57 и P80–82.

Отдельно был обнаружен устаревший assertion `schema=82` в P80–82 runtime E2E; он исправлен на canonical schema 83 и после этого тест прошёл на 160/160 cycles.

## 3. Runtime efficiency investigation

Long-horizon instrumentation выявила не доказанный memory leak, а сильную зависимость latency от растущих структур.

Профилирование показало, что заметную долю CPU получают repeated `structuredClone()` snapshots, прежде всего в P40 semantic intelligence, SelfGovernance, P30 continual и связанных observer/checkpoint paths.

В этом проходе точечно устранены безопасные дубликаты snapshot-работы:
- P40 ingest теперь не создаёт snapshot, который сразу же выбрасывается;
- P37 sensor snapshot переиспользуется;
- P41 native snapshot переиспользуется вместо повторного clone.

Дополнительный индексный fast path внедрён в P49/P51.

### Важное ограничение

Этого пока недостаточно для объявления long-horizon scaling solved. На отдельном 3×120 statistical workload текущий ratio был примерно 7.36× / 9.50× / 9.30× при retained heap ≈26.35 MB; это дало `WARNING`. При этом независимый функциональный 220-cycle regression продолжает проходить:

- first ≈32.19 ms;
- last ≈102.65 ms;
- ratio ≈3.19×;
- p50 ≈43.73 ms;
- p95 ≈178.49 ms;
- p99 ≈185.52 ms;
- heap growth ≈1.36×;
- `LONG_HORIZON_FUNCTIONAL=PASS`, `SCALING=PASS`.

Полный прежний statistical harness 3×180 в текущей среде не завершился в доступном execution window; поэтому его новый результат не объявляется PASS. Это следует считать ограничением текущей проверки, а не успехом.

## 4. Проверка предыдущего roadmap

### G1 Canonical Core Decomposition — 90%

Architecture audit остаётся чистым: `missing=0`, `cycles=0`, `legacyLeakage=0`. Projection responsibility стала более явной благодаря governor, но полноценный revision graph ещё отсутствует.

### G2 Long-Horizon Scaling — 78%

Функциональный 220-cycle gate — PASS. Statistical profile остаётся неоднородным; нужны 220–1000 cycle серии с controlled allocation profile и реальным mobile host.

### G3 Portable Subject v2 — 85%

Portable subject, identity/fingerprint, migration/restart/model-switch contracts сохранены. Physical degraded-host migration ещё не проверен.

### G4 Native Android Host — 72% source/runtime; 38% physical

Source contracts есть. Реальный Android CPU/RAM/battery/thermal/suspend/process-death/reboot gate остаётся незакрытым.

### G5 Semantic Sensorium — 70%

Semantic/temporal/native/multimodal paths есть. Holdout на реальных сенсорах пока отсутствует.

### G6 Autonomous Research Loop — 82%

P38 sandbox/evidence/accounting присутствуют. Остаток — повторяемые paired-baseline campaigns.

### G7 Longitudinal Development — 77%

Lifelong/dream/replay/maintenance/temporal continuity есть. Реальные 24h/72h/168h/30d trials не проведены.

## 5. Выполнение рекомендаций Qwen

Weighted implementation assessment: **≈67%**.

Сильные направления, уже существующие и сохраняемые:
- active forgetting;
- episodic/semantic separation;
- reconsolidation/provenance;
- intrinsic goal generation;
- sandboxed reasoning;
- prefrontal-like inhibition / governance;
- substrate migration semantics;
- metacognitive observer;
- confidence calibration;
- value evolution;
- ablation/lesion self-tests;
- epistemic humility.

Следующий приоритет по Qwen всё ещё не «добавить 20 новых кнопок», а довести частичные идеи до измеряемых state transitions: flashbulb retention class, thought debt, context-dependent retrieval, stronger DMN/incubation, explainable HITL и bias detection.

Сознательно не рекомендуется буквальное внедрение destructive/emotionally-chaotic вариантов memory interference/emotional bleed. Functional proxies должны оставаться bounded, reversible и provenance-aware.

## 6. Genesis v12.3 — статус использования идей

Предоставленный GENESIS v12.3 подтверждает полезность отдельного evolutionary sandbox с bytecode VM, mutable genome, self-modifying instructions, artifact library, invariant/proof layer, альтернативными средами и replay serialization. Он рассматривается как лабораторный источник идей для isolated procedural-skills / evolutionary mode, а не как замена Neuro-Kurisu Core.

Критически: в BIG PASS 9 Genesis не был механически смешан с persistent cognitive substrate.

## 7. Процент готовности после BIG PASS 9

Это инженерная оценка roadmap/completeness, а не измерение AGI, сознания или субъективного опыта.

| Область | Прогресс |
|---|---:|
| Canonical architecture | **90%** |
| Memory architecture | **83%** |
| Persistence / recovery | **90%** |
| Reality / provenance | **86%** |
| Autonomy / development | **82%** |
| Safety / HITL / substrate boundary | **85%** |
| Performance / mobile efficiency | **81%** |
| Termux readiness | **80%** |
| Android source / runtime contracts | **72%** |
| Real Android device validation | **38%** |
| Multimodal / semantic grounding | **70%** |
| Long-horizon validation | **78%** |
| Historical regression closure | **95%** |
| Qwen idea set — weighted implementation | **67%** |
| **Overall engineering readiness** | **86%** |

## 8. Что именно уже проверено в этом проходе

PASS:
- TypeScript typecheck;
- persistence projection tiering;
- persistence governor;
- persistence durability window;
- persistence footprint;
- memory substrate;
- checkpoint hot path;
- restart persistence;
- P15.5 device-hardening test;
- P29 core integration;
- P46 prediction ledger;
- P47 temporal memory;
- P48 functional awareness;
- P49 temporal life;
- P52 counterfactual truthfulness;
- P56–P57 integration persistence;
- P80–P82 runtime E2E 160 cycles;
- P69–P73 giant integration;
- P31/P32 lesion paths;
- P42–P44;
- architecture audit;
- historical shard audit;
- forensics/source-hygiene family.

`npm run test:long-horizon` — **PASS**, functional 220 cycles; текущий scaling status = `WARNING` из-за heap-growth в этом профиле.

`npm run test:long-horizon-statistical` — **не считать PASS в этом проходе**: полный 3×180 execution window не завершился; отдельный 3×120 контрольный прогон завершён как WARNING. Это сделано намеренно, чтобы не подменять измерение красивой цифрой.

## 9. Самопроверка: «всё ли из предыдущего анализа внедрено?»

Нет. Существенная часть сделана, но несколько пунктов остаются честно открытыми.

- True revision-aware dirty graph: **55%**. Реализован bounded hot/full governor; per-branch revision tokens ещё не внедрены.
- Unified memory substrate: **83%**. MemoryOS2 — canonical authority, compatibility continuum есть; фактическая двойная storage topology ещё существует.
- Branch-level persistence budgets: **80%**. Memory/event/P62 budgets работают, generic budget matrix по всем веткам ещё не завершена.
- Android physical hardening: **38%**. Source contracts не заменяют реальное устройство.
- Thought-debt / DMN / circadian / incubation: **70%**. Functional primitives есть, dedicated measurable ledgers/schedulers не доведены.
- Reality-validation campaigns: **58%**. Evidence/provenance infrastructure есть, repeated paired baselines ещё нужны.
- Historical + statistical release evidence: **90%**. Historical mapping и evidence file работают; statistical release gate ещё требует полного repeated series storage.

## 10. Следующий наиболее эффективный порядок

1. Revision-aware dirty graph: branch revision tokens + changed-branch serialization.
2. Memory consolidation: убрать физическое дублирование между MemoryOS2 и compatibility continuum.
3. Generic branch budgets: memory, event, provenance, traces, advanced history и raw modality buffers под одним budget contract.
4. Runtime hotspot reduction: snapshot caching/versioning для P40/P30/SelfGovernance и других growing structures без потери auditability.
5. Real Android campaign: process death, reboot, suspend/resume, thermal, battery, RAM, background limits, sensor permissions.
6. Reality/longitudinal campaigns: repeated P38/P41/P52/P77 with external evidence and paired baselines.
7. После этого — только точечные Qwen additions (thought debt, flashbulb, stronger DMN/incubation, explainable HITL), а не массовое расширение архитектуры.

## 11. Итог BIG PASS 9

Главный реальный прогресс этого прохода — persistence перестала быть только оптимизацией snapshot path и стала tiered durability policy с явным bounded crash window. Параллельно уменьшен persistent footprint, закрыт historical test drift, устранены безопасные snapshot duplication points и добавлены дополнительные lookup indices.

Главный оставшийся риск — growing CPU cost от множества независимых state representations. Поэтому следующий большой проход должен ещё сильнее идти через consolidation, revision-aware persistence и snapshot versioning, а не через рост количества модулей.
