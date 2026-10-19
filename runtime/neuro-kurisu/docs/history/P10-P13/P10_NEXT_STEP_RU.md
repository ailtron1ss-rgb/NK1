# Следующий шаг — P11 Agency & Causal World Interaction

P10 сделал World Model обучающимся на фактических переходах. Следующий крупный шаг должен перевести это обучение в долгосрочную агентность:

1. Causal model identification: отделить корреляцию от устойчивых intervention effects.
2. Learned residual + latent representation: обучать компактное состояние, а не только ручные признаки.
3. Counterfactual policy evaluation: оценивать `chosen vs alternative` на learned trajectories.
4. Regret-driven policy update.
5. Long-horizon commitments через learned world transitions.
6. Social/world model coupling.
7. Blind longitudinal evaluation и recovery-after-lesion.

Приоритет остаётся phone-first: не заменять world model большой on-device LLM.
