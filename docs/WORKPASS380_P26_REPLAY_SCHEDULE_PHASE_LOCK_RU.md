# WorkPass380 — устранение фазовой привязки replay к текущим примерам

**Дата:** 2026-10-26  
**Ветка:** workpass375-hexis-canonical-ingress-latest  
**Код на момент документа:** предшествующий HEAD 90cd552f1ffd42dbe6c4911a0288e95f236741f8  
**Статус:** код и регрессия внесены; exact-head P26/WorkPass71 должны подтвердить результат.

## Диагностическое свидетельство

WorkPass369 P26 Learning Validation провалился ровно на одной комбинации: `interleave-1`, seed 17. Её метрики: old task `oldBefore=0.93`, `oldAfter=0.93`; new task `newAfter=0.52`; `replayUpdates=5040`; `blockedReplayRows=0`. Порог `newAfter > 0.60` сработал, несмотря на то что replay обучался до свежего примера. Это опровергает гипотезу, что простой порядок `replay → current` достаточно решает interference.

## Причина в расписании

При одинаково упорядоченных current/replay пакетах старый код выбирал `candidateIndex = i % replay.length`. При `replayEveryNCurrent=1` одна и та же позиция текущего ряда постоянно сталкивалась со старым рядом той же позиции. На этих синтетических наборах их reward противоположен, а конфликтный фильтр не блокировал примеры из-за различия контекстных признаков. В результате возникал устойчивый индексный градиентный contest.

## Исправление

- Добавить deterministic coprime stride (GCD=1) по replay-буферу, чтобы на каждом проходе выбрать другую позицию и пройти всю выборку без короткого повторяющегося цикла.
- Поворачивать offset между вызовами по уже существующему canonical online-update counter; не вводить второй persistable state owner.
- Сохранить bounded conflict screening, `maxReplayUpdates`, preflight и rollback semantics.
- Добавить contract regression: каждая replay-строка в тестовой партии не совпадает по energy/index с соответствующим current row; current update остаётся последним в слоте; второй batch начинается с другой replay-позиции.

## Критерии закрытия

- `test:p26:interleaved-contract` проходит.
- `test:p26:sequential-benchmark` и `test:p26:replay-policy-sweep` проходят с неизменными порогами.
- P26 Learning Validation и WorkPass71 полный runtime/rebuild проходят на одном и том же exact HEAD.
- Не подменять synthetic score независимым доказательством generalization/real-world uplift.

