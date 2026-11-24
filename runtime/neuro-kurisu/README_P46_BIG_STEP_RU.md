# Neuro-Kurisu Evolution 12 — P46 Self/World Continuity

Этот релиз — большой архитектурный шаг. Цель: перестать трактовать prediction confidence как доказательство accuracy и начать вести долговременную эмпирическую историю прогнозов.

## Новое
- `PredictionLedger` хранит pending/resolved predictions, absolute error и confidence calibration gap.
- `OrganismRuntime` создаёт reward prediction до действия и разрешает его после реального перехода мира.
- `system.continuity` хранит компактную longitudinal-оценку совместной self/world ошибки.
- API snapshot позволяет наблюдать реальную prediction accuracy без подмены confidence.

## Принцип
`prediction -> action -> observation -> error -> update`

а не `confidence -> accuracy`.

Схема состояния сохранена совместимой: новые поля optional и безопасно восстанавливаются из старых state-файлов.
