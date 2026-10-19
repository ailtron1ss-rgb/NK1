# PASS19 — Durable History Projection + Continuity Repair

Дата: 2026-10-01

## Цель

Уменьшить durable residency растущих history/ledger-полей без урезания live runtime-состояния и одновременно проверить реальную restart-непрерывность.

## Изменения

Добавлены отдельные `persistenceSnapshot()` для P49, P56, P59, P62, P63, P66 и P68. Runtime продолжает хранить свои исходные bounded windows; persistence получает более короткие detached history-представления.

Основные durable limits:

- P49: 96 episodes + 96 beliefs, полный 2048-event continuity cursor/hash.
- P56: 48 history entries.
- P59: 48 history entries.
- P62: 8 history frames + последний frame.
- P63: 32 history plans.
- P66: 64 history samples.
- P68: 64 history views.

## Найденная и исправленная continuity-ошибка

`SelfSubsystemRuntime.restoreFromPersisted()` не передавал `p48Awareness` и `p49TemporalLife` в собственный restore-контракт. Из-за этого P49 после процесса-restart возвращался к `GENESIS-P49`, несмотря на наличие корректного persisted state.

PASS19 передаёт оба поля и содержит отдельную regression-проверку: journal hash после restart обязан совпасть с состоянием до restart.

## Измерения

После 256 циклов durable advanced projection уменьшился примерно с 1.283 MiB до 1.223 MiB (около -4.7%). Полный V8-сериализованный persisted snapshot уменьшился примерно с 5.605 MiB до 5.543 MiB.

256-cycle R19 long-horizon:

- pass=true
- restartedTick=257
- отдельный peak RSS прогон: ~465 MB
- контроль PASS17: ~477 MB

Timing вариативен между запусками и не используется как единственный критерий оптимизации.

## Verification

PASS:

- typecheck
- PASS17 V8 long horizon
- PASS18 persistence projection
- PASS19 persistence-history + restart continuity
- P34 personhood
- R26 neurocore matched ablation
- R26 hierarchical-vs-flat planning
- R26 neural substrate
- R26 observation planning
- R19 P2887–P2895 direct gates
- R26 release core

Известные baseline-проблемы, не внесённые PASS19: `p64:p65` integration test ожидает runtime participation P64 и падает тем же образом на предыдущем baseline.
