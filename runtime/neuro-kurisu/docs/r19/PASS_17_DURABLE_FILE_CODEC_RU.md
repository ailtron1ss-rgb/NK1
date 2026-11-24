# PASS 17 — Durable File Codec

PASS17 переносит тяжёлую persistence-сериализацию phone/Termux runtime с JSON на V8 binary codec без удаления JSON compatibility.

Ключевые изменения:

1. `FileStateStore` поддерживает `json`/`v8`.
2. V8 store умеет читать существующий JSON и мигрировать его при следующем save.
3. Phone server использует V8; research/debug сохраняет JSON.
4. NeuralExperienceBranch и B269 поддерживают internal `clone:false` persistence path.
5. Canonical neural substrate snapshot переиспользуется между persistence projections.
6. Crash safety, backup, fsync и atomic rename сохранены.

Результат A/B на 64 cycles: JSON ~4.86 MiB / ~212 ms flush, V8 ~3.70 MiB / ~98 ms flush.

256-cycle V8 FileStateStore long-horizon: PASS, restart tick 257, payload ~5.44 MiB.

Мобильный smoke при `--max-old-space-size=256`: PASS.

Большой агрегированный smoke/long-horizon orchestration не учитывается как PASS при timeout; отдельные изменённые слои проверены прямыми тестами.
