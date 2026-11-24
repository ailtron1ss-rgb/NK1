# BIG PASS 112 — Self-Directed Learning Investment Gate

## Цель
Сделать самостоятельное обучение ресурсным решением организма, а не безусловным автоматическим запуском. Neuro-Kurisu должна иметь возможность решить: инвестировать ресурс в обучение сейчас, наблюдать, отложить задачу или восстанавливаться.

## Реально внедрено
- `LearningInvestmentDecision` — persisted decision ledger.
- `decideLearningInvestment()` — bounded решение `invest | observe | defer | recover`.
- Decision учитывает D-VOI, expected gain, estimated cost, opportunity cost, resource pressure и remaining budget.
- При активном development cycle приоритет отдаётся продолжению существующего цикла, а не созданию конкурирующего обучения.
- Core интеграция: инвестиционное решение выполняется перед autonomous proposal и может не запускать новую гипотезу.
- API: `p36LearningInvestmentDecision()` и `p36LearningInvestmentHistory()`.
- P36 persistence version 4.
- State schema 120 → 121.
- Migration test и dedicated audit.

## Самообман / anti-circular-learning
Investment decision не меняет mastery, acceptedChanges или action policy. `runSafeExperiment()` остаётся preview-only. Только external evidence gate может принять developmental change.

## Смысл для автономии
Это не доказательство свободы воли. Но это реальный отдельный механизм resource-sensitive self-directed learning: система может отказаться от обучения при недостатке бюджета/ресурса вместо обязательного запуска.

## Проверенный synthetic result
`BIG_PASS_112_LEARNING_INVESTMENT=PASS`: `invest`, `recover`, `defer` корректно различаются; acceptedChanges остаётся 0 от самих investment decisions.
