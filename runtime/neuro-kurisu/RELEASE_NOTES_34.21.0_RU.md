# Neuro-Kurisu 34.21.0

## BIG PASS 50 — Cognitive Frame + Compiled Execution Plan

### Главное

Этот проход не добавляет очередной декоративный когнитивный P-уровень. Он усиливает существующий spine как единый execution layer для среднего Android/Termux.

### Добавлено

- `src/organism/core/CognitiveFrame.ts`
- `src/organism/core/CognitiveExecutionPlanner.ts`
- накопительная статистика execution runs/skips/forced/opportunities/savings;
- persisted `system.cognitiveExecutionPlan`;
- диагностический API `/api/organism/cognition-plan`;
- `BIG_PASS_50` regression test и npm alias;
- `500-warm` benchmark npm alias;
- BIG PASS 50 audit report.

### Изменено

- `OrganismCore.observe()` строит нормализованный frame один раз на цикл;
- тяжёлые операции дополнительно ограничиваются по dirty-domain, budget, thermal/RAM pressure и существующему spine;
- `stateBefore` больше не требует deep clone всего `OrganismState`;
- `ActionGateway`: `ok` и `verified` разделены. `verified` требует явного tool verification contract;
- built-in read tools явно объявляют verification contract;
- release/source-of-truth синхронизирован на `34.21.0`.

### Сохранено намеренно

- state schema остаётся 92;
- существующие P31/P32/P42-P44/P69-P82 механизмы не переписаны только ради архитектурного рефакторинга;
- существующий `CognitiveSpineScheduler` используется как базовый scheduler, а не заменён дубликатом.

### Validation

- TYPECHECK=PASS
- CLEAN_ARCHITECTURE=PASS
- CLEAN_INTEGRITY=PASS
- SOURCE_HYGIENE=PASS
- RELEASE_CONTRACT=PASS
- SOURCE_TRUTH=PASS
- FORENSICS=PASS
- API_ROUTES=93 / duplicates=0
- SUBJECT_BOUNDARY=PASS
- API_SECURITY=PASS
- SERVER_SECURITY_SMOKE=PASS
- IDENTITY_LOCK=PASS
- CONCURRENCY=PASS
- REPLAY=PASS
- PORTABLE_SUBJECT_BOUNDARY=PASS
- CLEAN_RESTART_PERSISTENCE=PASS
- SERVER_SMOKE=PASS
- BIG_PASS_45_ARCHITECTURE_PERFORMANCE=PASS (`21.16ms → 23.83ms`, ratio 1.126)
- BIG_PASS_49=PASS
- BIG_PASS_50_COGNITIVE_EXECUTION=PASS
- P31/P32 lesion=PASS
- P42-P44 complete integration/truth/persistence/performance suite=PASS
- P69-P73=PASS
- P74-P77=PASS
- P80-P82 integration/runtime E2E=PASS
- persistence projection/footprint/hotpath=PASS
- 250-cycle operational=PASS (`23.19ms → 34.44ms`, ratio 1.485)
- 500-warm=PASS (`24.94ms → 39.27ms`, ratio 1.575, heap growth 0.997)
- 1000-cycle=PASS (`33.05ms → 41.79ms`, ratio 1.265, p95 46.31ms, heap 44.07→47.79MB, memory 219)
- current enhanced release gate=PASS

### Scientific honesty

Этот релиз не заявляет empirical proof of consciousness, human equivalence, fully learned world model, semantic vision from raw camera frames или physical 24/72/168h validation on the target phone.
