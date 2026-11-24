# B312 Next Step Plan

## B313 priority

Не добавлять новый learner.

Главная цель: controlled longitudinal behavioral divergence.

Схема:
1. одинаковое исходное состояние;
2. две ветви получают разные verified outcomes;
3. branch A накапливает positive policy evidence для action A;
4. branch B накапливает negative evidence для action A;
5. 32–64 одинаковых holdout cycles;
6. измерять фактическое action distribution, neural state delta, personality delta, causal evidence и persistence;
7. policy lesion должен сжимать observed divergence.

## Stop condition

B313 считается выполненным, если:
- trained-positive и trained-negative branches имеют воспроизводимый action-distribution gap;
- lesion уменьшает gap;
- neural plasticity и personality change идут в том же направлении;
- restore сохраняет разницу;
- safety constraints не нарушаются.
