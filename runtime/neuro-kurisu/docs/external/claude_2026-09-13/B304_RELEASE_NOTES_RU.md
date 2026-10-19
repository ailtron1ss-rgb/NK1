# B304 Release Notes
Дата: 13.09.2026

## Новое
- `src/organism/system/B304SemanticHoldoutLedger.ts`
- semantic-family holdout evaluator
- resource-aware inputs in `TemporalResolutionGovernor`
- B304 feedback metadata for evaluator-only family labels
- migration preservation for `semanticHoldoutB304`
- B304 semantic, migration and resource-governor tests

## Архитектурное решение
B304 не создаёт второй learner и не изменяет personality directly. Он измеряет existing policy/neural/personality chain.

## Release evidence
Typecheck, B298, B300, B301 isolated, B302, B303, B304, function liveness, parameterized probes, architecture, integrity, forensics, hygiene, contract, syntax, UI and server smoke — PASS по отдельности.

Aggregate heavy test chain всё ещё может выйти за cumulative resource/time budget контейнера. Это фиксируется отдельно и не превращается автоматически в PASS.
