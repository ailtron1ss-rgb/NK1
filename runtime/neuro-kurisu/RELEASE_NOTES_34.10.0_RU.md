# Neuro-Kurisu 34.10.0 — BIG PASS 41

Главная тема релиза: **Performance Spine / mobile hot-path optimization**.

## Главное

- добавлен per-tick cache для P10/P26/P27/P30;
- shared forecasts больше не вычисляются повторно внутри action loop;
- добавлен adaptive perception cadence;
- внешние multimodal observations сохраняют немедленный refresh;
- удалён duplicate Runtime Evidence snapshot;
- schema остаётся 87;
- создан BIG PASS 41 performance gate;
- исправлена классификация результатов long-horizon benchmark: один прошлый exposed-GC запуск прошёл, но повторяемость 250-cycle natural run не гарантирована;
- сохранена строгая научная маркировка: benchmark timeout не считается PASS.

## Финальная проверка

`BIG_PASS_41_PERFORMANCE_SPINE=PASS`:
`tick=40`, `firstMedianMs=11.94`, `lastMedianMs=15.69`, `ratio=1.313`, `perceptionTick=11`, `spineSavings=0.600`.

Static/release/integrity gates проходят.

## Не скрыто

250-cycle benchmark остаётся **environment/GC-sensitive**: исторический exposed-GC run дал `warmedMedianRatio=1.694`, `heapGrowth=0.620`, но текущая natural npm campaign может превышать доступное wall-clock окно.

500-cycle warm benchmark ещё не закрыт.

Последний restart campaign в этой итоговой серии также превысил wall-clock окно; предыдущие успешные restart checks сохранены как историческое evidence, но не используются как гарантия стабильности.

Device-level Android validation на текущем host невозможна без Termux:API.
