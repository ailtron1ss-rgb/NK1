# WorkPass336 — привязка результата к экземпляру independent evaluator

Дата: 2026-10-26  
Ветка: `fix/mega-cognitive-progress-tracking-2026-10-26-r3`  
Область: P23 evaluator result → VerifiedOutcomeLedger commit boundary

## Проблема

`evaluationFingerprint` — обычный SHA-256 от сериализуемого отчёта. Он обнаруживает изменение данных, если caller оставил старый digest, но сам по себе не удостоверяет происхождение результата: вызывающий код может изменить `runId`, затем пересчитать публичный digest. Manifest/plan validation не доказывает, что этот новый execution ID действительно пришёл от установленного sandbox и независимого verifier.

## Изменение

- Модуль содержит приватный `WeakMap` capability registry: при возврате результата evaluator регистрирует точный object envelope и его исходный evaluation fingerprint.
- `recordIndependentEvaluationOutcomes` сначала выполняет существующие shape/manifest/plan/duplicate проверки, затем **до первой записи** требует совпадения приватной attestation с fingerprint результата.
- Копия/десериализованный JSON envelope не наследует capability. Пересчёт SHA-256 после подмены поля не предоставляет полномочие записи.
- Более конкретные ошибки сохранены: неправильно типизированные IDs, семейство из другого manifest, неполное покрытие и иные ошибки схемы продолжают отклоняться собственными guards до attestation guard.

## Регрессия

В `tests/workpass203-independent-candidate-evaluator.mjs` добавлен adversarial сценарий: результат копируется через `structuredClone`, первый execution ID подменяется на синтаксически валидный `forged-execution-run`, после чего caller пересчитывает `evaluationFingerprint`. Запись должна закончиться `independent-evaluation-ledger-evaluator-attestation-missing`, а `acceptedOutcomes` остаётся нулём. Исходный, не копированный объект после отрицательных тестов по-прежнему записывается штатно.

Команда: `npm run test:workpass203:independent-candidate-evaluator` в `runtime/neuro-kurisu`. Требуется exact-head WorkPass110/P26/WorkPass108 и unified CI.

## Ограничение модели доверия

Это **in-process capability**, а не криптографическая подпись. Если результат должен пройти сериализацию, рестарт процесса или границу между сервисами, он должен заново пройти отдельный trusted signed-evidence verifier; этот `WeakMap` не делает экспортированный JSON доверенным и не заменяет signed receipts.
