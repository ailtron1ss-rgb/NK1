# P25 Final Report — Scientific Development & External Evaluation

## Release

Application `7.5.0`; organism core `22.0.0-p25-scientific-development-and-evaluation`; state schema `28`.

## Главный переход

P25 делает научную проверяемость самостоятельной подсистемой runtime. Теперь learning-эффект может быть записан как контролируемый эксперимент, отдельно от внутренней телеметрии организма.

## Новые механизмы

- runtime outcome aggregation;
- controlled experiment ledger;
- external/holdout evaluation ledger;
- ablation study ledger;
- capability evidence levels;
- research campaign lifecycle;
- persisted P25 state + migration 27→28;
- API для получения и записи научных evidence.

## Ограничение

P25 не объявляет causal proof из обычного replay. Controlled experiment требует явно заявленной независимости условий; longitudinal и device-verified уровни всё ещё требуют фактических внешних измерений.
