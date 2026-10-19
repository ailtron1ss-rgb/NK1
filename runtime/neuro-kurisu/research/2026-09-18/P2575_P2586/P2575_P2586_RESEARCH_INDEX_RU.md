# Research Index — P2575–P2586

## Цель
Следующий слой Neuro Kurisu переводит уже построенный actionable world model в устойчивое обучение поведения: отложенная «репетиция во сне», конфликт-aware memory, model-time replay и проверка того, что сохранённый world model действительно помогает не только прогнозировать, но и удерживать действие после длинной новой нагрузки.

## Что взято из исследований

### 1. World model должен быть actionable
Yao et al., 2026, *World Models for Embodied Intelligence: From Plausible to Controllable to Actionable*.
Ключевая идея: world model ценен не визуальной правдоподобностью, а способностью улучшать planning/action/learning/verification/recovery. В проекте это реализовано через evidence gating и causal outcome loops.

### 2. Closed-loop оценка важнее open-loop качества
Zhang et al., ICLR 2026, *World-In-World: World Models in a Closed-Loop World*.
Рабочая гипотеза: больше inference-time compute стоит давать только тем кандидатам, которые реально проходят coarse action filter. Это соответствует coarse-to-fine rollout в EmbodiedCausalWorldBridge.

### 3. Actor может забывать даже если world model помнит
Nijjer, 2026, *The World Model Remembers, the Actor Forgets*.
Ключевой механизм, перенесённый как экспериментальная гипотеза: graded dream rehearsal по проверенным world rules должен периодически возвращать credit в action-value/policy слой без нового внешнего взаимодействия.

### 4. Replay должен зависеть от «времени модели», а не только от числа шагов
Feng et al., ACL 2026, *FOREVER*.
В проекте это переведено в model-time / forgetting-debt scheduler. Репетиция активируется от измеряемой величины изменения модели и риска забывания, а не от фиксированного replay-per-N-ticks правила.

### 5. Memory может содержать семантически конфликтующие похожие записи
Ma et al., ACL 2026, *Conflict-Aware Memory for Embodied Agents*.
В проекте добавлен conflict count, contradiction penalty и negative-transfer signal. Контекстно похожее правило с несовместимым successor delta теперь повышает contradiction и ограничивает дальнейшее promotion.

### 6. External memory не решает continual learning автоматически
Hu et al., 2026, *When Continual Learning Moves to Memory*.
Это поддерживает решение хранить utility/confidence/conflict/provenance внутри memory controller, а не считать retrieval сам по себе доказательством полезности.

## Ограничения переноса

Ни один процент из исходных публикаций не переносится напрямую на Neuro Kurisu. Архитектуры, среды и metrics отличаются. Здесь используются только механистические идеи как гипотезы, после чего они проходят собственный benchmark/ablation.
