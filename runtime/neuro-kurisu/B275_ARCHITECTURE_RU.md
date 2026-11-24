# B275 — Нейронная композиционная политика

## Назначение
B275 переводит навык из B274 из последовательности действий в обучаемую композиционную policy. Policy получает контекст мира, self-latent, neural assembly, goal vector, автономность и personality bias; вычисляет распределение вероятностей действий, обучает веса по реальному outcome и сохраняет eligibility traces.

## Основная цепь
B269 spiking substrate → B270 neural self/traits → B271 autobiographical assemblies → B272 endogenous goal → B273 goal lifecycle → B274 verified skills → B275 compositional neural policy.

## Что делает B275
- обучаемые action weights;
- recurrent action-to-action transitions;
- eligibility traces;
- reward/prediction-error third-factor update;
- neural grounding и self-alignment diagnostics;
- композиция до трёх ранее подтверждённых skills;
- независимая promotion gate для composed policy;
- transfer в новый goal-context;
- bias в реальный action arbitration OrganismCore.

## Что не заявляется
B275 пока не является произвольным генератором новых нейронных алгоритмов и не расширяет ActionKind vocabulary. Он учится выбирать и комбинировать действия внутри существующего motor/action space. Поэтому это шаг к compositional autonomy, а не доказательство open-ended intelligence.
