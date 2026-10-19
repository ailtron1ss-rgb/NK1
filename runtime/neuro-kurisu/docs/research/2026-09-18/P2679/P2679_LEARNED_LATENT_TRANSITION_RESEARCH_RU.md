# P2679 — исследовательская база: learned latent transitions

Дата: 2026-09-18

## Цель

Перевести world-model stack от retrieval-only опыта к компактной action-conditioned модели переходов: состояние -> действие -> изменение состояния -> результат. Модель должна быть пригодна для planning, verification, shift detection и последующего обучения.

## Исследования

1. **World Models for Embodied Intelligence: From Plausible to Controllable to Actionable** (2026-09-15).
   Основная идея: world model ценен не визуальной правдоподобностью, а тем, улучшают ли его прогнозы planning, action, learning, verification, recovery и data selection. Для P2679 это означает хранение action-conditioned transition и измерение prediction error.
   Источник: https://arxiv.org/abs/2609.16697

2. **Test-Time Mixture of World Models for Embodied Agents in Dynamic Environments** (2026).
   TMoW использует адаптивную маршрутизацию и prototype-based matching для перестройки смеси world models во время inference. P2679 сохраняет совместимость с P2677 router, но добавляет собственную transition evidence.
   Источник: https://arxiv.org/abs/2601.22647

3. **Multi-scale Mixture of World Models for Embodied Agents in Evolving Environments** (2026-07-01).
   MuSix добавляет scale-aware routing и разные скорости забывания для разных уровней представления. Это следующий кандидат для P2680+: fast local transition memory + slow abstract transition memory.
   Источник: https://arxiv.org/abs/2607.00457

4. **Active inference and artificial reasoning** (Nature Communications, 2026-09-08).
   Работа связывает выбор действий с ожидаемым information gain и value и предлагает выбирать действия, которые различают конкурирующие модели мира. P2679 использует shift/uncertainty как триггер self-authored experiment, а P2675 уже предоставляет information-gain layer.
   Источник: https://www.nature.com/articles/s41467-026-77209-5

5. **Interpretable abstractions of artificial neural networks predict behavior and neural activity during human information gathering** (Nature Neuroscience, 2026).
   В работе decision-relevant information связывается с относительным evidence между альтернативами, а не только с абсолютной uncertainty. Это мотивирует будущий policy-relative evidence balance для P2675/P2679.
   Источник: https://www.nature.com/articles/s41593-026-02342-9

6. **Modular Memory is the Key to Continual Learning Agents** (2026).
   Позиционная работа аргументирует сочетание быстрого memory/context learning со стабильными обновлениями параметров. P2678/P2679 следуют этому разделению: experience memory не подменяет основной neural substrate.
   Источник: https://arxiv.org/abs/2603.01761

## Реализованная гипотеза

P2679 вводит action-conditioned transition prototypes. Для каждого опыта сохраняется `pre`, `delta`, `action`, `reward`, `prediction error`, `count`, `success`.

Перед действием система:
- ищет похожие состояния;
- оценивает action-conditioned transition;
- формирует bias;
- оценивает distribution shift;
- при высокой неопределённости/shift добавляет ограниченный exploration/verification pressure.

После outcome:
- обновляет ближайший transition prototype или создаёт новый;
- считает prediction error;
- обновляет confidence и learning gain.

## Ограничения

Это **не полноценная глубокая вероятностная world model** и не доказательство физического понимания. Это lightweight transition-learning substrate, специально ограниченный для medium Android/Termux. Следующий этап должен добавить multi-scale transitions, uncertainty calibration, causal interventions и строгие ablations.
