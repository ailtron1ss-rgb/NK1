# Neuro-Kurisu 34.83.0 — BIG PASS 109

## Фокус
Evidence-gated autonomous development loop: sandbox isolation, external outcome evidence, delayed/context-diverse holdout, uncertainty gate, idempotent promotion.

## Критическое исправление
P36 `runSafeExperiment()` больше не считается реальным обучением. Sandbox теперь только preview: он не может увеличить mastery, acceptedChanges или action bias.

## Реальное изменение политики
`recordExternalEvidence()` принимает только наблюдения с внешним evaluator/manual observer и разрешает promotion только при независимости, holdout, разнообразии контекстов и задержек и положительной нижней границе 95% bootstrap CI.

## Состояние доказательности
Synthetic fixtures подтверждают программную механику. Они не являются доказательством того, что Neuro-Kurisu научилась, стала сознательной или обладает свободой воли.

## Release
Application 34.83.0, state schema 118.
