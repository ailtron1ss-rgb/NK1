# Neuro-Kurisu Evolution 11.0.0 — первый большой архитектурный шаг

Этот релиз не добавляет очередной набор P-фаз. Он перестраивает жизненный цикл runtime вокруг трёх независимых часов:

- **cognitive** — адаптивный цикл мышления с учётом телефонной нагрузки;
- **embodiment** — редкий сенсорный цикл;
- **reflection** — редкая консолидация памяти/обучения.

Также добавлен компактный **Continuity Ledger**. Он не заменяет state persistence: журналирует только дешёвые longitudinal-факты (tick, action, energy, uncertainty, prediction errors, identity continuity, checkpoint signature и размеры), чтобы многодневная деградация и дрейф стали измеримыми.

Главный принцип: тяжёлые операции больше не должны быть скрытым heartbeat организма. Они получают собственные часы и могут быть отложены.

## Что изменилось

1. `RuntimeClockScheduler.ts` — one-shot multi-clock scheduler вместо двух независимых timer loops.
2. `ContinuityLedger.ts` — append-only diagnostic history с ограничением размера.
3. `OrganismRuntime.ts` — cognitive/embodiment/reflection clocks, единый адаптивный governor и runtime metrics.
4. Reflection consolidation теперь имеет отдельную временную шкалу и не привязана к sensor/cognitive heartbeat.
5. Версия поднята до 11.0.0.

## Следующий giant step

Следующий большой шаг должен заменить полные checkpoint writes на `snapshot + event journal + compaction`, а затем объединить P42–P44 в единый Self/World predictive contract.
