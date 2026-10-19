# Release 35.6.14 / B362

B362 усиливает Brick 5: существующий B283 predictive planner теперь имеет контролируемую причинную связь с реальным выбором действия Core. Добавлены ON/OFF/SHAM режимы для научной абляции и парный тест из общего состояния. В двух независимых Core seed включение planner изменило `verify → wait`, тогда как OFF и 5%-SHAM сохранили `verify`. Restart сохранил план и imagined return.

Полная 5-seed Core replication остаётся OPEN из-за runtime budget полного OrganismCore. Критерий не ослаблен.
