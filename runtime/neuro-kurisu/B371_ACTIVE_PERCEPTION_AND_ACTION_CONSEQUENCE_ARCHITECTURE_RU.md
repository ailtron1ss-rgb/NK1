# B371 — ACTIVE PERCEPTION + ACTION CONSEQUENCE VERIFICATION

## Цель
Перевести B365 от пассивного потребления телеметрии к причинному выбору следующего сенсорного запроса и одновременно запретить повышение эффекта действия до physical-device evidence без независимого post-action измерения.

## Каноническая цепь
`B365 uncertainty/novelty/error → active perception plan → selective sensor acquisition → grounded observation → neural policy → action → independent pre/post device measurement → verified consequence → transition learning → replay/consolidation`

## Что реализовано
- B365 хранит persistent active-perception plan и statistics.
- Plan выбирает sensor bundle по uncertainty, prediction error, novelty, freshness, confidence и selected action.
- Android bridge поддерживает bounded selective sampling.
- EmbodimentRuntime принимает force/selective sampling.
- EmbodiedActionExecutor делает независимые pre/post measurements.
- `device-observation` выдаётся только при live Termux source, fresh timestamps и стабильном source между pre/post.
- Host execution остаётся `derived`/unavailable, а не fake Android.
- OrganismRuntime исполняет B371 plan до main cognitive observation и записывает fulfilment.

## Почему это не декорация
Ablation requirement: удаление active-perception planning не должно быть эквивалентно selective planning при изменяющихся uncertainty/confidence regimes.
Action consequence requirement: host-only execution MUST NOT produce `verified=true`.

## Ограничения
Физический Android всё ещё не сертифицирован в текущем execution environment; это отдельный device-gate, а не симуляционный PASS.
