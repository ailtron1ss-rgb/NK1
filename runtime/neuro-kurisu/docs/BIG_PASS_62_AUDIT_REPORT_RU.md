# BIG PASS 62 — Аудит External Outcome Verification

## Цель
Сделать различие между успешным ответом инструмента и реально подтверждённым изменением внешнего мира.

## Реализовано
- `OutcomeVerificationService` как единый verifier layer.
- `ToolDefinition.verify` для независимого postcondition verifier.
- live destructive tools без verifier блокируются.
- `ActionAuditRecord` хранит basis/confidence/observationId.
- `ToolExecution` возвращает структурированный verification result.
- подтверждённые external outcomes пишутся в bounded ledger.
- подтверждённые outcomes получают epistemic evidence.
- при наличии `observedWorldContextAfter` результат передаётся в World Fabric.
- schema 94→95 migration сохраняет совместимость.

## Научная граница
`ok=true` не является доказательством внешнего результата. `tool-contract` означает контрактный ответ самого инструмента и не равен независимой верификации. `external-postcondition` требует observation id.

## Проверки
- BIG_PASS_62_OUTCOME_VERIFICATION: PASS
- TYPECHECK: PASS
- SMOKE: PASS
- RESTART: PASS
- P41 truthfulness: PASS
- P27 integration: PASS
