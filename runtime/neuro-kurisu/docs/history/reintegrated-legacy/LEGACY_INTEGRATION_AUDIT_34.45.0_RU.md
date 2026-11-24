# Legacy integration audit — 34.45.0

Источник: исходный большой архив 34.2.0 и текущая canonical-ветка 34.45.0.

## Решение

Полный legacy runtime не возвращается: он содержит несколько конкурирующих когнитивных ядер и старую React/service архитектуру. Возвращаются только активы и идеи, которые дают реальную пользовательскую или диагностическую ценность без второго источника истины.

## Что интегрировано

- Полный комплект Live2D Kurisu: model3, moc3, texture 4096, physics, cdi3, expressions и motions.
- Lightweight embodiment verification endpoint и dashboard.
- Идеи старого Memory Inspector перенесены как read-only `MemoryOS2.inspectRecent()` + `/api/organism/memory-inspector`.
- Voice Controls функционально покрываются текущими `AndroidEmbodimentBridge` + `/api/organism/voice/*`; старый React-компонент не нужен.
- Termux doctor/runbook идеи покрываются текущими `docs/TERMUX_ZERO_TO_RUN_POCO_RU.md`, `TERMUX_SESSION_CONTINUITY_RU.md` и scripts/termux.

## Что осталось reference

Старые UI-компоненты, сервисы и research-документы не удалены из исторического знания проекта, но не подключены в runtime. Это предотвращает раздвоение ownership.

## Что сознательно не переносится

Старые `NeuroComputationalCore`, `UnifiedNeuroOrganism`, `RecurrentNeuroCore`, Specialist Swarm, старые memory engines и React/Vite application shell. Их возврат создал бы параллельный организм вместо усиления текущего.

## Полный реестр

- Файлов legacy: **1348**
- Интегрировано: **19**
- Reference: **943**
- Excluded-runtime: **386**

Полный path-by-path реестр находится в `LEGACY_COMPONENT_CLASSIFICATION_34.45.0.json`.
