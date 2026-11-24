# P2692 — Contextual Adaptive Memory Policy 2.0

## Что реально изменено

P2691 имел глобальные веса пяти retrieval-политик. P2692 превращает контроллер в bounded contextual learner:

1. Контекст retrieval дискретизируется в bounded buckets: pressure / goal / causal / temporal / mobile.
2. Для каждого контекста сохраняются `contextValue` и `contextTrials` по пяти политикам.
3. Выбор объединяет глобальную ценность, контекстную ценность, exploration и безопасный context prior.
4. Outcome обновляется составной функцией: quality, retention, transfer, interference, delayed value и compute cost.
5. State сохраняется и восстанавливается через существующий MemoryOS2 snapshot.
6. Старый `observeRetrievalOutcome()` сохранён для обратной совместимости; добавлен `observeRetrievalOutcomeV2()`.
7. Query-level causal/temporal признаки теперь участвуют в выборе политики до ранжирования кандидатов.

## Почему это важнее ещё одного retrieval signal

Теперь контроллер может различать: одна и та же retrieval policy не обязана быть оптимальной во всех состояниях организма. Это приближает память к policy learning, а не к статическому weighted search.

## Проверки

- `TYPECHECK=PASS`
- `P2691_ADAPTIVE_MEMORY_POLICY=PASS`
- `P2692_ADAPTIVE_POLICY_HOLDOUT=PASS`
- P2692 holdout: 150 retrieval outcomes, 12 contextual buckets, persisted contextual policy state.

Holdout является локальным synthetic/control experiment. Он подтверждает работоспособность механизма адаптации и persistence, но не является внешним benchmark и не доказывает универсального улучшения retrieval.

## Следующий критический шаг

Связать delayed causal credit с `contextValue`, чтобы policy reward приходил не только от локального retrieval outcome, но и от последствий решения через длинную цепочку organism cycles. После этого — независимый ablation: fixed semantic / fixed hybrid / fixed causal / fixed temporal / adaptive / adaptive+causal-credit.
