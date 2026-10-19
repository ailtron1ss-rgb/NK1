# Release 35.6.60 — B2521

Добавлен B2521 Learned Generative Organism Loop.

Главное изменение: imagination/planning теперь может опираться на накопленную persistent transition model, обученную на реальных outcome событиях организма. Это убирает один из главных архитектурных разрывов B2518-B2520: модель мира, counterfactual planning и sensorimotor imagination получают единый causal learning substrate.
