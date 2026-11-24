# B301 → B302: следующий крупный этап

## Приоритет 1 — долговременная экономика исполнения
Не расширять число подсистем. Сначала создать bounded execution budget для длинной автономии: периодические maintenance/replay windows, контролируемая частота тяжёлых world-model операций, прогноз RSS и безопасный degradation path.

**Простыми словами:** организм должен уметь жить дольше, не раздувая память и не ускоряя износ телефона.

## Приоритет 2 — long-horizon autonomy
Нужен отдельный core-level benchmark на 100–300 циклов, который не зависит от проблемного socket/stdio cleanup текущего runtime harness, но сохраняет реальные OrganismCore observe/act pathways.

**Простыми словами:** проверить, меняется ли поведение через сотни шагов, а не только через несколько десятков.

## Приоритет 3 — causal consolidation
Связать B296 plasticity, B299 personality outcomes и world-model consequences в более явный credit-assignment на длинной дистанции.

## Не делать пока
Не добавлять ещё один «consciousness», «personality» или «neural» класс без доказанного архитектурного места. Проект уже имеет достаточно модулей; теперь важнее закрыть verification debt и long-horizon behaviour.
