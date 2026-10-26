# WorkPass379 — полная диагностика replay-policy sweep

**Дата:** 2026-10-26  
**Ветка:** workpass375-hexis-canonical-ingress-latest  
**Статус:** диагностический контракт закоммичен; exact-head P26 rerun обязателен.

## Что обнаружено

WorkPass378 восстановил `P26TrueLearningEngine.trainInterleaved()`. В полном sequential benchmark он прошёл, включая сохранение новой задачи (`interleaved.taskBFinal=0.99375`) и contextual stream (`taskAFinal=1`, `taskBFinal=0.91875`); holdout/migration/replay sampler также прошли. Но следующий `p26-replay-policy-sweep.mjs` остановился на утверждении `each policy must retain useful new-task performance` при `newAfter > 0.60`, прежде чем вывести все seed/strategy результаты.

Это важно: метод и тест интегрированы, но вся политика replay ещё не подтверждена. Диагностический `interleave` прогон sequential benchmark показывает, что нельзя выводить обобщённый retention из единственного набора задач.

## Исправление проверки

- Переход от немедленного assert внутри вложенного цикла к накоплению нарушений с `strategy`, `seed`, `newAfter`, `oldBefore`, `oldAfter`, replay/collision счётчиками.
- Перед финальным assert печатать `P26_REPLAY_POLICY_SWEEP_DIAGNOSTIC` с каждым прогоном и сводкой.
- Оставить неизменными ограничения: каждую policy проверять на `newAfter > 0.60`, а для контекстно разделённых задач запрещать непредусмотренную блокировку конфликтов.
- После обнаружения конкретной стратегии исправлять runtime schedule/feature conflict screening, а не ослаблять порог.

## Граница подтверждения

Изменение делает сбой измеримым, но само по себе не исправляет политику replay. PASS требует нулевых diagnostic violations, полного `test:learning-replay`, `test:rebuild-recovered`, runtime typecheck и точного Actions SHA. Синтетический benchmark остаётся диагностикой, не независимым внешним proof of generalization.

