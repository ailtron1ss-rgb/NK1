# Neuro Kurisu — текущий статус WorkPass 58 (2026-10-17)

**База:** `Neuro_Kurisu_WORKPASS57_2026-10-17.zip`  
**Результат:** `Neuro_Kurisu_WORKPASS58_2026-10-17.zip`  
**Runtime:** `35.78.0` · **persisted schema:** `225`

## Прогресс

- **WorkPass58 — 100% (8/8 scoped implementation deliverables).** Это процент завершения задач текущего прохода, а не релизная готовность.
- **Официальная взвешенная готовность общей дорожной карты — 78.0% (изменение: 0 п.п.).** Реальные provider/device E2E, production app/browser/Live2D, независимый retrieval uplift, целевая локальная модель, clean-room rollback, полный license review и soak всё ещё открыты.
- В объединённом inventory: **53 выполнено / 10 частично / 8 открыто** из 71 отслеживаемых задач.

## Кодовыми изменениями закрыто

1. `OrganismCore.executeReusableSkill()` проверяет все основные, repair- и fallback-кандидаты до старта первого шага. Отсутствующий/невалидный ключ блокирует whole-skill без частичного исполнения.
2. Вложенные шаги получают устойчивые ключи и `decisionId`; trusted `autonomous` context и expected output metadata передаются в общий путь финализации.
3. `executeProjectTool()` выполняет preflight до списания бюджета и согласует ключ/decision identity с approval continuation.
4. HTTP project routes не принимают client-supplied `autonomous=true` как доверенное происхождение.
5. Добавлен `tests/workpass58-composite-idempotency-preflight.mjs` для fail-closed preflight, receipts, lineage, replay и project budget.
6. Стабилизирован фоновый memory-indexing тест: произвольная задержка заменена управляемым provider barrier; предыдущий регрессионный набор проходит при отдельном запуске.
7. Согласованы root/runtime version and release metadata, current status, backlog, package scripts и archive manifest; итоговый zip получает UTF-8 path comparison and SHA-256.

8. HTTP-ответы для idempotency preflight теперь различают неправильный переданный ключ (400) и отсутствующий обязательный ключ (428) через общий helper `idempotencyPreflightHttpStatus`.

## Evidence текущего прохода

- `TYPECHECK=PASS mode=tsc` для runtime `35.78.0`.
- `WORKPASS58_COMPOSITE_IDEMPOTENCY_PREFLIGHT=PASS`: блокировка до execution; 2 step receipts; stable decision IDs; keyed retry/replay без повторной операции; project preflight до расходования бюджета.
- `npm run test:workpass57` проходит при отдельном запуске: outcome hardening, inferred idempotency, late evidence/correlation, crash reconciliation, receipt integration 9/9, provider reconciliation 5 сценариев, memory indexing и embedding privacy.
- Широкий retrieval benchmark не продвинут: `recallDelta=0`, `promotion=not-promoted`.

## Открыто после прохода

- Real provider/device: read-after-write postcondition + process restart + reconciliation.
- Production Vite build и интерактивный browser/Live2D E2E.
- Независимый labelled temporal memory holdout и retrieval uplift.
- Реальная локальная модель на целевом оборудовании, аудио/фонемная синхронизация.
- Чистое восстановление/rollback, полный аудит лицензий вложенных источников и soak.

Полный реестр задач — `PROJECT_CURRENT_STATUS_2026-10-17_WORKPASS58.json`; методика процентов — `PROJECT_PROGRESS_SCORECARD_2026-10-17_WORKPASS58.json`.
