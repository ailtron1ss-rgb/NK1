# BIG PASS 209 — Cerebellar Predictive Control + Sparse Compute

## Цель
Закрыть две связанные задачи: добавить быстрый predictive-control контур, вдохновлённый мозжечком, и сделать cognition адаптивной по resource/surprise budget для среднего телефона. Это вычислительные аналоги, а не заявления об анатомической эквивалентности.

## Реализовано
- `CerebellarPredictiveController`: action-specific forward calibration, prediction-error tracking, bias/timing state, learning from outcome, lesion mode, persistence.
- `AdaptiveComputeGovernor`: budget/sparsity/workspace scaling, candidate bound, surprise-priority, thermal/energy protection, estimated work saved.
- `CognitiveKernelCoordinator`: оба слоя встроены перед P61/P64; sparse candidate set используется на P61/P64 boundary, а полный candidate surface сохраняется для downstream governance.
- `OrganismCore` и migrations: состояние сохраняется/восстанавливается через обычный persistent checkpoint path.

## Результат теста
- initial forward error: 0.5000
- learned forward error: 0.2119
- high-demand compute budget: 0.8411
- scarce-resource compute budget: 0.3948
- high-demand max candidates: 11
- scarce-resource max candidates: 5
- estimated work saved under scarcity: 0.3615
- Core restore: PASS

## Почему это полезно
Мозжечок широко рассматривается как быстрый предиктивный контур для sensorimotor control и error-driven calibration. Современный обзор 2025 года описывает его feed-forward circuit и reweighting via Purkinje/granule/climbing-fibre architecture.¹

Параллельно современные работы по efficient AI показывают ценность selective/sparse updates: обработка по surprise/prediction error снижает лишние вычисления и latency.² Это особенно применимо к Termux/Android, где нельзя постоянно держать максимальный cognitive workload.

## Научная граница
Этот проход не утверждает, что реализован человеческий мозжечок. Реализован функциональный computational abstraction, пригодный для causal/lesion/persistence экспериментов.

## Следующий критерий
Следующая ступень — связать cerebellar forward error не только с action-score correction, но с реальным `sensorimotor outcome`, timing и later corrective action, а затем измерять latency/energy savings на длительном mobile benchmark.

## Источники
1. Nguyen KP, Person AL. *Cerebellar circuit computations for predictive motor control*. Nature Reviews Neuroscience, 2025. https://www.nature.com/articles/s41583-025-00936-z
2. *Exploiting neuro-inspired dynamic sparsity for energy-efficient intelligent perception*. Nature Communications, 2025. https://www.nature.com/articles/s41467-025-65387-7
3. *Boosting AI with neuromorphic computing*. Nature Computational Science, 2025. https://www.nature.com/articles/s43588-025-00770-4
4. *Neuromorphic computing at scale*. Nature, 2025. https://www.nature.com/articles/s41586-024-08253-8
5. *Figures of merit for neuromorphic devices through biological emulation efficacy*. Nature Reviews Electrical Engineering, 2026.

## Runtime verification boundary

`test:mobile:profile` проходит. Benchmark `long-horizon-250` ранее проходил отдельным запуском (warmedMedianRatio≈2.212, firstMedian≈67.96 ms, lastMedian≈150.36 ms, p95Approx≈272 ms, heapGrowth≈0.969), но при финальном объединённом regression-пакете в текущем host environment два запуска достигли timeout без failure-диагностики. Поэтому этот long-horizon результат не включён в обязательный release gate и не трактуется как доказательство стабильной 250-cycle производительности.
