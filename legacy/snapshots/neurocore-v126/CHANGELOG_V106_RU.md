# V106 — Causal Trunk

- V106 / package 1.06.0 / checkpoint schema 19.
- Исправлен batch cross-sample leakage fast plasticity.
- `cascade` переделан в настоящий последовательный eligibility cascade.
- Event-bank ограничен по ёмкости и не содержит trainable parameters.
- QED/independent-address erase остаются candidate-only.
- Добавлен uncertainty-aware write controller без trainable parameters, disabled by default.
- Исправлена диагностика всех temporal-credit modes.
- Добавлены regression tests и legacy checkpoint load coverage.

- Добавлен `scripts/audit_current.py`; representative probe зафиксировал 19,35% trainable gradient coverage и 1924 unused named modules. Это evidence, а не успех: next frontier — реальное сокращение legacy execution graph.
