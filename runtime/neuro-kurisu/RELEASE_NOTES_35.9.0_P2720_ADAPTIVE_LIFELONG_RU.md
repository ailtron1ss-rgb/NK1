# Release 35.9.0 — P2720 Adaptive Lifelong Neuroplasticity

Крупный интеграционный проход поверх P2716.

## Основное

- добавлен P2720AdaptiveLifelongController;
- state schema NeuralExperienceBranch: 20 → 21;
- контекстная селективность и local availability;
- selective/sparse synaptic updates;
- adaptive plasticity multiplier;
- action-conditioned residual world model;
- adaptive eight-horizon delay policy;
- интеграция в microTick и full outcome path;
- persistence/restart validation;
- новый P2720 regression/ablation test.

## Важный результат

P2720 тест PASS, experimental/control trajectories расходятся. Это проверка реального изменения поведения, а не только появления новых полей.

Отрицательные результаты предыдущих проходов по forgetting не удалены и не замаскированы.
