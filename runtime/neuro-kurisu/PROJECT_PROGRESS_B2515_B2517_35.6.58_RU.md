# Neuro-Kurisu 35.6.58 — B2515–B2517

## Большой апгрейд

B2515 Unified Organism Latent Fabric теперь объединяет neural/world/body/self/semantic/future/identity/goal/personality representations в 64-мерное shared state с coherence/conflict/reliability/precision и causal lesion. Предыдущий latent из этого слоя циклически возвращается в B2503/B2504/B2505 на следующем решении, образуя реальный межцикловый feedback path.

B2516 Causal Autobiographical Graph хранит verified action-conditioned transitions и использует их как bounded autobiographical causal priors.

B2517 Self-Authored Rule Compiler извлекает устойчивые verified+autonomous patterns в правила, индексированные по стабильному goal/self context, а не по шумному полному latent. Правила проходят consolidation и identity-safety gating.

## Эксперименты

- B2515–B2517 direct: PASS; 241 latent cycles, 239 learning updates, precision 0.714, lesion effect 0.0985, 28 causal edges, 16 consolidations, self-authorship 0.957.
- Runtime: PASS; 8 cycles, B2515 learning 8, B2516 edges 7, B2517 rules 5.
- Controlled hidden-rule holdout: reward 376.25 vs baseline 210.0; +79.17%; correct 375/400 vs 200/400 baseline; correct rate 93.75%.

## Инженерное значение

Это не новый независимый executive, а shared latent/causal/self bridge. Главный результат B2515–B2517 — полученное знание теперь может пройти путь experience → shared latent → verified causal transition → self-authored rule → future action.

## Ограничения

Synthetic holdout доказывает перенос в контролируемой задаче, а не человеческую личность или сознание. Physical embodiment остаётся отдельным следующим уровнем.
