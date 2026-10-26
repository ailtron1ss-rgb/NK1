# WorkPass381 — учёт replay-pressure в темпе обучения новой задачи

**Дата:** 2026-10-26  
**Ветка:** workpass375-hexis-canonical-ingress-latest  
**Исходный exact HEAD:** a2ba59d5559811f938f8fa103dda469de8c25885  
**Статус:** алгоритм скорректирован после регрессии WorkPass380; exact-head проверки обязательны.

## Наблюдаемая регрессия

WorkPass380 заменил индексное соответствие старых/новых обучающих строк на coprime-stride permutation. Это было чрезмерно: sequential benchmark стал падать на контекстном сценарии, в котором одинаковые energy states с различной novelty — ценные контрфактические пары. Перестановка ухудшала способность функции выучить разные действия для разных контекстов и не переносится в этот обучающий контракт.

## Новый подход

- Восстановить context-aligned replay row selection; не вводить индексную перестановку как универсальное правило.
- При каждой свежей строке измерить количество replay updates, действительно применённых в текущем batch, относительно количества обработанных current rows.
- Корректировать эффективный темп свежего обновления как `min(0.30, currentLearningRate + replayLearningRate * appliedReplay/currentRowsProcessed)`. Это учитывает дополнительный шаг оптимизатора от replay; заблокированные и пропущенные replay не дают фиктивного boost.
- Сохранить batch preflight, bounded conflict screening, replay-before-current порядок и rollback learner/metrics при исключении.
- Тестировать контракт на заданных rates: current 0.18 + replay 0.06 на одном replay/current slot дают эффективный current rate 0.24; replay остаётся первым, current — последним.

## Критерии закрытия

Патч не считается validated до PASS на одном exact SHA для `test:p26:interleaved-contract`, `test:p26:sequential-benchmark`, `test:p26:replay-policy-sweep`, `test:learning-replay`, P26 Learning Validation и WorkPass71 runtime/rebuild. Ни один benchmark-порог не ослаблен; синтетические tests не являются внешним proof of learning/generalization.

`main` и опубликованный GitHub Release ZIP не меняются.

