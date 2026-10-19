# B300 → B310: следующий крупный этап

1. Mobile State Economy — отделить canonical state от cache/history и уменьшить snapshot cost.
2. Unseen-context transfer — проверить, что контекстная preference работает в новом сценарии, которого не было при обучении.
3. Long-horizon causal consolidation — переносить устойчивые traces в долговременную память, не раздувая state.
4. Independent evaluator regeneration — внешний evaluator должен генерировать новые проверки после обучения.
5. Android physical gate — отдельная evidence-ветка; симуляцию не считать заменой реального устройства.
6. Только после этого — расширять endogenous motivation, а не создавать ещё один personality module.

Запрет этапа: не плодить новый personality store, если существующий B299/MultiHypothesisPersonality можно усилить.
