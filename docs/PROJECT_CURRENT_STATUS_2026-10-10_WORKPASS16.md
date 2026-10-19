# Текущее состояние Neuro-Kurisu SUPER — WorkPass 16

**Дата среза:** 10 октября 2026 года  
**База:** WorkPass 15  
**Runtime:** Neuro-Kurisu 35.40.0 / schema 223  
**Статус:** implementation-workpass; НЕ release-ready.

## Итог

Взвешенная оценка реализации **68.65%** (изменение +0.15 п.п. относительно WorkPass 15). В WorkPass 16 скорректировано направление B с 94% до 95% благодаря усилению browser-smoke release gate и его регрессий. Направления C/D/F отражают ранее подтверждённую реализацию WorkPass 11–15, но полный релизный E2E и независимое production evidence по ним остаются открытыми.

Единый инвентарь содержит **51 уникальный deliverable**: **34 DONE**, **9 PARTIAL**, **8 TODO**. Исторические append-only таблицы не складываются повторно.

| Направление | Вес | Реализация | Вклад | Следующий блокер |
|---|---:|---:|---:|---|
| A. Canonical source lineage and single-owner architecture | 15% | 100% | 15.00 | Сохранение границ и provenance |
| B. Runtime integration, API/UI routes and smoke/linkage coverage | 15% | 95% | 14.25 | Dependency-complete UI build и настоящий browser E2E |
| C. Memory 2.0, retrieval/admission and benchmark evidence | 15% | 60% | 9.00 | Независимый размеченный temporal holdout |
| D. Agency, action schema, execution, outcome and reafference | 20% | 62% | 12.40 | Полная причинная цепочка и внешние postconditions |
| E. Portable subject continuity and social/known-entity dossier | 10% | 75% | 7.50 | Browser-backed correction/expiry/conflict |
| F. External transport, SDK, idempotency and replay | 10% | 40% | 4.00 | Remote receipts и reconnect/replay stress |
| G. Research promotion and controlled experiments | 5% | 40% | 2.00 | Воспроизводимые research promotion evidence |
| H. Release durability: build, E2E, rollback, soak, SBOM/provenance | 10% | 45% | 4.50 | Build, rollback, soak, SBOM/provenance |
| **Итого** | **100%** |  | **68.65%** | **31.35 п.п. плана остаются** |

## WorkPass 16 — реальная реализация

1. Browser smoke теперь считает обязательные `BRAND WARNING:` блокирующими ошибками процесса; `BRAND NOTE:` остаётся advisory, чтобы plain-utility исключение не стало ложным отказом.
2. Проверка авторизации записывает `authInvariant.status` и пояснение в verdict; настоящий `diverged` получает ненулевой код, а `indeterminate` явно отражается в диагностике без ложного заявления о согласии.
3. `BROWSER_SMOKE_TIMEOUT_MS` проверяется до старта Chromium: допускается целое значение от 1 000 до 180 000 мс.
4. JSON-отчёт browser smoke публикуется атомарно: same-directory temp, mode 0600, fsync и rename. Ошибка rename сохраняет прошлый отчёт и очищает временный файл.
5. Добавлены регрессии на выходные коды, статусы авторизации, timeout boundaries, права файла и отказ атомарной публикации; добавлена общая команда `npm run audit:workpass16`.

## Проверки, фактически выполненные

- Root `npm run audit:workpass16` — **PASS, exit code 0** (bounded focused gate). The offline multi-seed memory experiment is independently available via `npm run audit:workpass16:memory-experiment`; it is not nested inside the short aggregate because it intermittently stalled after the other gates in a long chained invocation.
- Release metadata validator — **34/34 PASS**; metadata regression fixtures **6/6 PASS**.
- App source-only script suite — **212/212 PASS**; browser/auth/atomic writer suites — **66/66 PASS**.
- Runtime TypeScript — `TYPECHECK=PASS mode=tsc`.
- Memory retrieval benchmark and offline experiment — PASS; synthetic fixture корректно остаётся `not-promoted`, реальный production uplift не заявлен.
- Server relative imports — 10 checked, 0 missing; UI/API linkage — 124 routes, 48 Runtime Atlas surfaces, 5 required seams, missing=0.
- Runtime evidence bus/outcome verification/reafference/agency/temporal-credit regressions — PASS in the component gates executed before the first over-broad chain hit the environment time limit.
- Asset audit — PASS; direct HTTP server smoke — PASS in separate component runs.
- Initial over-broad combined chain exceeded the execution window; `audit:workpass16` was tightened to the changed and critical integration gates and then passed. This is not a claim that every historic test ran in one command.

## Незакрытые блокеры

- Полный React/Vite build и app semantic typecheck: `npm run build` возвращает `spawn vite ENOENT`; app typecheck сообщает отсутствующие `@types/node` и `vite/client` (`TS2688`). `npm ci` в текущем окружении не завершился за 120 секунд.
- Реальный desktop/mobile browser E2E с интерактивным Live2D.
- Независимый размеченный temporal holdout MemoryOS2 и воспроизводимое доказательство улучшения.
- Полная action → remote postcondition/receipt → persistence → reafference цепочка и stress no-double-credit.
- Provider reconnect/replay stress, clean-room restore/upgrade/rollback, multi-hour soak и финальный SBOM/provenance.

**Вывод:** WorkPass 16 сделал browser smoke более надёжным релизным gate и подтвердил целевые регрессии. Полный production build и реальный browser E2E не подтверждены; статус остаётся implementation-workpass, не release-ready.


## WorkPass 16 — browser smoke gate и атомарные verdict-отчёты

- `browser-smoke-verdict.mjs` теперь возвращает failure для blocking `BRAND WARNING:` и реального `authStatus=diverged`; `BRAND NOTE` остаётся advisory, а `indeterminate` auth probe виден в JSON/diagnostics без ложного утверждения о согласии.
- Verdict JSON включает `authInvariant.status` и сообщение. `BROWSER_SMOKE_TIMEOUT_MS` принимает только целое число в диапазоне 1 000–180 000 мс; неверная конфигурация завершается до запуска браузера.
- `write-report-atomic.mjs` создаёт временный файл рядом с target, выставляет mode 0600, fsync-ит данные и атомарно заменяет отчёт; отказ переименования сохраняет старый файл и очищает temp.
- Добавлено 6 нормализованных DONE deliverables (G46–G51); итог: 51 уникальная задача — 34 DONE / 9 PARTIAL / 8 TODO.
- `npm run test:app:scripts`: **212/212 PASS**. Самостоятельные новые smoke/auth/atomic suites: **66/66 PASS**.
- `npm run install:all` / чистая установка UI в этом окружении не подтверждены: `npm ci` завис на недоступности registry; React/Vite build и actual Playwright E2E остаются TODO.
- Обновлённый weighted implementation estimate: **68.65%**; это не release readiness.
