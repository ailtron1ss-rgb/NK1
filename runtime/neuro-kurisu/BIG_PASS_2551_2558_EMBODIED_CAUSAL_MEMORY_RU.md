# BIG PASS 2551–2558 — Embodied Causal Memory / Selective Foresight

## Цель
Продолжить развитие искусственного организма не через разрозненные модули, а через один связный контур:

**наблюдение → память → действие → реальный outcome → delayed memory credit → semantic world rule → causal comparison → transfer → selective foresight → bounded action residual.**

## Реально добавлено
- `AdaptiveCausalMemoryPlanner.ts`
- delayed outcome-credit для retrieved memories;
- action-conditioned semantic transition rules;
- matched-context causal comparisons;
- similarity-based transfer вместо strict hash-only matching;
- selective foresight gate;
- bounded epistemic action residual;
- action uncertainty/exploration bonus;
- persistent planner state;
- NeuralExperienceBranch integration;
- restart verification.

## Почему это важно
P2545–P2550 умел управлять памятью и строить H1/H2/H4 forecasts. P2551–P2558 добавляет следующий слой: система может проверять, насколько память и прогноз действительно помогли результату, формировать переносимые правила и использовать только достаточно надёжное предсказание.

## Честность
Здесь нет утверждения о сознании или общем интеллекте. Это executable mechanisms и controlled benchmarks.
