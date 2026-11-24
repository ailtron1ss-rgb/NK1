# Neuro-Kurisu 35.6.1 — B268 BIG UPDATE

## Causal Self-Experiment Lab

B268 добавляет реальный экспериментальный контур над обучаемой policy:

`hypothesis -> shadow baseline -> bounded mutation -> hidden-family evaluation -> paired comparison -> commit/hold/revert -> persistence`

### Новое
- controlled mutation B264 policy;
- paired hidden-family evaluation;
- win-rate criterion;
- robustness-drop criterion;
- delayed-reward comparison;
- independent baseline shadow;
- automatic revert;
- Core API;
- StateMigrations;
- persistence evidence;
- standalone/Core regression.

### Главный результат
Одно изменение принято:
- reflect bias;
- paired gain ≈ 0.0201;
- win rate = 0.625;
- robustness drop ≈ 0.0242.

Другое изменение, несмотря на рост reward, отклонено:
- verify bias;
- paired gain ≈ 0.0232;
- win rate = 0.500;
- robustness drop ≈ 0.0613;
- decision = revert.

Это впервые в текущей brain-ветви демонстрирует полноценную policy-level self-improvement дисциплину с независимым критерием и rollback.

## Ограничение
B268 не доказывает AGI, сознание или open-world autonomy. Он доказывает инженерно проверяемый механизм контролируемого самоэксперимента в независимой цифровой среде.
