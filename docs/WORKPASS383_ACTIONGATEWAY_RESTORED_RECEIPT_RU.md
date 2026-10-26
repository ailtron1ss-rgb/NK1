# WorkPass383 — fail-closed проверка restored ActionGateway receipts

**Дата:** 2026-10-26  
**Ветка:** workpass375-hexis-canonical-ingress-latest  
**Исходный exact HEAD:** 50c72382927306444d0f976d3d7fdfb3f3cae657  
**Статус:** исправление и регрессии внесены; точный CI-запуск обязателен.

## Наблюдаемый дефект

На HEAD `5830564ac91d48dab355a63a575fdf020f8ab960` общий WorkPass71 прошёл App typecheck/build, runtime typecheck, P26 learning-replay и исправленный `causal-replay-runtime-wiring.mjs`, но упал в `tests/workpass95-restored-action-receipt-integrity.mjs:36`. Тест изменял `baseline.records[0].response.executionId` на `exec-forged-identity`, восстанавливал ledger и повторял запрос с тем же idempotency key. `ActionGateway` вернул сохранённый объект как успешный replay, несмотря на несовпадение execution identity.

## Причина

`restoreExecutionLedger()` клонировал `row.response` без проверки согласования с `row.executionId`/`row.toolId`. `replayLedgerEntry()` затем возвращал клонированный response без проверки. Это позволяло повреждённой persisted receipt подменить идентичность действия или заявить противоречивое outcome.

## Исправление

- Ввести единый `isReplayableActionReceipt(entry, response)` и использовать его и во время restore, и непосредственно перед replay (включая записи, пришедшие из archive port).
- Связать `response.executionId` с каноническим `entry.executionId`, `response.tool` с `entry.toolId`, а при наличии — `audit.executionId` и `audit.tool` с теми же идентификаторами.
- Проверять совпадение `response.ok` ↔ `audit.accepted`, `response.verified` ↔ `audit.verified` и `response.outcomeClass` ↔ `audit.outcomeClass`; положительный `verified` не допускается без положительных response/verification/audit подтверждений.
- Сохранить текущую верхнюю границу 48 KiB для replayable response; oversized/cyclic/invalid payload становится recovery tombstone.
- При невалидном response сохранять completed idempotency key, но не переиспользовать body; replay возвращает `idempotency-recovery-required`, не запускает tool executor и не освобождает ключ под новую операцию.
- Расширить WorkPass95 шестью corruption scenarios: response execution ID, tool ID, audit execution ID, verification contradiction, audit outcome mismatch и oversized payload.

## Критерии закрытия

Новый exact-head запуск должен пройти `test:workpass95:receipt-integrity`, `test:rebuild-recovered`, WorkPass71 и Repository Wiring Audit. Предыдущий fail остаётся baseline; синтетический test не доказывает внешнее end-to-end выполнение.

`main` и опубликованный Release ZIP не изменяются.

