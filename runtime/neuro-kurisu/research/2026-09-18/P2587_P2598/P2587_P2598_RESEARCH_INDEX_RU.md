# P2587–P2598 — исследовательская база и решения

Дата: 2026-09-18
Версия проекта: 35.6.70
Цель: усилить Neuro Kurisu как непрерывный искусственный организм с автономностью, нейронным субстратом, переносом навыков, причинной моделью мира, восстановлением после ошибок и реальной долговременной преемственностью.

## Что показала внешняя литература

1. World-model должен оцениваться по тому, улучшает ли он замкнутый цикл поведения: планирование, действие, обучение, верификацию, восстановление и выбор данных, а не только правдоподобие прогнозов. Это напрямую поддерживает переход проекта к измерению `prediction → action → consequence → verification → learning → transfer`.
2. В continual model-based RL память сама по себе не гарантирует сохранение поведения: опубликованная работа Nijjer показывает, что world model может сохранять знания, пока actor теряет навык; graded dream rehearsal использовался для восстановления навыков без новых взаимодействий с внешней средой. Наш предыдущий P2575–P2586 уже внедрил bounded dream rehearsal; этот блок расширяет его переносимыми procedural skills.
3. EnvACE показывает направление world rehearsal: внутреннее проигрывание последствий действий можно использовать для обучения поведения и для приватной репетиции перед реальным действием.
4. CAER предлагает перераспределять обучение к тем частям предсказания, которые причинно затронуты действием, вместо равномерной ошибки. В P2587–P2598 добавлен облегчённый CAER-inspired causal-effect weighting в динамический латентный world model.
5. Successor features и temporal abstraction дают математически обоснованный путь разделять динамику от конкретной цели и переносить temporally extended skills. В проект добавлен компактный `successorFeature`-вектор внутри `TransferableEmbodiedSkillSystem`.
6. Современные обзоры world models выделяют узкие места долгих горизонтов, uncertainty calibration, compounding error, planner exploitation и sim-to-real transfer. Поэтому H1/H2/H4/H8/H16 выбираются адаптивно, а H8/H16 включаются только при достаточном compute budget.

## Реально внедрено

- `TransferableEmbodiedSkillSystem.ts`: прототипная procedural-skill memory, successor features, option-like abstraction, negative-transfer tracking, intervention probes и recovery trigger.
- `EmbodiedCausalWorldBridge.ts`: адаптивный multi-horizon ladder H1/H2/H4/H8/H16 + causal-effect focused learning.
- `B2521LearnedGenerativeOrganismLoop.ts`: exact → prototype → global action prior вместо exact-key-only lookup; добавлены отдельные метрики local/prototype/global coverage и recovery counting.
- `NeuralExperienceBranch.ts`: unified integration нового transferable skill layer в action selection, learning, persistence и diagnostics.

## Не внедрено намеренно в этот блок

- полноценный neural ODE / SSM вместо текущего компактного дискретного world model;
- тяжёлый multimodal foundation model на телефоне;
- полноценный Active Inference factor-graph runtime;
- online self-modification кода или неограниченное структурное саморасширение.

Причина: эти варианты сейчас имеют высокий compute/engineering cost и требуют отдельного benchmark блока, чтобы не маскировать прогресс ростом сложности.
