# WorkPass378 — восстановление runtime-контракта P26 interleaved learning

**Дата:** 2026-10-26  
**Ветка:** workpass375-hexis-canonical-ingress-latest  
**Статус:** реализация и CI wiring внесены; exact-head тесты обязательны.

## 1. Реальный дефект

На exact head WorkPass377 `b0cae1706041d1c957efa628165055a6b004af57` проверки App TypeScript, App development build и runtime typecheck прошли. Общий `test:rebuild-recovered` остановился в `tests/p26-sequential-learning-benchmark.mjs:82`: тест использовал `engine.trainInterleaved(...)`, но `P26TrueLearningEngine` в активной ветке не предоставлял этот API. Это был реальный несовместимый контракт между engine и уже подключённой тестовой цепочкой, а не проблема UI/Live2D.

## 2. Изменения

- Восстановлен `trainInterleaved()` в существующем `P26TrueLearningEngine`, без второго learning owner.
- Полная валидация текущей и replay-партии идёт до первой записи весов.
- Ограничен размер партии, число replay updates и стоимость conflict-screen; противоречивые старые метки для почти одинаковых признаков блокируются.
- Replay выполняется до свежего примера в запланированном слоте, чтобы старый градиент не затирал последнюю свежую обучающую корректировку.
- Ошибка посреди партии восстанавливает snapshot learner и метрики, не оставляя частично применённый learning update.
- Счётчики online/replay updates и training exposure остаются отделены от независимого holdout/generalization evidence; дубликаты evidence после restore не могут увеличить счётчик.
- Добавлен `tests/p26-interleaved-contract.mjs`: API, направление градиентов, provenance holdout, duplicate/restore, preflight, запрет getter-ов и rollback.
- Тест включён в `test:learning-replay`; P26 Learning Validation теперь триггерится изменением `P26TrueLearningEngine.ts` и запускает весь learning-replay chain.

## 3. Контроль

Ранее существующий WorkPass71 запуск документировал ошибку `TypeError: engine.trainInterleaved is not a function`. Это точное свидетельство исходного дефекта. Новая реализация перенесена/адаптирована из отдельного WorkPass369 PR, где этот контракт и его regressions были оформлены явно; но тесты из родственной ветки не считаются автоматическим PASS текущей ветки.

Критерии закрытия: runtime typecheck; `test:p26:sequential-benchmark`; `test:p26:replay-policy-sweep`; `test:p26:interleaved-contract`; весь `test:learning-replay`; затем `test:rebuild-recovered` и соответствующий P26/WorkPass71 Actions run на точном head. Порог benchmark не снижается. Результаты синтетических задач не трактуются как внешний прирост способности обобщения.

## 4. Выпуск

`main` и опубликованный GitHub Release ZIP не изменялись. После exact-head проверок необходимо продолжить к следующим блокерам: retrieval holdout (включая текущий `recallDelta=0`), фактический Android/Termux audio, браузерный Live2D E2E, длительный soak и license/provenance review.

