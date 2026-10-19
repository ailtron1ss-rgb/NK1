# P39 — Continuous Artificial Life Mega Pack

## Практический эффект
P39 переводит Neuro-Kurisu от режима «долгоживущий агент» к единому lifecycle-контурy. Организм отслеживает течение собственного времени, непрерывность сессий, sleep debt, recovery, maintenance debt, resource stress и host lineage. Состояние lifecycle реально влияет на выбор действий: при восстановительной необходимости усиливается `rest`, а при maintenance debt — `defer`.

## Что реализовано
- persistent life clock с `birthAt`, `lastTickAt`, `lifeTicks` и длительностями active/sleep;
- continuity-gap detection для длительных пауз;
- sleep debt и recovery dynamics;
- lifecycle phases: `wake`, `active`, `wind-down`, `sleep`, `recovering`, `maintenance`;
- host/device lineage и перенос между host идентификаторами;
- maintenance accounting и bounded lifecycle event log;
- resource stress signals для battery/thermal/storage pressure;
- persistence в `facets.learning.p39`;
- migration 41→42;
- server API `/api/organism/life` и `/api/organism/life/host`;
- integration/performance/regression tests.

## Почему это не декоративный модуль
Lifecycle state не ограничивается dashboard. `actionBias()` реально входит в action utility ranking. Переходы sleep/wake и host transfer меняют persisted state. Maintenance и recovery также сохраняются.

## Ограничения
P39 не является биологической жизнью. Он не доказывает наличие субъективного времени, чувства усталости или сознательного опыта. Для реальной artificial life hypothesis нужны длительные внешние эксперименты, физическое тело/host и независимая longitudinal evaluation.
