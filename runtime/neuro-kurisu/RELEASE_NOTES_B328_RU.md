# Release Notes B328 — Recovery Strategy Reversal & Holdout

## Изменено
- `AdaptivePolicyEngine`: reversal-aware recovery promotions.
- Диагностика показывает статус стратегии, число reversal и contradiction.
- Сохранена единая persistence-модель `AdaptivePolicyState`.
- Добавлен B328 holdout/reversal test.

## Проверки
- B328 reversal + holdout: PASS
- B327 direct: PASS
- B327 OrganismCore: PASS
- B326 causal influence: PASS
- TypeScript runtime typecheck: PASS

## Следующий этап
B329 — causal/counterfactual strategy evaluation.
