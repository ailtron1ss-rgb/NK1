# 11.0.0 — Continuous Organism Core

Первый giant step новой серии. Вместо добавления очередной P-фазы реорганизован runtime lifecycle:

- единый one-shot scheduler для cognitive / embodiment / reflection clocks;
- adaptive phone-aware cognitive clock;
- отдельный reflection clock для редкой консолидации;
- компактный Continuity Ledger для многодневного наблюдения за дрейфом, предсказаниями и идентичностью;
- новые runtime persistence/clock metrics;
- версия canonical release повышена до 11.0.0, core до 40.0.0.

State schema остаётся 48: формат persisted organism state не менялся, поэтому это runtime-only architectural migration.
