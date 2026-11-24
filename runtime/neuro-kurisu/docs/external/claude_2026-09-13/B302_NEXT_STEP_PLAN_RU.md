# B302 → B303 Next Step Plan

## Главный следующий шаг

Не создавать новый neural/personality subsystem.

Следующий крупный этап должен объединить три уже существующие линии:

`long-horizon autonomy` + `mobile bounded compute` + `verification debt reduction`.

## Приоритет A — длинная жизнь

Target: 192-256 operational ticks, но с тем же правилом разделения full pulse / micro-cycle.

Release критерии:
- не менее 48 full cognitive pulses;
- не менее 120 micro-cycles;
- не менее 12 autonomous outcomes;
- не менее 8 verified world transitions;
- B296 synaptic updates продолжаются;
- B285 consolidation >= 6;
- restart сохраняет trajectory.

## Приоритет B — future-behavior transfer

Не просто «bias changed». Нужно:

baseline → learn → freeze training context → новый контекст → action distribution change.

При этом нельзя обучать test context той же последовательностью заранее.

## Приоритет C — mobile evidence

Снизить peak state/persistence pressure без удаления canonical neural branches.

Нужно измерять:
- RSS;
- serialized bytes;
- checkpoint latency;
- full-pulse latency;
- micro-cycle latency;
- thermal/resource pressure.

## Приоритет D — verification debt

Новый код не должен быстрее расти, чем VERIFIED evidence.

Target следующего этапа: не добавлять десятки unverified surface functions без теста; закрывать самые влияющие на causal/personality/self-model контуры.

## Что намеренно не делать

- не создавать ещё один personality ledger;
- не создавать B303 neural brain clone;
- не объявлять consciousness достигнутым;
- не считать benchmark metric научным доказательством.
