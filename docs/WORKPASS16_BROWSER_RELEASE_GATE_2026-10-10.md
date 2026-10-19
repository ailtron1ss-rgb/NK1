# Neuro-Kurisu SUPER — WorkPass 16: Browser Release Gate Hardening

**Дата:** 10 октября 2026  
**База:** `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS15_2026-10-10.zip`  
**Canonical runtime:** Neuro-Kurisu 35.40.0 / schema 223  
**Статус:** implementation-workpass; NOT release-ready.

## Что сделано

1. Browser smoke больше не игнорирует blocking `BRAND WARNING:`: такие warnings блокируют smoke; `BRAND NOTE:` остаётся неблокирующей рекомендацией для обычных utility apps.
2. Auth config comparison теперь включён в конечный verdict и exit policy. Настоящее расхождение dev/build (`authStatus=diverged`) возвращает отдельный ненулевой код; `indeterminate` остаётся явно видимым в JSON и stderr, но не маскируется под agreement и не блокирует легитимный preview, где dev-only endpoint отсутствует.
3. Валидация `BROWSER_SMOKE_TIMEOUT_MS`: принимает только integer от 1000 до 180000 мс; NaN, Infinity, fractional, negative и неограниченные значения завершаются до запуска Chromium.
4. Browser verdict JSON публикуется атомарно через same-directory temp + fsync + rename. Файл создаётся с mode 0600; ошибки публикации сохраняют предыдущий полный отчёт и очищают временные файлы.
5. Добавлено 6 новых нормализованных deliverables G46–G51 и воспроизводимая root-команда `npm run audit:workpass16`, которая запускает targeted source/runtime/HTTP gates для изменённого участка и ключевых интеграций без повторного прогона каждой исторической регрессии.

## Проверки

- `npm run test:app:scripts` — **PASS, 212/212**.
- `node --test app/scripts/browser-smoke-verdict.test.mjs app/scripts/check-auth-invariant.test.mjs app/scripts/write-report-atomic.test.mjs` — **PASS, 66/66**.
- Добавлены регрессии на required brand warnings vs advisory notes, auth divergence vs indeterminate probe, приоритет error exit codes, timeout boundaries, permissions, cleanup и сохранность предыдущего отчёта при simulated rename failure.
- `npm ci --no-audit --no-fund` из `app/` не завершился в 120-секундном окне из-за недоступности registry; `app/node_modules` не появился. Прямая попытка `npm --prefix app run typecheck` завершилась TS2688 для `@types/node` и `vite/client`; `npm run build` завершилась `spawn vite ENOENT`. Отдельный офлайн Memory Retrieval Experiment проходит через `npm run audit:workpass16:memory-experiment`, но намеренно не включён в короткую aggregate-цепочку после нестабильных таймаутов при последовательном запуске множества npm gates. Целевая команда `npm run audit:workpass16` прошла с кодом 0. Это не доказывает успешность полной UI-сборки и не означает, что все исторические suites запускались одним процессом.
- App semantic typecheck был запущен и завершился ошибкой `TS2688` из-за отсутствующих `@types/node` и `vite/client`; `npm run build` запущен и завершился `spawn vite ENOENT`. Настоящий Playwright browser E2E в этой среде не запускался успешно. Все три gate остаются открытыми.

## Прогресс

- Нормализованный инвентарь: **51 deliverables** — 34 DONE, 9 PARTIAL, 8 TODO.
- Взвешенный progress: **68.65%**, +0.15 п.п. к WorkPass 15; workstream B с 94% до 95%.
- Процент реализации не равен release readiness.

## Архитектурные границы

Изменён только UI smoke / diagnostics / report-output seam. Не создавались дополнительные runtime owners. UI build и browser E2E остаются не подтверждены, пока зависимости не установлены в среде с registry-доступом.
