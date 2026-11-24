# NEXT BIG PASS 13 — Core Perception/Reality Refactor

Цель: продолжить slimming `OrganismCore` уже после безопасного вынесения planning stage.

1. Вынести P35/P37/P40/P41/P42/P43/P44 orchestration в отдельный perception/reality stage.
2. Сохранить порядок semantic evidence → grounded world → experience → predictive rollout.
3. Убрать оставшиеся повторные object builders и `as any` на perception boundary там, где типы уже известны.
4. Добавить direct parity test: один input → одинаковые P41/P42/P44 snapshots до/после extraction.
5. После extraction заново проверить function reality graph, ownership, architecture cycles и runtime smoke.
6. Отдельным подшагом измерить memory residency без full `core.snapshot()` в hot loop.
7. Не продвигать новый substrate в canonical execution path без matched holdout improvement.

## New priority from PASS 12 validation

Before expanding perception extraction, isolate the R19 long-horizon allocation growth. At ~224 cycles the durable serialized state is ~6 MB, while process RSS approaches ~500 MB; inspect retained caches/owner-side histories and checkpoint/compaction cadence. Do not lower the 256-cycle gate.
