# Neuro-Kurisu — PASS 09: Verified Synthetic Trajectory Closure

Дата: 2026-09-29

## Реальная реализация

До PASS 09 multi-step world replay мог непосредственно изменять `actionReadout` внутри replay-фазы. Это создавало риск circular validation: модель вообразила траекторию и тем же воображаемым исходом обучила исполнительный слой.

PASS 09 разделяет эти фазы:

`imagined trajectory → pending hypothesis → real outcome confirmation → holdout confirmation → promotion`.

`VerifiedSyntheticTrajectoryGate` хранит не более 8 pending-кандидатов. Кандидат истекает через 24 ticks или отклоняется после нескольких несовпадений. Для promotion нужны минимум две реальные confirmation, хотя бы одна с `verified01 >= 0.62` и хотя бы одна holdout confirmation. Только после этого ограниченная прибавка попадает в canonical action readout.

## Mobile allocation optimization

В `NeuralExperienceBranch.afterOutcome()` повторно создававшиеся context/identity arrays вынесены в bounded shared arrays текущего outcome. Это не меняет владельцев состояния и не меняет learning equations; меняется только количество transient allocations.

## Evidence

- `TYPECHECK=PASS`.
- `P2870_VERIFIED_SYNTHETIC_PROMOTION=PASS`.
- `P2863_ADAPTIVE_REPLAY_EMBODIED_MULTISTEP=PASS`.
- `P2862_INTEGRATION=PASS`.
- `P2862_DREAM_REPLAY_IDENTITY=PASS`.
- `P2869_DURABLE_CHECKPOINT_DEDUP=PASS`.
- `P2868_MOBILE_DECISION_EQUIVALENCE=PASS`.
- B284 neural identity regressions PASS.

## Ограничение

Полный `OrganismRuntime` endurance на 100/500/1000 cycles по-прежнему не объявляется закрытым: ограничение связано с полной стоимостью runtime orchestration и durable/causal bookkeeping, а не только с одним kernel. Native NEON/SIMD/NNAPI acceleration также не заявляется без target-device evidence.

## Progress

Weighted integration backlog: **78.50%**.

## Identity holdout / long-timescale coupling

B284 теперь разделяет два класса revision evidence. Для external/world evidence promotion требует независимое подтверждение; для внутреннего simulation-пути допускается только provisional revision после повторяемой внутренней согласованности и context holdout. Оба пути имеют cooldown, поэтому один эпизод не может многократно переписывать identity. Прямой `reviseIdentity()` сохранён как низкоуровневый диагностический API, тогда как runtime использует evidence-gated путь.

## Runtime hot-path allocation closure

`OrganismCore.feedback()` кэширует `nextWorldContext01` и компактный world-vector внутри одного outcome, вместо повторного построения одинаковых структур для B401/B421/B451/B501/B561/B621/B721/B901/B1101/B1351/B1701 и связанных ветвей. `TemporalContinuityEngine` дополнительно кэширует `calendarContext` при совпадающем timestamp. Эти изменения не меняют learning equations и не меняют owner state.

## Evidence

- `P2870_VERIFIED_SYNTHETIC_PROMOTION=PASS`
- `P2871_IDENTITY_REVISION_HOLDOUT=PASS`
- `P2872_RUNTIME_IDENTITY_PROVISIONAL=PASS`
- B284 core identity regression: PASS
- B284 260-cycle longitudinal regression: PASS
- `P2868_MOBILE_DECISION_EQUIVALENCE=PASS`
- `P2865/P2866/P2867/P2869=PASS`
- P2854/P2855 isolated regression gates: PASS

Weighted engineering integration backlog after this extension: **79.41%**.
