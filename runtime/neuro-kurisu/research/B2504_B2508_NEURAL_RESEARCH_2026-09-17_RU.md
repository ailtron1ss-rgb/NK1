# Research Synthesis — B2504–B2508, 17 Sep 2026

## 1. Actionable world models

Публикация 15 сентября 2026 года по world models для embodied intelligence предлагает оценивать world model не по визуальной правдоподобности, а по тому, улучшают ли predictions planning, action, learning, verification, recovery и data selection. Это напрямую поддерживает design B2503/B2504: прогноз должен менять downstream behavior и проверяться исходом.

Source: https://arxiv.org/abs/2609.16697

## 2. World Action Models

Обзор World Action Models 2026 года описывает объединение predictive state modeling и action generation, с акцентом на joint conditioning будущих состояний и действий. Наш B2504 движется в том же направлении, но на малом state-space и без большого foundation model.

Source: https://arxiv.org/abs/2605.12090

## 3. Compositional hippocampal replay

Nature Neuroscience 2025 work по composition + replay показывает, что reusable building blocks могут комбинироваться для новых состояний, а replay может формировать compositional state spaces и улучшать перенос поведения. Это поддерживает B2505, особенно unseen recombination holdouts.

Source: https://www.nature.com/articles/s41593-025-01908-3

## 4. Human hippocampal ripples and planning

Исследование 2026 года сообщает, что hippocampal ripples/replay координируются с cortical representations и поддерживают inferred compositional solutions. Для проекта это аргумент в пользу разделения fast episodic replay и more stable cortical-like generalized primitives.

Source: https://www.nature.com/articles/s41593-026-02291-3

## 5. Acetylcholine and predictive learning

Perspective 2026 года рассматривает acetylcholine как возможный субстрат predictive learning и связывает cholinergic modulation с novelty, uncertainty, error correction, arousal и hidden-state inference. Для проекта это полезнее как design hypothesis для neuromodulatory control, а не как утверждение биологической эквивалентности B2508/B2506.

Source: https://www.nature.com/articles/s41583-026-01058-w

## 6. Three-factor / eligibility learning

Работа 2026 года по brain-inspired spiking reinforcement learning с eligibility traces и отдельным reward modulation подтверждает практическую ценность разделения быстрых следов активности и более медленного reward-dependent weight update. Это согласуется с уже существующими B2501/B2502 eligibility traces и мотивирует дальнейшее refinement timing kernels.

Source: https://www.nature.com/articles/s41467-026-69898-9

## Experimental synthesis

Наиболее перспективной считается не одна технология, а связка:

`recurrent neural state -> action-conditioned predictive field -> compositional replay -> counterfactual evaluation -> measured neural authority -> verified outcome -> eligibility/plasticity -> consolidation -> future planning`

Но каждое звено должно иметь отдельный ablation/holdout test; добавление слоёв без такой проверки будет считаться архитектурным долгом, а не прогрессом.
