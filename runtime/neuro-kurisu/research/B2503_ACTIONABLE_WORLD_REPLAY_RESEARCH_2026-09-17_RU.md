# Research synthesis — B2503

## Почему направление выбрано именно такое

Современная литература 2025–2026 годов всё чаще смещает критерий полезности world models от «красиво предсказывать мир» к способности улучшать planning, action, verification, recovery и learning. Для Neuro-Kurisu это означает: prediction должен иметь causal path к выбору действия и затем получать обратную проверку реальным outcome.

В 2025 Nature Neuroscience работа по hippocampal composition/replay показывает роль compositional state spaces и replay в построении будущего поведения и генерализации. Это поддерживает связку replay + predictive rollouts + compositional memory, но не оправдывает буквальное копирование мозга.

Работа 2025 Nature Communications по hybrid neural networks, вдохновлённым corticohippocampal circuits, показывает полезность разделения быстрых specific representations и более generalized representations для continual learning и борьбы с catastrophic forgetting.

## Что внедрено

1. B2502: sparse recurrent E/I dynamics + eligibility/plasticity + replay + action-conditioned prototypes.
2. B2503: action-conditioned transition field + multi-step rollouts + uncertainty + calibration + counterfactual spread.
3. Runtime wiring: prediction -> bounded utility/gate -> action -> outcome -> learning.
4. Lesion experiments: отдельный evaluation path для причинности.

## Что показал дополнительный эксперимент

После исправления bounded prototype consolidation B2502 на synthetic holdout вырос с +0.01520 до +0.05776 mean-reward относительно base; accuracy выросла с +0.020 до +0.076. Это показывает, что адресация и повторное использование памяти критичнее простого увеличения её объёма. В combo B2502 достиг 487 prototype hits/500 cycles, но итоговый reward остался равен B2503 alone.

## Что следует сделать дальше

### B2504
Сделать единое state-space поле `world/body/self` и обучать prediction error одновременно по внешнему состоянию и interoceptive/body variables.

### B2505
Ввести compositional replay: раздельное хранение state fragments, action fragments и outcome fragments с holdout tasks, где комбинации ранее не встречались.

### B2506
Постепенно повышать neural bottleneck. На каждом уровне измерять: reward, autonomy, personality stability, goal preservation, prediction calibration и lesion effect. Если усиление neural control ломает другие системы — откатывать уровень и сохранять максимум causal contribution без разрушения функций.

### B2507
Сделать awake/rest/deep-consolidation scheduler: online plasticity против offline replay/consolidation.

### B2508
Адаптировать compute budget к uncertainty, energy и thermal constraints.

### B2509
Подключить Android sensorimotor loop, когда аппаратный baseline будет доступен.

## Экспериментальная гипотеза

Наиболее перспективный прирост ожидается не от «ещё одного большего нейронного слоя», а от объединения: compositional replay + action-conditioned prediction + uncertainty-aware gating + controlled neural bottleneck + verified outcome learning.

В этом релизе synthetic holdout показал +0.15656 mean-reward и +0.206 accuracy для B2503 относительно base на конкретной задаче. Это не переносится автоматически на общий интеллект и требует независимых holdout/ablation экспериментов.
