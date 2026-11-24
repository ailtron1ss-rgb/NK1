# Neuro-Kurisu 35.6.60 — B2521

## Большой апдейт: Learned Generative Organism Loop

B2521 объединяет persistent self/world model, counterfactual planning и sensorimotor imagination в единый обучаемый transition loop.

### Реализация
- action-conditioned transition model `state -> action -> next-state/reward`;
- обучение переходов по реальным исходам;
- усиленное обновление по verified outcomes;
- многом шаговый rollout из накопленной модели;
- counterfactual action comparison;
- model coverage/confidence;
- generative prediction error;
- bounded persistent transition store (512 transitions);
- causal lesion;
- persistence/restart support;
- реальное включение в OrganismCore decision/outcome path.

### Замыкание
`B2515 latent -> B2521 learned model -> counterfactual rollout -> action bias -> real outcome -> transition learning -> next B2521 rollout`.

B2519 теперь предоставляет горизонт, а B2521 использует накопленные переходы вместо полностью независимого heuristic rollout.

## Ограничения
Это не доказательство сознания. Это измеряемая исследовательская архитектура model-based autonomy и обучения переходов. Физические сенсоры/актуаторы Android остаются отдельным этапом.
