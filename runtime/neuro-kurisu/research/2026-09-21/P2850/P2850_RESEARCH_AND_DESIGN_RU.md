# P2850 — исследовательское основание и дизайн

## Что изменено

P2850 не добавляет ещё один декоративный «мозговой» слой. Он усиливает уже существующий `NeuralExperienceBranch` в двух рабочих направлениях:

1. **Replay становится обучающим**, а не только диагностическим: отобранные воспоминания теперь дают подписанный temporal-error credit в реальные `edgeWeights` и action-readout, с ограничением шага и проверочным gating.
2. **Cross-modal binding становится частью live neural path**: доступные сенсорные каналы связываются через устойчивые pair traces/weights; согласованность влияет на fused input и prediction.

## Почему именно это

Experience Replay показал практическую ценность для continual learning и снижения catastrophic forgetting; работа Rolnick et al. рассматривает replay в непрерывном потоке без обязательных task boundaries. [Rolnick et al., 2018, arXiv:1811.11682]

Более поздние работы подчёркивают, что качество replay зависит не только от наличия буфера, но и от стратегии отбора, diversity и контроля interference. В частности, Rethinking Experience Replay показывает эффект улучшений поверх простой rehearsal-схемы. [Buzzega et al., 2020, arXiv:2010.05595]

Для нашего проекта это означает: replay должен менять параметры ограниченно и проверяемо, а не просто увеличивать счётчик replay-событий.

## Ограничения

- Это инженерная нейросетевая модель, а не биологическая копия мозга.
- Cross-modal binding использует доступные runtime sensor streams; он не утверждает наличие биологических cortical areas.
- Replay credit ограничен по величине, чтобы не разрушить стабильность мобильного runtime.
- Следующий этап должен проверять не только внутренние метрики, но и holdout/generalization после длительного interleaving.

## Следующий эксперимент

A→B→C→A→D→A с interleaved replay, controlled forgetting и holdout-сценариями. Отдельно измерять:
- retention;
- backward interference;
- forward transfer;
- replay-induced parameter drift;
- cross-modal agreement under aligned vs contradictory streams;
- функциональный lesion effect до и после recovery.
