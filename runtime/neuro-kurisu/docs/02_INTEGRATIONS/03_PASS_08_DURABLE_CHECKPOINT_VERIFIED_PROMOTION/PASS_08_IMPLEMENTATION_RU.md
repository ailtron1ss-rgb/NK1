# Neuro-Kurisu — PASS 08: Durable Checkpoint Dedup

Дата: 2026-09-29

## Реальная реализация

PASS 08 завершает текущий незакрытый участок вокруг durable persistence. `FileStateStore` теперь вычисляет content hash сериализованного состояния и пропускает повторную запись полностью идентичного payload внутри одного runtime-процесса. Если файл был удалён или стал недоступен извне, запись не блокируется: store снова создаёт его.

Добавлен счётчик `skippedUnchangedSaves` в `StateStoreMetrics` и executable gate `P2869`.

## Что не заявляется

Это не означает полную оптимизацию checkpoint path: разные состояния по-прежнему требуют полноценной атомарной записи, fsync и backup policy. Также не заявляется физический Android benchmark.

## Evidence

- `P2869_DURABLE_CHECKPOINT_DEDUP=PASS` — unchanged save suppressed, changed save persisted, restart load verified.
- `TYPECHECK=PASS`.
- `P2862_PERSISTENCE=PASS`.
- `P2862_DREAM_REPLAY_IDENTITY=PASS`.
- `P2868_MOBILE_DECISION_EQUIVALENCE=PASS`.
- `CLEAN_RESTART_PERSISTENCE=PASS`.
- `P2854` and `P2855` regression gates PASS.
- Full structural/release audits are required before the archive is considered final.

## Integration progress

The weighted integration score remains **77.94%**. The PASS 08 change is recorded as a concrete persistence optimisation without artificially increasing backlog percentages for capabilities that are still unproven, especially full-runtime 100/500/1000-cycle Android endurance and native acceleration.
