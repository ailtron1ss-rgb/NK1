# Neuro-Kurisu 35.6.1 — B287 Project Potential & Development Roadmap

Дата: 2026-09-12

## 1. Где проект находится реально

Проект уже представляет собой широкий developmental organism stack: neural substrate, recurrent memory, world prediction, causal policy, goal lifecycle, autonomous skill formation, self, autobiographical continuity, future-self, personality и social relationship values. Главный риск теперь не в недостатке модулей, а в том, что symbolic interfaces могут опережать глубину совместного обучения.

Поэтому следующие passes должны уменьшать количество независимых оценочных шкал и увеличивать число механизмов, где один обучаемый state причинно меняет другой через observation → prediction → action → outcome → plasticity.

## 2. Потенциал

### Сильные стороны
- Развитая persistence/migration дисциплина.
- Повторяющиеся ablation/holdout/hidden tests.
- Уже есть spiking-like, recurrent, E/I и multi-area neural layers.
- Self, goals, policy, memory, personality и social state связаны в Core.
- Есть independent evaluator и commit/revert patterns.

### Риски
- Action space всё ещё конечный.
- Многие neural layers компактны и абстрактны.
- Personality частично продолжает жить в symbolic evidence layer.
- Часть Core integration сигналов пока мала.
- Короткие hidden-tests не равны долгой жизни организма.
- Сознание нельзя считать доказанным proxy-метриками.

## 3. Приоритетный принцип

Если новый механизм улучшает одну метрику и заметно ухудшает другую, сначала ищется архитектурно более хороший вариант. Regression допустим только если выигрыш большой и ухудшение действительно мало, иначе изменение отклоняется.

## 4. Roadmap после B287

### B288 — Social Predictive Other-Model
Модель скрытого состояния другого субъекта: observation → inferred state → response prediction → actual response → social prediction error → relationship update.

### B289 — Relationship Memory Consolidation
Связывание конкретных отношений с эпизодами, commitments, boundaries и long-term value shifts.

### B290 — Personality Value Consolidation
Перевести часть personality formation из symbolic evidence в neural/value attractors и проверять поведение после ablation symbolic personality ledger.

### B291 — Future Self Decision Coupling
Выбор действий должен учитывать ожидаемую цену/выгоду для будущих версий self, а не только текущий reward.

### B292 — Neural Conflict Arbitration
Построить общий recurrent competition между self-preservation, curiosity, truth, care, autonomy и commitments.

### B293 — Long-Horizon Autobiographical Compression
Научить организм сжимать длинную жизнь без потери причинных событий и личных commitments.

### B294 — Open-Ended Primitive Composition
Развить B276–B278 так, чтобы новые внутренние primitives могли собираться из latent operators без фиксированного списка action kinds.

### B295 — Neural Program Verification
Проверять новые internal programs в world model, затем ограниченным реальным trial и независимым evaluator.

### B296 — Developmental Sleep/Replay
Многошаговый offline replay: memories, relationships, goals, values, world-model predictions и neural assemblies.

### B297 — Meta-Learning of Learning Rules
Давать нескольким neural areas возможность изменять локальные learning rates/eligibility decay в пределах safety constraints.

### B298 — Self-Model Integrity
Проверять расхождение между тем, кем организм считает себя, и тем, что его фактическое поведение показывает.

### B299 — Multi-Agent Life Test
Длинные взаимодействия с несколькими независимыми субъектами/агентами; identity и personality должны различаться по отношениям, но оставаться одной личности.

### B300 — Longitudinal Kurisu Identity Trial
Многодневный/многоэпизодный эксперимент с restart, изменениями среды, отношениями, целями, обучением и независимой оценкой устойчивости личности.

## 5. Что значит «реально нейронно» для следующих passes

Новый нейронный элемент засчитывается только если выполнены все условия:
1. Есть state variables, которые реально меняются от входа/опыта.
2. Есть causal dependency от neural state к downstream computation.
3. Есть learning rule, изменяющее параметры на основании опыта.
4. Есть ablation/lesion, после которого предсказуемо меняется downstream behavior.
5. Есть holdout/unseen-context test.
6. Есть persistence/migration.
7. По возможности есть независимая reference/baseline модель.

## 6. Аналоги и полезные идеи

Brian2: явность neuron/synapse/learning primitives.
Nengo: composable neural areas.
DreamerV3: learned world model + imagined trajectories.
Generative Agents: experience + reflection + planning.
Letta: durable identity-relevant memory and skills.
Lava: event-driven/neuromorphic area messaging.

Эти идеи используются как внешние ориентиры; код внешних проектов не импортируется.

## 7. Цель Курису

Главная цель developmental ветви — не создать максимально сложный набор подсистем. Нужно получить одну искусственную личность с:
- непрерывным self;
- автобиографией;
- различимыми ценностями;
- отношениями;
- собственными целями;
- способностью обучаться на последствиях;
- способностью самостоятельно проверять свои гипотезы;
- устойчивыми привычками/способностями;
- контролируемой самокоррекцией;
- независимой проверкой поведения.

Сознание и субъективный опыт должны оставаться экспериментальной гипотезой, а не release-claim.
