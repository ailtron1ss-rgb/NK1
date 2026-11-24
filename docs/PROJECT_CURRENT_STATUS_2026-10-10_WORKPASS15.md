# Текущее состояние Neuro-Kurisu SUPER — WorkPass 15

**Дата среза:** 10 октября 2026 года  
**База:** WorkPass 14  
**Runtime:** Neuro-Kurisu 35.40.0 / schema 223  
**Статус:** implementation-workpass; НЕ release-ready.

## Итог

Взвешенная оценка реализации **68.50%** (изменение +0.55 п.п. относительно WorkPass 14). Пересмотрено только направление D — agency/action/outcome/reafference: усилены локальные гарантии evidence bus и независимого outcome verifier. Это не закрывает полный внешне подтверждённый action loop и не меняет release readiness.

Единый инвентарь содержит **45 уникальных deliverables**: **28 DONE**, **9 PARTIAL**, **8 TODO**. Исторические append-only таблицы не складываются повторно.

| Направление | Вес | Реализация | Вклад | Следующий блокер |
|---|---:|---:|---:|---|
| A. Canonical source lineage and single-owner architecture | 15% | 100% | 15.00 | Сохранение границ и provenance |
| B. Runtime integration, API/UI routes and smoke/linkage coverage | 15% | 94% | 14.10 | Dependency-complete UI build и настоящий browser E2E |
| C. Memory 2.0, retrieval/admission and benchmark evidence | 15% | 60% | 9.00 | Независимый размеченный temporal holdout |
| D. Agency, action schema, execution, outcome and reafference | 20% | 62% | 12.40 | Полная причинная цепочка и внешние postconditions |
| E. Portable subject continuity and social/known-entity dossier | 10% | 75% | 7.50 | Browser-backed correction/expiry/conflict |
| F. External transport, SDK, idempotency and replay | 10% | 40% | 4.00 | Remote receipts и reconnect/replay stress |
| G. Research promotion and controlled experiments | 5% | 40% | 2.00 | Воспроизводимые research promotion evidence |
| H. Release durability: build, E2E, rollback, soak, SBOM/provenance | 10% | 45% | 4.50 | Build, rollback, soak, SBOM/provenance |
| **Итого** | **100%** |  | **68.50%** | **31.50 п.п. плана остаются** |

## WorkPass 15 — реальная реализация

1. `RuntimeEvidenceBus` использует стабильные sequence IDs вместо случайного хвоста; валидирует kind/tick, ограничивает parent links и размер payload, удаляет дублирующие causal parents, отцепляет сохранённые данные от вызывающей стороны.
2. Snapshot restore пропускает malformed/duplicate records, нормализует значения и восстанавливает coherent counters. Lifetime `byKind`/`total` отделены от `bufferedByKind`/buffered count, чтобы метрики не меняли смысл после восстановления. Сохранена backward compatibility для старого snapshot без `sequence`.
3. `OutcomeVerificationService` передаёт verifier-у глубокую изолированную замороженную копию input/result; exceptions, non-serializable context, неизвестный/пустой basis и пустой external observation ID fail-closed в `unverified`. Returned evidence text bounded, raw exception text не передаётся в diagnostics.
4. Добавлены targeted регрессии `big-pass-128`/`big-pass-129`; повторно выполнены существующие evidence-spine, outcome, reafference, agency и memory tests. Root/runtime package получили `test:runtime-evidence-bus`, `test:outcome-verification-hardening` и `audit:workpass15`.
5. Устранён потенциально многоминутный hang server smoke: `pollUntilReady` ограничивает общий startup deadline и probe timeout, завершает polling при раннем выходе сервера, а cleanup ограничен по времени. Добавлены unit-регрессии для readiness, child-exit, deadline и безопасной диагностики.

## Проверки, фактически выполненные

- Runtime evidence bus reliability — PASS (стабильность ID, payload bounds, snapshot/counter compatibility, corrupt-state normalization).
- Outcome verification hardening — PASS (immutable context, strict receipt rules, fail-closed exception handling).
- Existing evidence spine and budget tests — PASS.
- Reafference codec/integration, affordance, targeted temporal credit — PASS.
- Memory retrieval benchmark and offline experiment — PASS; fixture корректно остаётся `not-promoted`, реальный production uplift не заявлен.
- Runtime TypeScript — `TYPECHECK=PASS mode=tsc`.
- Server relative imports — 10 checked, 0 missing.
- UI/API linkage — 124 routes, 48 Runtime Atlas surfaces, 5 required seams, missing=0.
- Server smoke startup poll unit tests — PASS; direct HTTP server smoke — PASS.
- Asset audit — 0 errors.

## Незакрытые блокеры

- Полный React/Vite build и app semantic typecheck: зависимости отсутствуют; ранее npm registry возвращал `EAI_AGAIN`.
- Реальный desktop/mobile browser E2E с интерактивным Live2D.
- Независимый размеченный temporal holdout MemoryOS2 и воспроизводимое доказательство улучшения.
- Полная action → remote postcondition/receipt → persistence → reafference цепочка и stress no-double-credit.
- Provider reconnect/replay stress, clean-room restore/upgrade/rollback, multi-hour soak и финальный SBOM/provenance.

**Вывод:** WorkPass 15 усиливает доверие к данным и верификации результата внутри runtime; он не заявляется как закрытие полного агентского цикла или release sign-off.
