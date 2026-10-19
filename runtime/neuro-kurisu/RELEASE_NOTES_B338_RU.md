# Release Notes B338 — Endogenous Goal Plasticity

B338 — функциональный pass над organism motivation/goal-learning loop.

### Изменения

1. Исправлена integration hole в `OrganismCore.feedback()`:
   B272/B273 раньше учились только в ветви без `worldTransition`. Теперь обычный runtime world-transition feedback обучает endogenous goal generator и autonomous goal lifecycle.

2. B272 получил persistent `goalOutcomeMemory`:
   goal vector + reward mean + prediction error mean + update count + last tick.

3. Генерация будущих endogenous goals теперь учитывает bounded learned value похожих прошлых goal prototypes.

4. Добавлены B338 unit и real-runtime tests.

### Evidence

- B338 unit PASS
- B338 Core real-runtime PASS, 6 ticks
- typecheck PASS
- core ownership PASS
- architecture PASS
- integrity PASS
- syntax PASS
- release contract PASS
- P23 true learning PASS

### Open

Long-horizon autonomy остаётся OPEN из-за execution timeout. Это не трактуется как PASS.
